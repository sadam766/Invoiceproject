
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from '@/components/ui/command';
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
import { format } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Send,
  Eye,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { type InvoiceNumber, type Customer, type ProductListItem, type Invoice, type SalesOrder, type UserProfile, type VirtualAccount } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, writeBatch, where, getDocs } from 'firebase/firestore';

type InvoiceItem = {
    id: number;
    name: string;
    quantity: number | string;
    unit: string;
    price: number | string;
    total: number;
};

const ADD_INVOICE_SESSION_KEY = 'addInvoiceFormState';

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const invoiceNumberId = searchParams.get('invoiceNumberId');
  const editInvoiceId = searchParams.get('editInvoiceId');
  
  const [invoiceId, setInvoiceId] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customer, setCustomer] = useState<Customer | undefined>(undefined);

  // Default Issue Date to 25/04/2026 per instruction
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date('2026-04-25'));
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'sent' | 'draft'>('draft');
  const [printType, setPrintType] = useState<'original' | 'copy'>('original');

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiation, setNegotiation] = useState<number | string>(0);
  const [dpPercent, setDpPercent] = useState<string | number>('');
  const [dpValue, setDpValue] = useState<string | number>('');
  const [pelunasan, setPelunasan] = useState<string | number>('');

  const [grandTotal, setGrandTotal] = useState<string | number>(0);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  // Virtual Account States
  const [isVaActive, setIsVaActive] = useState(false);
  const [selectedVaId, setSelectedVaId] = useState<string>('');
  const [paymentMethodText, setPaymentMethodMethodText] = useState('Bank Transfer');

  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState<number | null>(null);

  const userProfileRef = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const customersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customers'));
  }, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const productsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: productListData } = useCollection<ProductListItem>(productsCollection);

  const salesOrdersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salesOrders'));
  }, [firestore]);
  const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);

  const vaCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'virtualAccounts'));
  }, [firestore]);
  const { data: vaListData } = useCollection<VirtualAccount>(vaCollection);

  const availableVAs = useMemo(() => {
    if (!vaListData || !customer) return [];
    return vaListData.filter(va => va.customerName === customer.name);
  }, [vaListData, customer]);

  useEffect(() => {
      if (isVaActive && selectedVaId) {
          const va = availableVAs.find(v => v.id === selectedVaId);
          if (va) setPaymentMethodMethodText(`Virtual Account - ${va.bankName}`);
      } else if (!isVaActive) {
          setPaymentMethodMethodText('Bank Transfer');
      }
  }, [isVaActive, selectedVaId, availableVAs]);

  const uniqueSalesOrders = useMemo(() => {
      if (!salesOrderListData) return [];
      return Array.from(new Set(salesOrderListData.map(item => item.soNumber)))
  }, [salesOrderListData]);


  const invoiceNumberRef = useMemoFirebase(() => {
    if (!firestore || !invoiceNumberId) return null;
    return doc(firestore, 'invoiceNumbers', invoiceNumberId);
  }, [firestore, invoiceNumberId]);
  const { data: invoiceNumberData, isLoading: isInvoiceNumberLoading } = useDoc<InvoiceNumber>(invoiceNumberRef);

  const invoiceToEditRef = useMemoFirebase(() => {
    if (!firestore || !editInvoiceId) return null;
    return doc(firestore, 'invoices', editInvoiceId);
  }, [firestore, editInvoiceId]);
  const { data: invoiceToEditData, isLoading: isEditInvoiceLoading } = useDoc<Invoice>(invoiceToEditRef);
  
  const isLoading = isInvoiceNumberLoading || isEditInvoiceLoading;
  
  useEffect(() => {
    const savedStateJSON = sessionStorage.getItem(ADD_INVOICE_SESSION_KEY);
    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            setInvoiceId(savedState.invoiceId || '');
            setSoNumber(savedState.soNumber || '');
            setPoNumber(savedState.poNumber || '');
            setCustomer(savedState.customer);
            setIssueDate(savedState.issueDate ? new Date(savedState.issueDate) : new Date('2026-04-25'));
            setDueDate(savedState.dueDate ? new Date(savedState.dueDate) : undefined);
            setStatus(savedState.status || 'draft');
            setPrintType(savedState.printType || 'original');
            setItems(savedState.items || []);
            setNegotiation(savedState.negotiation || 0);
            setDpPercent(savedState.dpPercent || '');
            setDpValue(savedState.dpValue || '');
            setPelunasan(savedState.pelunasan || '');
            setGrandTotal(savedState.grandTotal || 0);
            setDppVat(savedState.dppVat || 0);
            setVat12(savedState.vat12 || 0);
            setTotalAmount(savedState.totalAmount || 0);
            setIsVaActive(savedState.isVaActive || false);
            setSelectedVaId(savedState.selectedVaId || '');
        } catch (e) {
            console.error("Failed to parse saved invoice state:", e);
        }
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem(ADD_INVOICE_SESSION_KEY, JSON.stringify({
        invoiceId, soNumber, poNumber, customer, issueDate: issueDate?.toISOString(), dueDate: dueDate?.toISOString(), status, printType, items, negotiation, dpPercent, dpValue, pelunasan, grandTotal, dppVat, vat12, totalAmount, isVaActive, selectedVaId
      }));
    }
  }, [invoiceId, soNumber, poNumber, customer, issueDate, dueDate, status, printType, items, negotiation, dpPercent, dpValue, pelunasan, grandTotal, dppVat, vat12, totalAmount, isVaActive, selectedVaId, isLoading]);


  useEffect(() => {
    if (invoiceNumberData) {
      sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
      setInvoiceId(invoiceNumberData.id);
      if (invoiceNumberData.salesOrder) handleSoSelect(invoiceNumberData.salesOrder);
      else setCustomer(customerListData?.find(c => c.name === invoiceNumberData.customer));
    }
  }, [invoiceNumberData, customerListData]);

  useEffect(() => {
    if (invoiceToEditData && salesOrderListData) {
        sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
        setInvoiceId(invoiceToEditData.id);
        setSoNumber(invoiceToEditData.soNumber);
        setPoNumber(invoiceToEditData.poNumber);
        setStatus(invoiceToEditData.status);
        setCustomer(customerListData?.find(c => c.name === invoiceToEditData.customer));
        if (invoiceToEditData.date) setIssueDate(new Date(invoiceToEditData.date));

        const soItems = salesOrderListData.filter(so => so.soNumber === invoiceToEditData.soNumber);
        if (soItems.length > 0) {
            setItems(soItems.map((item, index) => ({
                id: Date.now() + index,
                name: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.quantity * item.price,
            })));
        }
    }
  }, [invoiceToEditData, customerListData, salesOrderListData]);
  
  const handleSoSelect = (selectedSo: string) => {
    setSoNumber(selectedSo);
    if (salesOrderListData) {
        const soItems = salesOrderListData.filter(so => so.soNumber === selectedSo);
        if (soItems.length > 0) {
            setItems(soItems.map((item, index) => ({
                id: Date.now() + index,
                name: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.quantity * item.price,
            })));
            setCustomer(customerListData?.find(c => c.name === soItems[0].customer));
        }
    }
    setSoPopoverOpen(false);
  }

  const handleCustomerSelect = (customerName: string) => {
    setCustomer(customerListData?.find(c => c.name.toLowerCase() === customerName.toLowerCase()));
    setCustomerPopoverOpen(false);
  }

  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (parseFormattedNumber(item.quantity) * parseFormattedNumber(item.price)), 0);
    setSubtotal(currentSubtotal);
  
    const numericNegotiation = parseFormattedNumber(String(negotiation));
    const base = currentSubtotal - numericNegotiation;
  
    const numericDpPercent = parseFloat(String(dpPercent)) || 0;
    let numericDpValue = parseFormattedNumber(String(dpValue));
    if (numericDpPercent > 0 && (dpValue === '' || dpValue === 0)) {
      numericDpValue = base * (numericDpPercent / 100);
      setDpValue(formatNumberWithCommas(numericDpValue));
    }
  
    const numericPelunasan = parseFormattedNumber(String(pelunasan));
    const currentGrandTotal = base - numericDpValue - numericPelunasan;
    
    setGrandTotal(formatNumberWithCommas(currentGrandTotal));
    const currentDpp = currentGrandTotal / 1.12;
    setDppVat(formatNumberWithCommas(currentDpp));
    const currentVat = currentDpp * 0.12;
    setVat12(formatNumberWithCommas(currentVat));
    setTotalAmount(formatNumberWithCommas(currentGrandTotal + currentVat));
  }, [items, negotiation, dpPercent, dpValue, pelunasan]);

  const handleBlurFormat = (setter: React.Dispatch<React.SetStateAction<string | number>>, value: string | number) => {
    setter(formatNumberWithCommas(String(value)));
  };

  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' | 'paid' | 'unpaid' = 'draft') => {
    if (!firestore || !user || !invoiceId || !customer || !issueDate) {
        toast({ variant: "destructive", title: "Validation Error", description: "Lengkapi Nomor Invoice, Customer, dan Tanggal." });
        return;
    }

    const batch = writeBatch(firestore);
    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const creatorInfo = userProfile?.displayName || user.email || 'System';
    const finalAmountValue = parseFormattedNumber(String(totalAmount));

    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const newInvoiceData = {
        id: invoiceId,
        soNumber: soNumber || safeInvoiceId,
        poNumber: poNumber,
        customer: customer.name,
        date: format(issueDate, 'yyyy-MM-dd'),
        amount: finalAmountValue,
        status: invoiceStatus,
        spdNumber: invoiceToEditData?.spdNumber || '-',
        paymentMethod: paymentMethodText,
        ownerId: user.uid,
        createdBy: invoiceToEditData?.createdBy || creatorInfo,
    };
    batch.set(invoiceDocRef, newInvoiceData, { merge: true });

    // Sync Amount with invoiceNumbers collection
    const invoiceNumberRef = doc(firestore, 'invoiceNumbers', safeInvoiceId);
    batch.set(invoiceNumberRef, { amount: finalAmountValue }, { merge: true });

    const salesOrderQuery = query(collection(firestore, 'salesOrders'), where('soNumber', '==', soNumber || safeInvoiceId));
    try {
        const existingSoItemsSnapshot = await getDocs(salesOrderQuery);
        existingSoItemsSnapshot.forEach(doc => batch.delete(doc.ref));
        items.forEach(item => {
            const newSoRef = doc(collection(firestore, 'salesOrders'));
            batch.set(newSoRef, {
                id: newSoRef.id,
                soNumber: soNumber || safeInvoiceId,
                customer: customer.name,
                productName: item.name,
                quantity: parseFormattedNumber(String(item.quantity)),
                unit: item.unit,
                price: parseFormattedNumber(String(item.price)),
                category: productListData?.find(p => p.name === item.name)?.category || '',
                ownerId: user.uid,
            });
        });
        await batch.commit();
        sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
        toast({ title: "Invoice Disimpan" });
        router.push('/dashboard/invoices');
    } catch (e) { console.error(e); }
  };

  const handlePreview = () => {
    const selectedVa = isVaActive ? availableVAs.find(va => va.id === selectedVaId) : undefined;
    const previewData = {
      id: invoiceId, soNumber, poNumber, customer, date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      amount: parseFormattedNumber(String(totalAmount)), status, printType,
      items: items.map((item, index) => ({
        id: item.id, no: index + 1, item: item.name, name: item.name,
        quantity: parseFormattedNumber(String(item.quantity)), unit: item.unit,
        price: parseFormattedNumber(String(item.price)), total: item.total
      })),
      subtotal, dppVat: parseFormattedNumber(String(dppVat)), vat12: parseFormattedNumber(String(vat12)),
      negotiation: parseFormattedNumber(String(negotiation)), dpValue: parseFormattedNumber(String(dpValue)),
      pelunasan: parseFormattedNumber(String(pelunasan)), grandTotal: parseFormattedNumber(String(grandTotal)),
      virtualAccount: selectedVa ? { bankName: selectedVa.bankName, vaNumber: selectedVa.vaNumber } : undefined,
      paymentTerms: '90 Hari setelah invoice diterima',
      paymentMethod: paymentMethodText,
    };
    sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
    router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoiceId || 'new')}`);
  };

  if (isLoading) return <main className="p-8 text-center"><Skeleton className="h-64 w-full" /></main>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => { sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY); router.push('/dashboard/invoices'); }}><ChevronLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-semibold">{editInvoiceId ? "Edit Invoice" : "Create Invoice"}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-5">
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div><label className="text-sm font-medium">Invoice No.</label><Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!!editInvoiceId || !!invoiceNumberId} /></div>
              <div><label className="text-sm font-medium">SO/Sales Order</label>
                <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{soNumber || "Cari SO..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0"><Command><CommandInput placeholder="Search SO..." /><CommandList><CommandEmpty>No SO found.</CommandEmpty><CommandGroup>{uniqueSalesOrders.map((so) => (<CommandItem key={so} value={so} onSelect={(v) => handleSoSelect(v.toUpperCase())}><Check className={cn("mr-2 h-4 w-4", soNumber.toLowerCase() === so.toLowerCase() ? "opacity-100" : "opacity-0")} />{so}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                </Popover>
              </div>
              <div><label className="text-sm font-medium">No. PO</label><Input value={poNumber} onChange={e => setPoNumber(e.target.value)} /></div>
              <div><label className="text-sm font-medium">Payment</label><Input value={paymentMethodText} onChange={e => setPaymentMethodMethodText(e.target.value)} /></div>
              <div className="lg:col-span-2">
                 <label className="text-sm font-medium">Bill To</label>
                 <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{customer?.name ?? "Cari Customer..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-full p-0"><Command><CommandInput placeholder="Search customer..." /><CommandList><CommandGroup>{customerListData?.map((c) => (<CommandItem key={c.id} value={c.name} onSelect={(v) => handleCustomerSelect(v)}><Check className={cn("mr-2 h-4 w-4", customer?.name.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0")} />{c.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                 </Popover>
                 {customer && <div className="mt-2 p-2 border rounded-md bg-muted text-sm text-muted-foreground"><p>{customer.address}</p></div>}
              </div>
              <div><label className="text-sm font-medium">Issue Date</label><Popover><PopoverTrigger asChild><Button variant={'outline'} className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{issueDate ? format(issueDate, 'dd/MM/yyyy') : 'Pilih Tanggal'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={issueDate} onSelect={setIssueDate} /></PopoverContent></Popover></div>
              <div><label className="text-sm font-medium">Due Date</label><Popover><PopoverTrigger asChild><Button variant={'outline'} className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Pilih Tanggal'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} /></PopoverContent></Popover></div>
            </div>

            <div className="mt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-24">Unit</TableHead><TableHead className="w-36">Price</TableHead><TableHead className="w-36 text-right">Total</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                        <Popover open={productPopoverOpen === item.id} onOpenChange={(o) => setProductPopoverOpen(o ? item.id : null)}>
                            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{item.name || "Cari Produk..."}</Button></PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search product..." /><CommandList><CommandGroup>{productListData?.map((p) => (<CommandItem key={p.id} value={p.name} onSelect={() => { setItems(items.map(it => it.id === item.id ? { ...it, name: p.name, unit: p.unit, price: p.price, total: parseFormattedNumber(String(it.quantity)) * p.price } : it)); setProductPopoverOpen(null); }}>{p.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                        </Popover>
                    </TableCell>
                    <TableCell><Input value={item.quantity} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value, total: parseFormattedNumber(e.target.value) * parseFormattedNumber(String(it.price)) } : it))} onBlur={() => handleBlurFormat(v => setItems(items.map(it => it.id === item.id ? { ...it, quantity: v as string } : it)), item.quantity)} className="text-right" /></TableCell>
                    <TableCell><Input value={item.unit} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))} /></TableCell>
                    <TableCell><Input value={item.price} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, price: e.target.value, total: parseFormattedNumber(String(it.quantity)) * parseFormattedNumber(e.target.value) } : it))} onBlur={() => handleBlurFormat(v => setItems(items.map(it => it.id === item.id ? { ...it, price: v as string } : it)), item.price)} className="text-right" /></TableCell>
                    <TableCell className="text-right">Rp {formatNumberWithCommas(item.total)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setItems(items.filter(it => it.id !== item.id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" className="mt-4" onClick={() => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'pcs', price: 0, total: 0 }])}><Plus className="mr-2 h-4 w-4" /> Add item</Button>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="w-80 space-y-2">
                    <div className="flex justify-between items-center"><span className="text-sm">Subtotal:</span><span className="text-sm font-medium">Rp {formatNumberWithCommas(subtotal)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm">A/Negotiation:</span><Input className="h-8 w-44 text-right" value={negotiation} onChange={e => setNegotiation(e.target.value)} onBlur={() => handleBlurFormat(setNegotiation, negotiation)} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">DP Value:</span><Input className="h-8 w-44 text-right" value={dpValue} onChange={e => setDpValue(e.target.value)} onBlur={() => handleBlurFormat(setDpValue, dpValue)} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">Pelunasan:</span><Input className="h-8 w-44 text-right" value={pelunasan} onChange={e => setPelunasan(e.target.value)} onBlur={() => handleBlurFormat(setPelunasan, pelunasan)} /></div>
                    <div className="flex justify-between items-center font-bold border-t pt-2"><span>Grand Total:</span><Input className="h-8 w-44 text-right font-bold" value={grandTotal} onChange={e => setGrandTotal(e.target.value)} onBlur={() => { const v = parseFormattedNumber(String(grandTotal)); setGrandTotal(formatNumberWithCommas(v)); setDppVat(formatNumberWithCommas(v/1.12)); setVat12(formatNumberWithCommas((v/1.12)*0.12)); setTotalAmount(formatNumberWithCommas(v + (v/1.12)*0.12)); }} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">DPP VAT:</span><Input className="h-8 w-44 text-right" value={dppVat} onChange={e => setDppVat(e.target.value)} onBlur={() => { const v = parseFormattedNumber(String(dppVat)); setDppVat(formatNumberWithCommas(v)); setVat12(formatNumberWithCommas(v*0.12)); setTotalAmount(formatNumberWithCommas(parseFormattedNumber(String(grandTotal)) + v*0.12)); }} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">VAT 12%:</span><Input className="h-8 w-44 text-right" value={vat12} onChange={e => setVat12(e.target.value)} onBlur={() => { const v = parseFormattedNumber(String(vat12)); setVat12(formatNumberWithCommas(v)); setTotalAmount(formatNumberWithCommas(parseFormattedNumber(String(grandTotal)) + v)); }} /></div>
                    <div className="flex justify-between items-center font-bold border-t pt-2"><span>Total:</span><Input className="h-8 w-44 text-right font-bold" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} onBlur={() => handleBlurFormat(setTotalAmount, totalAmount)} /></div>
                </div>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="va-mode" className="flex flex-col space-y-1">
                        <span>Gunakan Virtual Account</span>
                        <span className="font-normal text-xs text-muted-foreground">Aktifkan untuk pembayaran via VA</span>
                    </Label>
                    <Switch id="va-mode" checked={isVaActive} onCheckedChange={setIsVaActive} />
                </div>
                {isVaActive && (
                    <div className="space-y-2">
                        <Label className="text-xs">Pilih Bank VA</Label>
                        <Select value={selectedVaId} onValueChange={setSelectedVaId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih VA..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableVAs.length > 0 ? (
                                    availableVAs.map(va => (
                                        <SelectItem key={va.id} value={va.id!}>{va.bankName} - {va.vaNumber}</SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-xs text-center text-muted-foreground">Tidak ada VA terdaftar</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </CardContent>
          </Card>
          <Card><CardContent className="p-4 space-y-4">
              <Button className="w-full" onClick={() => handleSaveInvoice('sent')}><Send className="mr-2 h-4 w-4" /> Send Invoice</Button>
              <Button variant="outline" className="w-full" onClick={handlePreview}><Eye className="mr-2 h-4 w-4" /> Preview</Button>
              <div className="p-3 rounded-md bg-muted border text-xs"><label className="font-bold text-muted-foreground uppercase">Pembuat (Otomatis)</label><p className="font-medium mt-1">{userProfile?.displayName || user?.email}</p></div>
          </CardContent></Card>
        </div>
      </div>
    </main>
  );
}
