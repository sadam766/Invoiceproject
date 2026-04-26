
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
  Cpu,
  Info,
  Hash,
  Database,
  Lock,
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type SalesListItem, type Customer, type InvoiceItem, type InvoiceNumber } from '@/app/lib/data';
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
  // 1. Identity Link Fetch (Source of Truth for the ID)
  const identityRef = useMemoFirebase(() => {
      if (!firestore || !invoiceNumberIdParam) return null;
      return doc(firestore, 'invoiceNumbers', invoiceNumberIdParam);
  }, [firestore, invoiceNumberIdParam]);
  const { data: identityData, isLoading: isIdentityLoading } = useDoc<InvoiceNumber>(identityRef);

  // 2. Existing Invoice Fetch (If in Edit Mode)
  const existingInvoiceRef = useMemoFirebase(() => {
      if (!firestore || !editInvoiceId) return null;
      return doc(firestore, 'invoices', editInvoiceId);
  }, [firestore, editInvoiceId]);
  const { data: existingInvoiceData } = useDoc<Invoice>(existingInvoiceRef);

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

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

  // --- PROTEKSI & REDIRECT ---
  useEffect(() => {
      if (!isIdentityLoading && !identityData && !editInvoiceId) {
          toast({ variant: "destructive", title: "Akses Ditolak", description: "Identitas Invoice tidak ditemukan. Mohon pilih nomor terlebih dahulu." });
          router.replace('/dashboard/invoices/number');
      }
  }, [identityData, isIdentityLoading, editInvoiceId, router]);

  // --- LOGIC: POPULATE DATA FROM IDENTITY ---
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
              setItems(relatedItems.map((item, idx) => ({
                  id: idx.toString(),
                  name: item.productName,
                  quantity: item.quantity,
                  unit: item.unit,
                  price: item.price,
                  total: item.quantity * item.price
              })));
          }
      }
  }, [identityData, customerListData, allSoItems, editInvoiceId]);

  // --- LOGIC: EDIT MODE POPULATION ---
  useEffect(() => {
      if (existingInvoiceData) {
          setItems(existingInvoiceData.items || []);
          setBillingAddress(existingInvoiceData.billingAddress || '');
          setBillingNpwp(existingInvoiceData.billingNpwp || '');
          setInternalNote(existingInvoiceData.erpInvoiceId || '');
          setIsDpInvoice(!!existingInvoiceData.isDpInvoice);
          setNegotiationValue(existingInvoiceData.negotiation || '');
          setDpValue(existingInvoiceData.dpValue || '');
          setRetentionValue(existingInvoiceData.retention || '');
          setDpDeductionValue(existingInvoiceData.dpDeduction || '');
          setIssueDate(existingInvoiceData.date ? new Date(existingInvoiceData.date) : new Date());
      }
  }, [existingInvoiceData]);

  // --- LOGIC: CALCULATIONS ---
  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    setSubtotal(currentSubtotal);
    const negInputVal = parseFormattedNumber(String(negotiationValue));
    const negNominal = negotiationMode === 'percent' ? (currentSubtotal * (negInputVal / 100)) : negInputVal;
    const baseAfterNeg = currentSubtotal - negNominal;
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
    const grand = isDpInvoice ? dpNominal : (currentDpp + currentVat - dpDedNominal - retNominal);
    setTotalAmount(formatNumberWithCommas(grand));
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, dpDeductionValue, dpDeductionMode, isTaxManual, dppVat, vat12, isDpInvoice]);

  const handleSaveInvoice = async (invoiceStatus: any = 'sent') => {
    const activeIdentity = existingInvoiceData || identityData;
    if (!firestore || !user || !activeIdentity) {
        toast({ variant: "destructive", title: "Gagal Simpan", description: "Identitas Invoice tidak valid." });
        return;
    }

    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

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

  const activeIdentity = existingInvoiceData || identityData;
  if (isIdentityLoading || (!activeIdentity && !editInvoiceId)) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-muted-foreground animate-pulse">Syncing Constructor with Database...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid') && !isSuperAdmin;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Invoice Constructor</h1>
                <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    Identitas Terkunci <Badge variant="secondary" className="text-[8px] bg-emerald-100 text-emerald-700 h-3.5"><Lock className="h-2 w-2 mr-1" /> Database Persistent</Badge>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-indigo-700">Mode Tagihan:</Label>
                <Badge variant={isDpInvoice ? "default" : "outline"} className={cn("text-[9px] uppercase cursor-pointer", isDpInvoice ? "bg-indigo-600" : "text-indigo-600 border-indigo-200")} onClick={() => !isLocked && setIsDpInvoice(!isDpInvoice)}>
                   {isDpInvoice ? "Down Payment (DP)" : "Tagihan Barang / Progress"}
                </Badge>
            </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7 items-start">
        <div className="lg:col-span-5 space-y-6">
          <Card className={cn("shadow-sm border-none ring-1 ring-border bg-muted/5", isLocked && "opacity-60")}>
            <CardHeader className="bg-muted/30 border-b py-3">
                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-muted-foreground tracking-widest">
                    <ReceiptText className="h-4 w-4" /> Identitas Penagihan (ReadOnly)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Invoice Number</Label>
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border-2 border-indigo-100 shadow-sm">
                          <Hash className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="font-black text-indigo-700">{activeIdentity?.id || 'N/A'}</span>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Customer</Label>
                      <div className="bg-white px-3 py-2 rounded-md border border-slate-200 text-xs font-black uppercase truncate">{activeIdentity?.customer}</div>
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Referensi PO / SO</Label>
                      <div className="bg-white px-3 py-2 rounded-md border border-slate-200 text-xs font-mono font-bold truncate">
                          {activeIdentity?.poNumber} {((activeIdentity as any).salesOrder || activeIdentity?.soNumber) && `• ${(activeIdentity as any).salesOrder || activeIdentity?.soNumber}`}
                      </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Alamat Penagihan & NPWP</Label>
                      <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="font-medium h-9 text-xs" placeholder="Alamat lengkap..." disabled={isLocked} />
                      <Input value={billingNpwp} onChange={e => setBillingNpwp(e.target.value)} className="font-mono text-[10px] mt-2 h-8 bg-muted/30" placeholder="NPWP..." disabled={isLocked} />
                  </div>

                  <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Internal Note / ERP Ref</Label>
                      <Input 
                        value={internalNote} 
                        onChange={e => setInternalNote(e.target.value)} 
                        className="font-mono text-[10px] h-9" 
                        placeholder="Catatan sistem..." 
                        disabled={isLocked}
                      />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-none ring-1 ring-border", isLocked && "opacity-60", isDpInvoice && "opacity-40 grayscale pointer-events-none")}>
            <CardHeader className="bg-muted/30 border-b py-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Item Progress Tracking</CardTitle>
                    {isDpInvoice && <Badge variant="secondary" className="text-[8px] uppercase">Disabled in DP Mode</Badge>}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase py-2">Nama Produk / Jasa</TableHead>
                            <TableHead className="w-[100px] text-center text-[10px] font-black uppercase py-2">Now Billing</TableHead>
                            <TableHead className="w-[80px] text-center text-[10px] font-black uppercase py-2">Unit</TableHead>
                            <TableHead className="w-[140px] text-right text-[10px] font-black uppercase py-2">Total (IDR)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic text-xs">Belum ada item terdeteksi.</TableCell></TableRow>
                        ) : items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><Input value={item.name} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} className="h-8 text-[11px] font-bold" disabled={isLocked} /></TableCell>
                                <TableCell>
                                    <Input 
                                        value={item.quantity} 
                                        onChange={e => {
                                            const val = parseFormattedNumber(e.target.value);
                                            setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                        }} 
                                        className="text-center text-xs h-8 font-black bg-blue-50/50" 
                                        disabled={isLocked}
                                    />
                                </TableCell>
                                <TableCell className="text-center text-[10px] font-bold uppercase">{item.unit}</TableCell>
                                <TableCell className="text-right font-black text-xs text-slate-800">Rp {formatNumberWithCommas(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="p-4 bg-muted/10 border-t flex justify-between items-center">
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: Date.now().toString(), name: '', quantity: 1, unit: 'm', price: 0, total: 0 }])} className="border-dashed h-8 text-[9px] font-black uppercase" disabled={isLocked}>
                        <Plus className="mr-2 h-3 w-3" /> Tambah Baris Manual
                    </Button>
                    <p className="text-[10px] font-bold text-muted-foreground italic">Total {items.length} Baris Produk</p>
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6 sticky top-24">
          <Card className={cn("shadow-md border-none ring-1 ring-primary/20", isLocked && "opacity-80")}>
            <CardHeader className="bg-primary/5 py-4 border-b">
                <CardTitle className="text-xs font-black uppercase flex items-center justify-between tracking-widest">
                    Summary Kalkulasi
                    {(existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid') && <ShieldCheck className="h-4 w-4 text-indigo-600" />}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-black uppercase tracking-widest">Gross Subtotal</span>
                    <span className="font-black">Rp {formatNumberWithCommas(subtotal)}</span>
                </div>
                
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label className="text-[9px] font-black uppercase text-red-600 tracking-tighter">Negotiation / Discount</Label>
                        <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={negotiationValue} onChange={e => setNegotiationValue(e.target.value)} className="h-8 text-right font-black text-red-600 border-red-100 bg-red-50/30" placeholder="0" disabled={isLocked} />
                </div>

                {isDpInvoice ? (
                    <div className="space-y-1.5 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                        <div className="flex justify-between items-center">
                            <Label className="text-[9px] font-black uppercase text-indigo-700 tracking-tighter">Tagihan Down Payment</Label>
                            <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-8 text-right font-black border-indigo-200" placeholder="0" disabled={isLocked} />
                    </div>
                ) : (
                    <div className="space-y-1.5 bg-emerald-50/30 p-3 rounded-xl border border-emerald-100">
                        <div className="flex justify-between items-center">
                            <Label className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Deduction from DP</Label>
                            <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isLocked}>
                                <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <Input value={dpDeductionValue} onChange={e => setDpDeductionValue(e.target.value)} className="h-8 text-right font-black border-emerald-200 text-emerald-700" placeholder="0" disabled={isLocked} />
                    </div>
                )}

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label className="text-[9px] font-black uppercase text-slate-800 tracking-tighter">Retention (Safety Fund)</Label>
                        <Select value={retentionMode} onValueChange={(v: any) => setRetentionMode(v)} disabled={isLocked}>
                            <SelectTrigger className="h-5 w-14 text-[8px] font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Input value={retentionValue} onChange={e => setRetentionValue(e.target.value)} className="h-8 text-right font-black border-slate-200" placeholder="0" disabled={isLocked} />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-xl space-y-4 border border-dashed">
                <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase text-primary">Override Pajak (VAT)</Label>
                    <Switch checked={isTaxManual} onCheckedChange={setIsTaxManual} disabled={isLocked} />
                </div>
                <div className="grid gap-3">
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-muted-foreground">Dasar Pengenaan Pajak (DPP)</span>
                        <Input value={dppVat} onChange={e => setDppVat(e.target.value)} disabled={!isTaxManual || isLocked} className="h-8 text-right font-mono text-xs font-bold" />
                    </div>
                    <div className="grid gap-1">
                        <span className="text-[8px] font-black uppercase text-muted-foreground">PPN (12%)</span>
                        <Input value={vat12} onChange={e => setVat12(e.target.value)} disabled={!isTaxManual || isLocked} className="h-8 text-right font-mono text-xs font-bold" />
                    </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-primary/20">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Grand Total Tagihan</span>
                  <div className="text-2xl font-black text-primary leading-none mt-1">Rp {totalAmount}</div>
              </div>

              <div className="space-y-3 pt-4">
                  {!isLocked && (
                      <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase shadow-lg text-white" onClick={() => handleSaveInvoice('sent')}>
                        <Send className="mr-2 h-4 w-4" /> SIMPAN & TERBITKAN
                      </Button>
                  )}
                  {isSuperAdmin && existingInvoiceData?.status !== 'finalized' && existingInvoiceData?.status !== 'paid' && (
                      <Button variant="outline" className="w-full h-11 border-indigo-600 text-indigo-600 font-black uppercase text-[10px] tracking-widest" onClick={() => handleSaveInvoice('finalized')}>
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
