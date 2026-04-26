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

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const editInvoiceId = searchParams.get('editInvoiceId');
  const invoiceNumberIdParam = searchParams.get('invoiceNumberId');
  
  // --- DATA FETCHING (REAL-TIME CLOUD ONLY) ---
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

  // AUDIT FIX: Stable identity source
  const activeIdentity = existingInvoiceData || identityData;

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  const soItemsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSoItems } = useCollection<SalesOrder>(soItemsCollection);

  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const vaCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'virtualAccounts')) : null, [firestore]);
  const { data: allVas } = useCollection<VirtualAccount>(vaCollection);

  const productsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
  const { data: masterProducts } = useCollection<ProductListItem>(productsCollection);

  // --- FORM STATES ---
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingNpwp, setBillingNpwp] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [isOverBillingAllowed, setIsOverBillingAllowed] = useState(false);
  const [selectedVaId, setSelectedVaId] = useState<string>('manual');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  const [negotiationValue, setNegotiationValue] = useState<string | number>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpValue, setDpValue] = useState<string | number>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('nominal');
  const [retentionValue, setRetentionValue] = useState<string | number>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpDeductionValue, setDpDeductionValue] = useState<string | number>('');
  const [dpDeductionMode, setDpDeductionMode] = useState<'percent' | 'nominal'>('nominal');
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  const dpBalance = useMemo(() => {
    if (!allInvoices || !activeIdentity) return 0;
    const currentPo = activeIdentity.poNumber;
    
    const totalDpInvoiced = allInvoices
        .filter(inv => inv.poNumber === currentPo && inv.isDpInvoice && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + inv.amount, 0);
    
    const totalDpUsed = allInvoices
        .filter(inv => inv.poNumber === currentPo && !inv.isDpInvoice && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.dpDeduction || 0), 0);

    return Math.max(0, totalDpInvoiced - totalDpUsed);
  }, [allInvoices, activeIdentity]);

  const availableVas = useMemo(() => {
    if (!allVas || !activeIdentity) return [];
    return allVas.filter(va => va.customerName === activeIdentity.customer);
  }, [allVas, activeIdentity]);

  // AUDIT FIX: Strict Database Dependency (No Reset to 0001)
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
          setIsOverBillingAllowed(!!(activeIdentity as Invoice).isOverBillingAllowed);
          setNegotiationValue((activeIdentity as Invoice).negotiation || 0);
          setDpValue((activeIdentity as Invoice).dpValue || 0);
          setDpDeductionValue((activeIdentity as Invoice).dpDeduction || 0);
          setRetentionValue((activeIdentity as Invoice).retention || 0);
          if ((activeIdentity as Invoice).paymentMethod) setSelectedVaId((activeIdentity as Invoice).paymentMethod!);
          if (activeIdentity.erpInvoiceId) setInternalNote(activeIdentity.erpInvoiceId);
      }
  }, [activeIdentity, allSoItems, allInvoices, editInvoiceId]);

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

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;

    setIsSaving(true);
    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    let actionDescription = editInvoiceId ? "Document UPDATED" : "Document CREATED";
    
    const dataToSave: any = {
        id: activeIdentity.id,
        erpInvoiceId: internalNote,
        soNumber: activeIdentity.salesOrder || (activeIdentity as any).soNumber || '',
        poNumber: activeIdentity.poNumber || '',
        customer: activeIdentity.customer,
        billingAddress: billingAddress,
        billingNpwp: billingNpwp,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: parseFormattedNumber(String(totalAmount)),
        status: invoiceStatus,
        isDpInvoice: isDpInvoice,
        isOverBillingAllowed: isOverBillingAllowed,
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
            action: actionDescription
        })
    };

    setDoc(invoiceDocRef, dataToSave, { merge: true })
        .then(() => {
            toast({ title: "Invoice Berhasil Disimpan" });
            if (redirectToPreview) {
                const previewData = {
                  id: activeIdentity.id,
                  erpInvoiceId: internalNote,
                  items: items.map((it, idx) => ({ ...it, no: idx + 1 })),
                  customer: { name: activeIdentity.customer, address: billingAddress, npwp: billingNpwp },
                  date: format(issueDate, 'yyyy-MM-dd'),
                  soNumber: activeIdentity.salesOrder || (activeIdentity as any).soNumber || '',
                  poNumber: activeIdentity.poNumber || '',
                  grandTotal: parseFormattedNumber(String(totalAmount)),
                  subtotal: subtotal,
                  dppVat: parseFormattedNumber(String(dppVat)),
                  vat12: parseFormattedNumber(String(vat12)),
                  paymentTerms: '30 Days',
                  printType: 'original',
                  negotiation: parseFormattedNumber(String(negotiationValue)),
                  dpValue: isDpInvoice ? parseFormattedNumber(String(dpValue)) : (parseFormattedNumber(String(dpDeductionValue)) + parseFormattedNumber(String(retentionValue))),
                  virtualAccount: selectedVaId !== 'manual' ? availableVas.find(v => v.id === selectedVaId) : undefined
                };
                sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
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

  const isLoading = (invoiceNumberIdParam && isIdentityLoading) || (editInvoiceId && isExistingLoading);

  if (isLoading || (!activeIdentity && (invoiceNumberIdParam || editInvoiceId))) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Architectural Handshake...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;

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
                    Stage 3: Persistence Verified <Badge variant="secondary" className="text-[8px] bg-indigo-50 text-indigo-600 h-3.5"><Lock className="h-2 w-2 mr-1" /> Data Locked</Badge>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {isAdmin && !isDpInvoice && (
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 shadow-sm">
                    <Label className="text-[10px] font-black uppercase text-amber-700 tracking-widest flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Over-Billing
                    </Label>
                    <Switch checked={isOverBillingAllowed} onCheckedChange={setIsOverBillingAllowed} disabled={isLocked} />
                </div>
            )}
            <Badge 
                variant={isDpInvoice ? "default" : "outline"} 
                className={cn("text-[9px] uppercase cursor-pointer py-1.5 px-4", isDpInvoice ? "bg-indigo-600" : "text-indigo-600 border-indigo-200")} 
                onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}
            >
                {isDpInvoice ? "Down Payment" : "Progress Billing"}
            </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        <div className="lg:col-span-5 space-y-6">
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
                      <Label className="text-[9px] font-black uppercase text-slate-400">PO / SO Reference</Label>
                      <div className="bg-slate-50 px-3 py-2 rounded-md border border-slate-200 text-xs font-mono font-bold truncate">
                          {activeIdentity?.poNumber} {(activeIdentity as any)?.salesOrder && `• ${(activeIdentity as any).salesOrder}`}
                      </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Billing Address & NPWP</Label>
                      <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="font-medium h-9 text-xs" placeholder="Alamat..." disabled={isLocked} />
                      <Input value={billingNpwp} onChange={e => setBillingNpwp(e.target.value)} className="font-mono text-[10px] mt-2 h-8 bg-slate-50" placeholder="NPWP..." disabled={isLocked} />
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">System Note</Label>
                      <Input value={internalNote} onChange={e => setInternalNote(e.target.value)} className="font-mono text-[10px] h-9" placeholder="Note..." disabled={isLocked} />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm ring-1 ring-slate-200", isLocked && "opacity-60", isDpInvoice && "opacity-40 grayscale pointer-events-none")}>
            <CardHeader className="bg-slate-50/50 border-b py-4">
                <CardTitle className="text-sm font-black uppercase text-slate-800">Variance Report & Item Tracking</CardTitle>
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic text-xs uppercase font-black">Belum ada item.</TableCell></TableRow>
                        ) : items.map(item => {
                            const totalBillQty = item.quantity + (item.prevInvoicedQty || 0);
                            const isOverInvoiced = totalBillQty > (item.originalQty || 0);
                            return (
                                <TableRow key={item.id} className={cn("transition-colors", isOverInvoiced && !isOverBillingAllowed && "bg-red-50/50")}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 py-2">
                                            <Input 
                                                value={item.name} 
                                                onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                                className="h-7 text-[11px] font-bold border-dashed"
                                                disabled={isLocked || !isAdmin}
                                            />
                                            <span className="text-[8px] font-black uppercase text-slate-400">Kontrak PO: {item.originalQty} {item.unit}</span>
                                            {(isOverInvoiced || item.price !== item.originalPrice) && (
                                                <Input 
                                                    value={item.varianceReason} 
                                                    onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, varianceReason: e.target.value } : it))}
                                                    className="h-6 text-[10px] bg-indigo-50/30 border-indigo-100 italic"
                                                    placeholder="Alasan Variansi..."
                                                />
                                            )}
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
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="p-4 bg-slate-50/30 border-t">
                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="border-dashed h-8 text-[9px] font-black uppercase text-indigo-600" disabled={isLocked}>
                                <Plus className="mr-2 h-3 w-3" /> Tambah Baris Manual
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 shadow-2xl" align="start">
                            <Command>
                                <CommandInput placeholder="Cari Produk..." className="h-10" />
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
        </div>

        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className="shadow-md ring-1 ring-indigo-100 bg-white">
            <CardHeader className="bg-indigo-50/20 py-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Kalkulasi</CardTitle>
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
                        <Label className="text-[9px] font-black uppercase text-indigo-700">Tagihan DP</Label>
                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-black border-indigo-200" placeholder="0" disabled={isLocked} />
                    </div>
                ) : (
                    <div className="space-y-2 bg-emerald-50/20 p-3 rounded-xl border border-emerald-100">
                        <Label className="text-[9px] font-black uppercase text-emerald-700 flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> Potongan Saldo DP
                        </Label>
                        <Input value={dpDeductionValue} onChange={e => setDpDeductionValue(e.target.value)} className="h-8 text-right font-black border-emerald-200 text-emerald-700" placeholder="0" disabled={isLocked} />
                        <div className="flex items-center justify-between text-[8px] font-bold text-emerald-600 mt-1 uppercase">
                            <span>Sisa Saldo DP:</span>
                            <span>Rp {formatNumberWithCommas(dpBalance)}</span>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Retention / Guarantee</Label>
                    <Input value={retentionValue} onChange={e => setRetentionValue(e.target.value)} className="h-8 text-right font-black border-slate-200" placeholder="0" disabled={isLocked} />
                </div>
              </div>

              <div className="bg-blue-50/30 p-4 rounded-xl space-y-4 border border-blue-100">
                  <Label className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Payment & VA
                  </Label>
                  <Select value={selectedVaId} onValueChange={setSelectedVaId} disabled={isLocked}>
                      <SelectTrigger className="h-9 text-xs font-bold bg-white">
                          <SelectValue placeholder="Akun Pembayaran..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="manual">Standard Mandiri/BCA</SelectItem>
                          {availableVas.map(va => (
                              <SelectItem key={va.id} value={va.id!}>{va.bankName} - {va.vaNumber}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase text-indigo-600">Tax Override (VAT)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-2">
                    <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual || isLocked} className="h-7 text-right font-mono text-xs font-black bg-transparent" />
                    <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual || isLocked} className="h-7 text-right font-mono text-xs font-black bg-transparent" />
                </div>
              </div>

              <div className="pt-2 border-t-2 border-indigo-600/10">
                  <span className="text-[9px] font-black uppercase text-slate-400">Grand Total</span>
                  <div className="text-2xl font-black text-slate-900 leading-none mt-1 tracking-tight">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                      <>
                        <Button 
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-white shadow-lg" 
                            onClick={() => handleSaveInvoice('sent', true)}
                            disabled={isProcessing}
                        >
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-2 h-4 w-4" /> SIMPAN & PREVIEW</>}
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="w-full text-[10px] font-black uppercase text-slate-400" 
                            onClick={() => handleSaveInvoice('sent')}
                            disabled={isProcessing}
                        >
                          {isProcessing ? "Processing..." : "Hanya Simpan (Draft)"}
                        </Button>
                      </>
                  )}
                  {isAdmin && (existingInvoiceData?.status === 'sent' || existingInvoiceData?.status === 'draft') && (
                      <Button 
                        variant="outline" 
                        className="w-full h-11 border-indigo-600 text-indigo-600 font-black uppercase text-[10px]" 
                        onClick={() => handleSaveInvoice('finalized')}
                        disabled={isProcessing}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" /> FINALIZE & LOCK
                      </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}