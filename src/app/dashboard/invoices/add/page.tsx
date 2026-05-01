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
  ReceiptText,
  Loader2,
  Trash2,
  History,
  Eye,
  ChevronsUpDown
} from 'lucide-react';
import { type Invoice, type SalesOrder, type UserProfile, type InvoiceItem, type InvoiceNumber } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
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
  
  const { customers: allCustomers, products: masterProducts, salesOrders: allSalesOrders } = useDashboardData();

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

  const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedSoNumber, setSelectedSoNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [isDpInvoice, setIsDpInvoice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'va'>('va');
  const [manualVaNumber, setManualVaNumber] = useState('');
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);

  // Calculation States
  const [negotiationValue, setNegotiationValue] = useState<string>('0');
  const [negotiationMode, setNegotiationMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpValue, setDpValue] = useState<string>('0');
  const [dpMode, setDpMode] = useState<'percent' | 'nominal'>('percent');
  const [retentionValue, setRetentionValue] = useState<string>('0');
  const [retentionMode, setRetentionMode] = useState<'percent' | 'nominal'>('nominal');
  const [dpDeductionValue, setDpDeductionValue] = useState<string>('0');
  const [dpDeductionMode, setDpDeductionMode] = useState<'percent' | 'nominal'>('nominal');

  useEffect(() => {
      if (activeIdentity) {
          if (!selectedSoNumber) setSelectedSoNumber(activeIdentity.salesOrder || '');
          if (activeIdentity.items && activeIdentity.items.length > 0 && items.length === 0) {
              setItems(activeIdentity.items);
          }
          if (activeIdentity.billingAddress) setBillingAddress(activeIdentity.billingAddress);
          if ((activeIdentity as Invoice).paymentMethod) setPaymentMethod((activeIdentity as Invoice).paymentMethod as any);
          if ((activeIdentity as Invoice).vaNumber) setManualVaNumber((activeIdentity as Invoice).vaNumber!);
          setIsDpInvoice(!!(activeIdentity as Invoice).isDpInvoice);
      }
  }, [activeIdentity]);

  const currentCustomer = useMemo(() => {
    if (!activeIdentity?.customer || !allCustomers) return null;
    return allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
  }, [activeIdentity?.customer, allCustomers]);

  useEffect(() => {
    if (currentCustomer && paymentMethod === 'va' && !manualVaNumber) {
        setManualVaNumber(currentCustomer.virtualAccountNumber || '');
    }
  }, [currentCustomer, paymentMethod]);

  const calcs = useMemo(() => {
    const subTotalItems = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const negInputVal = parseFormattedNumber(negotiationValue);
    const negotiation = negotiationMode === 'percent' ? (subTotalItems * (negInputVal / 100)) : negInputVal;
    const baseAfterNeg = Math.max(0, subTotalItems - negotiation);
    
    const dpInputVal = parseFormattedNumber(dpValue);
    const dpVal = dpMode === 'percent' ? (baseAfterNeg * (dpInputVal / 100)) : dpInputVal;
    
    const retInputVal = parseFormattedNumber(retentionValue);
    const retNominal = retentionMode === 'percent' ? (baseAfterNeg * (retInputVal / 100)) : retInputVal;
    
    const dpDedInputVal = parseFormattedNumber(dpDeductionValue);
    const dpDedNominal = dpDeductionMode === 'percent' ? (baseAfterNeg * (dpDedInputVal / 100)) : dpDedInputVal;

    // MANDATORY CALCULATION SINKRON (11/12)
    const dppVat = baseAfterNeg * (11 / 12);
    const vat12 = dppVat * 0.12;
    
    let totalRp = isDpInvoice ? dpVal : (baseAfterNeg + vat12 - dpDedNominal - retNominal);
    totalRp = Math.max(0, totalRp);

    return {
        subTotalItems,
        negotiation,
        dpValue: dpVal,
        dpPercent: subTotalItems > 0 ? Math.round((dpVal / subTotalItems) * 100) : 0,
        retensiValue: retNominal,
        dppVat,
        vat12,
        totalRp
    };
  }, [items, negotiationValue, negotiationMode, dpValue, dpMode, retentionValue, retentionMode, dpDeductionValue, dpDeductionMode, isDpInvoice]);

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
        customerName: activeIdentity.customer, // ADDED FOR PREVIEW SYNC
        customerCode: currentCustomer?.customerCode || '',
        billingAddress: billingAddress,
        date: format(issueDate, 'yyyy-MM-dd'),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: calcs.totalRp,
        status: invoiceStatus,
        isDpInvoice: isDpInvoice,
        paymentMethod: paymentMethod,
        vaNumber: paymentMethod === 'va' ? manualVaNumber : '',
        negotiation: calcs.negotiation,
        dpValue: calcs.dpValue,
        dpDeduction: parseFormattedNumber(dpDeductionValue),
        retention: calcs.retensiValue,
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

  const handleNumericChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') { setter(''); return; }
    const num = parseFormattedNumber(value);
    if (!isNaN(num)) {
        let formatted = formatNumberWithCommas(num);
        if (value.endsWith(',') || value.endsWith('.')) {
            if (!formatted.includes(',')) formatted += ',';
        }
        setter(formatted);
    }
  };

  if (isIdentityLoading || isExistingLoading) {
      return <div className="flex h-[80vh] items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Synchronizing Modules...</div>;
  }

  const isLocked = (existingInvoiceData?.status === 'finalized' || existingInvoiceData?.status === 'paid' || existingInvoiceData?.status === 'received') && !isAdmin;

  const previewInvoiceData = {
      ...activeIdentity,
      customerName: activeIdentity?.customer,
      billingAddress,
      paymentMethod,
      vaNumber: manualVaNumber,
      date: format(issueDate, 'dd MMM yyyy'),
  };

  return (
    <main className="flex flex-1 flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
      {/* TOPBAR */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white z-10">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10">
                  <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">Billing Constructor</h1>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Constructing Invoice ID: {activeIdentity?.id}</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <Button variant="ghost" className="font-bold text-xs uppercase" onClick={() => handleSaveInvoice('draft')}>Save Draft</Button>
              <Button 
                  className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-8 h-10 rounded-xl shadow-lg shadow-indigo-100" 
                  onClick={() => handleSaveInvoice('sent', true)}
                  disabled={isProcessing}
              >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-2 h-4 w-4" /> Save & Preview</>}
              </Button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          {/* EDITOR COLUMN */}
          <div className="w-[45%] overflow-y-auto p-8 border-r bg-slate-50/30">
              <div className="space-y-8 max-w-2xl mx-auto pb-20">
                  
                  <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                            <ReceiptText className="h-4 w-4 text-indigo-600" /> Header Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Invoice Date</Label>
                                <Input type="date" value={format(issueDate, 'yyyy-MM-dd')} onChange={e => setIssueDate(new Date(e.target.value))} className="h-10 font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Due Date</Label>
                                <Input type="date" value={format(dueDate, 'yyyy-MM-dd')} onChange={e => setDueDate(new Date(e.target.value))} className="h-10 font-bold border-rose-100 bg-rose-50/10" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sales Order (Mapping)</Label>
                            <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-bold border-slate-200">
                                        {selectedSoNumber || "Search SO..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search SO from active contracts..." />
                                        <CommandList>
                                            <CommandEmpty>No SO found.</CommandEmpty>
                                            <CommandGroup>
                                                {allSalesOrders?.filter(so => so.customer === activeIdentity?.customer).map((so) => (
                                                    <CommandItem
                                                        key={so.soNumber}
                                                        value={so.soNumber}
                                                        onSelect={(v) => { setSelectedSoNumber(v); setSoPopoverOpen(false); }}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-indigo-700">{so.soNumber}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">PO: {so.poNumber} • Rp {so.grandTotal.toLocaleString()}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Billing Address</Label>
                                <div className="flex gap-1.5">
                                    {currentCustomer?.addresses?.map(addr => (
                                        <Badge 
                                            key={addr.id} 
                                            variant="outline" 
                                            className={cn(
                                                "text-[8px] font-black uppercase cursor-pointer px-2 h-4", 
                                                billingAddress === addr.address ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400"
                                            )}
                                            onClick={() => setBillingAddress(addr.address)}
                                        >
                                            {addr.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <textarea 
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[10px] leading-tight font-medium italic min-h-[80px]"
                                value={billingAddress}
                                onChange={e => setBillingAddress(e.target.value)}
                                placeholder="Enter specific billing address..."
                            />
                        </div>
                    </CardContent>
                  </Card>

                  <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
                    <CardHeader className="bg-white border-b py-3 px-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Line Items</CardTitle>
                        <Switch checked={isDpInvoice} onCheckedChange={setIsDpInvoice} id="dp-mode" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="py-3 px-6 text-[8pt]">Description</TableHead>
                                        <TableHead className="w-[80px] text-center text-[8pt]">Qty</TableHead>
                                        <TableHead className="w-[120px] text-right text-[8pt]">Price</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Add items or link SO...</TableCell></TableRow>
                                    ) : items.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 group">
                                            <TableCell className="px-6 py-3">
                                                <Input 
                                                    value={item.name} 
                                                    onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                                                    className="h-8 text-[10px] font-bold border-none shadow-none bg-transparent p-0"
                                                />
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Input 
                                                    value={item.quantity} 
                                                    onChange={e => {
                                                        const val = parseFormattedNumber(e.target.value);
                                                        setItems(items.map(it => it.id === item.id ? { ...it, quantity: val, total: val * it.price } : it));
                                                    }} 
                                                    className="text-center h-8 text-[10px] font-black border-slate-200" 
                                                />
                                            </TableCell>
                                            <TableCell className="py-3 text-right">
                                                <Input 
                                                    value={formatNumberWithCommas(item.price)} 
                                                    onChange={e => {
                                                        const val = parseFormattedNumber(e.target.value);
                                                        setItems(items.map(it => it.id === item.id ? { ...it, price: val, total: it.quantity * val } : it));
                                                    }}
                                                    className="h-8 text-right text-[10px] font-black border-none shadow-none bg-transparent pr-0"
                                                />
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setItems(items.filter(it => it.id !== item.id))}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-center">
                            <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase text-indigo-600">
                                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Insert Manual Row
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="center">
                                    <Command>
                                        <CommandInput placeholder="Search catalog..." />
                                        <CommandList>
                                            <CommandEmpty>Not found.</CommandEmpty>
                                            <CommandGroup>
                                                {masterProducts?.map((p) => (
                                                    <CommandItem
                                                        key={p.id}
                                                        onSelect={() => {
                                                            const newItem: InvoiceItem = { id: `man-${Date.now()}`, name: p.name, quantity: 1, unit: p.unit || 'Meter', price: p.price, total: p.price };
                                                            setItems([...items, newItem]);
                                                            setProductPopoverOpen(false);
                                                        }}
                                                    >
                                                        <span className="text-[10px] font-bold">{p.name}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className={cn("shadow-sm border-none ring-1 ring-slate-200 overflow-hidden", isLocked && "opacity-60")}>
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <History className="h-4 w-4 text-emerald-600" /> Financial Adjustments
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">Negotiation</Label>
                                    <Select value={negotiationMode} onValueChange={(v: any) => setNegotiationMode(v)}>
                                        <SelectTrigger className="h-6 w-14 text-[8px] font-black uppercase px-2"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Input value={negotiationValue} onChange={handleNumericChange(setNegotiationValue)} className="h-9 text-right font-black" />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">Retention</Label>
                                    <Select value={retentionMode} onValueChange={(v: any) => setRetentionMode(v)}>
                                        <SelectTrigger className="h-6 w-14 text-[8px] font-black uppercase px-2"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Input value={retentionValue} onChange={handleNumericChange(setRetentionValue)} className="h-9 text-right font-black" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className={cn("space-y-2 p-4 rounded-xl border-2 transition-all", isDpInvoice ? "bg-indigo-50 border-indigo-100 ring-2 ring-indigo-50/50" : "bg-slate-50/30 border-slate-100 opacity-60")}>
                                <div className="flex justify-between items-center">
                                    <Label className="text-[9px] font-black uppercase text-indigo-700">Down Payment (DP)</Label>
                                    <Select value={dpMode} onValueChange={(v: any) => setDpMode(v)} disabled={!isDpInvoice}>
                                        <SelectTrigger className="h-6 w-14 text-[8px] font-black uppercase px-2"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Input value={dpValue} onChange={handleNumericChange(setDpValue)} disabled={!isDpInvoice} className="h-9 text-right font-black bg-white border-indigo-200" />
                            </div>

                            <div className={cn("space-y-2 p-4 rounded-xl border-2 transition-all", !isDpInvoice ? "bg-emerald-50 border-emerald-100" : "bg-slate-50/30 border-slate-100 opacity-60")}>
                                <div className="flex justify-between items-center">
                                    <Label className="text-[9px] font-black uppercase text-emerald-700">DP Credit Use</Label>
                                    <Select value={dpDeductionMode} onValueChange={(v: any) => setDpDeductionMode(v)} disabled={isDpInvoice}>
                                        <SelectTrigger className="h-6 w-14 text-[8px] font-black uppercase px-2"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="nominal">IDR</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Input value={dpDeductionValue} onChange={handleNumericChange(setDpDeductionValue)} disabled={isDpInvoice} className="h-9 text-right font-black bg-white border-emerald-200" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-dashed">
                             <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Payment Matrix</Label>
                                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                    <Button variant={paymentMethod === 'bank' ? 'white' : 'ghost'} size="sm" onClick={() => setPaymentMethod('bank')} className="h-7 text-[8px] font-black uppercase rounded-md px-3">Manual Bank</Button>
                                    <Button variant={paymentMethod === 'va' ? 'white' : 'ghost'} size="sm" onClick={() => setPaymentMethod('va')} className="h-7 text-[8px] font-black uppercase rounded-md px-3">Virtual Account</Button>
                                </div>
                             </div>
                             {paymentMethod === 'va' && (
                                 <div className="bg-indigo-900 p-4 rounded-xl space-y-2">
                                     <Label className="text-[8px] font-black uppercase text-indigo-300">Target Virtual Account</Label>
                                     <Input value={manualVaNumber} onChange={e => setManualVaNumber(e.target.value)} className="bg-indigo-800 border-indigo-700 text-white font-mono font-black text-center tracking-[0.2em] h-9 text-xs" />
                                 </div>
                             )}
                        </div>
                    </CardContent>
                  </Card>
              </div>
          </div>

          {/* PREVIEW COLUMN */}
          <div className="flex-1 bg-slate-200/50 overflow-y-auto scroll-smooth py-12 px-8">
              <div className="max-w-[210mm] mx-auto scale-[0.85] origin-top shadow-2xl">
                  <InvoiceTemplate 
                    type="Original"
                    invoiceData={previewInvoiceData}
                    items={items}
                    calculations={calcs}
                  />
              </div>
          </div>
      </div>
    </main>
  );
}
