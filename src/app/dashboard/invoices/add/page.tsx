'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Separator } from '@/components/ui/separator';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  ChevronLeft,
  Plus,
  ShieldCheck,
  ReceiptText,
  Lock,
  Hash,
  Wallet,
  Scale,
  RefreshCw,
  Tag,
  MessageSquare,
  CreditCard,
  Eye,
  Loader2,
  Info,
  History,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  FileCheck,
  Trash2,
  ListChecks,
  ArrowRight,
  CopyPlus,
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type Customer, type InvoiceItem, type InvoiceNumber, type VirtualAccount, type ProductListItem } from '@/app/lib/data';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const editInvoiceId = searchParams.get('editInvoiceId');
  const invoiceNumberIdParam = searchParams.get('invoiceNumberId');
  
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

  const isLoading = (invoiceNumberIdParam && isIdentityLoading) || (editInvoiceId && isExistingLoading);

  // --- COLLECTIONS FOR HISTORY & SYNC ---
  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const soItemsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSoItems } = useCollection<SalesOrder>(soItemsCollection);

  const productsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
  const { data: masterProducts } = useCollection<ProductListItem>(productsCollection);

  const vaCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'virtualAccounts')) : null, [firestore]);
  const { data: allVas } = useCollection<VirtualAccount>(vaCollection);

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  // --- LOGIKA "THE GOLDEN KEY" (PO HISTORY) ---
  const poBillingHistory = useMemo(() => {
    if (!allInvoices || !activeIdentity) return [];
    return allInvoices.filter(inv => 
        inv.poNumber === activeIdentity.poNumber && 
        inv.id !== activeIdentity.id &&
        inv.status !== 'cancelled'
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [allInvoices, activeIdentity]);

  const billedItemsHistory = useMemo(() => {
      if (!poBillingHistory) return [];
      return poBillingHistory.flatMap(inv => (inv.items || []).map(it => ({ ...it, parentInvoice: inv.id, date: inv.date })));
  }, [poBillingHistory]);

  const dpInvoicedBalance = useMemo(() => {
    if (!poBillingHistory) return 0;
    
    const totalDpInvoiced = poBillingHistory
        .filter(inv => inv.isDpInvoice)
        .reduce((sum, inv) => sum + inv.amount, 0);
    
    const totalDpUsed = poBillingHistory
        .filter(inv => !inv.isDpInvoice)
        .reduce((sum, inv) => sum + (inv.dpDeduction || 0), 0);

    return Math.max(0, totalDpInvoiced - totalDpUsed);
  }, [poBillingHistory]);

  const totalPoValue = useMemo(() => {
    if (!allSoItems || !activeIdentity) return 0;
    return allSoItems
        .filter(so => so.poNumber === activeIdentity.poNumber)
        .reduce((sum, so) => sum + (so.quantity * so.price), 0);
  }, [allSoItems, activeIdentity]);

  const totalInvoicedSoFar = useMemo(() => {
    return poBillingHistory.reduce((sum, inv) => sum + inv.amount, 0);
  }, [poBillingHistory]);

  const remainingPoBalance = Math.max(0, totalPoValue - totalInvoicedSoFar);

  // --- FORM STATES ---
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingNpwp, setBillingNpwp] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [selectedVaId, setSelectedVaId] = useState<string>('manual');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  const [negotiationValue, setNegotiationValue] = useState<string | number>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpValue, setDpValue] = useState<string | number>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('percent');
  const [retentionValue, setRetentionValue] = useState<string | number>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpDeductionValue, setDpDeductionValue] = useState<string | number>('');
  const [dpDeductionMode, setDpDeductionMode] = useState<'percent' | 'nominal'>('nominal');
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  // Initial Sync from Identity or Existing Data
  useEffect(() => {
      if (activeIdentity && items.length === 0) {
          if (activeIdentity.items && activeIdentity.items.length > 0) {
             setItems(activeIdentity.items);
          } else if (allSoItems && !editInvoiceId) {
              const relatedItems = allSoItems.filter(item => item.soNumber === activeIdentity.salesOrder);
              setItems(relatedItems.map((item, idx) => {
                  const prevQty = allInvoices?.filter(inv => inv.soNumber === item.soNumber && inv.status !== 'cancelled')
                                  .reduce((sum, inv) => {
                                      const matchingItem = inv.items?.find(i => i.id === item.id || i.name === item.productName);
                                      return sum + (matchingItem?.quantity || 0);
                                  }, 0) || 0;

                  return {
                      id: item.id || idx.toString(),
                      name: item.productName,
                      originalName: item.productName,
                      quantity: Math.max(0, item.quantity - prevQty),
                      originalQty: item.quantity,
                      unit: item.unit,
                      price: item.price,
                      originalPrice: item.price,
                      total: Math.max(0, (item.quantity - prevQty) * item.price),
                      prevInvoicedQty: prevQty,
                      varianceQty: 0,
                      varianceReason: ''
                  };
              }));
          }

          setBillingAddress(activeIdentity.billingAddress || '');
          setBillingNpwp(activeIdentity.billingNpwp || '');
          setIsDpInvoice(!!(activeIdentity as Invoice).isDpInvoice);
          setNegotiationValue((activeIdentity as Invoice).negotiation || 0);
          setDpValue((activeIdentity as Invoice).dpValue || 0);
          setDpDeductionValue((activeIdentity as Invoice).dpDeduction || 0);
          setRetentionValue((activeIdentity as Invoice).retention || 0);
          if ((activeIdentity as Invoice).paymentMethod) setSelectedVaId((activeIdentity as Invoice).paymentMethod!);
          if (activeIdentity.erpInvoiceId) setInternalNote(activeIdentity.erpInvoiceId);

          if (!editInvoiceId && !(activeIdentity as Invoice).isDpInvoice && dpInvoicedBalance > 0) {
              setDpDeductionValue(formatNumberWithCommas(dpInvoicedBalance));
          }
      }
  }, [activeIdentity, allSoItems, allInvoices, editInvoiceId, items.length, dpInvoicedBalance]);

  // Dynamic Calculations
  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    setSubtotal(currentSubtotal);
    
    const negInputVal = parseFormattedNumber(String(negotiationValue));
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;
    const baseAfterNeg = Math.max(0, currentSubtotal - negNominal);
    
    const dpInputVal = parseFormattedNumber(String(dpValue));
    const dpNominal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;
    
    const retInputVal = parseFormattedNumber(String(retentionValue));
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;
    
    const dpDedInputVal = parseFormattedNumber(String(dpDeductionValue));
    const dpDedNominal = dpDeductionMode === 'percent' ? (baseAfterNeg * (dpDedInputVal / 100)) : dpDedInputVal;

    if (!isTaxManual) {
        const calculatedDpp = baseAfterNeg;
        const calculatedVat = calculatedDpp * 0.12;
        setDppVat(formatNumberWithCommas(calculatedDpp));
        setVat12(formatNumberWithCommas(calculatedVat));
    }
    
    const currentDpp = parseFormattedNumber(String(dppVat));
    const currentVat = parseFormattedNumber(String(vat12));
    
    let grand = isDpInvoice ? dpNominal : (currentDpp + currentVat - dpDedNominal - retNominal);
    grand = Math.max(0, grand);
    setTotalAmount(formatNumberWithCommas(grand));
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, dpDeductionValue, dpDeductionMode, isTaxManual, dppVat, vat12, isDpInvoice]);

  const handleProductSelect = (product: ProductListItem) => {
      const newItem: InvoiceItem = {
          id: `manual-${Date.now()}`,
          name: product.name,
          originalName: 'Manual Addition',
          quantity: 1,
          originalQty: 0,
          unit: product.unit,
          price: product.price,
          originalPrice: 0,
          total: product.price,
          varianceReason: 'Additional charge from master catalog'
      };
      setItems([...items, newItem]);
      setProductPopoverOpen(false);
  };

  const handleCopyFromHistory = (histItem: any) => {
      const newItem: InvoiceItem = {
          id: `history-copy-${Date.now()}`,
          name: histItem.name,
          originalName: histItem.name,
          quantity: 1,
          originalQty: 0,
          unit: histItem.unit,
          price: histItem.price,
          originalPrice: histItem.price,
          total: histItem.price,
          varianceReason: `Copied from prev. Invoice ${histItem.parentInvoice}`
      };
      setItems([...items, newItem]);
      toast({ 
        title: "Item Disalin", 
        description: `${histItem.name} berhasil ditambahkan ke tabel input.` 
      });
  };

  const removeItem = (id: string | number) => {
      setItems(items.filter(it => it.id !== id));
      toast({ title: "Baris Item Dihapus", description: "Kalkulasi total telah disesuaikan." });
  };

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;

    // PROTECTION: Exceeds PO validation
    const grandTotalNumeric = parseFormattedNumber(String(totalAmount));
    const totalWithNewInvoice = grandTotalNumeric + totalInvoicedSoFar;
    if (totalWithNewInvoice > (totalPoValue + 0.01)) {
        toast({ 
            variant: "destructive", 
            title: "Pencegahan Over-Billing", 
            description: "Nilai tagihan saat ini melebihi sisa plafon PO. Mohon periksa kembali kuantitas atau nominal." 
        });
        return;
    }

    setIsSaving(true);
    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    const dataToSave: any = {
        id: activeIdentity.id,
        erpInvoiceId: internalNote,
        soNumber: activeIdentity.salesOrder || '',
        poNumber: activeIdentity.poNumber || '',
        customer: activeIdentity.customer,
        billingAddress: billingAddress,
        billingNpwp: billingNpwp,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: grandTotalNumeric,
        status: invoiceStatus,
        isDpInvoice: isDpInvoice,
        negotiation: parseFormattedNumber(String(negotiationValue)),
        dpValue: parseFormattedNumber(String(dpValue)),
        dpDeduction: parseFormattedNumber(String(dpDeductionValue)),
        retention: parseFormattedNumber(String(retentionValue)),
        paymentMethod: selectedVaId,
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

  if (isLoading) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Architectural Handshake...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;
  const grandTotalNumeric = parseFormattedNumber(String(totalAmount));
  const isExceedingPo = (grandTotalNumeric + totalInvoicedSoFar) > (totalPoValue + 0.01); // 0.01 tolerance for floats

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Invoice Constructor</h1>
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    Parent PO: {activeIdentity?.poNumber} <Badge variant="secondary" className="text-[8px] bg-indigo-50 text-indigo-600 h-3.5"><Lock className="h-2 w-2 mr-1" /> Data Locked</Badge>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                      variant={isDpInvoice ? "default" : "outline"} 
                      className={cn("text-[9px] uppercase cursor-pointer py-1.5 px-4", isDpInvoice ? "bg-indigo-600" : "text-indigo-600 border-indigo-200")} 
                      onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}
                  >
                      {isDpInvoice ? "Down Payment" : "Progress Billing"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-slate-900 text-white p-3">
                    <p className="text-xs">
                        {isDpInvoice 
                            ? "Down Payment: Tagihan uang muka di awal proyek." 
                            : "Progress Billing: Penagihan bertahap berdasarkan persentase penyelesaian pekerjaan atau termin yang telah disepakati di Sales Order."}
                    </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Main Form Section */}
        <div className="lg:col-span-8 space-y-6">
          <Card className={cn("shadow-sm ring-1 ring-slate-200", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 border-b py-3">
                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-400">
                    <ReceiptText className="h-4 w-4" /> Identitas Penagihan
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Invoice Number</Label>
                      <div className="flex items-center gap-2 bg-indigo-50/30 px-3 py-2 rounded-md border-2 border-indigo-100/50">
                          <Hash className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="font-black text-indigo-600">{activeIdentity?.id || 'N/A'}</span>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Customer</Label>
                      <div className="bg-slate-50 px-3 py-2 rounded-md border border-slate-200 text-xs font-black uppercase truncate">{activeIdentity?.customer}</div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Ref PO / ERP Hub</Label>
                      <div className="bg-slate-50 px-3 py-2 rounded-md border border-slate-200 text-xs font-mono font-bold truncate">
                          {activeIdentity?.poNumber}
                      </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Billing Address & NPWP</Label>
                      <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="font-medium h-9 text-xs" placeholder="Alamat..." disabled={isLocked} />
                      <Input value={billingNpwp} onChange={e => setBillingNpwp(e.target.value)} className="font-mono text-[10px] mt-2 h-8 bg-slate-50" placeholder="NPWP..." disabled={isLocked} />
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">ERP Sync Reference (Manual)</Label>
                      <Input value={internalNote} onChange={e => setInternalNote(e.target.value)} className="font-mono text-[10px] h-9" placeholder="Internal Ref..." disabled={isLocked} />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm ring-1 ring-slate-200", isLocked && "opacity-60", isDpInvoice && "opacity-40 grayscale pointer-events-none")}>
            <CardHeader className="bg-slate-50/50 border-b py-4">
                <CardTitle className="text-sm font-black uppercase text-slate-800">Item Tracking (Input Aktif)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-2">Item Detail</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase py-2">Now Bill</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase py-2">Prev. Bill</TableHead>
                            <TableHead className="w-[120px] text-right text-[10px] font-black uppercase py-2">Unit Price</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Total (IDR)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400 italic text-xs uppercase font-black">Belum ada item ditarik.</TableCell></TableRow>
                        ) : items.map(item => {
                            const totalBillQty = item.quantity + (item.prevInvoicedQty || 0);
                            return (
                                <TableRow key={item.id} className="transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col gap-1 py-2">
                                            <Input 
                                                value={item.name} 
                                                onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                                className="h-7 text-[11px] font-bold border-dashed"
                                                disabled={isLocked || !isAdmin}
                                            />
                                            <span className="text-[8px] font-black uppercase text-slate-400">Kontrak PO: {item.originalQty} {item.unit}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={item.quantity} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                            }} 
                                            className="text-center text-xs h-8 font-black" 
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center font-black text-[10px] text-slate-400">{item.prevInvoicedQty || 0}</TableCell>
                                    <TableCell>
                                        <Input 
                                            value={item.price} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, price: val, total: it.quantity * val } : it));
                                            }}
                                            className="h-8 text-right text-xs font-black border-dashed"
                                            disabled={isLocked || !isAdmin}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-black text-xs">Rp {formatNumberWithCommas(item.total)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeItem(item.id)} disabled={isLocked}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="p-4 bg-slate-50/30 border-t">
                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="border-dashed h-8 text-[9px] font-black uppercase text-indigo-600" disabled={isLocked}>
                                <Plus className="mr-2 h-3 w-3" /> Tambah Baris Manual (Master Catalog)
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 shadow-2xl" align="start">
                            <Command>
                                <CommandInput placeholder="Cari Produk di Master Database..." className="h-10" />
                                <CommandList>
                                    <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                        {masterProducts?.map((p) => (
                                            <CommandItem
                                                key={p.id}
                                                value={`${p.name}|${p.id}`}
                                                onSelect={() => handleProductSelect(p)}
                                                className="p-3 border-b"
                                            >
                                                <div className="flex justify-between w-full">
                                                    <span className="font-bold text-slate-800 uppercase text-xs">{p.name}</span>
                                                    <span className="text-[10px] font-black text-indigo-600">Rp {p.price.toLocaleString()}</span>
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

          {/* ITEM HISTORY AUDIT TRAIL - QUICK TRANSFER ENABLED */}
          {billedItemsHistory.length > 0 && (
              <Card className="shadow-sm ring-1 ring-slate-200 border-none overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-indigo-600">
                        <History className="h-4 w-4" /> Riwayat Item Terbit (Quick-Transfer)
                    </CardTitle>
                    <Badge className="text-[8px] bg-indigo-50 text-indigo-700 font-bold uppercase">Klik Baris untuk Menyalin ke Input Aktif</Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-100/50">
                            <TableRow>
                                <TableHead className="text-[9px] font-bold uppercase py-2">Invoice #</TableHead>
                                <TableHead className="text-[9px] font-bold uppercase py-2">Nama Barang (Lama)</TableHead>
                                <TableHead className="text-center text-[9px] font-bold uppercase py-2">Qty Terbit</TableHead>
                                <TableHead className="text-right text-[9px] font-bold uppercase py-2">Unit Price</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {billedItemsHistory.map((h, i) => (
                                <TableRow 
                                    key={i} 
                                    className="hover:bg-indigo-50/50 cursor-pointer group transition-colors"
                                    onClick={() => !isLocked && handleCopyFromHistory(h)}
                                >
                                    <TableCell className="text-[9px] font-black text-slate-400">{h.parentInvoice}</TableCell>
                                    <TableCell className="text-[10px] font-bold text-slate-600 uppercase">{h.name}</TableCell>
                                    <TableCell className="text-center text-[10px] font-black">{h.quantity} {h.unit}</TableCell>
                                    <TableCell className="text-right text-[10px] font-mono">Rp {h.price.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                        <CopyPlus className="h-3 w-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
              </Card>
          )}
        </div>

        {/* Sidebar: Audit & Calculations */}
        <div className="lg:col-span-4 space-y-6">
          {/* PO BILLING LEDGER (RECORD TRACKING) */}
          <Card className="shadow-md ring-1 ring-slate-200 border-none overflow-hidden">
             <CardHeader className="bg-slate-900 text-white py-3">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                     <History className="h-3.5 w-3.5 text-indigo-400" /> PO Billing Ledger (Audit)
                 </CardTitle>
             </CardHeader>
             <CardContent className="p-4 space-y-4 bg-slate-50/50">
                 <div className="grid grid-cols-2 gap-3">
                     <div className="p-3 bg-white rounded-lg border shadow-sm">
                         <p className="text-[8px] font-black text-slate-400 uppercase">Total Nilai PO</p>
                         <p className="text-sm font-black text-slate-900">Rp {formatNumberWithCommas(totalPoValue)}</p>
                     </div>
                     <div className="p-3 bg-white rounded-lg border shadow-sm">
                         <p className="text-[8px] font-black text-slate-400 uppercase">Sudah Ditagih</p>
                         <p className="text-sm font-black text-indigo-600">Rp {formatNumberWithCommas(totalInvoicedSoFar)}</p>
                     </div>
                 </div>

                 <div className={cn(
                     "p-3 rounded-lg border-2 flex justify-between items-center",
                     remainingPoBalance > 0 ? "bg-indigo-50/50 border-indigo-100" : "bg-red-50 border-red-100"
                 )}>
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Sisa Plafon PO</p>
                        <p className={cn("text-xs font-black", remainingPoBalance > 0 ? "text-indigo-700" : "text-red-600")}>
                            Rp {formatNumberWithCommas(remainingPoBalance)}
                        </p>
                    </div>
                    <ListChecks className={cn("h-5 w-5", remainingPoBalance > 0 ? "text-indigo-400" : "text-red-400")} />
                 </div>

                 <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                         <ChevronRight className="h-3 w-3" /> Riwayat Transaksi PO
                     </p>
                     <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                         {poBillingHistory.length === 0 ? (
                             <p className="text-[10px] italic text-slate-400 py-4 text-center">First time billing for this PO.</p>
                         ) : poBillingHistory.map(inv => (
                             <div key={inv.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[10px] shadow-sm">
                                 <div className="flex flex-col">
                                     <span className="font-black text-indigo-700">{inv.id}</span>
                                     <span className="text-[8px] text-slate-400">{inv.date} • {inv.isDpInvoice ? 'DP' : 'Progress'}</span>
                                 </div>
                                 <span className="font-black">Rp {formatNumberWithCommas(inv.amount)}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 <Separator />

                 <div className={cn("p-3 rounded-lg border-2 border-dashed flex justify-between items-center", dpInvoicedBalance > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-200 opacity-50")}>
                     <div className="space-y-0.5">
                         <p className="text-[8px] font-black text-slate-400 uppercase">Saldo DP Tersedia (Pengurang)</p>
                         <p className="text-xs font-black text-emerald-700">Rp {formatNumberWithCommas(dpInvoicedBalance)}</p>
                     </div>
                     <Wallet className="h-5 w-5 text-emerald-500" />
                 </div>
             </CardContent>
          </Card>

          {/* CALCULATION CARD */}
          <Card className="shadow-lg ring-1 ring-indigo-100 bg-white">
            <CardHeader className="bg-indigo-50/20 py-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Calculation Audit</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-black uppercase">Gross Subtotal</span>
                    <span className="font-black text-slate-900">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label className="text-[9px] font-black uppercase text-amber-600">Negotiation</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-5 w-14 text-[8px] font-black shadow-none border-none bg-amber-50 text-amber-700"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-black text-amber-600 border-amber-100" placeholder="0" disabled={isLocked} />
                </div>

                {isDpInvoice ? (
                    <div className="space-y-1.5 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[9px] font-black uppercase text-indigo-700">Tagihan Down Payment (DP)</Label>
                            <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-5 w-14 text-[8px] font-black shadow-none border-none bg-indigo-100 text-indigo-700"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-black border-indigo-200" placeholder="0" disabled={isLocked} />
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 bg-emerald-50/20 p-3 rounded-xl border border-emerald-100">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[9px] font-black uppercase text-emerald-700 flex items-center gap-1">
                                    <Wallet className="h-3 w-3" /> Potongan Saldo DP (Child Sync)
                                </Label>
                                <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isLocked}>
                                    <SelectTrigger className="h-5 w-14 text-[8px] font-black shadow-none border-none bg-emerald-100 text-emerald-700"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input value={dpDeductionValue} onChange={e => setDpDeductionValue(e.target.value)} className="h-8 text-right font-black border-emerald-200 text-emerald-700" placeholder="0" disabled={isLocked} />
                            <div className="flex items-center justify-between text-[8px] font-bold text-emerald-600 mt-1 uppercase">
                                <span>Sisa Kuota DP:</span>
                                <span>Rp {formatNumberWithCommas(dpInvoicedBalance)}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Retention / Guarantee (Pengurang)</Label>
                                <Select value={retentionMode} onValueChange={(v: any) => setRetentionMode(v)} disabled={isLocked}>
                                    <SelectTrigger className="h-5 w-14 text-[8px] font-black shadow-none border-none bg-slate-100 text-slate-700"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input value={retentionValue} onChange={e => setRetentionValue(e.target.value)} className="h-8 text-right font-black border-slate-200" placeholder="0" disabled={isLocked} />
                        </div>
                    </>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase text-indigo-600">Tax Override (VAT 12%)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-2">
                    <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black uppercase text-slate-400">DPP</span> <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual || isLocked} className="h-6 w-32 text-right font-mono text-[10px] font-black bg-transparent border-none p-0" /></div>
                    <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black uppercase text-slate-400">PPN</span> <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual || isLocked} className="h-6 w-32 text-right font-mono text-[10px] font-black bg-transparent border-none p-0" /></div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-indigo-600/10">
                  <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase text-slate-400">Grand Total Net</span>
                      {isExceedingPo && (
                          <Badge className="text-[7px] bg-rose-600 animate-pulse h-3.5"><AlertTriangle className="h-2 w-2 mr-1" /> EXCEEDS PO</Badge>
                      )}
                  </div>
                  <div className="text-2xl font-black text-slate-900 leading-none mt-1 tracking-tight">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-white shadow-lg" 
                              onClick={() => handleSaveInvoice('sent', true)}
                              disabled={isProcessing}
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-2 h-4 w-4" /> SIMPAN & PREVIEW</>}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                          Preview tampilan PDF sebelum dikirim.
                        </TooltipContent>
                      </Tooltip>

                      <Button 
                          variant="ghost" 
                          className="w-full text-[10px] font-black uppercase text-slate-400" 
                          onClick={() => handleSaveInvoice('sent')}
                          disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : "Hanya Simpan (Draft)"}
                      </Button>
                    </TooltipProvider>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
