
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays, isBefore, parseISO, startOfToday } from 'date-fns';
import {
  ChevronLeft,
  Plus,
  Send,
  History,
  AlertTriangle,
  ShieldCheck,
  Banknote,
  ReceiptText,
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type SalesListItem, type Customer } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

type InvoiceItem = {
    id: number;
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

  const poNumberParam = searchParams.get('poNumber');
  const editInvoiceId = searchParams.get('editInvoiceId');
  
  // --- FORM STATES ---
  const [invoiceId, setInvoiceId] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingNpwp, setBillingNpwp] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
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

  const [isTaxManual, setIsTaxManual] = useState(false);
  const [dppVat, setDppVat] = useState<string | number>(0);
  const [vat12, setVat12] = useState<string | number>(0);
  const [totalAmount, setTotalAmount] = useState<string | number>(0);

  // --- DATA FETCHING ---
  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  const salesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'sales')) : null, [firestore]);
  const { data: allSales } = useCollection<SalesListItem>(salesCollection);

  const soItemsCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
  const { data: allSoItems } = useCollection<SalesOrder>(soItemsCollection);

  const invoicesCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices')) : null, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesCollection);

  const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  // --- LOGIC: AUTO-GENERATE INVOICE NUMBER ---
  useEffect(() => {
    if (!editInvoiceId && allInvoices && !invoiceId) {
        const now = new Date();
        const year = now.getFullYear();
        // Count existing for the year to increment
        const count = allInvoices.filter(inv => inv.id.includes(year.toString())).length + 1;
        setInvoiceId(`KW/${count.toString().padStart(4, '0')}/KEU/${year}`);
    }
  }, [allInvoices, editInvoiceId, invoiceId]);

  // --- LOGIC: INITIAL LOAD FROM PO ---
  useEffect(() => {
    if (poNumberParam && allSales && allSoItems && customerListData) {
        const foundSale = allSales.find(s => s.poNumber === poNumberParam);
        if (foundSale) {
            setPoNumber(foundSale.poNumber);
            setSoNumber(foundSale.soNumber || '');
            setCustomerName(foundSale.customer);
            
            // Auto-fetch default address
            const cust = customerListData.find(c => c.name === foundSale.customer);
            if (cust) {
                const defAddr = cust.addresses?.find(a => a.isDefault) || cust.addresses?.[0];
                setBillingAddress(defAddr?.address || '');
                setBillingNpwp(defAddr?.npwp || '');
            }

            // Auto-load items
            const relatedItems = allSoItems.filter(item => item.poNumber === poNumberParam || item.soNumber === foundSale.soNumber);
            setItems(relatedItems.map((item, idx) => ({
                id: idx,
                name: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.quantity * item.price
            })));
        }
    }
  }, [poNumberParam, allSales, allSoItems, customerListData]);

  // --- LOGIC: EDIT MODE ---
  useEffect(() => {
    if (editInvoiceId && allInvoices) {
        const found = allInvoices.find(inv => inv.id.replace(/\//g, '_') === editInvoiceId);
        if (found) {
            setInvoiceId(found.id);
            setSoNumber(found.soNumber);
            setPoNumber(found.poNumber);
            setCustomerName(found.customer);
            setBillingAddress(found.billingAddress);
            setBillingNpwp(found.billingNpwp || '');
            setIssueDate(found.date ? new Date(found.date) : new Date());
            setIsFinalized(found.status === 'finalized');
            setIsPaid(found.status === 'paid');
            setNegotiationValue(found.negotiation || '');
            setDpValue(found.dpValue || '');
            setRetentionValue(found.retention || '');
        }
    }
  }, [editInvoiceId, allInvoices]);

  // --- LOGIC: CALCULATIONS ---
  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (parseFormattedNumber(item.quantity) * parseFormattedNumber(item.price)), 0);
    setSubtotal(currentSubtotal);
  
    const negInputVal = parseFormattedNumber(String(negotiationValue));
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;

    const baseAfterNeg = currentSubtotal - negNominal;

    const dpInputVal = parseFormattedNumber(String(dpValue));
    const dpNominal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;

    const retInputVal = parseFormattedNumber(String(retentionValue));
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;

    if (!isTaxManual) {
        const calculatedDpp = baseAfterNeg;
        const calculatedVat = calculatedDpp * 0.12;
        setDppVat(formatNumberWithCommas(calculatedDpp));
        setVat12(formatNumberWithCommas(calculatedVat));
    }

    const currentDpp = parseFormattedNumber(String(dppVat));
    const currentVat = parseFormattedNumber(String(vat12));
    setTotalAmount(formatNumberWithCommas(currentDpp + currentVat - dpNominal - retNominal));
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, isTaxManual, dppVat, vat12]);

  const handleSaveInvoice = async (invoiceStatus: any = 'sent') => {
    if (!firestore || !user || !invoiceId || !customerName) {
        toast({ variant: "destructive", title: "Gagal Simpan", description: "Nomor Invoice dan Customer wajib ada." });
        return;
    }

    const safeInvoiceId = invoiceId.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    const dataToSave: any = {
        id: invoiceId,
        soNumber: soNumber,
        poNumber: poNumber,
        customer: customerName,
        billingAddress: billingAddress,
        billingNpwp: billingNpwp,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: parseFormattedNumber(String(totalAmount)),
        status: invoiceStatus,
        negotiation: parseFormattedNumber(String(negotiationValue)),
        dpValue: parseFormattedNumber(String(dpValue)),
        retention: parseFormattedNumber(String(retentionValue)),
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
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Pembuatan invoice otomatis berbasis PO/SO.</p>
            </div>
        </div>
      </div>

      {isPaid && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-black uppercase text-[10px]">Dokumen Lunas</AlertTitle>
              <AlertDescription className="text-xs">Invoice ini sudah dilunasi dan terkunci untuk audit.</AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        {/* LEFT COLUMN: PRIMARY DATA */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={cn("shadow-sm border-none ring-1 ring-border", isLocked && "opacity-60 pointer-events-none")}>
            <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-primary" /> Identitas Penagihan
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">No. Invoice (Auto)</Label>
                  <Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} className="font-black text-indigo-700 bg-indigo-50/30" disabled={!!editInvoiceId} />
              </div>
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Customer</Label>
                  <Input value={customerName} disabled className="font-bold uppercase" />
              </div>
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Referensi PO</Label>
                  <Input value={poNumber} disabled className="font-mono" />
              </div>
              <div className="lg:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Alamat Penagihan & NPWP</Label>
                  <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="font-medium" placeholder="Alamat lengkap..." />
                  <Input value={billingNpwp} onChange={e => setBillingNpwp(e.target.value)} className="font-mono text-xs mt-2" placeholder="NPWP..." />
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-none ring-1 ring-border", isLocked && "opacity-60 pointer-events-none")}>
            <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-sm font-black uppercase">Item Penagihan (Sync SO)</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-2">Nama Produk / Jasa</TableHead>
                            <TableHead className="w-[80px] text-center text-[10px] font-black uppercase py-2">Qty</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Harga Satuan</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">Belum ada item SO terdeteksi.</TableCell></TableRow>
                        ) : items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><Input value={item.name} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} className="h-9 text-xs font-bold" /></TableCell>
                                <TableCell><Input value={item.quantity} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value, total: parseFormattedNumber(e.target.value) * parseFormattedNumber(String(it.price)) } : it))} className="text-center text-xs h-9 font-bold" /></TableCell>
                                <TableCell><Input value={item.price} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, price: e.target.value, total: parseFormattedNumber(String(it.quantity)) * parseFormattedNumber(e.target.value) } : it))} className="text-right text-xs h-9 font-bold" /></TableCell>
                                <TableCell className="text-right font-black text-xs text-slate-800">Rp {formatNumberWithCommas(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="p-4 bg-muted/10 border-t">
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'm', price: 0, total: 0 }])} className="border-dashed h-8 text-[10px] font-bold">
                        <Plus className="mr-2 h-3 w-3" /> TAMBAH BARIS MANUAL
                    </Button>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: FINANCIAL SUMMARY */}
        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className={cn("shadow-md border-none ring-1 ring-primary/20", isLocked && "opacity-80 pointer-events-none")}>
            <CardHeader className="bg-primary/5 py-4 border-b">
                <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                    Kalkulasi Finansial
                    {(isFinalized || isPaid) && <ShieldCheck className="h-4 w-4 text-indigo-600" />}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-black uppercase tracking-widest">Gross Subtotal</span>
                    <span className="font-black">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-red-600">Negotiation</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)}>
                            <SelectTrigger className="h-6 w-16 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-black text-red-600 border-red-100 bg-red-50/30" placeholder="0" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase text-slate-800">Down Payment (DP)</Label>
                        <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)}>
                            <SelectTrigger className="h-6 w-16 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-black border-slate-200" placeholder="0" />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-xl space-y-4 border border-dashed">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-primary">Override Pajak (VAT)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} />
                </div>
                <div className="grid gap-3">
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-muted-foreground">Dasar Pengenaan Pajak (DPP)</span>
                        <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual} className="h-8 text-right font-mono text-xs font-bold" />
                    </div>
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-muted-foreground">PPN (12%)</span>
                        <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual} className="h-8 text-right font-mono text-xs font-bold" />
                    </div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Grand Total Tagihan</span>
                  <div className="text-2xl font-black text-primary leading-none mt-1">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                      <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase shadow-lg text-white" onClick={() => handleSaveInvoice('sent')}>
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
          
          <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-center">
             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Preview PDF tersedia setelah simpan.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
