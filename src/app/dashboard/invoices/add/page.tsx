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
  Send,
  ShieldCheck,
  ReceiptText,
  Lock,
  Hash,
  AlertCircle,
  TrendingUp,
  Wallet,
  Scale,
  RefreshCw,
  AlertTriangle,
  History,
  Tag,
  MessageSquare
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type Customer, type InvoiceItem, type InvoiceNumber } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

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

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  const soItemsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSoItems } = useCollection<SalesOrder>(soItemsCollection);

  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  // --- FORM STATES ---
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingNpwp, setBillingNpwp] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [isOverBillingAllowed, setIsOverBillingAllowed] = useState(false);

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
    if (!allInvoices || !identityData) return 0;
    const currentPo = identityData.poNumber;
    
    const totalDpInvoiced = allInvoices
        .filter(inv => inv.poNumber === currentPo && inv.isDpInvoice && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + inv.amount, 0);
    
    const totalDpUsed = allInvoices
        .filter(inv => inv.poNumber === currentPo && !inv.isDpInvoice && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.dpDeduction || 0), 0);

    return Math.max(0, totalDpInvoiced - totalDpUsed);
  }, [allInvoices, identityData]);

  // RELAXED REDIRECT: Ensure we only redirect if we've explicitly finished loading and have no data
  useEffect(() => {
      const isInitialLoad = (invoiceNumberIdParam && isIdentityLoading) || (editInvoiceId && isExistingLoading);
      if (!isInitialLoad && !identityData && !existingInvoiceData && !editInvoiceId && !invoiceNumberIdParam) {
          router.replace('/dashboard/invoices/number');
      }
  }, [identityData, existingInvoiceData, isIdentityLoading, isExistingLoading, editInvoiceId, invoiceNumberIdParam, router]);

  useEffect(() => {
      if (identityData && customerListData && items.length === 0 && !editInvoiceId) {
          const cust = customerListData.find(c => c.name === identityData.customer);
          if (cust) {
              const defAddr = cust.addresses?.find(a => a.isDefault) || cust.addresses?.[0];
              setBillingAddress(defAddr?.address || '');
              setBillingNpwp(defAddr?.npwp || '');
          }

          if (allSoItems) {
              const relatedItems = allSoItems.filter(item => item.soNumber === identityData.salesOrder);
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
      } else if (existingInvoiceData && items.length === 0) {
          setItems(existingInvoiceData.items || []);
          setBillingAddress(existingInvoiceData.billingAddress || '');
          setBillingNpwp(existingInvoiceData.billingNpwp || '');
          setIsDpInvoice(!!existingInvoiceData.isDpInvoice);
          setIsOverBillingAllowed(!!existingInvoiceData.isOverBillingAllowed);
          setNegotiationValue(existingInvoiceData.negotiation || 0);
          setDpValue(existingInvoiceData.dpValue || 0);
          setDpDeductionValue(existingInvoiceData.dpDeduction || 0);
          setRetentionValue(existingInvoiceData.retention || 0);
      }
  }, [identityData, customerListData, allSoItems, editInvoiceId, allInvoices, existingInvoiceData]);

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
    
    if (dpDedNominal > dpBalance && !isDpInvoice && dpBalance > 0) {
        setDpDeductionValue(0);
        toast({ variant: "destructive", title: "Limit Saldo DP", description: "Potongan melebihi saldo DP yang tersedia." });
    }

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
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, dpDeductionValue, dpDeductionMode, isTaxManual, dppVat, vat12, isDpInvoice, dpBalance, toast]);

  const handleSaveInvoice = async (invoiceStatus: any = 'sent') => {
    const activeIdentity = existingInvoiceData || identityData;
    if (!firestore || !user || !activeIdentity) return;

    // VALIDATION: Variance Reasons
    const needsReason = items.some(item => 
        (item.quantity + (item.prevInvoicedQty || 0)) !== (item.originalQty || 0) || 
        item.price !== item.originalPrice || 
        item.name !== item.originalName
    );

    if (needsReason && items.some(i => !i.varianceReason && ((i.quantity + (i.prevInvoicedQty || 0)) !== (i.originalQty || 0) || i.price !== i.originalPrice))) {
        toast({ variant: "destructive", title: "Audit Alert", description: "Wajib mengisi 'Alasan Variansi' untuk setiap perubahan item." });
        return;
    }

    const hasVariance = items.some(item => (item.quantity + (item.prevInvoicedQty || 0)) > (item.originalQty || 0));
    if (hasVariance && !isOverBillingAllowed) {
        toast({ variant: "destructive", title: "Persetujuan Diperlukan", description: "Terdapat item melebihi kuota PO. Aktifkan 'Allow Over-Billing' (Otoritas Leader)." });
        return;
    }

    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    let actionDescription = editInvoiceId ? "Document UPDATED" : "Document CREATED";
    
    items.forEach(item => {
        if (item.name !== item.originalName) {
            actionDescription += ` | Name Change: [${item.originalName}] -> [${item.name}]`;
        }
        if (item.price !== item.originalPrice) {
            actionDescription += ` | Price Adj: Rp${item.originalPrice?.toLocaleString()} -> Rp${item.price.toLocaleString()}`;
        }
    });

    if (isOverBillingAllowed) actionDescription += " | OVER-BILLING APPROVED";

    const dataToSave: any = {
        id: activeIdentity.id,
        erpInvoiceId: internalNote,
        soNumber: activeIdentity.soNumber || (activeIdentity as any).salesOrder,
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
            router.push('/dashboard/invoices');
        })
        .catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: invoiceDocRef.path, operation: 'write', requestResourceData: dataToSave
            }));
        });
  };

  const activeIdentity = existingInvoiceData || identityData;
  const isLoading = (invoiceNumberIdParam && isIdentityLoading) || (editInvoiceId && isExistingLoading);

  if (isLoading || (!activeIdentity && (invoiceNumberIdParam || editInvoiceId))) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Architectural Handshake in Progress...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full border-slate-200">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-slate-50">Invoice Constructor</h1>
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    Stage 3: Variance Analytics Enabled <Badge variant="secondary" className="text-[8px] bg-indigo-50 text-indigo-600 h-3.5"><Lock className="h-2 w-2 mr-1" /> Data Persistent</Badge>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {isAdmin && !isDpInvoice && (
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 shadow-sm">
                    <Label className="text-[10px] font-black uppercase text-amber-700 tracking-widest flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Allow Over-Billing
                    </Label>
                    <Switch checked={isOverBillingAllowed} onCheckedChange={setIsOverBillingAllowed} disabled={isLocked} />
                </div>
            )}
            <div className="flex items-center gap-3 bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50">
                <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Mode Penagihan:</Label>
                    <Badge 
                        variant={isDpInvoice ? "default" : "outline"} 
                        className={cn("text-[9px] uppercase cursor-pointer transition-all", isDpInvoice ? "bg-indigo-600 shadow-md text-white" : "text-indigo-600 border-indigo-200")} 
                        onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}
                    >
                    {isDpInvoice ? "Down Payment (DP)" : "Tagihan Barang / Progres"}
                    </Badge>
                </div>
            </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        <div className="lg:col-span-5 space-y-6">
          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b py-3">
                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-400 tracking-widest">
                    <ReceiptText className="h-4 w-4" /> Identitas Penagihan (Locked Context)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Invoice Number</Label>
                      <div className="flex items-center gap-2 bg-indigo-50/30 px-3 py-2 rounded-md border-2 border-indigo-100/50 shadow-sm">
                          <Hash className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="font-black text-indigo-600">{activeIdentity?.id || 'N/A'}</span>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Customer Profile</Label>
                      <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-md border border-slate-200 text-xs font-black uppercase truncate">{activeIdentity?.customer}</div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Ref PO / SO Hub</Label>
                      <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-md border border-slate-200 text-xs font-mono font-bold truncate">
                          {activeIdentity?.poNumber} {((activeIdentity as any).salesOrder || activeIdentity?.soNumber) && `• ${(activeIdentity as any).salesOrder || activeIdentity?.soNumber}`}
                      </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Billing Address & NPWP</Label>
                      <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="font-medium h-9 text-xs" placeholder="Alamat lengkap..." disabled={isLocked} />
                      <Input value={billingNpwp} onChange={e => setBillingNpwp(e.target.value)} className="font-mono text-[10px] mt-2 h-8 bg-slate-50 dark:bg-slate-800 text-slate-500" placeholder="NPWP..." disabled={isLocked} />
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Internal System Note</Label>
                      <Input 
                        value={internalNote} 
                        onChange={e => setInternalNote(e.target.value)} 
                        className="font-mono text-[10px] h-9" 
                        placeholder="Catatan pelacakan..." 
                        disabled={isLocked}
                      />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900", isLocked && "opacity-60", isDpInvoice && "opacity-40 grayscale pointer-events-none")}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b py-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">Variance Report & Item Tracking</CardTitle>
                    {isDpInvoice && <Badge variant="secondary" className="text-[8px] uppercase">Disabled in DP Mode</Badge>}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-2 text-slate-400 tracking-widest">Detail Item & Alasan Variansi</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase py-2 text-slate-400 tracking-widest">Now Billing</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase py-2 text-slate-400 tracking-widest">Prev. Invoiced</TableHead>
                            <TableHead className="w-[120px] text-right text-[10px] font-black uppercase py-2 text-slate-400 tracking-widest">Unit Price</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2 text-slate-400 tracking-widest">Total (IDR)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic text-xs uppercase font-black tracking-widest opacity-30">Belum ada item terdeteksi.</TableCell></TableRow>
                        ) : items.map(item => {
                            const totalBillQty = item.quantity + (item.prevInvoicedQty || 0);
                            const isOverInvoiced = totalBillQty > (item.originalQty || 0);
                            const isUnderInvoiced = totalBillQty < (item.originalQty || 0) && item.quantity > 0;
                            const isPriceChanged = item.price !== item.originalPrice;
                            const isNameChanged = item.name !== item.originalName;
                            const hasVariance = isOverInvoiced || isUnderInvoiced || isPriceChanged || isNameChanged;

                            return (
                                <TableRow key={item.id} className={cn("border-b-slate-100 dark:border-b-slate-800 transition-colors", isOverInvoiced && !isOverBillingAllowed && "bg-red-50/50")}>
                                    <TableCell>
                                        <div className="flex flex-col gap-2 py-2">
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    value={item.name} 
                                                    onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                                    className={cn("h-7 text-[11px] font-bold shadow-none bg-transparent border-dashed", isNameChanged ? "border-indigo-300 text-indigo-700" : "border-transparent hover:border-slate-200")}
                                                    disabled={isLocked || !isAdmin}
                                                />
                                                {isNameChanged && <Tag className="h-3 w-3 text-indigo-400" />}
                                            </div>
                                            <div className="flex items-center gap-3 px-3">
                                                <span className="text-[8px] font-black uppercase text-slate-400">Kontrak PO: {item.originalQty} {item.unit}</span>
                                                {isNameChanged && <span className="text-[8px] font-bold text-slate-400 italic">PO Ref: {item.originalName}</span>}
                                            </div>
                                            
                                            {hasVariance && (
                                                <div className="px-3 space-y-1">
                                                    <div className="flex items-center gap-1.5 text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                                                        <MessageSquare className="h-2.5 w-2.5" /> Alasan Variansi (Wajib Audit):
                                                    </div>
                                                    <Input 
                                                        value={item.varianceReason} 
                                                        onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, varianceReason: e.target.value } : it))}
                                                        className="h-6 text-[10px] bg-indigo-50/30 border-indigo-100 italic placeholder:text-slate-300"
                                                        placeholder="Contoh: Over-delivery atas permintaan proyek / Penyesuaian harga pasar..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Input 
                                                value={item.quantity} 
                                                onChange={e => {
                                                    const val = parseFormattedNumber(e.target.value);
                                                    setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                                }} 
                                                className={cn("text-center text-xs h-8 font-black shadow-none", isOverInvoiced && !isOverBillingAllowed ? "border-red-500 ring-1 ring-red-200" : "border-slate-200")} 
                                                disabled={isLocked}
                                            />
                                            {isOverInvoiced && (
                                                <div className="text-[8px] font-black text-red-600 text-center uppercase">Variance +{Math.max(0, totalBillQty - (item.originalQty || 0))}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-slate-400">{item.prevInvoicedQty || 0}</span>
                                            <Badge variant="outline" className="text-[7px] h-3 uppercase font-bold text-emerald-600 border-emerald-200 bg-emerald-50/30">
                                                Sisa: {Math.max(0, (item.originalQty || 0) - totalBillQty)}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Input 
                                                value={item.price} 
                                                onChange={e => {
                                                    const val = parseFormattedNumber(e.target.value);
                                                    setItems(items.map(it => it.id === item.id ? { ...it, price: val, total: it.quantity * val } : it));
                                                }}
                                                className={cn("h-8 text-right text-xs font-black shadow-none bg-transparent border-dashed", isPriceChanged ? "border-amber-300 text-amber-700" : "border-transparent")}
                                                disabled={isLocked || !isAdmin}
                                            />
                                            {isPriceChanged && (
                                                <div className="text-[7px] font-bold text-slate-400 text-right italic">PO: Rp{item.originalPrice?.toLocaleString()}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-xs text-slate-900 dark:text-slate-100">Rp {formatNumberWithCommas(item.total)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="p-4 bg-slate-50/30 border-t flex justify-between items-center">
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: Date.now().toString(), name: 'Item Baru', quantity: 0, unit: 'm', price: 0, total: 0, originalName: 'Manual Entry', originalPrice: 0, originalQty: 0, varianceReason: 'Manual addition' }])} className="border-dashed h-8 text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700" disabled={isLocked}>
                        <Plus className="mr-2 h-3 w-3" /> Tambah Baris Manual
                    </Button>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 italic uppercase tracking-widest opacity-50">
                        <Scale className="h-3 w-3" /> Financial Audit Ready
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className={cn("shadow-md border-none ring-1 ring-indigo-100 dark:ring-indigo-900/50 bg-white dark:bg-slate-900", isLocked && "opacity-80")}>
            <CardHeader className="bg-indigo-50/20 dark:bg-indigo-900/10 py-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase flex items-center justify-between tracking-widest text-slate-400">
                    Audit Kalkulasi
                    {(existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid') && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-black uppercase tracking-widest">Gross Subtotal</span>
                    <span className="font-black text-slate-900 dark:text-slate-50">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label className="text-[9px] font-black uppercase text-amber-600 tracking-tighter">Negotiation / Adjustment</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase shadow-none border-none bg-amber-50 text-amber-700"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-black text-amber-600 border-amber-100 bg-amber-50/20 shadow-none" placeholder="0" disabled={isLocked} />
                </div>

                {isDpInvoice ? (
                    <div className="space-y-1.5 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100 shadow-inner">
                        <div className="flex justify-between items-center">
                            <Label className="text-[9px] font-black uppercase text-indigo-700 tracking-tighter">Tagihan Down Payment</Label>
                            <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-black border-indigo-200 bg-white dark:bg-slate-900" placeholder="0" disabled={isLocked} />
                    </div>
                ) : (
                    <div className="space-y-2 bg-emerald-50/20 p-3 rounded-xl border border-emerald-100 shadow-inner">
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter flex items-center gap-1">
                                <Wallet className="h-3 w-3" /> Potongan Saldo DP
                            </Label>
                            <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpDeductionValue} onChange={e => setDpDeductionValue(e.target.value)} className="h-8 text-right font-black border-emerald-200 text-emerald-700 bg-white dark:bg-slate-900" placeholder="0" disabled={isLocked} />
                        <div className="flex items-center justify-between text-[8px] font-bold text-emerald-600 mt-1 uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5" /> Sisa Saldo DP:</span>
                            <span>Rp {formatNumberWithCommas(dpBalance)}</span>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Retention (Guarantee)</Label>
                        <Select value={retentionMode} onValueChange={(v: any) => setRetentionMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase bg-slate-50"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={retentionValue} onChange={e => setRetentionValue(e.target.value)} className="h-8 text-right font-black border-slate-200" placeholder="0" disabled={isLocked} />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Manual Tax Override (VAT)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-3">
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">DPP (Dasar Pengenaan Pajak)</span>
                        <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual || isLocked} className="h-8 text-right font-mono text-xs font-black bg-transparent border-slate-200" />
                    </div>
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">PPN (12% Rate)</span>
                        <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual || isLocked} className="h-8 text-right font-mono text-xs font-black bg-transparent border-slate-200" />
                    </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-indigo-600/10">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Grand Total Billing</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mt-1 tracking-tight">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                      <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase shadow-lg text-white tracking-widest" onClick={() => handleSaveInvoice('sent')}>
                        <Send className="mr-2 h-4 w-4" /> SIMPAN & TERBITKAN
                      </Button>
                  )}
                  {isAdmin && existingInvoiceData?.status !== 'finalized' && existingInvoiceData?.status !== 'paid' && (
                      <Button variant="outline" className="w-full h-11 border-indigo-600 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50" onClick={() => handleSaveInvoice('finalized')}>
                        <ShieldCheck className="mr-2 h-4 w-4" /> FINALIZE & LOCK ARCHIVE
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
