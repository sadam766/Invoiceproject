
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays, isBefore, parseISO, startOfToday } from 'date-fns';
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
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Banknote,
} from 'lucide-react';
import { type InvoiceNumber, type Customer, type ProductListItem, type Invoice, type SalesOrder, type UserProfile, type VirtualAccount } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, setDoc, arrayUnion, updateDoc } from 'firebase/firestore';
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
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // --- CALCULATION STATES ---
  const [subtotal, setSubtotal] = useState(0);
  const [negotiationValue, setNegotiationValue] = useState<string | number>('');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpValue, setDpValue] = useState<string | number>('');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('nominal');
  const [retentionValue, setRetentionValue] = useState<string | number>('');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');

  const [calculatedNegNominal, setCalculatedNegNominal] = useState(0);
  const [calculatedDpNominal, setCalculatedDpNominal] = useState(0);
  const [calculatedRetNominal, setCalculatedRetNominal] = useState(0);
  const [isOverLimit, setIsOverLimit] = useState(false);

  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  const [paymentMethodText, setPaymentMethodMethodText] = useState('Bank Transfer');

  // Popovers
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  // --- DATA FETCHING ---
  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  // --- LOGIC: OVERDUE EXPOSURE ---
  const overdueExposure = useMemo(() => {
    if (!allInvoices || !customer) return [];
    const today = startOfToday();
    return allInvoices.filter(inv => 
        inv.customer === customer.name && 
        inv.status !== 'paid' && 
        inv.status !== 'cancelled' &&
        inv.dueDate && 
        isBefore(parseISO(inv.dueDate), today)
    );
  }, [allInvoices, customer]);

  const totalOverdueAmount = overdueExposure.reduce((sum, inv) => sum + inv.amount, 0);

  // --- LOGIC: INITIAL LOAD ---
  useEffect(() => {
    if (editInvoiceId && allInvoices) {
        const found = allInvoices.find(inv => inv.id.replace(/\//g, '_') === editInvoiceId);
        if (found) {
            setInvoiceId(found.id);
            setSoNumber(found.soNumber);
            setPoNumber(found.poNumber);
            setSjInput(found.sjNumbers?.join(', ') || '');
            const cust = customerListData?.find(c => c.name === found.customer);
            setCustomer(cust);
            setSelectedAddressId(cust?.addresses?.find(a => a.address === found.billingAddress)?.id || '');
            setIssueDate(found.date ? new Date(found.date) : new Date());
            setDueDate(found.dueDate ? new Date(found.dueDate) : undefined);
            setStatus(found.status as any);
            setIsFinalized(found.status === 'finalized');
            setIsPaid(found.status === 'paid');
            setCalculatedNegNominal(found.negotiation || 0);
            setCalculatedDpNominal(found.dpValue || 0);
            setCalculatedRetNominal(found.retention || 0);
        }
    }
  }, [editInvoiceId, allInvoices, customerListData]);

  // --- LOGIC: CALCULATIONS ---
  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (parseFormattedNumber(item.quantity) * parseFormattedNumber(item.price)), 0);
    setSubtotal(currentSubtotal);
  
    const negInputVal = parseFormattedNumber(String(negotiationValue));
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;
    setCalculatedNegNominal(negNominal);

    const baseAfterNeg = currentSubtotal - negNominal;

    const dpInputVal = parseFormattedNumber(String(dpValue));
    const dpNominal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;
    setCalculatedDpNominal(dpNominal);

    const retInputVal = parseFormattedNumber(String(retentionValue));
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;
    setCalculatedRetNominal(retNominal);

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

  const handleSaveInvoice = async (invoiceStatus: any = 'sent') => {
    if (!firestore || !user || !invoiceId || !customer || !issueDate || !selectedAddressId) {
        toast({ variant: "destructive", title: "Validation Error", description: "Lengkapi data wajib." });
        return;
    }

    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    const dataToSave: any = {
        id: invoiceId,
        soNumber: soNumber || '(Waiting SO)',
        poNumber: poNumber,
        customer: customer.name,
        billingAddress: customer.addresses.find(a => a.id === selectedAddressId)?.address || '',
        billingNpwp: customer.addresses.find(a => a.id === selectedAddressId)?.npwp || '',
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : format(addDays(issueDate, 30), 'yyyy-MM-dd'),
        amount: parseFormattedNumber(String(totalAmount)),
        status: invoiceStatus,
        paymentMethod: paymentMethodText,
        sjNumbers: sjInput.split(',').map(s => s.trim()).filter(s => s !== ''),
        negotiation: calculatedNegNominal,
        dpValue: calculatedDpNominal,
        retention: calculatedRetNominal,
        lastUpdatedAt: timestamp,
        lastUpdatedBy: updater,
        revisionLogs: arrayUnion({
            updatedBy: updater,
            updatedAt: timestamp,
            action: editInvoiceId ? "Document UPDATED" : "Document CREATED"
        })
    };

    if (!editInvoiceId) {
        dataToSave.ownerId = user.uid;
        dataToSave.createdBy = updater;
    }

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

  const isLocked = (isFinalized || isPaid) && !isSuperAdmin;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/invoices')} className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Invoice Constructor</h1>
                <div className="flex gap-2 mt-1">
                    {isFinalized && <Badge className="bg-indigo-600 text-[9px] font-black uppercase">FINALIZED & LOCKED</Badge>}
                    {isPaid && <Badge className="bg-emerald-600 text-[9px] font-black uppercase">PAID & SECURED</Badge>}
                </div>
            </div>
        </div>
      </div>

      {overdueExposure.length > 0 && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan Limit Pelanggan</AlertTitle>
              <AlertDescription>
                Customer ini memiliki <b>{overdueExposure.length} invoice Overdue</b> senilai <b>Rp {totalOverdueAmount.toLocaleString('id-ID')}</b>. 
                Mohon pertimbangkan sebelum menerbitkan tagihan baru.
              </AlertDescription>
          </Alert>
      )}

      {isPaid && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-black uppercase text-[10px]">Dokumen Lunas</AlertTitle>
              <AlertDescription className="text-xs">Invoice ini sudah dilunasi melalui Payment Center dan telah dikunci demi keamanan audit.</AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={cn("shadow-sm", isLocked && "opacity-60 pointer-events-none")}>
            <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Dokumen Utama
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">No. Invoice</Label>
                  <Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} className="font-bold" disabled={!!editInvoiceId} />
              </div>
              <div className="space-y-2">
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
                              <CommandInput placeholder="Cari PT..." />
                              <CommandList>
                                  {customerListData?.map(c => (
                                      <CommandItem key={c.id} value={c.name} onSelect={() => { setCustomer(c); setCustomerPopoverOpen(false); }}>
                                          {c.name}
                                      </CommandItem>
                                  ))}
                              </CommandList>
                          </Command>
                      </PopoverContent>
                  </Popover>
              </div>
              <div className="lg:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Alamat Penagihan (Cabang/Proyek)</Label>
                  <Select value={selectedAddressId} onValueChange={setSelectedAddressId} disabled={!customer}>
                      <SelectTrigger className="font-medium text-xs h-11">
                          <SelectValue placeholder="Pilih lokasi spesifik..." />
                      </SelectTrigger>
                      <SelectContent>
                          {customer?.addresses?.map(addr => (
                              <SelectItem key={addr.id} value={addr.id} className="text-xs">
                                  {addr.label} - {addr.address}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm", isLocked && "opacity-60 pointer-events-none")}>
            <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-sm font-black uppercase">Item Penagihan</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-2">Produk & Alias</TableHead>
                            <TableHead className="w-[80px] text-center text-[10px] font-black uppercase py-2">Qty</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Harga Satuan</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><Input value={item.name} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} className="h-9 text-xs" /></TableCell>
                                <TableCell><Input value={item.quantity} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value, total: parseFormattedNumber(e.target.value) * parseFormattedNumber(String(it.price)) } : it))} className="text-center text-xs h-9" /></TableCell>
                                <TableCell><Input value={item.price} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, price: e.target.value, total: parseFormattedNumber(String(it.quantity)) * parseFormattedNumber(e.target.value) } : it))} className="text-right text-xs h-9" /></TableCell>
                                <TableCell className="text-right font-black text-xs">Rp {formatNumberWithCommas(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="p-4 bg-muted/10 border-t">
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'm', price: 0, total: 0 }])} className="border-dashed h-8 text-[10px] font-bold">
                        <Plus className="mr-2 h-3 w-3" /> TAMBAH BARIS
                    </Button>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className={cn("shadow-md border-primary/20", isLocked && "opacity-80 pointer-events-none")}>
            <CardHeader className="bg-primary/5 py-4 border-b">
                <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                    Kalkulasi Finansial
                    {(isFinalized || isPaid) && <ShieldCheck className="h-4 w-4 text-indigo-600" />}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold uppercase">Subtotal</span>
                    <span className="font-black">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Negotiation</Label>
                    <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-bold text-red-600" placeholder="0" />
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Down Payment (DP)</Label>
                    <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-bold" placeholder="0" />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-xl space-y-4 border border-dashed">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-primary">Override Pajak (VAT)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} />
                </div>
                <div className="grid gap-3">
                    <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual} className="h-8 text-right font-mono text-xs" />
                    <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual} className="h-8 text-right font-mono text-xs" />
                </div>
              </div>

              <div className="pt-2 border-t">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Grand Total</span>
                  <div className="text-2xl font-black text-primary leading-none">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                      <Button className="w-full h-11 bg-primary font-black uppercase shadow-lg" onClick={() => handleSaveInvoice('sent')} disabled={isOverLimit}>
                        <Send className="mr-2 h-4 w-4" /> SIMPAN & TERBITKAN
                      </Button>
                  )}
                  {isSuperAdmin && !isFinalized && !isPaid && (
                      <Button variant="outline" className="w-full h-11 border-indigo-600 text-indigo-600 font-black uppercase text-xs" onClick={() => handleSaveInvoice('finalized')}>
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
