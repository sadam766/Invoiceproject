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
  UserCircle2
} from 'lucide-react';
import { type Invoice, type UserProfile, type InvoiceItem, type InvoiceNumber } from '@/app/lib/data';
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
  const [paymentMode, setPaymentMode] = useState<'manual' | 'virtual_account'>('virtual_account');
  const [paymentTerms, setPaymentTerms] = useState('90 Hari');
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

  const uniqueMasterProducts = useMemo(() => {
    if (!masterProducts) return [];
    const seen = new Set();
    return masterProducts.filter(p => {
      const nameLower = p.name.toLowerCase().trim();
      const duplicate = seen.has(nameLower);
      seen.add(nameLower);
      return !duplicate;
    });
  }, [masterProducts]);

  const itemHistorySuggestions = useMemo(() => {
    if (!activeIdentity?.customer || !allInvoices) return [];
    const customerItems: Record<string, { name: string, price: number, unit: string }> = {};
    
    allInvoices
        .filter(inv => inv.customer === activeIdentity.customer)
        .forEach(inv => {
            inv.items?.forEach(item => {
                const key = item.name.toLowerCase().trim();
                if (!customerItems[key]) {
                    customerItems[key] = { name: item.name, price: item.price, unit: item.unit };
                }
            });
        });
    return Object.values(customerItems);
  }, [activeIdentity?.customer, allInvoices]);

  useEffect(() => {
    const p = parseFloat(dpPercent);
    if (!isNaN(p)) {
        const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
        const calculated = (p / 100) * subtotal;
        setDpValue(formatNumberWithCommas(calculated));
    }
  }, [dpPercent, items]);

  useEffect(() => {
      if (activeIdentity) {
          if (!selectedSoNumber) setSelectedSoNumber(activeIdentity.salesOrder || '');
          if (activeIdentity.items && activeIdentity.items.length > 0 && items.length === 0) {
              setItems(activeIdentity.items);
          } 
          if (activeIdentity.billingAddress) setBillingAddress(activeIdentity.billingAddress);
          if ((activeIdentity as Invoice).paymentMode) setPaymentMode((activeIdentity as Invoice).paymentMode as any);
          if ((activeIdentity as Invoice).paymentTerms) setPaymentTerms((activeIdentity as Invoice).paymentTerms!);
          if ((activeIdentity as Invoice).vaNumber) setManualVaNumber((activeIdentity as Invoice).vaNumber!);
          if ((activeIdentity as Invoice).dpDescription) setDpDescription((activeIdentity as Invoice).dpDescription!);
          if ((activeIdentity as Invoice).dpValue) setDpValue(formatNumberWithCommas((activeIdentity as Invoice).dpValue!));
          if ((activeIdentity as Invoice).dpMode) setDpMode((activeIdentity as Invoice).dpMode!);
          if ((activeIdentity as Invoice).discount) setDiscountValue(formatNumberWithCommas((activeIdentity as Invoice).discount!));
      }
  }, [activeIdentity, items.length, selectedSoNumber]);

  const currentCustomer = useMemo(() => {
    if (!activeIdentity?.customer || !allCustomers) return null;
    return allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
  }, [activeIdentity?.customer, allCustomers]);

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

    let baseValue = subTotalItems;
    if (dpMode === 'tagih') {
        baseValue = subTotalItems + dpVal - discVal;
    } else {
        baseValue = Math.max(0, subTotalItems - dpVal - discVal);
    }

    const dppVat = Math.round(baseValue * (11 / 12));
    const vat12 = Math.round(dppVat * 0.12);
    const totalRp = dppVat + vat12;

    return { subTotalItems, dpValue: dpVal, discountValue: discVal, dppVat, vat12, totalRp };
  }, [items, dpValue, dpMode, discountValue]);

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
        status: invoiceStatus,
        paymentMode: paymentMode,
        paymentTerms: paymentTerms,
        vaNumber: paymentMode === 'virtual_account' ? manualVaNumber : '',
        dpValue: calcs.dpValue,
        dpDescription: dpDescription,
        dpMode: dpMode,
        discount: calcs.discountValue,
        discountLabel: discountLabel,
        dppVat: calcs.dppVat,
        vat12: calcs.vat12,
        items: items.filter(i => i.quantity > 0),
        creatorId: user.uid,
        createdBy: updater,
        lastUpdatedAt: timestamp,
        lastUpdatedBy: updater
    };

    try {
        await setDoc(invoiceDocRef, dataToSave, { merge: true });
        sessionStorage.setItem('invoicePreviewData', JSON.stringify({ ...dataToSave, grandTotal: calcs.subTotalItems }));
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
      discount: calcs.discountValue,
      discountLabel: discountLabel,
      grandTotal: calcs.subTotalItems, 
      dppVat: calcs.dppVat,
      vat12: calcs.vat12,
      totalRp: calcs.totalRp,
      date: format(issueDate, 'yyyy-MM-dd')
  };

  return (
    <main className="flex flex-1 flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white z-10">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10"><ChevronLeft className="h-5 w-5" /></Button>
              <div>
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">Billing Constructor</h1>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Standard Layout V2.0 — High Precision Mode</p>
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
          <div className="w-[48%] overflow-y-auto p-8 border-r bg-slate-50/30">
              <div className="space-y-8 max-w-2xl mx-auto pb-20">
                  <Card className="border-none shadow-sm ring-1 ring-indigo-200 bg-indigo-50/30 overflow-hidden">
                    <CardHeader className="py-3 px-6 bg-white border-b">
                        <CardTitle className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2">
                            <UserCircle2 className="h-4 w-4" /> Verified Customer Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Legal PT Name</p>
                                <p className="text-sm font-black text-slate-900 uppercase">{activeIdentity?.customer || 'Awaiting Selection...'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Billing/Delivery Point</p>
                                <p className="text-[11px] leading-relaxed font-medium text-slate-600 italic">
                                    {billingAddress || 'No specific address specified.'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                            <ReceiptText className="h-4 w-4 text-indigo-600" /> Header Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Invoice Date</Label>
                                <Input type="date" value={format(issueDate, 'yyyy-MM-dd')} onChange={e => setIssueDate(new Date(e.target.value))} className="h-10 font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">Payment Terms</Label>
                                <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="E.g. 90 Hari" className="h-10 font-black border-indigo-200" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">Sales Order Number (SO)</Label>
                                <Input value={selectedSoNumber} onChange={e => setSelectedSoNumber(e.target.value)} placeholder="SO-9923-..." className="h-10 font-black border-indigo-200" />
                            </div>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-600" /> Line Items (History Supported)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[400px] overflow-y-auto">
                            <Table className="table-auto w-full">
                                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="py-3 px-6 text-[10px] font-black uppercase">Description</TableHead>
                                        <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Qty</TableHead>
                                        <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Unit</TableHead>
                                        <TableHead className="w-[150px] text-right text-[10px] font-black uppercase">Price</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 group">
                                            <TableCell className="px-6 py-4">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Input value={item.name} onChange={e => updateItemField(item.id, 'name', e.target.value)} className="h-9 text-xs font-bold border-none shadow-none bg-transparent p-0 w-full focus-visible:ring-0" />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[450px] p-0 shadow-2xl" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search Catalog or History..." />
                                                            <CommandList>
                                                                <CommandEmpty>No matches found.</CommandEmpty>
                                                                <CommandGroup heading="Material Catalog">
                                                                    {uniqueMasterProducts.map((p, i) => (
                                                                        <CommandItem key={i} onSelect={() => {
                                                                            updateItemField(item.id, 'name', p.name);
                                                                            updateItemField(item.id, 'price', p.price);
                                                                            updateItemField(item.id, 'unit', p.unit);
                                                                        }}>
                                                                            <div className="flex flex-col"><span className="text-[10px] font-bold uppercase">{p.name}</span><span className="text-[8px] text-indigo-600">{p.unit} • Catalog Std Price</span></div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                                <CommandGroup heading="Customer History">
                                                                    {itemHistorySuggestions.map((h, i) => (
                                                                        <CommandItem key={i} onSelect={() => {
                                                                            updateItemField(item.id, 'name', h.name);
                                                                            updateItemField(item.id, 'price', h.price);
                                                                            updateItemField(item.id, 'unit', h.unit);
                                                                        }}>
                                                                            <div className="flex flex-col"><span className="text-[10px] font-bold uppercase">{h.name}</span><span className="text-[8px] text-muted-foreground">{h.unit} • Rp {h.price.toLocaleString()}</span></div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Input type="text" value={inputBuffer[`${item.id}-quantity`] || formatNumberWithCommas(item.quantity)} onChange={e => handleNumericInputChange(item.id, 'quantity', e.target.value)} className="text-center h-9 text-xs font-bold" />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Input value={item.unit} onChange={e => updateItemField(item.id, 'unit', e.target.value)} className="text-center h-9 text-xs font-bold border-dashed" placeholder="Unit" />
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <Input type="text" value={inputBuffer[`${item.id}-price`] || formatNumberWithCommas(item.price)} onChange={e => handleNumericInputChange(item.id, 'price', e.target.value)} className="h-9 text-right text-xs font-bold" />
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-300 hover:text-rose-600" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-center">
                            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase text-indigo-600" onClick={() => setItems([...items, { id: `man-${Date.now()}`, name: '', quantity: 1, unit: 'Meter', price: 0, total: 0 }])}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> Insert Manual Row
                            </Button>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Percent className="h-4 w-4 text-emerald-600" /> DP & Discount Logic
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase text-indigo-700">Uang Muka (DP)</Label>
                                <div className="flex bg-white rounded-lg p-1 border">
                                    <Button variant={dpMode === 'tagih' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('tagih')} className="h-7 text-[8px] font-black uppercase">Tagih DP</Button>
                                    <Button variant={dpMode === 'kurangi' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('kurangi')} className="h-7 text-[8px] font-black uppercase">Kurangi DP</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[8px] font-bold uppercase text-slate-400">Percent (%)</Label>
                                    <Input type="text" value={dpPercent} onChange={e => setDpPercent(e.target.value)} className="h-9 font-bold text-xs" />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[8px] font-bold uppercase text-slate-400">Nominal DP (Rp)</Label>
                                    <Input type="text" value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-9 font-black text-xs text-right bg-white" />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center">
                                <Select value={discountLabel} onValueChange={setDiscountLabel}>
                                    <SelectTrigger className="h-7 w-32 text-[8px] font-black uppercase"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Discount">Discount</SelectItem><SelectItem value="Negotiation">Negotiation</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Input type="text" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="h-10 font-black text-xs text-right" placeholder="Rp 0" />
                        </div>
                    </CardContent>
                  </Card>
              </div>
          </div>

          <div className="flex-1 bg-slate-200/50 overflow-y-auto scroll-smooth py-12 px-8">
              <div className="max-w-[210mm] mx-auto scale-[0.85] origin-top shadow-2xl">
                  <InvoiceTemplate type="Original" invoiceData={previewInvoiceData} />
                  <InvoiceTemplate type="Copy" invoiceData={previewInvoiceData} />
              </div>
          </div>
      </div>
    </main>
  );
}
