'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  ChevronLeft,
  Plus,
  ReceiptText,
  Lock,
  Hash,
  Wallet,
  Eye,
  Loader2,
  Trash2,
  MapPin,
  Pencil,
  ShieldCheck,
  CreditCard,
  Layers,
  Database,
  UserCircle2
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type InvoiceItem, type InvoiceNumber } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardData } from '../../layout';

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const editInvoiceId = searchParams.get('editInvoiceId');
  const invoiceNumberIdParam = searchParams.get('invoiceNumberId');
  
  // Consuming Cached Data for speed
  const { customers: allCustomers, products: masterProducts } = useDashboardData();

  // --- DATA FETCHING ---
  const identityRef = useMemoFirebase(() => {
      if (!firestore || !invoiceNumberIdParam) return null;
      return doc(firestore, 'invoiceNumbers', invoiceNumberIdParam);
  }, [firestore, invoiceNumberIdParam]);
  const { data: identityData, isLoading: isIdentityLoading } = useDoc<InvoiceNumber>(identityRef);

  const existingInvoiceRef = useMemoFirebase(() => {
      if (!firestore || !editInvoiceId) return null;
      return doc(firestore, 'invoices', editInvoiceId);
  }, [firestore, editInvoiceId]);
  const { data: existingInvoiceData, isLoading: isExistingLoading } = useDoc<Invoice>(existingInvoiceRef);

  const activeIdentity = existingInvoiceData || identityData;

  // Master Data Pull
  const soHeadersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSalesOrders } = useCollection<SalesOrder>(soHeadersCollection);

  const activeSoData = useMemo(() => {
    if (!allSalesOrders || !activeIdentity?.salesOrder) return null;
    return allSalesOrders.find(so => so.soNumber === activeIdentity.salesOrder);
  }, [allSalesOrders, activeIdentity?.salesOrder]);

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  // --- FORM STATES ---
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [billingAddress, setBillingAddress] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [manualVaNumber, setManualVaNumber] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);

  // QUICK EDIT STATES
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<'name' | 'address'>('name');
  const [tempName, setTempName] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [updateMaster, setUpdateMaster] = useState(true);

  // --- CUSTOMER DATA SYNC ---
  const currentCustomer = useMemo(() => {
    if (!activeIdentity?.customer || !allCustomers) return null;
    return allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
  }, [activeIdentity?.customer, allCustomers]);

  // AUTO-POPULATE VA & ADDRESS FROM CUSTOMER PROFILE (Reactive)
  useEffect(() => {
    if (currentCustomer && !editInvoiceId) {
        if (!manualVaNumber) setManualVaNumber(currentCustomer.virtualAccountNumber || '');
        if (!billingAddress) {
            const defAddr = currentCustomer.addresses?.find(a => a.isDefault) || currentCustomer.addresses?.[0];
            if (defAddr) setBillingAddress(defAddr.address);
        }
    }
  }, [currentCustomer, manualVaNumber, billingAddress, editInvoiceId]);

  // CRITICAL: Pull Data from SO to items
  useEffect(() => {
      if (activeIdentity && items.length === 0) {
          if (activeIdentity.items && activeIdentity.items.length > 0) {
             setItems(activeIdentity.items);
          } else if (activeSoData && !editInvoiceId) {
             setItems(activeSoData.items.map((item, idx) => ({
                 id: item.id || `so-${idx}`,
                 name: item.productName,
                 quantity: item.quantity,
                 unit: item.unit || 'Meter',
                 price: item.price,
                 total: item.total,
                 originalPrice: item.price,
                 originalQty: item.quantity
             })));
             if (activeSoData.customerAddress) setBillingAddress(activeSoData.customerAddress);
          }

          if (activeIdentity.billingAddress && !billingAddress) setBillingAddress(activeIdentity.billingAddress);
          setIsDpInvoice(!!(activeIdentity as Invoice).isDpInvoice);
          setNegotiationValue(formatNumberWithCommas((activeIdentity as Invoice).negotiation || 0));
          setDpValue(formatNumberWithCommas((activeIdentity as Invoice).dpValue || 0));
          setDpDeductionValue(formatNumberWithCommas((activeIdentity as Invoice).dpDeduction || 0));
          setRetentionValue(formatNumberWithCommas((activeIdentity as Invoice).retention || 0));
          
          if ((activeIdentity as Invoice).vaNumber) {
              setManualVaNumber((activeIdentity as Invoice).vaNumber!);
          }
      }
  }, [activeIdentity, activeSoData, editInvoiceId, items.length]);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  const [negotiationValue, setNegotiationValue] = useState<string>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'| any>('nominal');
  const [dpValue, setDpValue] = useState<string>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'| any>('percent');
  const [retentionValue, setRetentionValue] = useState<string>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'| any>('nominal');
  const [dpDeductionValue, setDpDeductionValue] = useState<string>('');
  const [dpDeductionMode, setDpDeductionMode] = useState<'percent' | 'nominal'| any>('nominal');
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string>('0');
  const [vat12, setVat12] = useState<string>('0');
  const [totalAmount, setTotalAmount] = useState<string>('0');

  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    setSubtotal(currentSubtotal);
    
    const negInputVal = parseFormattedNumber(negotiationValue);
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;
    const baseAfterNeg = Math.max(0, currentSubtotal - negNominal);
    
    const dpInputVal = parseFormattedNumber(dpValue);
    const dpNominal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;
    
    const retInputVal = parseFormattedNumber(retentionValue);
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;
    
    const dpDedInputVal = parseFormattedNumber(dpDeductionValue);
    const dpDedNominal = dpDeductionMode === 'percent' ? (baseAfterNeg * (dpDedInputVal / 100)) : dpDedInputVal;

    if (!isTaxManual) {
        const calculatedDpp = baseAfterNeg;
        const calculatedVat = calculatedDpp * 0.12;
        setDppVat(formatNumberWithCommas(calculatedDpp));
        setVat12(formatNumberWithCommas(calculatedVat));
    }
    
    const currentDpp = parseFormattedNumber(dppVat);
    const currentVat = parseFormattedNumber(vat12);
    
    let grand = isDpInvoice ? dpNominal : (currentDpp + currentVat - dpDedNominal - retNominal);
    grand = Math.max(0, grand);
    setTotalAmount(formatNumberWithCommas(grand));
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, dpDeductionValue, dpDeductionMode, isTaxManual, dppVat, vat12, isDpInvoice]);

  const handleNumericChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') { setter(''); return; }
    const cleanValue = value.replace(/[^\d.,]/g, '');
    const num = parseFormattedNumber(cleanValue);
    if (!isNaN(num)) {
        let formatted = formatNumberWithCommas(num);
        if (value.endsWith(',') || value.endsWith('.')) {
            if (!formatted.includes(',')) formatted += ',';
        }
        setter(formatted);
    }
  };

  const removeItem = (id: string | number) => {
      setItems(items.filter(it => it.id !== id));
      toast({ title: "Baris Item Dihapus" });
  };

  const handleQuickEditSave = async () => {
    if (!firestore || !user || !currentCustomer) return;
    if (editTarget === 'name') {
        if (updateMaster) {
            await setDoc(doc(firestore, 'customers', currentCustomer.id!), { name: tempName }, { merge: true });
            toast({ title: "Master Data Updated" });
        }
    } else {
        if (updateMaster) {
            const currentAddresses = currentCustomer.addresses || [];
            const updatedAddresses = currentAddresses.map(a => a.address === billingAddress ? { ...a, address: tempAddress } : a);
            await setDoc(doc(firestore, 'customers', currentCustomer.id!), { addresses: updatedAddresses }, { merge: true });
            toast({ title: "Master Address Updated" });
        }
        setBillingAddress(tempAddress);
    }
    setIsQuickEditOpen(false);
  };

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;

    const grandTotalNumeric = parseFormattedNumber(totalAmount);
    setIsSaving(true);
    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    const dataToSave: any = {
        id: activeIdentity.id,
        soNumber: activeIdentity.salesOrder || '',
        poNumber: activeIdentity.poNumber || '',
        customer: activeIdentity.customer,
        customerCode: currentCustomer?.customerCode || '',
        billingAddress: billingAddress,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: grandTotalNumeric,
        status: invoiceStatus,
        isDpInvoice: isDpInvoice,
        negotiation: parseFormattedNumber(negotiationValue),
        dpValue: parseFormattedNumber(dpValue),
        dpDeduction: parseFormattedNumber(dpDeductionValue),
        retention: parseFormattedNumber(retentionValue),
        vaNumber: manualVaNumber,
        items: items,
        lastUpdatedAt: timestamp,
        lastUpdatedBy: updater,
        revisionLogs: arrayUnion({
            updatedBy: updater,
            updatedAt: timestamp,
            action: editInvoiceId ? "Document UPDATED" : "Document CREATED"
        })
    };

    setDoc(invoiceDocRef, dataToSave, { merge: true })
        .then(() => {
            toast({ title: "Invoice Berhasil Disimpan" });
            if (redirectToPreview) {
                router.push(`/dashboard/invoices/preview/${encodeURIComponent(activeIdentity.id)}`);
            } else {
                router.push('/dashboard/invoices');
            }
        })
        .catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: invoiceDocRef.path, operation: 'write', requestResourceData: dataToSave
            }));
        })
        .finally(() => setIsSaving(false));
  };

  if (isIdentityLoading || isExistingLoading) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Syncing Constructor...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-[1600px] mx-auto bg-background animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 border-slate-200">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-xl font-black tracking-tight uppercase text-slate-900">Invoice Constructor</h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Ref PO: {activeIdentity?.poNumber}</span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase bg-indigo-50 border-slate-200 text-slate-500 h-4">
                        <Lock className="h-2.5 w-2.5 mr-1" /> Financial Secure
                    </Badge>
                </div>
            </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-8">
          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                    <ReceiptText className="h-4 w-4 text-indigo-600" /> Identitas Penagihan
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid gap-8 md:grid-cols-3">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Invoice</Label>
                      <div className="flex items-center gap-2 bg-indigo-50/30 px-4 py-2.5 rounded-xl border-2 border-indigo-100/50">
                          <Hash className="h-4 w-4 text-indigo-600" />
                          <span className="font-black text-indigo-700 text-sm tracking-tight">{activeIdentity?.id || 'N/A'}</span>
                      </div>
                  </div>

                  <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Customer</Label>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditTarget('name'); setTempName(activeIdentity?.customer || ''); setIsQuickEditOpen(true); }}><Pencil className="h-3 w-3 text-indigo-600" /></Button>
                      </div>
                      <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase truncate text-slate-700 flex justify-between items-center">
                          {activeIdentity?.customer}
                          {currentCustomer?.customerCode && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 rounded">{currentCustomer.customerCode}</span>}
                      </div>
                      {currentCustomer?.contactPerson && (
                          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 mt-1">
                              <UserCircle2 className="h-3 w-3" /> {currentCustomer.contactPerson}
                          </div>
                      )}
                  </div>

                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Mandiri Virtual Account
                      </Label>
                      <div className="relative group">
                          <Input 
                            value={manualVaNumber} 
                            onChange={e => setManualVaNumber(e.target.value)} 
                            className="h-10 font-mono font-black text-xs border-emerald-100 bg-emerald-50/10 focus-visible:ring-emerald-500 rounded-xl"
                            placeholder="Tarik dari Profil..."
                            disabled={isLocked}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {manualVaNumber.length === 16 ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Badge variant="outline" className="text-[7px] h-3 px-1">SYNC</Badge>}
                          </div>
                      </div>
                  </div>

                  <div className="md:col-span-3 space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Alamat Penagihan Spesifik
                        </Label>
                        <div className="flex gap-2">
                             {currentCustomer?.addresses?.map(addr => (
                                 <Badge 
                                    key={addr.id} 
                                    variant="outline" 
                                    className={cn("text-[8px] uppercase cursor-pointer hover:bg-indigo-50 transition-all font-black", billingAddress === addr.address ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400")}
                                    onClick={() => setBillingAddress(addr.address)}
                                 >
                                    {addr.label}
                                 </Badge>
                             ))}
                             <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => { setEditTarget('address'); setTempAddress(billingAddress); setIsQuickEditOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-5 rounded-2xl border-2 border-slate-100 shadow-inner">
                             <p className="text-[11px] leading-snug font-medium text-slate-700 italic">
                                 {billingAddress || 'Pilih alamat dari daftar di atas.'}
                             </p>
                      </div>
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 border-b py-4 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-tighter">Line Items Constructor</CardTitle>
                <Badge 
                    variant={isDpInvoice ? "default" : "outline"} 
                    className={cn("text-[9px] uppercase cursor-pointer py-1.5 px-4 font-black tracking-widest transition-all", isDpInvoice ? "bg-indigo-600" : "text-indigo-600 border-indigo-200")} 
                    onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}
                >
                    {isDpInvoice ? "DP Mode" : "Regular Billing"}
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-4 px-6">Deskripsi Barang</TableHead>
                            <TableHead className="w-[120px] text-center text-[10px] font-black uppercase">Qty</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Satuan</TableHead>
                            <TableHead className="w-[160px] text-right text-[10px] font-black uppercase">Harga Satuan (IDR)</TableHead>
                            <TableHead className="w-[160px] text-right text-[10px] font-black uppercase">Total</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic font-black opacity-30 tracking-widest">Belum ada item yang ditarik.</TableCell></TableRow>
                        ) : items.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="px-6">
                                        <Input 
                                            value={item.name} 
                                            onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                            className="h-9 text-xs font-bold border-dashed shadow-none bg-transparent"
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="text"
                                            value={formatNumberWithCommas(item.quantity)} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                            }} 
                                            className="text-center text-xs h-9 font-black rounded-lg border-indigo-100 bg-indigo-50/10" 
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={item.unit} 
                                            onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))}
                                            className="text-center text-[10px] h-9 font-bold border-none uppercase text-slate-400"
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="text"
                                            value={formatNumberWithCommas(item.price)} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, price: val, total: it.quantity * val } : it));
                                            }}
                                            className="h-9 text-right text-xs font-black border-dashed rounded-lg"
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-black text-xs px-2">Rp {formatNumberWithCommas(item.total)}</TableCell>
                                    <TableCell className="px-4">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full" onClick={() => removeItem(item.id)} disabled={isLocked}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
                
                <div className="p-6 bg-slate-50/50 border-t flex flex-wrap gap-3">
                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10 text-[10px] font-black uppercase text-indigo-600 rounded-xl px-6 border-slate-200 shadow-sm" disabled={isLocked}>
                                <Plus className="mr-2 h-3.5 w-3.5" /> Tambah dari Katalog Master
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 shadow-2xl border-none ring-1 ring-slate-200" align="start">
                            <Command>
                                <CommandInput placeholder="Cari di database produk..." className="h-12" />
                                <CommandList>
                                    <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                        {masterProducts?.map((p) => (
                                            <CommandItem
                                                key={p.id}
                                                value={`${p.name}|${p.id}`}
                                                onSelect={() => {
                                                    const newItem: InvoiceItem = { id: `manual-${Date.now()}`, name: p.name, quantity: 1, unit: p.unit || 'Meter', price: p.price, total: p.price };
                                                    setItems([...items, newItem]);
                                                    setProductPopoverOpen(false);
                                                }}
                                                className="p-4 border-b last:border-0"
                                            >
                                                <div className="flex justify-between w-full">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 uppercase text-xs">{p.name}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{p.unit || 'Meter'}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Rp {p.price.toLocaleString()}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8 sticky top-24">
          <Card className="shadow-lg border-none ring-1 ring-indigo-100 bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-indigo-50/20 py-5 px-8 border-b border-indigo-50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Financial Audit Matrix</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Subtotal Bruto</span>
                    <span className="font-black text-slate-900">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-amber-600">Potongan Negosiasi</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-amber-50 text-amber-700 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={handleNumericChange(setNegotiationValue)} className="h-10 text-right font-black text-amber-600 border-amber-100 rounded-xl bg-amber-50/10" placeholder="0" disabled={isLocked} />
                </div>

                {isDpInvoice ? (
                    <div className="space-y-2 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[10px] font-black uppercase text-indigo-700">Down Payment (DP)</Label>
                            <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-indigo-100 text-indigo-700 rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpValue} onChange={handleNumericChange(setDpValue)} className="h-10 text-right font-black border-indigo-200 rounded-xl bg-white" placeholder="0" disabled={isLocked} />
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100 border-dashed">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5" /> Potongan Saldo DP
                                </Label>
                                <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isLocked}>
                                    <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-emerald-100 text-emerald-700 rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input value={dpDeductionValue} onChange={handleNumericChange(setDpDeductionValue)} className="h-10 text-right font-black border-emerald-200 text-emerald-700 rounded-xl bg-white" placeholder="0" disabled={isLocked} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Potongan Retensi</Label>
                                <Select value={retentionMode} onValueChange={(v: any) => setRetentionMode(v)} disabled={isLocked}>
                                    <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-slate-100 text-slate-700 rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input value={retentionValue} onChange={handleNumericChange(setRetentionValue)} className="h-10 text-right font-black border-slate-200 rounded-xl bg-slate-50/20" placeholder="0" disabled={isLocked} />
                        </div>
                    </>
                )}
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Sinkronisasi PPN (12%)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-4">
                    <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">Nilai DPP</span> <Input value={dppVat} onChange={handleNumericChange(setDppVat)} disabled={!isTaxManual || isLocked} className="h-7 w-36 text-right font-mono text-xs font-black bg-transparent border-none p-0 focus-visible:ring-0" /></div>
                    <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">PPN Terutang</span> <Input value={vat12} onChange={handleNumericChange(setVat12)} disabled={!isTaxManual || isLocked} className="h-7 w-36 text-right font-mono text-xs font-black bg-transparent border-none p-0 focus-visible:ring-0" /></div>
                </div>
              </div>

              <div className="pt-4 border-t-4 border-indigo-600/10">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Total Tagihan Akhir</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 leading-none tracking-tighter">Rp {totalAmount}</div>
              </div>

              <div className="space-y-4 pt-4">
                  {!isLocked && (
                    <div className="grid gap-3">
                      <Button 
                          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-white shadow-xl shadow-indigo-100 rounded-2xl transition-all hover:-translate-y-1 active:translate-y-0" 
                          onClick={() => handleSaveInvoice('sent', true)}
                          disabled={isProcessing}
                      >
                          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Eye className="mr-2 h-5 w-5" /> SIMPAN & PREVIEW</>}
                      </Button>

                      <Button 
                          variant="ghost" 
                          className="w-full h-12 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 rounded-2xl tracking-widest" 
                          onClick={() => handleSaveInvoice('sent')}
                          disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : "Hanya Simpan"}
                      </Button>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isQuickEditOpen} onOpenChange={setIsQuickEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle className="uppercase font-black tracking-tight">Koreksi Data Master</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase text-slate-400">Pembaruan ini dapat disimpan ke database permanen.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                  {editTarget === 'name' ? (
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase">Nama PT Resmi</Label>
                          <Input value={tempName} onChange={e => setTempName(e.target.value)} className="font-black uppercase h-12 bg-slate-50 border-slate-200" />
                      </div>
                  ) : (
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase">Alamat Penagihan</Label>
                          <textarea 
                             className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs min-h-[100px] font-medium italic focus:ring-1 focus:ring-indigo-600 outline-none"
                             value={tempAddress}
                             onChange={e => setTempAddress(e.target.value)}
                          />
                      </div>
                  )}

                  <div className="flex items-center space-x-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <Checkbox id="update-master" checked={updateMaster} onCheckedChange={(c) => setUpdateMaster(!!c)} />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="update-master" className="text-[10px] font-black uppercase text-indigo-700 cursor-pointer">Simpan Perubahan ke Database Master</Label>
                        <p className="text-[9px] text-indigo-400 font-medium">Memastikan data di profil pelanggan tetap akurat.</p>
                      </div>
                  </div>
              </div>
              <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
                  <Button variant="ghost" onClick={() => setIsQuickEditOpen(false)}>Batal</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase px-8" onClick={handleQuickEditSave}>Simpan</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </main>
  );
}