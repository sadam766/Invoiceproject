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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  ChevronLeft,
  Plus,
  ReceiptText,
  Lock,
  Hash,
  Wallet,
  Scale,
  History,
  Eye,
  Loader2,
  Trash2,
  ListChecks,
  CopyPlus,
  Search,
  Layers,
  MapPin,
  FileText,
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type InvoiceItem, type InvoiceNumber, type ProductListItem, type SalesListItem, type Customer } from '@/app/lib/data';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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

  // Single Source of Truth for PO Amount
  const saleRef = useMemoFirebase(() => {
    if (!firestore || !activeIdentity?.poNumber) return null;
    return doc(firestore, 'sales', activeIdentity.poNumber.replace(/\//g, '_'));
  }, [firestore, activeIdentity?.poNumber]);
  const { data: saleData } = useDoc<SalesListItem>(saleRef);

  const isLoading = (invoiceNumberIdParam && isIdentityLoading) || (editInvoiceId && isExistingLoading);

  // --- COLLECTIONS FOR HISTORY & SYNC ---
  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const soItemsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSoItems } = useCollection<SalesOrder>(soItemsCollection);

  const productsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
  const { data: masterProducts } = useCollection<ProductListItem>(productsCollection);

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: allCustomers } = useCollection<Customer>(customersCollection);

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  // --- FORM STATES ---
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingNpwp, setBillingNpwp] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [selectedVaId, setSelectedVaId] = useState<string>('manual');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

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

  const totalPoValue = saleData?.amount || 0;

  const totalInvoicedSoFar = useMemo(() => {
    return poBillingHistory.reduce((sum, inv) => sum + inv.amount, 0);
  }, [poBillingHistory]);

  const remainingPoBalance = Math.max(0, totalPoValue - totalInvoicedSoFar);

  // --- AUTO-PULL ADDRESS & NPWP LOGIC ---
  useEffect(() => {
    if (activeIdentity?.customer && allCustomers && !billingAddress && !editInvoiceId) {
      const foundCustomer = allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
      if (foundCustomer) {
        const defaultAddr = foundCustomer.addresses?.find(a => a.isDefault) || foundCustomer.addresses?.[0];
        if (defaultAddr) {
          setBillingAddress(defaultAddr.address);
          if (defaultAddr.npwp) setBillingNpwp(defaultAddr.npwp);
        }
      }
    }
  }, [activeIdentity, allCustomers, billingAddress, editInvoiceId]);

  // Initial Sync from Record
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

          if (activeIdentity.billingAddress) setBillingAddress(activeIdentity.billingAddress);
          if ((activeIdentity as Invoice).billingNpwp) setBillingNpwp((activeIdentity as Invoice).billingNpwp!);
          
          setIsDpInvoice(!!(activeIdentity as Invoice).isDpInvoice);
          setNegotiationValue(formatNumberWithCommas((activeIdentity as Invoice).negotiation || 0));
          setDpValue(formatNumberWithCommas((activeIdentity as Invoice).dpValue || 0));
          setDpDeductionValue(formatNumberWithCommas((activeIdentity as Invoice).dpDeduction || 0));
          setRetentionValue(formatNumberWithCommas((activeIdentity as Invoice).retention || 0));
          if ((activeIdentity as Invoice).paymentMethod) setSelectedVaId((activeIdentity as Invoice).paymentMethod!);

          if (!editInvoiceId && !(activeIdentity as Invoice).isDpInvoice && dpInvoicedBalance > 0) {
              setDpDeductionValue(formatNumberWithCommas(dpInvoicedBalance));
          }
      }
  }, [activeIdentity, allSoItems, allInvoices, editInvoiceId, items.length, dpInvoicedBalance]);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  const [negotiationValue, setNegotiationValue] = useState<string>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpValue, setDpValue] = useState<string>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('percent');
  const [retentionValue, setRetentionValue] = useState<string>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpDeductionValue, setDpDeductionValue] = useState<string>('');
  const [dpDeductionMode, setDpDeductionMode] = useState<'percent' | 'nominal'>('nominal');
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string>('0');
  const [vat12, setVat12] = useState<string>('0');
  const [totalAmount, setTotalAmount] = useState<string>('0');

  // Dynamic Calculations
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
      toast({ title: "Item Disalin" });
  };

  const removeItem = (id: string | number) => {
      setItems(items.filter(it => it.id !== id));
      toast({ title: "Baris Item Dihapus" });
  };

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;

    const grandTotalNumeric = parseFormattedNumber(totalAmount);
    const totalWithNewInvoice = grandTotalNumeric + totalInvoicedSoFar;
    if (totalWithNewInvoice > (totalPoValue + 100)) {
        toast({ 
            variant: "destructive", 
            title: "Pencegahan Kelebihan Tagih", 
            description: "Nilai tagihan saat ini melebihi sisa plafon PO." 
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
        negotiation: parseFormattedNumber(negotiationValue),
        dpValue: parseFormattedNumber(dpValue),
        dpDeduction: parseFormattedNumber(dpDeductionValue),
        retention: parseFormattedNumber(retentionValue),
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

  const filteredHistory = useMemo(() => {
      if (!billedItemsHistory) return [];
      if (!historySearch) return billedItemsHistory;
      return billedItemsHistory.filter(h => h.name.toLowerCase().includes(historySearch.toLowerCase()));
  }, [billedItemsHistory, historySearch]);

  if (isLoading) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Architectural Handshake...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;
  const grandTotalNumeric = parseFormattedNumber(totalAmount);
  const isExceedingPo = (grandTotalNumeric + totalInvoicedSoFar) > (totalPoValue + 100);

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
                        <Lock className="h-2.5 w-2.5 mr-1" /> Audit Safe
                    </Badge>
                </div>
            </div>
        </div>
        
        <div className="flex bg-white rounded-2xl border-2 border-slate-100 shadow-sm p-4 items-center gap-6 divide-x divide-slate-100 min-w-[500px]">
            <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Kontrak PO</p>
                <p className="text-sm font-black text-slate-900">Rp {formatNumberWithCommas(totalPoValue)}</p>
            </div>
            <div className="pl-6 space-y-0.5">
                <p className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">Total Ditagih</p>
                <p className="text-sm font-black text-indigo-600">Rp {formatNumberWithCommas(totalInvoicedSoFar)}</p>
            </div>
            <div className="pl-6 space-y-0.5 flex-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                    Sisa Plafon PO 
                    <span className={cn("text-[10px]", remainingPoBalance > 0 ? "text-emerald-600" : "text-rose-600")}>
                        {totalPoValue > 0 ? ((totalInvoicedSoFar/totalPoValue)*100).toFixed(0) : 0}%
                    </span>
                </p>
                <div className="flex items-center gap-3">
                    <p className={cn("text-sm font-black truncate", remainingPoBalance > 0 ? "text-slate-900" : "text-rose-600")}>
                        Rp {formatNumberWithCommas(remainingPoBalance)}
                    </p>
                    <ListChecks className={cn("h-4 w-4", remainingPoBalance > 0 ? "text-emerald-500" : "text-rose-500")} />
                </div>
            </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-8">
          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                    <ReceiptText className="h-4 w-4 text-indigo-600" /> Identitas Dokumen
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid gap-8 md:grid-cols-3">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice Number</Label>
                      <div className="flex items-center gap-2 bg-indigo-50/30 px-4 py-2.5 rounded-xl border-2 border-indigo-100/50">
                          <Hash className="h-4 w-4 text-indigo-600" />
                          <span className="font-black text-indigo-700 text-sm tracking-tight">{activeIdentity?.id || 'N/A'}</span>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer</Label>
                      <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase truncate text-slate-700">{activeIdentity?.customer}</div>
                  </div>

                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reference SO</Label>
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span>{activeIdentity?.salesOrder || 'Waiting SO'}</span>
                      </div>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Billing Address (Auto-Pulled from Customer Data)
                      </Label>
                      <textarea 
                          value={billingAddress} 
                          onChange={e => setBillingAddress(e.target.value)} 
                          className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium focus-visible:ring-1 focus-visible:ring-indigo-500 outline-none"
                          placeholder="Alamat lengkap penagihan..." 
                          disabled={isLocked} 
                      />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
            <CardHeader className="bg-slate-50/50 border-b py-4 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-tighter">Line Items Constructor</CardTitle>
                <div className="flex items-center gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge 
                                    variant={isDpInvoice ? "default" : "outline"} 
                                    className={cn("text-[9px] uppercase cursor-pointer py-1.5 px-4 font-black tracking-widest transition-all", isDpInvoice ? "bg-indigo-600" : "text-indigo-600 border-indigo-200")} 
                                    onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}
                                >
                                    {isDpInvoice ? "Down Payment Mode" : "Regular Billing"}
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-slate-900 text-white p-3 text-[10px]">
                                Klik untuk berganti mode penagihan (DP vs Final).
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-4 px-6">Description</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Quantity</TableHead>
                            <TableHead className="w-[120px] text-right text-[10px] font-black uppercase">Unit Price</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase">Total</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-[11px] uppercase font-black opacity-30 tracking-widest">Belum ada item yang ditarik.</TableCell></TableRow>
                        ) : items.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="px-6">
                                        <div className="flex flex-col gap-1 py-3">
                                            <Input 
                                                value={item.name} 
                                                onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                                className="h-8 text-[11px] font-bold border-dashed shadow-none"
                                                disabled={isLocked || !isAdmin}
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black uppercase text-slate-400">Kontrak: {item.originalQty} {item.unit}</span>
                                                <span className="text-[8px] font-bold text-slate-300">|</span>
                                                <span className="text-[9px] font-black uppercase text-indigo-400">Prev. Bill: {item.prevInvoicedQty || 0}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={formatNumberWithCommas(item.quantity)} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                            }} 
                                            className="text-center text-xs h-9 font-black rounded-lg border-slate-200" 
                                            disabled={isLocked}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={formatNumberWithCommas(item.price)} 
                                            onChange={e => {
                                                const val = parseFormattedNumber(e.target.value);
                                                setItems(items.map(it => it.id === item.id ? { ...it, price: val, total: it.quantity * val } : it));
                                            }}
                                            className="h-9 text-right text-xs font-black border-dashed rounded-lg"
                                            disabled={isLocked || !isAdmin}
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
                                <Plus className="mr-2 h-3.5 w-3.5" /> Tambah dari Katalog
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 shadow-2xl border-none ring-1 ring-slate-200" align="start">
                            <Command>
                                <CommandInput placeholder="Cari Produk di Master Database..." className="h-12" />
                                <CommandList>
                                    <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                        {masterProducts?.map((p) => (
                                            <CommandItem
                                                key={p.id}
                                                value={`${p.name}|${p.id}`}
                                                onSelect={() => handleProductSelect(p)}
                                                className="p-4 border-b last:border-0"
                                            >
                                                <div className="flex justify-between w-full">
                                                    <span className="font-bold text-slate-800 uppercase text-xs">{p.name}</span>
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Rp {p.price.toLocaleString()}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10 text-[10px] font-black uppercase text-emerald-600 rounded-xl px-6 border-slate-200 shadow-sm" disabled={isLocked || billedItemsHistory.length === 0}>
                                <History className="mr-2 h-3.5 w-3.5" /> Pilih dari Riwayat ({billedItemsHistory.length})
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="sm:max-w-md w-full p-0 flex flex-col">
                            <SheetHeader className="p-6 border-b bg-slate-50/50">
                                <SheetTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-indigo-600" /> Riwayat Item Terbit
                                </SheetTitle>
                                <div className="relative mt-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="Cari item di riwayat..." 
                                        className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-xs" 
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                    />
                                </div>
                            </SheetHeader>
                            <ScrollArea className="flex-1 px-2 py-4">
                                {filteredHistory.length === 0 ? (
                                    <div className="py-20 text-center text-slate-400 opacity-40 italic text-xs uppercase font-black">Tidak ada item ditemukan.</div>
                                ) : (
                                    <div className="space-y-3 px-4">
                                        {filteredHistory.map((h, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => !isLocked && handleCopyFromHistory(h)}
                                                className="group p-4 bg-white border rounded-2xl hover:border-indigo-300 hover:ring-1 hover:ring-indigo-300 transition-all cursor-pointer shadow-sm relative overflow-hidden"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{h.parentInvoice}</span>
                                                    <CopyPlus className="h-4 w-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <p className="text-xs font-black uppercase text-slate-800 line-clamp-2 leading-tight">{h.name}</p>
                                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                                    <span className="text-[10px] font-bold text-slate-400">{h.quantity} {h.unit}</span>
                                                    <span className="text-[10px] font-black text-slate-900">Rp {h.price.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8 sticky top-24">
          <Card className="shadow-lg border-none ring-1 ring-indigo-100 bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-indigo-50/20 py-5 px-8 border-b border-indigo-50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Calculation Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gross Subtotal</span>
                    <span className="font-black text-slate-900">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-amber-600">Negotiation Adjustment</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-amber-50 text-amber-700 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={handleNumericChange(setNegotiationValue)} className="h-10 text-right font-black text-amber-600 border-amber-100 rounded-xl bg-amber-50/10" placeholder="0" disabled={isLocked} />
                </div>

                {isDpInvoice ? (
                    <div className="space-y-2 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 ring-4 ring-indigo-50/10">
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
                                <Label className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-1">
                                    <Wallet className="h-3.5 w-3.5" /> Potongan Saldo DP
                                </Label>
                                <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isLocked}>
                                    <SelectTrigger className="h-6 w-16 text-[9px] font-black shadow-none border-none bg-emerald-100 text-emerald-700 rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input value={dpDeductionValue} onChange={handleNumericChange(setDpDeductionValue)} className="h-10 text-right font-black border-emerald-200 text-emerald-700 rounded-xl bg-white" placeholder="0" disabled={isLocked} />
                            <div className="flex items-center justify-between text-[9px] font-bold text-emerald-600/70 mt-1 uppercase tracking-tighter">
                                <span>Kuota DP Tersedia:</span>
                                <span>Rp {formatNumberWithCommas(dpInvoicedBalance)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Retention / Guarantee</Label>
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
                    <Label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Tax Sync (PPN 12%)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-4">
                    <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">DPP Value</span> <Input value={dppVat} onChange={handleNumericChange(setDppVat)} disabled={!isTaxManual || isLocked} className="h-7 w-36 text-right font-mono text-xs font-black bg-transparent border-none p-0 focus-visible:ring-0" /></div>
                    <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">PPN 12%</span> <Input value={vat12} onChange={handleNumericChange(setVat12)} disabled={!isTaxManual || isLocked} className="h-7 w-36 text-right font-mono text-xs font-black bg-transparent border-none p-0 focus-visible:ring-0" /></div>
                </div>
              </div>

              <div className="pt-4 border-t-4 border-indigo-600/10">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Grand Total Net</span>
                      {isExceedingPo && (
                          <Badge className="text-[8px] bg-rose-600 animate-pulse h-4 border-none shadow-none uppercase font-black">EXCEEDS PO</Badge>
                      )}
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
                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Eye className="mr-2 h-5 w-5" /> SIMPAN & PREVIEW PDF</>}
                      </Button>

                      <Button 
                          variant="ghost" 
                          className="w-full h-12 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 rounded-2xl tracking-widest" 
                          onClick={() => handleSaveInvoice('sent')}
                          disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : "Hanya Simpan Ke Database"}
                      </Button>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
