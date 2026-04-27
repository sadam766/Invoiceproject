'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Switch } from '@/components/ui/switch';
  import { Label } from '@/components/ui/label';
  import { 
    Search, 
    Eye, 
    TrendingUp, 
    CreditCard, 
    AlertCircle, 
    LayoutGrid, 
    List, 
    MoreVertical, 
    FileText,
    User,
    ClipboardCheck,
    Banknote,
    ReceiptText,
    Scale,
    Wallet,
    BadgeCheck,
    History,
    Filter,
    ArrowRight,
    CheckCircle2,
    Clock
  } from 'lucide-react';
  import { type SalesListItem, type Invoice, type TaxInvoice, type UserProfile } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
  import { collection, query, doc, writeBatch, updateDoc } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { PaymentDetailDialog } from './_components/payment-detail-dialog';
  import { RecordPaymentDialog } from './_components/record-payment-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { isBefore, parseISO, startOfToday } from 'date-fns';
  
  type MergedRecord = SalesListItem & {
    relatedInvoices: (Invoice & { taxInfo?: TaxInvoice })[];
    totalPaid: number;
    outstanding: number;
    latestInvoiceDate?: string;
    latestTaxNumber?: string;
  };

  export default function SalesManagementPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState<MergedRecord | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'book'>('list');
    const [activeTab, setActiveTab] = useState('outstanding');
    
    // Multi-select for bulk payment
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

    const firestore = useFirestore();
    const { user } = useUser();

    const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

    const salesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sales'));
    }, [firestore]);
    const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

    const taxInvoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'taxInvoices'));
    }, [firestore]);
    const { data: taxInvoiceList, isLoading: isTaxLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);
    
    const isLoading = isSalesLoading || isInvoicesLoading || isTaxLoading;

    const mergedData = useMemo((): MergedRecord[] => {
        if (!salesList || !invoiceList) return [];

        return salesList.map(sale => {
            const related = invoiceList.filter(inv => inv.poNumber === sale.poNumber && inv.status !== 'cancelled').map(inv => {
                const tax = taxInvoiceList?.find(t => t.invoiceNumber === inv.id);
                return { ...inv, taxInfo: tax };
            });

            const systemPaid = related.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            const totalPaid = (sale.paidOffline || 0) + systemPaid;
            
            let status: any = 'Waiting';
            if (totalPaid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (totalPaid > 0) status = 'Partial';

            const latestInv = [...related].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestTax = related.find(r => r.taxInfo)?.taxInfo?.taxInvoiceNumber;

            return {
                ...sale,
                status,
                relatedInvoices: related,
                totalPaid,
                outstanding: Math.max(0, sale.amount - totalPaid),
                latestInvoiceDate: latestInv?.date,
                latestTaxNumber: latestTax
            };
        }).filter(item => {
            const searchMatch = item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.customer.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (activeTab === 'outstanding' && item.outstanding <= 0 && item.amount > 0) return false;
            if (activeTab === 'paid' && item.outstanding > 0) return false;
            
            return searchMatch;
        }).sort((a, b) => b.outstanding - a.outstanding);
    }, [salesList, invoiceList, taxInvoiceList, searchQuery, activeTab]);

    const totals = useMemo(() => {
        if (!salesList || !invoiceList) return { po: 0, paid: 0, outstanding: 0 };
        const totalPo = salesList.reduce((sum, item) => sum + item.amount, 0);
        
        const systemPaid = invoiceList.filter(i => i.status === 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + i.amount, 0);
        const legacyPaid = salesList.reduce((sum, i) => sum + (i.paidOffline || 0), 0);
        
        return {
            po: totalPo,
            paid: systemPaid + legacyPaid,
            outstanding: Math.max(0, totalPo - (systemPaid + legacyPaid))
        };
    }, [salesList, invoiceList]);

    const handleToggleInvoice = (id: string) => {
        const next = new Set(selectedInvoiceIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInvoiceIds(next);
    };

    const handleRecordBulkPayment = () => {
        if (selectedInvoiceIds.size === 0) return;
        setRecordPaymentOpen(true);
    };

    const handlePaymentSuccess = async (paymentData: any) => {
        if (!firestore) return;
        
        const batch = writeBatch(firestore);
        const timestamp = new Date().toISOString();
        const recorder = userProfile?.displayName || user?.email || 'System';

        const selectedInvoices = invoiceList?.filter(inv => selectedInvoiceIds.has(inv.id)) || [];

        selectedInvoices.forEach(inv => {
            const safeId = inv.id.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeId);
            
            batch.update(invRef, {
                status: 'paid',
                payments: [
                    ...(inv.payments || []),
                    {
                        id: doc(collection(firestore, 'dummy')).id,
                        date: paymentData.date,
                        amount: inv.amount, 
                        reference: paymentData.reference,
                        method: paymentData.method,
                        recordedBy: recorder
                    }
                ],
                lastUpdatedAt: timestamp,
                lastUpdatedBy: recorder,
                revisionLogs: [
                    ...(inv.revisionLogs || []),
                    { updatedAt: timestamp, updatedBy: recorder, action: `Payment Verified (Smart Checklist) by ${recorder}: ${paymentData.reference}` }
                ]
            });
        });

        await batch.commit();
        toast({ title: "Pelunasan Berhasil", description: `${selectedInvoiceIds.size} Invoice telah ditandai lunas dan dipindahkan ke tab SELESAI.` });
        setSelectedInvoiceIds(new Set());
        setRecordPaymentOpen(false);
    };

    const today = startOfToday();

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background animate-in fade-in duration-500">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">Payment & Receivables</h1>
                <p className="text-slate-500 font-medium flex items-center gap-2">
                    Monitoring Arus Kas Penagihan (Buku Piutang Digital).
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border-indigo-100">Smart Checklist Active</Badge>
                </p>
            </div>
            <div className="flex gap-3">
                {selectedInvoiceIds.size > 0 && (
                    <Button onClick={handleRecordBulkPayment} className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 font-black uppercase text-[10px] tracking-widest px-8 h-11 animate-in slide-in-from-bottom-2">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Konfirmasi Bayar ({selectedInvoiceIds.size})
                    </Button>
                )}
                <div className="flex bg-slate-100 rounded-xl p-1 border shadow-inner h-11">
                    <Button 
                        variant={viewMode === 'list' ? 'white' : 'ghost'} 
                        size="sm" 
                        className={cn("h-9 gap-2 text-[10px] font-black uppercase rounded-lg px-4", viewMode === 'list' && "shadow-sm")}
                        onClick={() => setViewMode('list')}
                    >
                        <List className="h-4 w-4" /> <span className="hidden sm:inline">List View</span>
                    </Button>
                    <Button 
                        variant={viewMode === 'book' ? 'white' : 'ghost'} 
                        size="sm" 
                        className={cn("h-9 gap-2 text-[10px] font-black uppercase rounded-lg px-4", viewMode === 'book' && "shadow-sm")}
                        onClick={() => setViewMode('book')}
                    >
                        <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Books View</span>
                    </Button>
                </div>
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-indigo-300 transition-all">
                <div className="h-1.5 w-full bg-indigo-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-2"><TrendingUp className="h-3 w-3 text-indigo-500" /> Nilai Kontrak Aktif</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-slate-900">Rp {totals.po.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-emerald-300 transition-all">
                <div className="h-1.5 w-full bg-emerald-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-emerald-600 tracking-widest flex items-center gap-2"><CreditCard className="h-3 w-3" /> Total Kas Masuk (Lunas)</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-emerald-700">Rp {totals.paid.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-red-300 transition-all">
                <div className="h-1.5 w-full bg-rose-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-rose-600 tracking-widest flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Sisa Piutang Berjalan</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-rose-700">Rp {totals.outstanding.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>

        <Card className="shadow-xl border-none ring-1 ring-slate-200 bg-white rounded-3xl overflow-hidden">
            <Tabs defaultValue="outstanding" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader className="bg-slate-50/50 border-b py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <TabsList className="bg-slate-200/50 p-1.5 rounded-2xl h-12">
                            <TabsTrigger value="outstanding" className="text-xs font-black uppercase rounded-xl px-8 h-9 data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">
                                <Clock className="h-4 w-4 mr-2" /> Outstanding AR
                            </TabsTrigger>
                            <TabsTrigger value="paid" className="text-xs font-black uppercase rounded-xl px-8 h-9 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Fully Paid
                            </TabsTrigger>
                        </TabsList>
                        
                        <div className="relative w-full md:w-1/3">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Cari No. PO atau Nama Customer..." 
                                className="pl-11 h-12 bg-white border-slate-200 rounded-2xl font-medium text-xs focus-visible:ring-indigo-500" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                {isLoading ? (
                    <div className="py-40 text-center space-y-4">
                        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] animate-pulse">Reconciling Database Matrix...</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="w-full overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-b-slate-100 hover:bg-transparent">
                                    <TableHead className="w-[60px] py-6 px-6"></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">PO & Hub Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Term Tracking (Check to Pay)</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Nilai Kontrak</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Sisa Piutang</TableHead>
                                    <TableHead className="text-right px-8"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-black uppercase text-xs tracking-widest italic opacity-40">Tidak ada data penagihan di kategori ini.</TableCell></TableRow>
                                ) : mergedData.map((item) => (
                                    <TableRow key={item.poNumber} className={cn("hover:bg-slate-50 transition-colors border-b-slate-100", (item.paidOffline || 0) > 0 && "bg-blue-50/5")}>
                                        <TableCell className="px-6 py-5">
                                            <Wallet className={cn("h-5 w-5", item.outstanding > 0 ? "text-rose-400" : "text-emerald-400")} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-slate-900">{item.poNumber}</span>
                                                    {item.status === 'Paid' && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter truncate max-w-[250px]">{item.customer}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {(item.paidOffline || 0) > 0 && (
                                                    <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg text-[9px] font-black" title="Saldo Migrasi Sistem Lama">
                                                        <History className="h-3 w-3" /> MIGRATION
                                                    </div>
                                                )}
                                                {item.relatedInvoices.map(inv => {
                                                    const isOverdue = inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today);
                                                    return (
                                                        <div 
                                                            key={inv.id} 
                                                            onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                            className={cn(
                                                                "group cursor-pointer flex items-center gap-2 border px-3 py-1.5 rounded-xl text-[10px] font-black transition-all hover:scale-105 active:scale-95",
                                                                selectedInvoiceIds.has(inv.id) ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : 
                                                                inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60" : 
                                                                isOverdue ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-700 border-slate-200 hover:border-indigo-400"
                                                            )}
                                                        >
                                                            {inv.id.split('/').pop()}
                                                            {inv.status === 'paid' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : selectedInvoiceIds.has(inv.id) ? <div className="h-3 w-3 rounded-full bg-white/30" /> : <div className="h-3 w-3 rounded-full border-2 border-slate-200" />}
                                                        </div>
                                                    );
                                                })}
                                                {item.relatedInvoices.length === 0 && <span className="text-[10px] font-bold text-slate-400 italic">Waiting for Invoice...</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-sm text-slate-900">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn("font-black text-sm", item.outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                    Rp {item.outstanding.toLocaleString('id-ID')}
                                                </span>
                                                {item.outstanding > 0 && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Funds</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                                <ArrowRight className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-8 p-8 sm:grid-cols-2 lg:grid-cols-3">
                        {mergedData.map((item) => (
                            <Card key={item.poNumber} className="overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-500 ring-1 ring-slate-200 group bg-white rounded-3xl">
                                <div className={cn(
                                    "h-2 w-full transition-colors",
                                    item.status === 'Paid' ? "bg-emerald-500" : 
                                    item.status === 'Partial' ? "bg-amber-500" : "bg-slate-200"
                                )} />
                                <CardHeader className="pb-4 bg-slate-50/50 border-b">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-base font-black text-slate-900">{item.poNumber}</CardTitle>
                                                {item.status === 'Paid' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                            </div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate max-w-[200px]">{item.customer}</p>
                                        </div>
                                        <Badge className={cn(
                                            "text-[9px] font-black uppercase px-2 py-0.5 border-none",
                                            item.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                                            item.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                        )}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest">
                                            <ReceiptText className="h-4 w-4 text-indigo-500" /> Active Billing Term
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(item.paidOffline || 0) > 0 && (
                                                <div className="bg-slate-50 text-slate-500 border border-slate-200 p-2 rounded-xl text-center text-[9px] font-black flex items-center justify-center gap-1.5">
                                                    <History className="h-3 w-3" /> LEGACY
                                                </div>
                                            )}
                                            {item.relatedInvoices.map(inv => (
                                                <div 
                                                    key={inv.id} 
                                                    onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                    className={cn(
                                                        "p-2 rounded-xl border text-center text-[10px] font-black transition-all cursor-pointer",
                                                        selectedInvoiceIds.has(inv.id) ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : 
                                                        inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100 opacity-60" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"
                                                    )}
                                                >
                                                    {inv.id.split('/').pop()}
                                                </div>
                                            ))}
                                            {item.relatedInvoices.length === 0 && (
                                                <div className="col-span-2 py-4 border-2 border-dashed rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase italic">Waiting for Invoice</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Remaining Balance</span>
                                            <span className={cn("text-base font-black", item.outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>Rp {item.outstanding.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between items-center opacity-60">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Funds Verified</span>
                                            <span className="text-[11px] font-black text-emerald-600">Rp {item.totalPaid.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-4 bg-slate-50/50 border-t mt-auto">
                                    <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-md transition-all rounded-xl text-slate-500" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                        <Eye className="mr-2 h-4 w-4" /> Buka Buku Pembayaran
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
                </CardContent>
            </Tabs>
        </Card>

        <PaymentDetailDialog 
            isOpen={detailOpen} 
            onOpenChange={setDetailOpen} 
            sale={selectedSale} 
            invoices={selectedSale?.relatedInvoices || []} 
        />

        <RecordPaymentDialog
            isOpen={recordPaymentOpen}
            onOpenChange={setRecordPaymentOpen}
            onSave={handlePaymentSuccess}
            selectedCount={selectedInvoiceIds.size}
            totalAmount={invoiceList?.filter(i => selectedInvoiceIds.has(i.id)).reduce((s, i) => s + i.amount, 0) || 0}
        />
      </main>
    );
  }

