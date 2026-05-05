
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
  ChevronsUpDown,
  AlertTriangle,
  Clock,
  Percent,
  MapPin,
  Building2,
  Home,
  Check,
  Target,
  Wallet,
  ShieldAlert,
  Layers,
  Zap
} from 'lucide-react';
import { type Invoice, type UserProfile, type InvoiceItem, type InvoiceNumber, type SalesListItem } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, setDoc, arrayUnion, addDoc, getDocs, where } from 'firebase/firestore';
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
import { Progress } from '@/components/ui/progress';

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
    salesOrders: allSalesOrders, 
    invoices: allInvoices,
    sales: allSalesRecords
  } = useDashboardData();

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

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedSoNumber, setSelectedSoNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'va'>('va');
  const [paymentTerms, setPaymentTerms] = useState('90 Hari');
  const [manualVaNumber, setManualVaNumber] = useState('');
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [isProcessing, setIsSaving] = useState(false);

  // DP & Discount States
  const [dpDescription, setDpDescription] = useState('DP 35%');
  const [dpValue, setDpValue] = useState<string>('0');
  const [dpMode, setDpMode] = useState<'tagih' | 'kurangi'>('kurangi');
  const [discountValue, setDiscountValue] = useState<string>('0');

  // SMART HISTORY: Build a list of unique previously used items for this customer
  const itemHistorySuggestions = useMemo(() => {
    if (!activeIdentity?.customer || !allInvoices) return [];
    const customerItems: Record<string, { name: string, price: number, unit: string }> = {};
    
    allInvoices
        .filter(inv => inv.customer === activeIdentity.customer)
        .forEach(inv => {
            inv.items?.forEach(item => {
                const key = item.name.toLowerCase();
                if (!customerItems[key]) {
                    customerItems[key] = { name: item.name, price: item.price, unit: item.unit };
                }
            });
        });
    return Object.values(customerItems);
  }, [activeIdentity?.customer, allInvoices]);

  // PO Monitoring Logic
  const poRecord = useMemo(() => {
    if (!activeIdentity?.poNumber || !allSalesRecords) return null;
    return allSalesRecords.find(s => s.poNumber === activeIdentity.poNumber);
  }, [activeIdentity?.poNumber, allSalesRecords]);

  // SMART LOGIC: Auto-apply Payment Scheme from PO Blueprint
  useEffect(() => {
    if (poRecord && poRecord.paymentScheme && items.length > 0 && !editInvoiceId) {
        // Find existing invoices for this PO
        const poInvoices = allInvoices?.filter(inv => inv.poNumber === poRecord.poNumber && inv.status !== 'cancelled') || [];
        
        // Count how many stages are already invoiced
        const invoicedStagesCount = poInvoices.length;
        const currentStageIndex = invoicedStagesCount;
        
        if (currentStageIndex < poRecord.paymentScheme.length) {
            const nextStage = poRecord.paymentScheme[currentStageIndex];
            
            // Auto-configure DP section based on blueprint
            setDpDescription(nextStage.label + " " + nextStage.percent + "%");
            
            // Logic: First stage is usually "Tagih DP", subsequent are "Kurangi DP" (Pelunasan)
            if (currentStageIndex === 0) {
                setDpMode('tagih');
            } else {
                setDpMode('kurangi');
            }
            
            toast({ 
                title: "Blueprint Applied", 
                description: `Mengikuti skema penagihan PO: Tahap ${currentStageIndex + 1} (${nextStage.label}).`,
                duration: 5000
            });
        }
    }
  }, [poRecord, items.length, editInvoiceId, allInvoices, toast]);

  // Load Initial Data
  useEffect(() => {
      if (activeIdentity) {
          if (!selectedSoNumber) setSelectedSoNumber(activeIdentity.salesOrder || '');
          
          if (activeIdentity.items && activeIdentity.items.length > 0 && items.length === 0) {
              setItems(activeIdentity.items);
          } 
          else if ((!activeIdentity.items || activeIdentity.items.length === 0) && items.length === 0 && activeIdentity.poNumber && allInvoices) {
              const prevInvoices = allInvoices
                .filter(inv => inv.poNumber === activeIdentity.poNumber && inv.status !== 'cancelled')
                .sort((a, b) => b.date.localeCompare(a.date));
              
              if (prevInvoices.length > 0 && prevInvoices[0].items) {
                  setItems(prevInvoices[0].items);
                  toast({ title: "Items Auto-Pulled", description: "Mengambil data rincian barang dari invoice terakhir untuk PO yang sama." });
              }
          }

          if (activeIdentity.billingAddress) setBillingAddress(activeIdentity.billingAddress);
          if ((activeIdentity as Invoice).paymentMethod) setPaymentMethod((activeIdentity as Invoice).paymentMethod as any);
          if ((activeIdentity as Invoice).paymentTerms) setPaymentTerms((activeIdentity as Invoice).paymentTerms!);
          if ((activeIdentity as Invoice).vaNumber) setManualVaNumber((activeIdentity as Invoice).vaNumber!);
          
          if ((activeIdentity as Invoice).dpDescription) setDpDescription((activeIdentity as Invoice).dpDescription!);
          if ((activeIdentity as Invoice).dpValue) setDpValue(formatNumberWithCommas((activeIdentity as Invoice).dpValue!));
          if ((activeIdentity as Invoice).dpMode) setDpMode((activeIdentity as Invoice).dpMode!);
          if ((activeIdentity as Invoice).discount) setDiscountValue(formatNumberWithCommas((activeIdentity as Invoice).discount!));
      }
  }, [activeIdentity, allInvoices, items.length, selectedSoNumber, toast]);

  const currentCustomer = useMemo(() => {
    if (!activeIdentity?.customer || !allCustomers) return null;
    return allCustomers.find(c => c.name.toLowerCase() === activeIdentity.customer.toLowerCase());
  }, [activeIdentity?.customer, allCustomers]);

  const previouslyInvoiced = useMemo(() => {
    if (!activeIdentity?.poNumber || !allInvoices) return 0;
    return allInvoices
      .filter(inv => inv.poNumber === activeIdentity.poNumber && inv.id !== activeIdentity.id && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [activeIdentity?.poNumber, allInvoices, activeIdentity?.id]);

  // Auto-calculate DP from percentage
  useEffect(() => {
    const match = dpDescription.match(/(\d+)%/);
    if (match && match[1]) {
        const percent = parseInt(match[1], 10);
        const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
        const calculated = (percent / 100) * subtotal;
        setDpValue(formatNumberWithCommas(calculated));
    }
  }, [dpDescription, items]);

  useEffect(() => {
    if (currentCustomer && paymentMethod === 'va' && !manualVaNumber) {
        setManualVaNumber(currentCustomer.virtualAccountNumber || '');
    }
  }, [currentCustomer, paymentMethod, manualVaNumber]);

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
    setItems(items.filter(i => i.id !== id));
  };

  const calcs = useMemo(() => {
    const subTotalItems = items.reduce((acc, item) => acc + (item.total || 0), 0);
    const dpVal = parseFormattedNumber(dpValue);
    const discVal = parseFormattedNumber(discountValue);

    let baseValue = subTotalItems;
    if (dpMode === 'tagih') {
        baseValue = dpVal;
    } else {
        baseValue = Math.max(0, subTotalItems - dpVal - discVal);
    }

    // Logic e-Faktur: 11/12 integer rounding for DPP Nilai Lain
    const dppVat = Math.round(baseValue * (11 / 12));
    const vat12 = Math.round(dppVat * 0.12);
    const totalRp = dppVat + vat12;

    return {
        subTotalItems,
        dpValue: dpVal,
        discountValue: discVal,
        dppVat,
        vat12,
        totalRp
    };
  }, [items, dpValue, dpMode, discountValue]);

  const poUtilization = useMemo(() => {
    if (!poRecord) return { used: 0, current: 0, total: 0, percent: 0, remaining: 0 };
    const used = previouslyInvoiced;
    const current = calcs.totalRp;
    const total = poRecord.amount;
    const combined = used + current;
    return {
        used,
        current,
        total,
        percent: total > 0 ? (combined / total) * 100 : 0,
        remaining: Math.max(0, total - combined),
        isOverLimit: combined > total + 100 
    };
  }, [poRecord, previouslyInvoiced, calcs.totalRp]);

  const handleSaveInvoice = async (invoiceStatus: any = 'sent', redirectToPreview = false) => {
    if (!firestore || !user || !activeIdentity) return;
    
    if (poUtilization.isOverLimit) {
        toast({ variant: "destructive", title: "Plafon PO Terlampaui", description: "Nilai tagihan melebihi sisa plafon PO. Silakan sesuaikan item barang." });
        return;
    }

    setIsSaving(true);
    const safeInvoiceId = activeIdentity.id.replace(/\//g, '_');
    const invoiceDocRef = doc(firestore, 'invoices', safeInvoiceId);
    const timestamp = new Date().toISOString();
    const updater = userProfile?.displayName || user.email || 'System';

    let finalStatus = invoiceStatus;
    let finalVaStatus = null;
    let requiresVaApproval = false;

    if (paymentMethod === 'va') {
        finalVaStatus = 'pending';
        if (invoiceStatus === 'sent') {
            finalStatus = 'unpaid'; 
            requiresVaApproval = true;
        }
    } else {
        finalVaStatus = 'approved';
        if (invoiceStatus === 'sent') {
            finalStatus = 'sent'; 
        }
    }

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
        status: finalStatus,
        vaStatus: finalVaStatus,
        paymentMethod: paymentMethod,
        paymentTerms: paymentTerms,
        vaNumber: paymentMethod === 'va' ? manualVaNumber : '',
        dpValue: calcs.dpValue,
        dpDescription: dpDescription,
        dpMode: dpMode,
        discount: calcs.discountValue,
        dppVat: calcs.dppVat,
        vat12: calcs.vat12,
        items: items,
        creatorId: user.uid,
        createdBy: updater,
        lastUpdatedAt: timestamp,
        lastUpdatedBy: updater,
        isProforma: activeIdentity.id.startsWith('KW'),
        revisionLogs: arrayUnion({
            updatedBy: updater,
            updatedAt: timestamp,
            action: editInvoiceId ? "Document UPDATED" : "Document CREATED"
        })
    };

    try {
        await setDoc(invoiceDocRef, dataToSave, { merge: true });

        if (requiresVaApproval) {
            const leadersQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
            const leadersSnap = await getDocs(leadersQuery);
            
            const notifPromises = leadersSnap.docs.map(lDoc => {
                return addDoc(collection(firestore, 'notifications'), {
                    recipientId: lDoc.id,
                    senderId: user.uid,
                    title: "VA Approval Required",
                    message: `Virtual Account untuk Invoice ${activeIdentity.id} memerlukan persetujuan Leader.`,
                    invoiceId: activeIdentity.id,
                    status: 'unread',
                    createdAt: timestamp
                });
            });
            await Promise.all(notifPromises);
        }

        if (redirectToPreview) {
            router.push(`/dashboard/invoices/preview/${encodeURIComponent(activeIdentity.id)}`);
        } else {
            router.push('/dashboard/invoices');
        }
    } catch (err) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: invoiceDocRef.path, operation: 'write', requestResourceData: dataToSave
        }));
    } finally {
        setIsSaving(false);
    }
  };

  const previewInvoiceData = {
      ...activeIdentity,
      customerName: activeIdentity?.customer,
      billingAddress,
      paymentMethod,
      paymentTerms,
      vaNumber: manualVaNumber,
      dpDescription,
      dpMode,
      dpValue: calcs.dpValue,
      discount: calcs.discountValue,
      date: format(issueDate, 'dd MMM yyyy'),
      isProforma: activeIdentity?.id.startsWith('KW')
  };

  return (
    <main className="flex flex-1 flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white z-10">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10">
                  <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">Billing Constructor</h1>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Standard Layout V2.0 — High Precision Mode</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <Button variant="ghost" className="font-bold text-xs uppercase" onClick={() => handleSaveInvoice('draft')}>Save Draft</Button>
              <Button 
                  className={cn(
                    "font-black uppercase text-[10px] tracking-widest px-8 h-10 rounded-xl shadow-lg transition-all",
                    poUtilization.isOverLimit ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                  )}
                  onClick={() => handleSaveInvoice('sent', true)}
                  disabled={isProcessing || poUtilization.isOverLimit}
              >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-2 h-4 w-4" /> Save & Preview</>}
              </Button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          {/* EDITOR COLUMN */}
          <div className="w-[48%] overflow-y-auto p-8 border-r bg-slate-50/30">
              <div className="space-y-8 max-w-2xl mx-auto pb-20">
                  
                  {/* PO MONITORING WIDGET */}
                  {poRecord && (
                    <Card className={cn(
                        "border-none shadow-sm ring-1 overflow-hidden",
                        poUtilization.isOverLimit ? "ring-rose-500 bg-rose-50/30" : "ring-slate-200 bg-white"
                    )}>
                        <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-500 tracking-widest">
                                    <Target className="h-4 w-4 text-indigo-600" /> Plafon PO Control
                                </CardTitle>
                                {poUtilization.isOverLimit && <Badge className="bg-rose-600 text-[8px] uppercase font-black animate-pulse"><ShieldAlert className="h-2 w-2 mr-1" /> LIMIT REACHED</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 gap-8 mb-6">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Kontrak (PO)</p>
                                    <p className="text-sm font-black text-slate-900">Rp {formatNumberWithCommas(poRecord.amount)}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo Tersedia</p>
                                    <p className={cn("text-sm font-black", poUtilization.isOverLimit ? "text-rose-600" : "text-emerald-600")}>
                                        Rp {formatNumberWithCommas(poUtilization.remaining)}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                    <span>Pemanfaatan PO</span>
                                    <span>{poUtilization.percent.toFixed(1)}%</span>
                                </div>
                                <Progress 
                                    value={Math.min(100, poUtilization.percent)} 
                                    className={cn("h-1.5", poUtilization.isOverLimit ? "bg-rose-100" : "bg-slate-100")} 
                                />
                                <div className="flex gap-4 pt-2">
                                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Prev: Rp {formatNumberWithCommas(poUtilization.used)}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-indigo-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Current: Rp {formatNumberWithCommas(poUtilization.current)}
                                    </div>
                                </div>
                            </div>

                            {/* SMART BLUEPRINT STATUS */}
                            {poRecord.paymentScheme && (
                                <div className="mt-6 pt-4 border-t border-dashed flex items-center gap-3">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase text-slate-400">Blueprint Active</span>
                                        <span className="text-[10px] font-bold text-slate-700">Scheme: {poRecord.paymentScheme.map(s => `${s.percent}%`).join(' - ')}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                  )}

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
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-indigo-500" /> Payment Terms
                                </Label>
                                <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="E.g. 90 Hari" className="h-10 font-black border-indigo-200" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-indigo-500" /> Billing Address
                                </Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase bg-slate-100" disabled={!currentCustomer}>
                                            <Building2 className="h-2.5 w-2.5 mr-1" /> Pick from Hub
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-2">
                                        <div className="space-y-1">
                                            {currentCustomer?.addresses?.map((addr) => (
                                                <Button 
                                                    key={addr.id} 
                                                    variant="ghost" 
                                                    className="w-full justify-start text-left h-auto py-3 px-3 rounded-lg hover:bg-indigo-50"
                                                    onClick={() => setBillingAddress(addr.address)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {addr.label.toLowerCase().includes('office') ? <Home className="h-4 w-4 text-indigo-600 mt-0.5" /> : <Building2 className="h-4 w-4 text-amber-600 mt-0.5" />}
                                                        <div className="flex flex-col">
                                                            <span className="font-black uppercase text-[9px] tracking-tight">{addr.label}</span>
                                                            <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{addr.address}</p>
                                                        </div>
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <textarea 
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[10px] leading-tight font-medium italic min-h-[80px] focus:ring-1 focus:ring-indigo-400 outline-none"
                                value={billingAddress}
                                onChange={e => setBillingAddress(e.target.value)}
                                placeholder="Enter specific billing address..."
                            />
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="bg-white border-b py-3 px-6">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-600" /> Line Items (Max 10)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="py-3 px-6 text-[8pt]">Description</TableHead>
                                        <TableHead className="w-[70px] text-center text-[8pt]">Qty</TableHead>
                                        <TableHead className="w-[100px] text-center text-[8pt]">Unit</TableHead>
                                        <TableHead className="w-[120px] text-right text-[8pt]">Price</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-[10px] font-bold text-slate-300 uppercase italic">Add items to start...</TableCell></TableRow>
                                    ) : items.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 group">
                                            <TableCell className="px-6 py-3">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Input 
                                                            value={item.name} 
                                                            onChange={e => updateItemField(item.id, 'name', e.target.value)}
                                                            className="h-8 text-[10px] font-bold border-none shadow-none bg-transparent p-0 w-full"
                                                        />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search History..." />
                                                            <CommandList>
                                                                <CommandEmpty>No history for this customer.</CommandEmpty>
                                                                <CommandGroup heading="Recent Purchases">
                                                                    {itemHistorySuggestions.filter(h => h.name.toLowerCase().includes(item.name.toLowerCase())).map((h, i) => (
                                                                        <CommandItem 
                                                                            key={i} 
                                                                            onSelect={() => {
                                                                                updateItemField(item.id, 'name', h.name);
                                                                                updateItemField(item.id, 'price', h.price);
                                                                                updateItemField(item.id, 'unit', h.unit);
                                                                            }}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase">{h.name}</span>
                                                                                <span className="text-[8px] text-muted-foreground">{h.unit} • Rp {h.price.toLocaleString()}</span>
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Input 
                                                    value={formatNumberWithCommas(item.quantity)} 
                                                    onChange={e => updateItemField(item.id, 'quantity', parseFormattedNumber(e.target.value))} 
                                                    className="text-center h-8 text-[10px] font-black border-slate-200 px-1" 
                                                />
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Input 
                                                    value={item.unit} 
                                                    onChange={e => updateItemField(item.id, 'unit', e.target.value)} 
                                                    className="text-center h-8 text-[10px] font-bold bg-slate-50 border-none px-1" 
                                                    placeholder="Meter"
                                                />
                                            </TableCell>
                                            <TableCell className="py-3 text-right">
                                                <Input 
                                                    value={formatNumberWithCommas(item.price)} 
                                                    onChange={e => updateItemField(item.id, 'price', parseFormattedNumber(e.target.value))}
                                                    className="h-8 text-right text-[10px] font-black border-none shadow-none bg-transparent pr-0"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-300 hover:text-rose-600" onClick={() => removeItem(item.id)}>
                                                    <Trash2 className="h-3 w-3" />
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

                  <Card className="shadow-sm border-none ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="bg-white border-b py-3 px-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Percent className="h-4 w-4 text-emerald-600" /> DP & Discount Logic
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid gap-6">
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-black uppercase text-indigo-700">Uang Muka (DP)</Label>
                                    <div className="flex bg-white rounded-lg p-1 border">
                                        <Button variant={dpMode === 'tagih' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('tagih')} className="h-7 text-[8px] font-black uppercase">Tagih DP</Button>
                                        <Button variant={dpMode === 'kurangi' ? 'default' : 'ghost'} size="sm" onClick={() => setDpMode('kurangi')} className="h-7 text-[8px] font-black uppercase">Kurangi DP</Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[8px] font-bold uppercase text-slate-400">Deskripsi (e.g. DP 35%)</Label>
                                        <Input 
                                            value={dpDescription} 
                                            onChange={e => setDpDescription(e.target.value)} 
                                            className="h-9 font-bold text-xs" 
                                            placeholder="Ketik persentase..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[8px] font-bold uppercase text-slate-400">Nominal DP</Label>
                                        <Input value={dpValue} onChange={e => setDpValue(e.target.value)} className="h-9 font-black text-xs text-right bg-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 px-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Potongan Diskon (Nominal)</Label>
                                <Input value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="h-10 font-black text-right border-emerald-100" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-dashed">
                             <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Payment Matrix</Label>
                                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                    <Button variant={paymentMethod === 'bank' ? 'default' : 'ghost'} size="sm" onClick={() => setPaymentMethod('bank')} className="h-7 text-[8px] font-black uppercase rounded-md px-3">Manual Bank</Button>
                                    <Button variant={paymentMethod === 'va' ? 'default' : 'ghost'} size="sm" onClick={() => setPaymentMethod('va')} className="h-7 text-[8px] font-black uppercase rounded-md px-3">Virtual Account</Button>
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
