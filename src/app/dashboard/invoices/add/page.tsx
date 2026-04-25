
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
import { Separator } from '@/components/ui/separator';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Send,
  Eye,
  ChevronsUpDown,
  Check,
  History,
  MapPin,
  Building,
} from 'lucide-react';
import { type InvoiceNumber, type Customer, type ProductListItem, type Invoice, type SalesOrder, type UserProfile, type VirtualAccount, type CustomerAddress } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, writeBatch, getDocs, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

type InvoiceItem = {
    id: number;
    productId?: string;
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
  
  // Address selection state
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrText, setNewAddrText] = useState('');
  const [newAddrNpwp, setNewAddrNpwp] = useState('');

  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'sent' | 'draft'>('draft');
  const [printType, setPrintType] = useState<'original' | 'copy'>('original');

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiation, setNegotiation] = useState<number | string>(0);
  const [dpValue, setDpValue] = useState<string | number>('');
  const [pelunasan, setPelunasan] = useState<string | number>('');

  const [grandTotal, setGrandTotal] = useState<string | number>(0);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

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

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const vaCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'virtualAccounts'));
  }, [firestore]);
  const { data: vaListData } = useCollection<VirtualAccount>(vaCollection);

  const availableVAs = useMemo(() => {
    if (!vaListData || !customer) return [];
    return vaListData.filter(va => va.customerName === customer.name);
  }, [vaListData, customer]);

  const selectedAddress = useMemo(() => {
    return customer?.addresses?.find(a => a.id === selectedAddressId);
  }, [customer, selectedAddressId]);

  // Logic: Previous Payments for the same PO
  const previousPayments = useMemo(() => {
    if (!allInvoices || !poNumber) return [];
    return allInvoices.filter(inv => inv.poNumber === poNumber && inv.id !== invoiceId);
  }, [allInvoices, poNumber, invoiceId]);

  const totalPreviousAmount = previousPayments.reduce((sum, inv) => sum + inv.amount, 0);

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
    if (invoiceNumberData) {
      sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
      setInvoiceId(invoiceNumberData.id);
      setPoNumber(invoiceNumberData.poNumber || '');
      if (invoiceNumberData.salesOrder) handleSoSelect(invoiceNumberData.salesOrder);
      else {
          const found = customerListData?.find(c => c.name === invoiceNumberData.customer);
          setCustomer(found);
          if (found) setSelectedAddressId(found.addresses?.find(a => a.isDefault)?.id || found.addresses?.[0]?.id || '');
      }
    }
  }, [invoiceNumberData, customerListData]);

  useEffect(() => {
    if (invoiceToEditData && salesOrderListData) {
        sessionStorage.removeItem(ADD_INVOICE_SESSION_KEY);
        setInvoiceId(invoiceToEditData.id);
        setSoNumber(invoiceToEditData.soNumber);
        setPoNumber(invoiceToEditData.poNumber);
        setStatus(invoiceToEditData.status);
        const found = customerListData?.find(c => c.name === invoiceToEditData.customer);
        setCustomer(found);
        
        // Find correct address ID based on the string saved in invoice
        const matchedAddr = found?.addresses?.find(a => a.address === invoiceToEditData.billingAddress);
        if (matchedAddr) setSelectedAddressId(matchedAddr.id);
        
        if (invoiceToEditData.date) setIssueDate(new Date(invoiceToEditData.date));
        if (invoiceToEditData.dueDate) setDueDate(new Date(invoiceToEditData.dueDate));

        const soItems = salesOrderListData.filter(so => so.soNumber === invoiceToEditData.soNumber);
        if (soItems.length > 0) {
            setItems(soItems.map((item, index) => ({
                id: Date.now() + index,
                productId: item.id,
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
    const cleanSo = selectedSo.split('|')[0];
    setSoNumber(cleanSo);
    if (salesOrderListData) {
        const soItems = salesOrderListData.filter(so => so.soNumber === cleanSo);
        if (soItems.length > 0) {
            setItems(soItems.map((item, index) => ({
                id: Date.now() + index,
                productId: item.id,
                name: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.quantity * item.price,
            })));
            const foundCust = customerListData?.find(c => c.name === soItems[0].customer);
            setCustomer(foundCust);
            if (foundCust) setSelectedAddressId(foundCust.addresses?.find(a => a.isDefault)?.id || foundCust.addresses?.[0]?.id || '');
            setPoNumber(soItems[0].poNumber || '');
        }
    }
    setSoPopoverOpen(false);
  }

  const handleCustomerSelect = (value: string) => {
    const [name] = value.split('|');
    const found = customerListData?.find(c => c.name.toLowerCase() === name.toLowerCase());
    setCustomer(found);
    if (found) {
        setSelectedAddressId(found.addresses?.find(a => a.isDefault)?.id || found.addresses?.[0]?.id || '');
    }
    setCustomerPopoverOpen(false);
  }

  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (parseFormattedNumber(item.quantity) * parseFormattedNumber(item.price)), 0);
    setSubtotal(currentSubtotal);
  
    const numericNegotiation = parseFormattedNumber(String(negotiation));
    const base = currentSubtotal - numericNegotiation;
    const numericDpValue = parseFormattedNumber(String(dpValue));
    const numericPelunasan = parseFormattedNumber(String(pelunasan));
    const currentGrandTotal = base - numericDpValue - numericPelunasan;
    
    setGrandTotal(formatNumberWithCommas(currentGrandTotal));
    const currentDpp = currentGrandTotal / 1.12;
    setDppVat(formatNumberWithCommas(currentDpp));
    const currentVat = currentDpp * 0.12;
    setVat12(formatNumberWithCommas(currentVat));
    setTotalAmount(formatNumberWithCommas(currentGrandTotal + currentVat));
  }, [items, negotiation, dpValue, pelunasan]);

  const handleBlurFormat = (setter: React.Dispatch<React.SetStateAction<string | number>>, value: string | number) => {
    setter(formatNumberWithCommas(String(value)));
  };

  const handleAddNewAddressInline = async () => {
    if (!firestore || !customer || !newAddrLabel || !newAddrText) return;
    
    const newEntry: CustomerAddress = {
        id: Math.random().toString(36).substr(2, 9),
        label: newAddrLabel,
        address: newAddrText,
        npwp: newAddrNpwp,
        isDefault: false
    };

    const docRef = doc(firestore, 'customers', customer.id!);
    await updateDoc(docRef, {
        addresses: arrayUnion(newEntry)
    });

    setSelectedAddressId(newEntry.id);
    setIsAddingNewAddress(false);
    setNewAddrLabel('');
    setNewAddrText('');
    setNewAddrNpwp('');
    toast({ title: "Alamat Baru Berhasil Ditambahkan" });
  };

  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' | 'paid' | 'unpaid' = 'draft') => {
    if (!firestore || !user || !invoiceId || !customer || !issueDate || !selectedAddress) {
        toast({ variant: "destructive", title: "Validation Error", description: "Lengkapi Nomor Invoice, Customer, Alamat, dan Tanggal." });
        return;
    }

    const batch = writeBatch(firestore);
    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const finalAmountValue = parseFormattedNumber(String(totalAmount));

    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    batch.set(invoiceDocRef, {
        id: invoiceId,
        soNumber: soNumber || '(Waiting SO)',
        poNumber: poNumber,
        customer: customer.name,
        billingAddress: selectedAddress.address,
        billingNpwp: selectedAddress.npwp || '',
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : format(addDays(issueDate, 30), 'yyyy-MM-dd'),
        amount: finalAmountValue,
        status: invoiceStatus,
        paymentMethod: paymentMethodText,
        ownerId: user.uid,
        createdBy: user.email,
    }, { merge: true });

    const invNumRef = doc(firestore, 'invoiceNumbers', safeInvoiceId);
    batch.set(invNumRef, {
        id: invoiceId,
        amount: finalAmountValue,
        customer: customer.name,
        salesOrder: soNumber || '(Waiting SO)',
        poNumber: poNumber,
        ownerId: user.uid
    }, { merge: true });

    await batch.commit();
    toast({ title: "Invoice Berhasil Disimpan" });
    router.push('/dashboard/invoices');
  };

  const handlePreview = () => {
    if (!selectedAddress) {
        toast({ variant: "destructive", title: "Alamat Wajib Dipilih" });
        return;
    }
    const selectedVa = isVaActive ? availableVAs.find(va => va.id === selectedVaId) : undefined;
    const previewData = {
      id: invoiceId, soNumber, poNumber, customer: { name: customer?.name, address: selectedAddress.address, npwp: selectedAddress.npwp }, 
      date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
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
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/invoices')}><ChevronLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-semibold">{editInvoiceId ? "Edit Invoice" : "Create Invoice"}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div><label className="text-sm font-medium">Invoice No.</label><Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!!editInvoiceId || !!invoiceNumberId} /></div>
              <div><label className="text-sm font-medium">SO/Sales Order</label>
                <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{soNumber || "Cari SO (Opsional)"}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0 shadow-xl border border-muted" align="start"><Command><CommandInput placeholder="Search SO..." /><CommandList><CommandEmpty /><CommandGroup>{uniqueSalesOrders.map((so) => (<CommandItem key={so} value={so} onSelect={handleSoSelect}><Check className={cn("mr-2 h-4 w-4", soNumber.toLowerCase() === so.toLowerCase() ? "opacity-100" : "opacity-0")} />{so}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                </Popover>
              </div>
              <div><label className="text-sm font-medium">No. PO Customer</label><Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Wajib jika SO kosong" disabled={!!soNumber} /></div>
              <div><label className="text-sm font-medium">Issue Date</label><Popover><PopoverTrigger asChild><Button variant={'outline'} className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{issueDate ? format(issueDate, 'dd/MM/yyyy') : 'Pilih Tanggal'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={issueDate} onSelect={setIssueDate} /></PopoverContent></Popover></div>
              
              <div className="lg:col-span-2">
                 <label className="text-sm font-medium">Bill To (Pusat)</label>
                 <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between h-10">{customer?.name ?? "Cari Customer..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-xl border border-muted" align="start"><Command><CommandInput placeholder="Search customer..." /><CommandList><CommandEmpty /><CommandGroup>{customerListData?.map((c) => (
                      <CommandItem key={c.id} value={`${c.name}|${c.id}`} onSelect={handleCustomerSelect} className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2"><Check className={cn("h-4 w-4", customer?.name.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0")} /><span className="font-bold">{c.name}</span></div>
                        <p className="text-[10px] text-muted-foreground ml-6 truncate w-full">{c.addresses?.find(a => a.isDefault)?.address || c.addresses?.[0]?.address || 'No address'}</p>
                      </CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                 </Popover>
              </div>

              <div className="lg:col-span-2">
                 <label className="text-sm font-medium">Invoice Address (Cabang/Lokasi)</label>
                 <Select value={selectedAddressId} onValueChange={setSelectedAddressId} disabled={!customer}>
                    <SelectTrigger className="h-10">
                        <SelectValue placeholder="Pilih alamat cabang..." />
                    </SelectTrigger>
                    <SelectContent>
                        {customer?.addresses?.map(addr => (
                            <SelectItem key={addr.id} value={addr.id}>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase flex items-center gap-1">
                                        {addr.label} {addr.isDefault && <Check className="h-2 w-2" />}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{addr.address}</span>
                                </div>
                            </SelectItem>
                        ))}
                        <Separator className="my-1" />
                        <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-7 px-2 font-bold text-primary" onClick={(e) => { e.stopPropagation(); setIsAddingNewAddress(true); }}>
                            <Plus className="h-3 w-3 mr-2" /> TAMBAH ALAMAT BARU
                        </Button>
                    </SelectContent>
                 </Select>
              </div>
            </div>

            {/* Inline New Address Form */}
            {isAddingNewAddress && (
                <div className="mt-4 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><MapPin className="h-3 w-3" /> Quick Add Address</h4>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setIsAddingNewAddress(false)}>Batal</Button>
                    </div>
                    <div className="grid gap-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Label (e.g. Kantor Cabang Bali)" value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)} className="h-8 text-xs" />
                            <Input placeholder="NPWP Cabang (Jika Berbeda)" value={newAddrNpwp} onChange={e => setNewAddrNpwp(e.target.value)} className="h-8 text-xs font-mono" />
                        </div>
                        <Input placeholder="Alamat lengkap lokasi..." value={newAddrText} onChange={e => setNewAddrText(e.target.value)} className="h-8 text-xs" />
                        <Button size="sm" className="h-8 w-full" onClick={handleAddNewAddressInline}>Simpan & Gunakan Alamat Ini</Button>
                    </div>
                </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Item (Alias Display Name)</TableHead>
                    <TableHead className="w-[80px] text-center">Qty</TableHead>
                    <TableHead className="w-[80px] text-center">Unit</TableHead>
                    <TableHead className="w-[140px] text-right">Price</TableHead>
                    <TableHead className="w-[140px] text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="p-2 space-y-1">
                        <Popover open={productPopoverOpen === item.id} onOpenChange={(o) => setProductPopoverOpen(o ? item.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-8 text-xs flex items-center justify-between font-normal">
                                <span className="truncate">Pilih Produk Dasar</span>
                                <ChevronsUpDown className="h-3 w-3 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 shadow-xl border border-muted overflow-hidden">
                              <Command><CommandInput placeholder="Cari Produk..." /><CommandList><CommandEmpty /><CommandGroup>{productListData?.map((p) => (
                                <CommandItem key={p.id} value={`${p.name}|${p.id}`} onSelect={() => { setItems(items.map(it => it.id === item.id ? { ...it, name: p.name, unit: p.unit, price: p.price, productId: p.id, total: parseFormattedNumber(String(it.quantity)) * p.price } : it)); setProductPopoverOpen(null); }}
                                >{p.name}</CommandItem>))}</CommandGroup></CommandList></Command>
                            </PopoverContent>
                        </Popover>
                        <Input value={item.name} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} placeholder="Edit Nama untuk dokumen (Alias)..." className="h-8 text-sm bg-blue-50/50" />
                    </TableCell>
                    <TableCell className="p-2"><Input value={item.quantity} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value, total: parseFormattedNumber(e.target.value) * parseFormattedNumber(String(it.price)) } : it))} onBlur={() => handleBlurFormat(v => setItems(items.map(it => it.id === item.id ? { ...it, quantity: v as string } : it)), item.quantity)} className="text-center" /></TableCell>
                    <TableCell className="p-2"><Input value={item.unit} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))} className="text-center uppercase" /></TableCell>
                    <TableCell className="p-2"><Input value={item.price} onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, price: e.target.value, total: parseFormattedNumber(String(item.quantity)) * parseFormattedNumber(e.target.value) } : it))} onBlur={() => handleBlurFormat(v => setItems(items.map(it => it.id === item.id ? { ...it, price: v as string } : it)), item.price)} className="text-right" /></TableCell>
                    <TableCell className="p-2 text-right font-medium">Rp {formatNumberWithCommas(item.total)}</TableCell>
                    <TableCell className="p-2 text-center"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter(it => it.id !== item.id))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" className="mt-4 border-dashed" onClick={() => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'pcs', price: 0, total: 0 }])}><Plus className="mr-2 h-4 w-4" /> Add item</Button>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="w-full md:w-80 space-y-2">
                    <div className="flex justify-between items-center"><span className="text-sm">Subtotal:</span><span className="text-sm font-medium">Rp {formatNumberWithCommas(subtotal)}</span></div>
                    <div className="flex justify-between items-center font-bold border-t pt-2"><span>Total Tagihan Baru:</span><span className="text-primary">Rp {totalAmount}</span></div>
                </div>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4" /> Riwayat PO: {poNumber || '-'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {previousPayments.length > 0 ? (
                    <div className="space-y-2">
                        {previousPayments.map(inv => (
                            <div key={inv.id} className="flex justify-between text-xs border-b pb-1">
                                <span className="text-muted-foreground">{inv.id}</span>
                                <span className="font-medium">Rp {inv.amount.toLocaleString('id-ID')}</span>
                            </div>
                        ))}
                        <div className="pt-2 flex justify-between font-bold text-sm text-green-600">
                            <span>Sudah Ditagih:</span>
                            <span>Rp {totalPreviousAmount.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Belum ada penagihan untuk PO ini.</p>
                )}
            </CardContent>
          </Card>
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
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-xs">Pilih Bank VA</Label>
                        <Select value={selectedVaId} onValueChange={setSelectedVaId}>
                            <SelectTrigger><SelectValue placeholder="Pilih VA..." /></SelectTrigger>
                            <SelectContent>{availableVAs.length > 0 ? availableVAs.map(va => (<SelectItem key={va.id} value={va.id!}>{va.bankName} - {va.vaNumber}</SelectItem>)) : <div className="p-2 text-xs text-center">Tidak ada VA</div>}</SelectContent>
                        </Select>
                    </div>
                )}
            </CardContent>
          </Card>
          <Card><CardContent className="p-4 space-y-4">
              <Button className="w-full shadow-md" onClick={() => handleSaveInvoice('sent')}><Send className="mr-2 h-4 w-4" /> Send Invoice</Button>
              <Button variant="outline" className="w-full" onClick={handlePreview}><Eye className="mr-2 h-4 w-4" /> Preview</Button>
          </CardContent></Card>
        </div>
      </div>
    </main>
  );
}
