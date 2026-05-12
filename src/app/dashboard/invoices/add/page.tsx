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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  ChevronLeft,
  Plus,
  ReceiptText,
  Loader2,
  Trash2,
  Eye,
  Percent,
  Layers,
  UserCircle2,
  MapPin,
  Building2,
  History,
  CalendarDays,
  Zap,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Edit3,
  Package,
  Search,
  Database,
  CreditCard,
  Banknote
} from 'lucide-react';
import { type Invoice, type UserProfile, type InvoiceItem, type InvoiceNumber, type ProductListItem } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
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
import { useDashboardData } from '../../layout';
import { InvoiceTemplate } from '@/app/components/invoice/invoice-layout';

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const editInvoiceId = searchParams.get('editInvoiceId');
  const invoiceNumberIdParam = searchParams.get('invoiceNumberId');
  
  const { 
    customers: allCustomers, 
    products: masterProducts, 
    invoices: allInvoices
  } = useDashboardData();

  const identityRef = useMemoFirebase(() => {
      if (!firestore || !invoiceNumberIdParam) return null;
      return doc(firestore, 'invoiceNumbers', invoiceNumberIdParam);
  }, [firestore, invoiceNumberIdParam]);
  const { data: identityData } = useDoc<InvoiceNumber>(identityRef);

  const existingInvoiceRef = useMemoFirebase(() => {
      if (!firestore || !editInvoiceId) return null;
      return doc(firestore, 'invoices', editInvoiceId);
  }, [firestore, editInvoiceId]);
  const { data: existingInvoiceData } = useDoc<Invoice>(existingInvoiceRef);

  const activeIdentity = existingInvoiceData || identityData;

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedSoNumber, setSelectedSoNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [paymentMode, setPaymentMode] = useState<'manual' | 'virtual_account'>('manual');
  const [paymentTerms, setPaymentTerms] = useState('90 Hari');
  const [selectedTermPreset, setSelectedTermPreset] = useState('90');
  const [manualVaNumber, setManualVaNumber] = useState('');
  const [isProcessing, setIsSaving] = useState(false);

  const [inputBuffer, setInputBuffer] = useState<Record<string, string>>({});

  // DP & Discount States
  const [dpDescription, setDpDescription] = useState('DP 35%');
  const [dpValue, setDpValue] = useState<string>('0');
  const [dpPercent, setDpPercent] = useState<string>('0');
  const [dpMode, setDpMode] = useState<'tagih' | 'kurangi'>('kurangi');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [discountLabel, setDiscountLabel] = useState('Discount');

  // OVERRIDE States for DPP and VAT (Excel Rule Support)
  const [manualDppVat, setManualDppVat] = useState<string | null>(null);
  const [manualVat12, setManualVat12] = useState<string | null>(null);

  // TRIGGER: Real-time DP % to Rp Calculation
  useEffect(() => {
    const p = parseFloat(dpPercent);
    if (!isNaN(p)) {
        const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
        const calculated = (p / 100) * subtotal;
        setDpValue(formatNumberWithCommas(calculated));
    }
  }, [dpPercent, items]);

  // TRIGGER: Hybrid Payment Term Logic (Auto Due Date)
  useEffect(() => {
    if (selectedTermPreset !== 'custom') {
      const days = parseInt(selectedTermPreset);
      if (!isNaN(days)) {
        setDueDate(addDays(issueDate, days));
        setPaymentTerms(days === 0 ? 'CBD' : `${days} Hari`);
      }
    }
  }, [issueDate, selectedTermPreset]);

  const currentCustomer = useMemo(() => {
    if (!activeIdentity?.customer || !allCustomers) return null;
    return allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
  }, [activeIdentity?.customer, allCustomers]);

  // PO History Pulling
  useEffect(() => {
    const po = activeIdentity?.poNumber;
    if (!po || !allInvoices || items.length > 0 || editInvoiceId) return;

    const previousInvoices = allInvoices
      .filter(inv => inv.poNumber === po && inv.id !== activeIdentity?.id && inv.status !== 'cancelled')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (previousInvoices.length > 0) {
      const latest = previousInvoices[0];
      if (latest.items && latest.items.length > 0) {
        setItems(latest.items.map(item => ({ ...item, id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` })));
      }
      if (latest.dpPercent !== undefined) {
        setDpPercent(String(latest.dpPercent));
        setDpMode(latest.dpMode || 'kurangi');
        setDpDescription(latest.dpDescription || 'DP');
      }
      if (latest.paymentTerms) setPaymentTerms(latest.paymentTerms);
      if (latest.paymentMode) setPaymentMode(latest.paymentMode as any);
      if (latest.vaNumber) setManualVaNumber(latest.vaNumber);
    }
  }, [activeIdentity?.poNumber, allInvoices, items.length, editInvoiceId, activeIdentity?.id]);

  useEffect(() => {
      if (activeIdentity) {
          if (!selectedSoNumber) setSelectedSoNumber(activeIdentity.salesOrder || (activeIdentity as any).soNumber || '');
          if (activeIdentity.items && activeIdentity.items.length > 0 && items.length === 0) {
              setItems(activeIdentity.items);
          } 
          if (activeIdentity.billingAddress) setBillingAddress(activeIdentity.billingAddress);
          else if (currentCustomer && !billingAddress) {
              const defaultAddr = currentCustomer.addresses?.find(a => a.isDefault) || currentCustomer.addresses?.[0];
              if (defaultAddr) setBillingAddress(defaultAddr.address);
          }
          if ((activeIdentity as Invoice).paymentMode) setPaymentMode((activeIdentity as Invoice).paymentMode as any);
          if ((activeIdentity as Invoice).paymentTerms) {
              setPaymentTerms((activeIdentity as Invoice).paymentTerms!);
              setSelectedTermPreset('custom');
          }
          if ((activeIdentity as Invoice).dueDate) setDueDate(new Date((activeIdentity as Invoice).dueDate!));
          if ((activeIdentity as Invoice).vaNumber) setManualVaNumber((activeIdentity as Invoice).vaNumber!);
          if ((activeIdentity as Invoice).dpDescription) setDpDescription((activeIdentity as Invoice).dpDescription!);
          if ((activeIdentity as Invoice).dpValue) setDpValue(formatNumberWithCommas((activeIdentity as Invoice).dpValue!));
          if ((activeIdentity as Invoice).dpPercent !== undefined) setDpPercent(String((activeIdentity as Invoice).dpPercent));
          if ((activeIdentity as Invoice).dpMode) setDpMode((activeIdentity as Invoice).dpMode!);
          if ((activeIdentity as Invoice).discount) setDiscountValue(formatNumberWithCommas((activeIdentity as Invoice).discount!));
          if ((activeIdentity as Invoice).dppVat) setManualDppVat(formatNumberWithCommas((activeIdentity as Invoice).dppVat));
          if ((activeIdentity as Invoice).vat12) setManualVat12(formatNumberWithCommas((activeIdentity as Invoice).vat12));
      }
  }, [activeIdentity, items.length, selectedSoNumber, currentCustomer, billingAddress]);

  useEffect(() => {
    if (currentCustomer && paymentMode === 'virtual_account' && !manualVaNumber) {
        setManualVaNumber(currentCustomer.virtualAccountNumber || '');
    }
  }, [currentCustomer, paymentMode, manualVaNumber]);

  const updateItemField = (id: string | number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
          updatedItem.total = (Number(updatedItem.quantity) || 0) * (Number(updatedItem.price) || 0);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string | number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleNumericInputChange = (id: string | number, field: 'quantity' | 'price', rawValue: string) => {
    const key = `${id}-${field}`;
    setInputBuffer(prev => ({ ...prev, [key]: rawValue }));
    const parsed = parseFormattedNumber(rawValue);
    updateItemField(id, field, parsed);
  };

  const calcs = useMemo(() => {
    const subTotalItems = items.reduce((acc, item) => acc + (item.total || 0), 0);
    const dpVal = parseFormattedNumber(dpValue);
    const discVal = parseFormattedNumber(discountValue);

    const goodsNet = Math.max(0, subTotalItems - discVal - dpVal);
    const autoDppVat = Math.round(goodsNet * 11 / 12);
    const finalDppVat = manualDppVat !== null ? parseFormattedNumber(manualDppVat) : autoDppVat;
    const autoVat12 = Math.round(finalDppVat * 0.12);
    const finalVat12 = manualVat12 !== null ? parseFormattedNumber(manualVat12) : autoVat12;
    const totalRp = goodsNet + finalVat12;

    return { 
        subTotalItems, 
        dpValue: dpVal, 
        discountValue: discVal, 
        goodsNet,
        autoDppVat,
        finalDppVat,
        autoVat12,
        finalVat12,
        totalRp 
    };
  }, [items, dpValue, discountValue, manualDppVat, manualVat12]);

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;
    setIsSaving(true);
    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    const dataToSave: any = {
        id: activeIdentity.id,
        soNumber: selectedSoNumber,
        poNumber: activeIdentity.poNumber || '',
        customer: activeIdentity.customer,
        customerName: activeIdentity.customer,
        customerCode: currentCustomer?.customerCode || '',
        billingAddress: billingAddress,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: calcs.totalRp,
        grandTotal: calcs.goodsNet, 
        status: invoiceStatus,
        paymentMode: paymentMode,
        paymentTerms: paymentTerms,
        vaNumber: (paymentMode === 'virtual_account' || manualVaNumber) ? manualVaNumber : '',
        dpValue: calcs.dpValue,
        dpPercent: Number(dpPercent) || 0,
        dpDescription: dpDescription,
        dpMode: dpMode,
        discount: calcs.discountValue,
        discountLabel: discountLabel,
        dppVat: calcs.finalDppVat,
        vat12: calcs.finalVat12,
        totalRp: calcs.totalRp,
        items: items.filter(i => i.quantity > 0),
        creatorId: user.uid,
        createdBy: updater,
        lastUpdatedAt: timestamp,
        lastUpdatedBy: updater
    };

    try {
        await setDoc(invoiceDocRef, dataToSave, { merge: true });
        if (redirectToPreview) router.push(`/dashboard/invoices/preview/${encodeURIComponent(activeIdentity.id)}`);
        else router.push('/dashboard/invoices');
    } catch (err) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: invoiceDocRef.path, operation: 'write', requestResourceData: dataToSave }));
    } finally {
        setIsSaving(false);
    }
  };

  const previewInvoiceData = {
      ...activeIdentity,
      items: items.filter(i => i.quantity > 0),
      customer: { name: activeIdentity?.customer, address: billingAddress },
      customerName: activeIdentity?.customer,
      customerCode: currentCustomer?.customerCode || '',
      billingAddress,
      soNumber: selectedSoNumber,
      paymentMode,
      paymentTerms,
      vaNumber: manualVaNumber,
      dpDescription,
      dpMode,
      dpValue: calcs.dpValue,
      dpPercent: Number(dpPercent) || 0,
      discount: calcs.discountValue,
      discountLabel: discountLabel,
      grandTotal: calcs.goodsNet, 
      dppVat: calcs.finalDppVat,
      vat12: calcs.finalVat12,
      totalRp: calcs.totalRp,
      date: format(issueDate, 'yyyy-MM-dd')
  } as any;

  return (
    <main className="flex flex-1 flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white z-10">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10"><ChevronLeft className="h-5 w-5" /></Button>
              <div>
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">Billing Constructor</h1>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Dakota Intelligent Billing Engine v2.0</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <Button 
                  className="font-black uppercase text-[10px] tracking-widest px-8 h-10 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => handleSaveInvoice('sent', true)}
                  disabled={isProcessing}
              >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-2 h-4 w-4" /> Save & Preview</>}
              </Button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-y-auto p-8 border-r bg-slate-50/30">
              <div className="space-y-8 max-w-4xl mx-auto pb-32">
                  
                  <Card className="border-none shadow-md ring-1 ring-indigo-200 bg-white overflow-hidden rounded-3xl">
                    <CardHeader className="py-4 px-6 bg-indigo-600 text-white">
                        <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest">
                            <Building2 className="h-4 w-4" /> Customer Profile Verification
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid gap-6">
                            <div className="flex items-start gap-4">
                                <div className="bg-indigo-50 p-3 rounded-2xl"><UserCircle2 className="h-6 w-6 text-indigo-600" /></div>
                                <div className="space-y-1 flex-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Legal PT Name</p>
                                    <p className="text-lg font-black text-slate-900 uppercase leading-none">{activeIdentity?.customer || 'Awaiting Selection...'}</p>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-slate-50 border-slate-200">{currentCustomer?.customerCode || 'NO CODE'}</Badge>
                                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-100">VA: {currentCustomer?.virtualAccountNumber || 'Manual Only'}</Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 pt-4 border-t border-slate-50">
                                <div className="bg-rose-50 p-3 rounded-2xl"><MapPin className="h-6 w-6 text-rose-600" /></div>
                                <div className="space-y-1 flex-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Official Billing Address</p>
                                    <p className="text-[11px] leading-relaxed font-bold text-slate-600 italic">
                                        {billingAddress || 'No address specified in record.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-indigo-100 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-indigo-50/50 border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-indigo-600 tracking-widest">
                            <Wallet className="h-4 w-4" /> Hybrid Payment Selector
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <Button 
                                variant={paymentMode === 'manual' ? 'default' : 'outline'} 
                                onClick={() => setPaymentMode('manual')}
                                className={cn("h-14 rounded-2xl flex flex-col items-center gap-1 font-black uppercase text-[10px] tracking-widest", paymentMode === 'manual' ? "bg-indigo-600" : "border-indigo-100")}
                            >
                                <Banknote className="h-4 w-4" /> Manual Transfer
                                <span className="text-[7px] opacity-60">Display Mandiri & BCA Regular</span>
                            </Button>
                            <Button 
                                variant={paymentMode === 'virtual_account' ? 'default' : 'outline'} 
                                onClick={() => setPaymentMode('virtual_account')}
                                className={cn("h-14 rounded-2xl flex flex-col items-center gap-1 font-black uppercase text-[10px] tracking-widest", paymentMode === 'virtual_account' ? "bg-emerald-600 hover:bg-emerald-700" : "border-emerald-100")}
                            >
                                <CreditCard className="h-4 w-4" /> Virtual Account
                                <span className="text-[7px] opacity-60">Display Only Mandiri VA</span>
                            </Button>
                        </div>

                        {paymentMode === 'virtual_account' && (
                            <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 border-dashed animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-[9px] font-black uppercase text-emerald-700">Verified Virtual Account Number</Label>
                                    <Badge className="bg-emerald-600 text-[7px] font-black uppercase">Active</Badge>
                                </div>
                                <Input 
                                    value={manualVaNumber} 
                                    onChange={e => setManualVaNumber(e.target.value)} 
                                    className="font-mono text-lg font-black tracking-widest text-emerald-900 bg-white border-emerald-200"
                                    placeholder="86625XXXXXXXXXXX"
                                />
                                <p className="text-[8px] text-emerald-600 font-bold uppercase mt-2 italic">*Hanya nomor ini yang akan muncul di footer invoice.</p>
                            </div>
                        )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                            <ReceiptText className="h-4 w-4 text-indigo-600" /> Invoice Header & Hybrid Terms
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Invoice Issue Date</Label>
                                <Input type="date" value={format(issueDate, 'yyyy-MM-dd')} onChange={e => setIssueDate(new Date(e.target.value))} className="h-10 font-bold rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Term Preset (Mapping)</Label>
                                <Select value={selectedTermPreset} onValueChange={setSelectedTermPreset}>
                                    <SelectTrigger className="h-10 font-bold rounded-xl bg-white border-indigo-200">
                                        <SelectValue placeholder="Pilih..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">CBD (0 Hari)</SelectItem>
                                        <SelectItem value="30">Net 30 (30 Hari)</SelectItem>
                                        <SelectItem value="60">Net 60 (60 Hari)</SelectItem>
                                        <SelectItem value="90">Net 90 (90 Hari)</SelectItem>
                                        <SelectItem value="custom">Custom / Lainnya...</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">Display Term (Invoice)</Label>
                                <Input 
                                    value={paymentTerms} 
                                    onChange={e => { setPaymentTerms(e.target.value); setSelectedTermPreset('custom'); }} 
                                    placeholder="E.g. CBD" 
                                    className="h-10 font-black border-indigo-200 rounded-xl" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">Due Date <CalendarDays className="h-3 w-3" /></Label>
                                <Input 
                                    type="date" 
                                    value={format(dueDate, 'yyyy-MM-dd')} 
                                    onChange={e => { setDueDate(new Date(e.target.value)); setSelectedTermPreset('custom'); }} 
                                    className="h-10 font-bold rounded-xl border-indigo-200" 
                                />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">Sales Order Reference (SO)</Label>
                                <Input value={selectedSoNumber} onChange={e => setSelectedSoNumber(e.target.value)} placeholder="SO-XXXX-..." className="h-10 font-black border-indigo-200 rounded-xl uppercase" />
                            </div>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Layers className="h-4 w-4 text-indigo-600" /> Line Items (Hybrid Input)
                            </CardTitle>
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase tracking-tighter">Auto-pull PO History Active</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="py-3 px-6 text-[10px] font-black uppercase min-w-[350px]">Item Description (Catalog & Manual)</TableHead>
                                        <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Qty</TableHead>
                                        <TableHead className="w-[120px] text-center text-[10px] font-black uppercase">Unit</TableHead>
                                        <TableHead className="w-[180px] text-right text-[10px] font-black uppercase">Price</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 group border-b last:border-0">
                                            <TableCell className="px-6 py-4">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="relative cursor-text">
                                                            <Input 
                                                                value={item.name} 
                                                                onChange={e => updateItemField(item.id, 'name', e.target.value)} 
                                                                className="h-9 text-xs font-black uppercase border-none shadow-none bg-transparent p-0 w-full focus-visible:ring-0 placeholder:italic" 
                                                                placeholder="Type Manual or Search Catalog..." 
                                                            />
                                                            <Search className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 pointer-events-none" />
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[550px] p-0 shadow-2xl rounded-2xl overflow-hidden border-indigo-100" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Cari Nama Material atau History..." className="h-11 font-medium" />
                                                            <CommandList className="max-h-[350px]">
                                                                <CommandEmpty className="py-6 text-center text-xs font-bold text-slate-400 italic">Material tidak ditemukan. Lanjutkan ketik manual.</CommandEmpty>
                                                                
                                                                <CommandGroup heading="Material Catalog (Pusat)" className="px-2 font-black uppercase text-[10px] text-emerald-600">
                                                                    {masterProducts?.map((p, i) => (
                                                                        <CommandItem key={`cat-${i}`} onSelect={() => {
                                                                            updateItemField(item.id, 'name', p.name);
                                                                            updateItemField(item.id, 'price', p.price);
                                                                            updateItemField(item.id, 'unit', p.unit);
                                                                        }} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer">
                                                                            <Package className="h-3.5 w-3.5 text-emerald-300" />
                                                                            <div className="flex flex-col"><span className="text-[10px] font-black uppercase">{p.name}</span><span className="text-[8px] text-muted-foreground">{p.unit} • Rp {p.price.toLocaleString()}</span></div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Input type="text" value={inputBuffer[`${item.id}-quantity`] || formatNumberWithCommas(item.quantity)} onChange={e => handleNumericInputChange(item.id, 'quantity', e.target.value)} className="text-center h-9 text-xs font-black rounded-lg" />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Input value={item.unit} onChange={e => updateItemField(item.id, 'unit', e.target.value)} className="text-center h-9 text-xs font-black border-indigo-100 bg-indigo-50/30 rounded-lg uppercase" placeholder="UOM" />
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <Input type="text" value={inputBuffer[`${item.id}-price`] || formatNumberWithCommas(item.price)} onChange={e => handleNumericInputChange(item.id, 'price', e.target.value)} className="h-9 text-right text-xs font-black rounded-lg" />
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-full" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-4 bg-slate-50/50 border-t flex justify-center">
                            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-50 rounded-xl" onClick={() => setItems([...items, { id: `man-${Date.now()}`, name: '', quantity: 1, unit: 'Meter', price: 0, total: 0 }])}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> Insert Manual Row
                            </Button>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Percent className="h-4 w-4 text-emerald-600" /> DP & Discount Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="p-5 bg-indigo-50/50 rounded-[2rem] border-2 border-indigo-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase text-indigo-700 tracking-widest flex items-center gap-2">
                                    <Database className="h-3.5 w-3.5" /> Down Payment (DP) - PO Synchronized
                                </Label>
                                <div className="flex bg-white rounded-xl p-1 border shadow-sm">
                                    <Button variant={dpMode === 'tagih' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('tagih')} className="h-8 text-[9px] font-black uppercase rounded-lg px-4">Tagih DP</Button>
                                    <Button variant={dpMode === 'kurangi' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('kurangi')} className="h-8 text-[9px] font-black uppercase rounded-lg px-4">Kurangi DP</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[8px] font-black uppercase text-slate-400">Percent (%)</Label>
                                    <Input type="text" value={dpPercent} onChange={e => setDpPercent(e.target.value)} className="h-11 font-black text-center text-indigo-600 bg-white border-indigo-100 rounded-xl" />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[8px] font-black uppercase text-slate-400">Nominal Rp (Auto-sync)</Label>
                                    <Input type="text" value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-11 font-black text-right bg-white border-indigo-100 rounded-xl" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4">
                            <div className="flex justify-between items-center">
                                <Select value={discountLabel} onValueChange={setDiscountLabel}>
                                    <SelectTrigger className="h-8 w-36 text-[9px] font-black uppercase bg-white rounded-lg border-none shadow-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl"><SelectItem value="Discount">Discount</SelectItem><SelectItem value="Negotiation">Negotiation</SelectItem></SelectContent>
                                </Select>
                                <Badge variant="outline" className="text-[8px] font-black uppercase">Final Reduction</Badge>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rp</span>
                                <Input type="text" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="h-12 font-black text-right pl-12 bg-white rounded-xl" placeholder="0" />
                            </div>
                        </div>
                    </CardContent>
                  </Card>

                  <div className="p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col gap-8">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1 w-full">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                    <Layers className="h-3 w-3" /> Gross Goods (Bruto)
                                </p>
                                <p className="text-sm font-black text-white">Rp {formatNumberWithCommas(calcs.subTotalItems)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                    <TrendingUp className="h-3 w-3" /> Potongan (DP+Disc)
                                </p>
                                <p className="text-sm font-black text-rose-400">- Rp {formatNumberWithCommas(calcs.dpValue + calcs.discountValue)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em] flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Goods (Basis Pajak)
                                </p>
                                <p className="text-sm font-black text-indigo-300">Rp {formatNumberWithCommas(calcs.goodsNet)}</p>
                            </div>
                        </div>

                        <div className="h-px w-full bg-slate-800" />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                    <Edit3 className="h-3 w-3 text-indigo-400" /> DPP VAT (11/12)
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">Rp</span>
                                    <Input 
                                        type="text" 
                                        value={manualDppVat !== null ? manualDppVat : formatNumberWithCommas(calcs.autoDppVat)} 
                                        onChange={e => setManualDppVat(e.target.value)}
                                        className={cn(
                                            "h-11 pl-9 font-black text-right rounded-xl border-none transition-all",
                                            manualDppVat !== null ? "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-500" : "bg-slate-800 text-slate-300"
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                    <Edit3 className="h-3 w-3 text-emerald-400" /> VAT 12%
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">Rp</span>
                                    <Input 
                                        type="text" 
                                        value={manualVat12 !== null ? manualVat12 : formatNumberWithCommas(calcs.autoVat12)} 
                                        onChange={e => setManualVat12(e.target.value)}
                                        className={cn(
                                            "h-11 pl-9 font-black text-right rounded-xl border-none transition-all",
                                            manualVat12 !== null ? "bg-emerald-950 text-emerald-300 ring-1 ring-emerald-500" : "bg-slate-800 text-slate-300"
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-1 flex items-center justify-end gap-2">
                                    <Wallet className="h-3 w-3" /> Total Rp (Grand Total)
                                </p>
                                <p className="text-3xl font-black text-white tracking-tighter italic">Rp {formatNumberWithCommas(calcs.totalRp)}</p>
                            </div>
                        </div>

                        {(manualDppVat !== null || manualVat12 !== null) && (
                            <div className="flex justify-center">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => { setManualDppVat(null); setManualVat12(null); }}
                                    className="text-[9px] font-black uppercase text-slate-500 hover:text-white"
                                >
                                    Reset to Auto-Calculation
                                </Button>
                            </div>
                        )}
                    </div>
                  </div>
              </div>
          </div>

          <div className="w-[45%] bg-slate-200/50 overflow-auto scroll-smooth py-12 px-4 md:px-8">
              <div className="flex flex-col items-center min-w-min min-h-full">
                  <div className="invoice-print-wrapper max-w-[210mm] w-full shadow-2xl rounded-xl overflow-visible origin-top scale-[0.7] md:scale-[0.8] xl:scale-[0.85] transition-all duration-300 bg-white">
                      <InvoiceTemplate type="Original" invoiceData={previewInvoiceData} />
                      <InvoiceTemplate type="Copy" invoiceData={previewInvoiceData} />
                  </div>
              </div>
          </div>
      </div>
    </main>
  );
}