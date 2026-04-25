
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
  FileText,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { type InvoiceNumber, type Customer, type ProductListItem, type Invoice, type SalesOrder, type UserProfile, type VirtualAccount, type CustomerAddress } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, writeBatch, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

type InvoiceItem = {
    id: number;
    productId?: string;
    name: string;
    quantity: number | string;
    unit: string;
    price: number | string;
    total: number;
};

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const invoiceNumberId = searchParams.get('invoiceNumberId');
  const editInvoiceId = searchParams.get('editInvoiceId');
  
  // --- FORM STATES ---
  const [invoiceId, setInvoiceId] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [sjInput, setSjInput] = useState('');
  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'sent' | 'draft'>('draft');
  const [printType, setPrintType] = useState<'original' | 'copy'>('original');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  
  // Negotiation Logic
  const [negotiationValue, setNegotiationValue] = useState<string | number>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  
  // DP & Retention
  const [dpValue, setDpValue] = useState<string | number>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('nominal');
  const [retentionValue, setRetentionValue] = useState<string | number>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');

  // Calculation Results for Display
  const [calculatedNegNominal, setCalculatedNegNominal] = useState(0);
  const [calculatedDpNominal, setCalculatedDpNominal] = useState(0);
  const [calculatedRetNominal, setCalculatedRetNominal] = useState(0);
  const [isOverLimit, setIsOverLimit] = useState(false);

  // Tax Overrides
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  // Virtual Account
  const [isVaActive, setIsVaActive] = useState(false);
  const [selectedVaId, setSelectedVaId] = useState<string>('');
  const [paymentMethodText, setPaymentMethodMethodText] = useState('Bank Transfer');

  // Popovers
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState<number | null>(null);

  // --- DATA FETCHING ---
  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: productListData } = useCollection<ProductListItem>(productsCollection);

  const salesOrdersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);

  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const vaCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'virtualAccounts')) : null, [firestore]);
  const { data: vaListData } = useCollection<VirtualAccount>(vaCollection);

  const invoiceNumberRef = useMemoFirebase(() => (!firestore || !invoiceNumberId) ? null : doc(firestore, 'invoiceNumbers', invoiceNumberId), [firestore, invoiceNumberId]);
  const { data: invoiceNumberData, isLoading: isInvoiceNumberLoading } = useDoc<InvoiceNumber>(invoiceNumberRef);

  const availableVAs = useMemo(() => {
    if (!vaListData || !customer) return [];
    return vaListData.filter(va => va.customerName === customer.name);
  }, [vaListData, customer]);

  const selectedAddress = useMemo(() => customer?.addresses?.find(a => a.id === selectedAddressId), [customer, selectedAddressId]);

  const previousPayments = useMemo(() => {
    if (!allInvoices || !poNumber) return [];
    return allInvoices.filter(inv => inv.poNumber === poNumber && inv.id !== invoiceId);
  }, [allInvoices, poNumber, invoiceId]);

  const totalPreviousAmount = previousPayments.reduce((sum, inv) => sum + inv.amount, 0);

  // --- LOGIC: INITIAL LOAD ---
  useEffect(() => {
    if (invoiceNumberData) {
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

  // --- LOGIC: CALCULATIONS ---
  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (parseFormattedNumber(item.quantity) * parseFormattedNumber(item.price)), 0);
    setSubtotal(currentSubtotal);
  
    // 1. Negotiation Calculation
    const negInputVal = parseFormattedNumber(String(negotiationValue));
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;
    setCalculatedNegNominal(negNominal);

    const baseAfterNeg = currentSubtotal - negNominal;

    // 2. DP Calculation
    const dpInputVal = parseFormattedNumber(String(dpValue));
    const dpNominal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;
    setCalculatedDpNominal(dpNominal);

    // 3. Retention Calculation
    const retInputVal = parseFormattedNumber(String(retentionValue));
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;
    setCalculatedRetNominal(retNominal);

    // Validation: Check if total deductions exceed subtotal
    const totalDeductions = negNominal + dpNominal + retNominal;
    setIsOverLimit(totalDeductions > currentSubtotal);

    const baseForTax = baseAfterNeg - dpNominal - retNominal;
    
    if (!isTaxManual) {
        const calculatedDpp = baseForTax / 1.12;
        const calculatedVat = calculatedDpp * 0.12;
        setDppVat(formatNumberWithCommas(calculatedDpp));
        setVat12(formatNumberWithCommas(calculatedVat));
    }

    const currentDpp = parseFormattedNumber(String(dppVat));
    const currentVat = parseFormattedNumber(String(vat12));
    
    setTotalAmount(formatNumberWithCommas(currentDpp + currentVat));
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, isTaxManual, dppVat, vat12]);

  // --- HANDLERS ---
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
    if (found) setSelectedAddressId(found.addresses?.find(a => a.isDefault)?.id || found.addresses?.[0]?.id || '');
    setCustomerPopoverOpen(false);
  }

  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' | 'paid' | 'unpaid' = 'draft') => {
    if (!firestore || !user || !invoiceId || !customer || !issueDate || !selectedAddress) {
        toast({ variant: "destructive", title: "Validation Error", description: "Lengkapi data wajib (No. Invoice, Customer, Alamat)." });
        return;
    }

    // ANTI-DUPLICATE CHECK
    const existing = allInvoices?.find(inv => inv.id.toLowerCase() === invoiceId.toLowerCase());
    if (existing && !editInvoiceId) {
        toast({ 
            variant: "destructive", 
            title: "Nomor Invoice Duplikat", 
            description: `Nomor ini sudah digunakan oleh ${existing.createdBy || 'User lain'}.` 
        });
        return;
    }

    if (isOverLimit) {
        toast({ variant: "destructive", title: "Calculation Error", description: "Akumulasi potongan melebihi nilai barang." });
        return;
    }

    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const finalAmountValue = parseFormattedNumber(String(totalAmount));

    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const dataToSave = {
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
        sjNumbers: sjInput.split(',').map(s => s.trim()).filter(s => s !== ''),
        ownerId: user.uid,
        createdBy: userProfile?.displayName || user.email || 'System',
        negotiation: calculatedNegNominal,
        dpValue: calculatedDpNominal,
        retention: calculatedRetNominal,
    };

    setDoc(invoiceDocRef, dataToSave, { merge: true })
        .then(() => {
            toast({ title: "Invoice Berhasil Disimpan" });
            router.push('/dashboard/invoices');
        })
        .catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: invoiceDocRef.path, operation: editInvoiceId ? 'update' : 'create', requestResourceData: dataToSave
            }));
        });
  };

  const handlePreview = () => {
    if (!selectedAddress) { toast({ variant: "destructive", title: "Alamat Cabang Wajib Dipilih" }); return; }
    
    const previewData = {
      id: invoiceId, soNumber, poNumber, customer: { name: customer?.name, address: selectedAddress.address, npwp: selectedAddress.npwp }, 
      date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
      amount: parseFormattedNumber(String(totalAmount)), status, printType,
      sjNumbers: sjInput.split(',').map(s => s.trim()).filter(s => s !== ''),
      items: items.map((item, index) => ({
        id: String(item.id), no: index + 1, item: item.name, name: item.name,
        quantity: parseFormattedNumber(String(item.quantity)), unit: item.unit,
        price: parseFormattedNumber(String(item.price)), total: item.total
      })),
      subtotal: subtotal, 
      dppVat: parseFormattedNumber(String(dppVat)), 
      vat12: parseFormattedNumber(String(vat12)),
      negotiation: calculatedNegNominal, 
      dpValue: calculatedDpNominal,
      pelunasan: calculatedRetNominal,
      grandTotal: parseFormattedNumber(String(totalAmount)), 
      virtualAccount: isVaActive ? availableVAs.find(va => va.id === selectedVaId) : undefined,
      paymentTerms: '90 Hari setelah invoice diterima',
      paymentMethod: paymentMethodText,
    };
    sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
    router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoiceId || 'new')}`);
  };

  if (isInvoiceNumberLoading) return <main className="p-8"><Skeleton className="h-64 w-full" /></main>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/invoices')} className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Invoice Constructor</h1>
                <p className="text-xs text-muted-foreground font-bold">Lengkapi rincian penagihan dan sinkronisasi nilai pajak harian secara real-time.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 font-mono">{invoiceId || 'NEW-DRAFT'}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        {/* LEFT COLUMN: Input Form */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-sm border-muted-foreground/10 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Dokumen Utama
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">No. Invoice</Label>
                  <Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} className="font-bold border-primary/20" />
              </div>
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">SO / Sales Order</Label>
                  <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-mono text-xs">
                            {soNumber || "Cari SO..."}
                            <ChevronsUpDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 shadow-2xl" align="start">
                        <Command>
                            <CommandInput placeholder="Cari nomor SO..." />
                            <CommandList>
                                <CommandEmpty />
                                <CommandGroup>
                                    {Array.from(new Set(salesOrderListData?.map(s => s.soNumber) || [])).map(so => (
                                        <CommandItem key={so} value={so} onSelect={handleSoSelect} className="text-xs">
                                            <Check className={cn("mr-2 h-3 w-3", soNumber === so ? "opacity-100" : "opacity-0")} />
                                            {so}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                  </Popover>
              </div>
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">No. PO Customer</Label>
                  <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} disabled={!!soNumber} className="bg-muted/10" />
              </div>
              <div className="space-y-2 lg:col-span-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Tanggal Terbit</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-xs">
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {issueDate ? format(issueDate, 'dd/MM/yyyy') : 'Pilih Tanggal'}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={issueDate} onSelect={setIssueDate} /></PopoverContent>
                  </Popover>
              </div>
              <div className="lg:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Customer (Pusat)</Label>
                  <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                      <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-bold">
                              {customer?.name || "Pilih Customer..."}
                              <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 shadow-2xl" align="start">
                          <Command>
                              <CommandInput placeholder="Cari nama PT..." />
                              <CommandList>
                                  <CommandEmpty />
                                  <CommandGroup>
                                      {customerListData?.map(c => (
                                          <CommandItem key={c.id} value={`${c.name}|${c.id}`} onSelect={handleCustomerSelect} className="flex flex-col items-start gap-1 p-3">
                                              <div className="flex items-center gap-2">
                                                  <Check className={cn("h-4 w-4", customer?.id === c.id ? "opacity-100" : "opacity-0")} />
                                                  <span className="font-black uppercase text-xs">{c.name}</span>
                                              </div>
                                              <p className="text-[10px] text-muted-foreground ml-6 truncate w-full italic">
                                                  {c.addresses?.find(a => a.isDefault)?.address || c.addresses?.[0]?.address || 'No address'}
                                              </p>
                                          </CommandItem>
                                      ))}
                                  </CommandGroup>
                              </CommandList>
                          </Command>
                      </PopoverContent>
                  </Popover>
              </div>
              <div className="lg:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Alamat Penagihan (Cabang/Proyek)</Label>
                  <Select value={selectedAddressId} onValueChange={setSelectedAddressId} disabled={!customer}>
                      <SelectTrigger className="font-medium text-xs h-11 border-primary/10">
                          <SelectValue placeholder="Pilih lokasi spesifik..." />
                      </SelectTrigger>
                      <SelectContent>
                          {customer?.addresses?.map(addr => (
                              <SelectItem key={addr.id} value={addr.id} className="text-xs">
                                  <div className="flex flex-col">
                                      <span className="font-black uppercase tracking-tight">{addr.label} {addr.isDefault && "(Utama)"}</span>
                                      <span className="text-[10px] text-muted-foreground line-clamp-1">{addr.address}</span>
                                  </div>
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="lg:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Referensi Surat Jalan (SJ)</Label>
                  <Input value={sjInput} onChange={e => setSjInput(e.target.value)} placeholder="SJ-001, SJ-002..." className="bg-blue-50/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted-foreground/10 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-black uppercase">Daftar Item Penagihan</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase py-2">Produk & Alias (DisplayName)</TableHead>
                    <TableHead className="w-[80px] text-center text-[10px] font-black uppercase py-2">Qty</TableHead>
                    <TableHead className="w-[80px] text-center text-[10px] font-black uppercase py-2">Unit</TableHead>
                    <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Harga Satuan</TableHead>
                    <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="space-y-1 py-3">
                        <Popover open={productPopoverOpen === item.id} onOpenChange={(o) => setProductPopoverOpen(o ? item.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" className="w-full h-8 text-[10px] justify-between border-dashed border-muted font-normal text-muted-foreground">
                                <span className="truncate">Tautkan ke Master Produk...</span>
                                <ChevronsUpDown className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Cari di gudang..." />
                                    <CommandList>
                                        {productListData?.map(p => (
                                            <CommandItem key={p.id} value={p.name} onSelect={() => {
                                                setItems(items.map(it => it.id === item.id ? { ...it, name: p.name, unit: p.unit, price: p.price, total: parseFormattedNumber(String(it.quantity)) * p.price } : it));
                                                setProductPopoverOpen(null);
                                            }} className="text-xs">{p.name}</CommandItem>
                                        ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <Input 
                            value={item.name} 
                            onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} 
                            className="h-9 text-xs font-bold bg-blue-50/30" 
                            placeholder="Ketik nama alias untuk dokumen..."
                        />
                    </TableCell>
                    <TableCell><Input value={item.quantity} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value, total: parseFormattedNumber(e.target.value) * parseFormattedNumber(String(it.price)) } : it))} className="text-center text-xs h-9" /></TableCell>
                    <TableCell><Input value={item.unit} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))} className="text-center text-xs uppercase h-9" /></TableCell>
                    <TableCell><Input value={item.price} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, price: e.target.value, total: parseFormattedNumber(String(item.quantity)) * parseFormattedNumber(e.target.value) } : it))} className="text-right text-xs h-9" /></TableCell>
                    <TableCell className="text-right font-black text-xs">Rp {formatNumberWithCommas(item.total)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setItems(items.filter(it => it.id !== item.id))} className="text-destructive h-8 w-8"><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 bg-muted/10 border-t">
                <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'm', price: 0, total: 0 }])} className="border-dashed h-8 text-[10px] font-bold">
                    <Plus className="mr-2 h-3 w-3" /> TAMBAH BARIS BARU
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Live Summary */}
        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className="shadow-md border-primary/20">
            <CardHeader className="bg-primary/5 py-4 border-b">
                <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                    Kalkulasi Finansial
                    <Badge variant="outline" className="bg-background text-[9px] font-black uppercase px-2">Ready</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Basic Totals */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold uppercase tracking-tighter">Gross Subtotal</span>
                    <span className="font-black">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                {/* Negotiation Logic */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Negotiation</Label>
                        <div className="flex bg-muted rounded p-0.5 scale-90 origin-right">
                            <Button variant={negotiationMode === 'percent' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setNegotiationMode('percent')}>%</Button>
                            <Button variant={negotiationMode === 'nominal' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setNegotiationMode('nominal')}>Rp</Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-bold text-red-600 bg-muted/10" placeholder="0" />
                        {negotiationMode === 'nominal' && calculatedNegNominal > 0 && (
                            <p className="text-[9px] text-right text-muted-foreground italic font-medium">Setara {(calculatedNegNominal / subtotal * 100 || 0).toFixed(1)}%</p>
                        )}
                    </div>
                </div>
              </div>

              <Separator />

              {/* DP & Retention Logic */}
              <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Uang Muka (DP)</Label>
                        <div className="flex bg-muted rounded p-0.5 scale-90 origin-right">
                            <Button variant={dpMode === 'percent' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setDpMode('percent')}>%</Button>
                            <Button variant={dpMode === 'nominal' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setDpMode('nominal')}>Rp</Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-9 text-right font-bold bg-muted/20" placeholder="0" />
                        {dpMode === 'nominal' && calculatedDpNominal > 0 && (
                            <p className="text-[9px] text-right text-muted-foreground italic font-medium">Setara {(calculatedDpNominal / (subtotal - calculatedNegNominal) * 100 || 0).toFixed(1)}%</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Potongan Retensi</Label>
                        <div className="flex bg-muted rounded p-0.5 scale-90 origin-right">
                            <Button variant={retentionMode === 'percent' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setRetentionMode('percent')}>%</Button>
                            <Button variant={retentionMode === 'nominal' ? 'secondary' : 'ghost'} size="sm" className="h-5 px-2 text-[9px] font-bold" onClick={() => setRetentionMode('nominal')}>Rp</Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Input value={retentionValue} onChange={e => setRetentionValue(e.target.value)} className="h-9 text-right font-bold text-amber-600 bg-muted/20" placeholder="0" />
                        {retentionMode === 'nominal' && calculatedRetNominal > 0 && (
                            <p className="text-[9px] text-right text-muted-foreground italic font-medium">Setara {(calculatedRetNominal / (subtotal - calculatedNegNominal) * 100 || 0).toFixed(1)}%</p>
                        )}
                    </div>
                </div>
              </div>

              {isOverLimit && (
                <div className="bg-red-50 border border-red-200 p-2 rounded-lg flex items-center gap-2 text-red-700 animate-pulse">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase">Peringatan: Potongan melebihi subtotal!</span>
                </div>
              )}

              <div className="bg-muted/50 p-4 rounded-xl space-y-4 border border-dashed border-primary/20">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1">
                        {isTaxManual ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        Rekonsiliasi Pajak (VAT)
                    </Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} />
                </div>

                <div className="grid gap-3">
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Dasar Pengenaan Pajak (DPP)</span>
                        <Input 
                            value={dppVat} 
                            onChange={e => setDppVat(e.target.value)} 
                            disabled={!isTaxManual} 
                            className={cn("h-8 text-right font-mono text-xs", isTaxManual ? "bg-white border-blue-400" : "bg-transparent border-none")} 
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">PPN (12%)</span>
                        <Input 
                            value={vat12} 
                            onChange={e => setVat12(e.target.value)} 
                            disabled={!isTaxManual} 
                            className={cn("h-8 text-right font-mono text-xs", isTaxManual ? "bg-white border-blue-400" : "bg-transparent border-none")} 
                        />
                    </div>
                    {isTaxManual && (
                        <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold text-blue-600" onClick={() => setIsTaxManual(false)}>
                            <RefreshCw className="mr-1 h-2.5 w-2.5" /> RESET KE HITUNGAN SISTEM
                        </Button>
                    )}
                </div>
              </div>

              <div className="pt-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Tagihan Baru (NET)</span>
                    <span className="text-2xl font-black text-primary leading-none">Rp {totalAmount}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                  <Button className="w-full h-11 bg-primary hover:bg-primary/90 font-black uppercase tracking-tighter shadow-lg" onClick={() => handleSaveInvoice('sent')} disabled={isOverLimit}>
                      <Send className="mr-2 h-4 w-4" /> TERBITKAN INVOICE
                  </Button>
                  <Button variant="outline" className="w-full h-11 font-black uppercase text-xs" onClick={handlePreview} disabled={isOverLimit}>
                      <Eye className="mr-2 h-4 w-4" /> PRATINJAU DOKUMEN
                  </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/50 border-amber-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-amber-800 flex items-center gap-2"><History className="h-3 w-3" /> Riwayat PO: {poNumber || '-'}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {previousPayments.length > 0 ? (
                    <>
                        <div className="space-y-1.5">
                            {previousPayments.map(inv => (
                                <div key={inv.id} className="flex justify-between text-[10px] border-b border-amber-100 pb-1">
                                    <span className="text-muted-foreground">{inv.id}</span>
                                    <span className="font-bold">Rp {inv.amount.toLocaleString('id-ID')}</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 flex justify-between font-black text-xs text-amber-900 uppercase">
                            <span>Akumulasi Tagihan:</span>
                            <span>Rp {totalPreviousAmount.toLocaleString('id-ID')}</span>
                        </div>
                    </>
                ) : <p className="text-[10px] text-muted-foreground italic text-center py-2">Belum ada penagihan untuk PO ini.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
