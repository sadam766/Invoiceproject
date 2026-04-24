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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Send,
  Settings,
  Eye,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { type InvoiceNumber, type Customer, type ProductListItem, type Invoice, type SalesOrder, type UserProfile } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
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

  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'sent' | 'draft'>('draft');
  const [printType, setPrintType] = useState<'original' | 'copy'>('original');

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiation, setNegotiation] = useState<number | string>(0);
  
  const [dpPercent, setDpPercent] = useState<string | number>('');
  const [dpValue, setDpValue] = useState<string | number>('');
  
  const [dpPelunasanPercent, setDpPelunasanPercent] = useState<string | number>('');
  const [pelunasan, setPelunasan] = useState<string | number>('');

  const [grandTotal, setGrandTotal] = useState<string | number>(0);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState<number | null>(null);

  // Fetch current user profile for audit trail
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
  
  const formState = {
    invoiceId, soNumber, poNumber, customer, issueDate: issueDate?.toISOString(), dueDate: dueDate?.toISOString(), status, printType, items, negotiation, dpPercent, dpValue, dpPelunasanPercent, pelunasan, grandTotal, dppVat, vat12, totalAmount
  };

  useEffect(() => {
    const savedStateJSON = sessionStorage.getItem(ADD_INVOICE_SESSION_KEY);
    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            setInvoiceId(savedState.invoiceId || '');
            setSoNumber(savedState.soNumber || '');
            setPoNumber(savedState.poNumber || '');
            setCustomer(savedState.customer);
            setIssueDate(savedState.issueDate ? new Date(savedState.issueDate) : new Date());
            setDueDate(savedState.dueDate ? new Date(savedState.dueDate) : undefined);
            setStatus(savedState.status || 'draft');
            setPrintType(savedState.printType || 'original');
            setItems(savedState.items || []);
            setNegotiation(savedState.negotiation || 0);
            setDpPercent(savedState.dpPercent || '');
            setDpValue(savedState.dpValue || '');
            setDpPelunasanPercent(savedState.dpPelunasanPercent || '');
            setPelunasan(savedState.pelunasan || '');
            setGrandTotal(savedState.grandTotal || 0);
            setDppVat(savedState.dppVat || 0);
            setVat12(savedState.vat12 || 0);
            setTotalAmount(savedState.totalAmount || 0);
        } catch (e) {
            console.error("Failed to parse saved invoice state:", e);
        }
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem(ADD_INVOICE_SESSION_KEY, JSON.stringify(formState));
    }
  }, [formState, isLoading]);


  useEffect(() => {
    if (invoiceNumberData) {
      sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
      setInvoiceId(invoiceNumberData.id);
      
      if (invoiceNumberData.salesOrder) {
        handleSoSelect(invoiceNumberData.salesOrder);
      } else {
        const foundCustomer = customerListData?.find(c => c.name === invoiceNumberData.customer);
        setCustomer(foundCustomer);
      }

      if (invoiceNumberData.date) {
        const parts = invoiceNumberData.date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            setIssueDate(new Date(`${year}-${month}-${day}`));
        }
      }
    }
  }, [invoiceNumberData, customerListData, salesOrderListData]);

  useEffect(() => {
    if (invoiceToEditData && salesOrderListData) {
        sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
        setInvoiceId(invoiceToEditData.id);
        setSoNumber(invoiceToEditData.soNumber);
        setPoNumber(invoiceToEditData.poNumber);
        setStatus(invoiceToEditData.status);
        
        const foundCustomer = customerListData?.find(c => c.name === invoiceToEditData.customer);
        setCustomer(foundCustomer);

        if (invoiceToEditData.date) {
            setIssueDate(new Date(invoiceToEditData.date));
        }

        if(invoiceToEditData.soNumber) {
            const soItems = salesOrderListData.filter(so => so.soNumber === invoiceToEditData.soNumber);
             if (soItems.length > 0) {
                const newItems: InvoiceItem[] = soItems.map((item, index) => ({
                    id: Date.now() + index,
                    name: item.productName,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.quantity * item.price,
                }));
                setItems(newItems);
            }
        }
    }
  }, [invoiceToEditData, customerListData, salesOrderListData]);
  
  const handleSoSelect = (selectedSo: string) => {
    setSoNumber(selectedSo);

    if (salesOrderListData) {
        const soItems = salesOrderListData.filter(so => so.soNumber === selectedSo);
        if (soItems.length > 0) {
            const newItems: InvoiceItem[] = soItems.map((item, index) => ({
                id: Date.now() + index,
                name: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.quantity * item.price,
            }));
            setItems(newItems);

            const soCustomerName = soItems[0].customer;
            const foundCustomer = customerListData?.find(c => c.name === soCustomerName);
            setCustomer(foundCustomer);
        } else {
            setItems([]);
            setCustomer(undefined);
        }
    }
    setSoPopoverOpen(false);
  }

  const handleCustomerSelect = (customerName: string) => {
    const foundCustomer = customerListData?.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    setCustomer(foundCustomer);
    setCustomerPopoverOpen(false);
  }

  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => {
        const q = parseFormattedNumber(item.quantity);
        const p = parseFormattedNumber(item.price);
        return acc + (q * p);
    }, 0);
    setSubtotal(currentSubtotal);
  
    const numericNegotiation = parseFormattedNumber(String(negotiation));
    const baseForCalculations = currentSubtotal - numericNegotiation;
  
    const numericDpPercent = typeof dpPercent === 'string' && dpPercent !== '' ? parseFloat(dpPercent.toString()) : (typeof dpPercent === 'number' ? dpPercent : 0);
    let numericDpValue = parseFormattedNumber(String(dpValue));
    
    if (numericDpPercent > 0 && (dpValue === '' || dpValue === 0)) {
      const calculatedDp = baseForCalculations * (numericDpPercent / 100);
      setDpValue(formatNumberWithCommas(calculatedDp));
      numericDpValue = calculatedDp;
    }
  
    const numericPelunasanPercent = typeof dpPelunasanPercent === 'string' && dpPelunasanPercent !== '' ? parseFloat(dpPelunasanPercent.toString()) : (typeof dpPelunasanPercent === 'number' ? dpPelunasanPercent : 0);
    let numericPelunasan = parseFormattedNumber(String(pelunasan));
  
    if (numericPelunasanPercent > 0 && (pelunasan === '' || pelunasan === 0)) {
        const calculatedPelunasan = baseForCalculations * (numericPelunasanPercent / 100);
        setPelunasan(formatNumberWithCommas(calculatedPelunasan));
        numericPelunasan = calculatedPelunasan;
    }
  
    const currentGrandTotal = baseForCalculations - numericDpValue - numericPelunasan;
    setGrandTotal(formatNumberWithCommas(currentGrandTotal));
    
    const currentDppVat = currentGrandTotal / 1.12;
    setDppVat(formatNumberWithCommas(currentDppVat));
    
    const currentVat12 = currentDppVat * 0.12;
    setVat12(formatNumberWithCommas(currentVat12));

    setTotalAmount(formatNumberWithCommas(currentGrandTotal + currentVat12));
  
  }, [items, negotiation, dpPercent, dpValue, dpPelunasanPercent, pelunasan]);

  const handleGrandTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => setGrandTotal(e.target.value);
  const handleGrandTotalBlur = () => {
    const numericGT = parseFormattedNumber(String(grandTotal));
    if (!isNaN(numericGT)) {
      const dpp = numericGT / 1.12;
      const vat = dpp * 0.12;
      const total = numericGT + vat;
      setGrandTotal(formatNumberWithCommas(numericGT));
      setDppVat(formatNumberWithCommas(dpp));
      setVat12(formatNumberWithCommas(vat));
      setTotalAmount(formatNumberWithCommas(total));
    }
  };

  const handleDppVatChange = (e: React.ChangeEvent<HTMLInputElement>) => setDppVat(e.target.value);
  const handleDppVatBlur = () => {
    const numericDPP = parseFormattedNumber(String(dppVat));
    if (!isNaN(numericDPP)) {
      const vat = numericDPP * 0.12;
      const total = numericDPP + vat;
      setDppVat(formatNumberWithCommas(numericDPP));
      setVat12(formatNumberWithCommas(vat));
      setTotalAmount(formatNumberWithCommas(total));
    }
  };

  const handleVat12Change = (e: React.ChangeEvent<HTMLInputElement>) => setVat12(e.target.value);
  const handleVat12Blur = () => {
    const numericVAT = parseFormattedNumber(String(vat12));
    if (!isNaN(numericVAT)) {
      const dpp = parseFormattedNumber(String(dppVat));
      const total = dpp + numericVAT;
      setVat12(formatNumberWithCommas(numericVAT));
      setTotalAmount(formatNumberWithCommas(total));
    }
  };

  const handleTotalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => setTotalAmount(e.target.value);
  const handleTotalAmountBlur = () => setTotalAmount(formatNumberWithCommas(String(totalAmount)));

  const handleBlurFormat = (setter: React.Dispatch<React.SetStateAction<string | number>>, value: string | number) => {
    if (typeof value === 'string' || typeof value === 'number') {
        setter(formatNumberWithCommas(String(value)));
    }
  };

  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' | 'paid' | 'unpaid' = 'draft') => {
    if (!firestore || !user || !invoiceId || !customer || !issueDate) {
        toast({ variant: "destructive", title: "Validation Error", description: "Lengkapi Nomor Invoice, Customer, dan Tanggal." });
        return;
    }

    const batch = writeBatch(firestore);
    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const itemReferenceSONumber = soNumber || safeInvoiceId;
    const finalNumericAmount = parseFormattedNumber(String(totalAmount));

    // Audit Trail: Record creator automatically
    const creatorInfo = userProfile?.displayName || user.displayName || user.email || 'System';

    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const newInvoiceData = {
        id: invoiceId,
        soNumber: itemReferenceSONumber,
        poNumber: poNumber,
        customer: customer.name,
        date: format(issueDate, 'yyyy-MM-dd'),
        amount: finalNumericAmount,
        status: invoiceStatus,
        spdNumber: invoiceToEditData?.spdNumber || '-',
        ownerId: user.uid,
        createdBy: invoiceToEditData?.createdBy || creatorInfo,
    };
    batch.set(invoiceDocRef, newInvoiceData, { merge: true });

    const salesOrderQuery = query(collection(firestore, 'salesOrders'), where('soNumber', '==', itemReferenceSONumber));

    try {
        const existingSoItemsSnapshot = await getDocs(salesOrderQuery);
        existingSoItemsSnapshot.forEach(doc => batch.delete(doc.ref));

        if (items.length > 0) {
            items.forEach(item => {
                const newSalesOrderItemRef = doc(collection(firestore, 'salesOrders'));
                batch.set(newSalesOrderItemRef, {
                    id: newSalesOrderItemRef.id,
                    soNumber: itemReferenceSONumber,
                    customer: customer.name,
                    productName: item.name,
                    quantity: parseFormattedNumber(String(item.quantity)),
                    unit: item.unit,
                    price: parseFormattedNumber(String(item.price)),
                    category: productListData?.find(p => p.name === item.name)?.category || '',
                    ownerId: user.uid,
                });
            });
        }
        
        await batch.commit()
        .then(() => {
            sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
            toast({ title: "Invoice Disimpan", description: `Invoice ${invoiceId} berhasil disimpan.` });
            router.push('/dashboard/invoices');
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: `batch write to invoices and salesOrders`,
                operation: editInvoiceId ? 'update' : 'create',
                requestResourceData: { invoice: newInvoiceData },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } catch (serverError) {
        console.error("Batch query/setup failed:", serverError);
    }
  };

  const handleAddItem = () => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'pcs', price: 0, total: 0 }]);

  const handleItemChange = (id: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const handleProductSelect = (itemId: number, product: ProductListItem) => {
    setItems(items.map(item => {
        if (item.id === itemId) {
            const q = parseFormattedNumber(String(item.quantity));
            return { ...item, name: product.name, unit: product.unit, price: product.price, total: q * product.price };
        }
        return item;
    }));
    setProductPopoverOpen(null);
  };
  
  const handleNumericItemChange = (id: number, field: 'quantity' | 'price', value: string) => {
    setItems(items.map(item => {
        if (item.id === id) {
            const updatedItem = { ...item, [field]: value };
            const q = parseFormattedNumber(field === 'quantity' ? value : String(item.quantity));
            const p = parseFormattedNumber(field === 'price' ? value : String(item.price));
            updatedItem.total = q * p;
            return updatedItem;
        }
        return item;
    }));
  };

  const handleNumericItemBlur = (id: number, field: 'quantity' | 'price') => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: formatNumberWithCommas(parseFormattedNumber(String(item[field]))) } : item));
  };

  const handleRemoveItem = (id: number) => setItems(items.filter(item => item.id !== id));
  
  const handlePreview = () => {
    const previewData = {
      id: invoiceId, soNumber, poNumber, customer, date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      amount: parseFormattedNumber(String(totalAmount)), status, printType,
      items: items.map((item, index) => ({
        id: item.id, no: index + 1, item: item.name, name: item.name,
        quantity: parseFormattedNumber(String(item.quantity)), unit: item.unit,
        price: parseFormattedNumber(String(item.price)), total: item.total
      })),
      subtotal, dppVat: parseFormattedNumber(String(dppVat)), vat12: parseFormattedNumber(String(vat12)),
      negotiation: parseFormattedNumber(String(negotiation)), dpPercent, dpValue: parseFormattedNumber(String(dpValue)),
      dpPelunasanPercent, pelunasan: parseFormattedNumber(String(pelunasan)), grandTotal: parseFormattedNumber(String(grandTotal)),
    };
    sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
    router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoiceId || 'new')}`);
  };


  if (isLoading) return <main className="p-8 text-center"><Skeleton className="h-64 w-full" /></main>;
  const handleBack = () => { sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY); router.push('/dashboard/invoices'); };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleBack}><ChevronLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-semibold tracking-tight">{editInvoiceId ? "Edit Invoice" : "Create Invoice"}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <div className="lg:col-span-5">
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div><label className="text-sm font-medium">Invoice No.</label><Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!!editInvoiceId || !!invoiceNumberId} /></div>
              <div><label className="text-sm font-medium">SO/Sales Order</label>
                <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{soNumber || "Cari SO..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0"><Command><CommandInput placeholder="Search sales order..." /><CommandList><CommandEmpty>No sales order found.</CommandEmpty><CommandGroup>{uniqueSalesOrders.map((so) => (<CommandItem key={so} value={so} onSelect={(currentValue) => handleSoSelect(currentValue.toUpperCase())}><Check className={cn("mr-2 h-4 w-4", soNumber.toLowerCase() === so.toLowerCase() ? "opacity-100" : "opacity-0")} />{so}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                </Popover>
              </div>
              <div><label className="text-sm font-medium">No. PO</label><Input value={poNumber} onChange={e => setPoNumber(e.target.value)} /></div>
              <div><label className="text-sm font-medium">Payment</label><Input placeholder="e.g. Bank Transfer" /></div>
              <div className="lg:col-span-2">
                 <label className="text-sm font-medium">Bill To</label>
                 <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{customer?.name ?? "Cari Customer..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-full p-0"><Command><CommandInput placeholder="Search customer..." /><CommandList><CommandEmpty>No customer found.</CommandEmpty><CommandGroup>{customerListData?.map((c) => (<CommandItem key={c.id} value={c.name} onSelect={(currentValue) => handleCustomerSelect(currentValue)}><Check className={cn("mr-2 h-4 w-4", customer?.name.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0")} />{c.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                 </Popover>
                 {customer && <div className="mt-2 p-2 border rounded-md bg-muted text-sm text-muted-foreground"><p>{customer.address}</p></div>}
              </div>
              <div><label className="text-sm font-medium">Issue Date</label><Popover><PopoverTrigger asChild><Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !issueDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{issueDate ? format(issueDate, 'dd/MM/yyyy') : <span>Pilih Tanggal</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={issueDate} onSelect={setIssueDate} initialFocus /></PopoverContent></Popover></div>
              <div><label className="text-sm font-medium">Due Date</label><Popover><PopoverTrigger asChild><Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'dd/MM/yyyy') : <span>Pilih Tanggal</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent></Popover></div>
            </div>

            <div className="mt-6">
              <Table>
                <TableHeader><TableRow><TableHead className="w-2/5">Item</TableHead><TableHead className="w-[100px]">Qty</TableHead><TableHead className="w-[100px]">Unit</TableHead><TableHead className="w-[150px]">Price</TableHead><TableHead className="w-[150px] text-right">Total</TableHead><TableHead className="w-[40px]"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                        <Popover open={productPopoverOpen === item.id} onOpenChange={(isOpen) => setProductPopoverOpen(isOpen ? item.id : null)}>
                            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{item.name || "Cari Produk..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search product..." /><CommandList><CommandEmpty>No product found.</CommandEmpty><CommandGroup>{productListData?.map((product) => (<CommandItem key={product.id} value={product.name} onSelect={() => handleProductSelect(item.id, product)}><Check className={cn("mr-2 h-4 w-4", item.name.toLowerCase() === product.name.toLowerCase() ? "opacity-100" : "opacity-0")} />{product.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                        </Popover>
                    </TableCell>
                    <TableCell><Input value={item.quantity} onChange={(e) => handleNumericItemChange(item.id, 'quantity', e.target.value)} onBlur={() => handleNumericItemBlur(item.id, 'quantity')} className="text-right w-24" /></TableCell>
                    <TableCell><Input value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input value={item.price} onChange={(e) => handleNumericItemChange(item.id, 'price', e.target.value)} onBlur={() => handleNumericItemBlur(item.id, 'price')} className="text-right w-36" /></TableCell>
                    <TableCell className="text-right">Rp {formatNumberWithCommas(item.total)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" className="mt-4" onClick={handleAddItem}><Plus className="mr-2 h-4 w-4" /> Add item</Button>
            </div>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-4">
                <div className="lg:col-start-3 lg:col-span-2 space-y-2">
                    <div className="flex justify-between items-center"><span className="text-sm">Subtotal:</span><span className="text-sm font-medium">Rp {formatNumberWithCommas(subtotal)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm">A/Negotiation:</span><Input className="h-8 w-44 text-right" value={negotiation} onChange={e => setNegotiation(e.target.value)} onBlur={() => handleBlurFormat(setNegotiation, negotiation)} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">DP (%):</span><Input className="h-8 w-44 text-right" value={dpPercent} onChange={e => setDpPercent(e.target.value)} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">DP Value:</span><Input className="h-8 w-44 text-right" value={dpValue} onChange={e => setDpValue(e.target.value)} onBlur={() => handleBlurFormat(setDpValue, dpValue)} /></div>
                    <div className="flex justify-between items-center font-bold border-t pt-2"><span className="text-sm">Grand Total:</span><Input className="h-8 w-48 text-right font-bold" value={grandTotal} onChange={handleGrandTotalChange} onBlur={handleGrandTotalBlur} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">DPP VAT:</span><Input className="h-8 w-48 text-right" value={dppVat} onChange={handleDppVatChange} onBlur={handleDppVatBlur} /></div>
                    <div className="flex justify-between items-center"><span className="text-sm">VAT 12%:</span><Input className="h-8 w-48 text-right" value={vat12} onChange={handleVat12Change} onBlur={handleVat12Blur} /></div>
                    <div className="flex justify-between items-center py-2 mt-2 border-t"><span className="text-base font-bold">Total:</span><Input className="h-8 w-48 text-right font-bold" value={totalAmount} onChange={handleTotalAmountChange} onBlur={handleTotalAmountBlur} /></div>
                </div>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card><CardContent className="p-4 space-y-4">
              <Button className="w-full" onClick={() => handleSaveInvoice('sent')}><Send className="mr-2 h-4 w-4" /> Send Invoice</Button>
              <Button variant="outline" className="w-full" onClick={handlePreview}><Eye className="mr-2 h-4 w-4" /> Preview</Button>
              <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice('draft')}>Save Draft</Button>
              <div className="space-y-2"><label className="text-sm font-medium">Status</label><Select value={status} onValueChange={(v) => setStatus(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent></Select></div>
              <div className="mt-4 p-3 rounded-md bg-muted border text-xs"><label className="font-bold text-muted-foreground uppercase">Pembuat (Otomatis)</label><p className="font-medium mt-1">{userProfile?.displayName || user?.email}</p></div>
          </CardContent></Card>
        </div>
      </div>
    </main>
  );
}
