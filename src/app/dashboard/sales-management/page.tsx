
'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { 
    Search, 
    Eye, 
    TrendingUp, 
    CreditCard, 
    AlertCircle, 
    LayoutGrid, 
    List, 
    Wallet, 
    BadgeCheck, 
    Clock,
    CheckCircle2,
    ArrowRight
  } from 'lucide-react';
  import { type SalesListItem, type Invoice, type TaxInvoice, type UserProfile } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
  import { collection, query, doc, writeBatch } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { PaymentDetailDialog } from './_components/payment-detail-dialog';
  import { RecordPaymentDialog } from './_components/record-payment-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { isBefore, parseISO, startOfToday } from 'date-fns';
  
  type MergedRecord = SalesListItem & {
    relatedInvoices: (Invoice & { taxInfo?: TaxInvoice })[];
    totalPaid: number;
    outstanding: number;
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
    
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

    const firestore = useFirestore();
    const { user } = useUser();

    const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const salesCollection = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'sales'))), [firestore]);
    const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'invoices'))), [firestore]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

    const taxInvoicesCollection = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'taxInvoices'))), [firestore]);
    const { data: taxInvoiceList } = useCollection<TaxInvoice>(taxInvoicesCollection);
    
    const isLoading = isSalesLoading || isInvoicesLoading;

    const mergedData = useMemo((): MergedRecord[] => {
        if (!salesList || !invoiceList) return [];

        return salesList.map(sale => {
            const related = invoiceList.filter(inv => inv.poNumber === sale.poNumber && inv.status !== 'cancelled').map(inv => {
                const tax = taxInvoiceList?.find(t => t.invoiceNumber === inv.id);
                return { ...inv, taxInfo: tax };
            });

            const systemPaid = related.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            const totalPaid = (sale.paidOffline || 0) + systemPaid;

            return {
                ...sale,
                relatedInvoices: related,
                totalPaid,
                outstanding: Math.max(0, sale.amount - totalPaid),
            };
        }).filter(item => {
            const searchMatch = item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.customer.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (activeTab === 'outstanding' && item.outstanding <= 0) return false;
            if (activeTab === 'paid' && item.outstanding > 0) return false;
            
            return searchMatch;
        }).sort((a, b) => b.outstanding - a.outstanding);
    }, [salesList, invoiceList, taxInvoiceList, searchQuery, activeTab]);

    const totals = useMemo(() => {
        if (!salesList || !invoiceList) return { po: 0, paid: 0, outstanding: 0 };
        const totalPo = salesList.reduce((sum, item) => sum + item.amount, 0);
        const legacyPaid = salesList.reduce((sum, i) => sum + (i.paidOffline || 0), 0);
        const systemPaid = invoiceList.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
        
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
                payments: [...(inv.payments || []), {
                    id: doc(collection(firestore, 'dummy')).id,
                    date: paymentData.date,
                    amount: inv.amount, 
                    reference: paymentData.reference,
                    method: paymentData.method,
                    recordedBy: recorder
                }],
                lastUpdatedAt: timestamp,
                lastUpdatedBy: recorder
            });
        });

        await batch.commit();
        toast({ title: "Pelunasan Berhasil Diverifikasi" });
        setSelectedInvoiceIds(new Set());
        setRecordPaymentOpen(false);
    };

    const today = startOfToday();

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background animate-in fade-in duration-500">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">Buku Piutang Digital</h1>
                <div className="text-slate-500 font-medium flex items-center gap-2">
                    Monitoring Saldo Piutang (AR) & Rekonsiliasi Kas PT Jembo Cable.
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border-indigo-100">Live Audit Sync</Badge>
                </div>
            </div>
            <div className="flex gap-3">
                {selectedInvoiceIds.size > 0 && (
                    <Button onClick={() => setRecordPaymentOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 font-black uppercase text-[10px] tracking-widest px-8 h-11 animate-bounce">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Konfirmasi Bayar ({selectedInvoiceIds.size})
                    </Button>
                )}
                <div className="flex bg-slate-100 rounded-xl p-1 border shadow-inner h-11">
                    <Button variant={viewMode === 'list' ? 'white' : 'ghost'} size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-lg px-4" onClick={() => setViewMode('list')}><List className="h-4 w-4" /> List</Button>
                    <Button variant={viewMode === 'book' ? 'white' : 'ghost'} size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-lg px-4" onClick={() => setViewMode('book')}><LayoutGrid className="h-4 w-4" /> Books</Button>
                </div>
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-indigo-300 transition-all">
                <div className="h-1.5 w-full bg-indigo-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-2"><TrendingUp className="h-3 w-3 text-indigo-500" /> Total Nilai Kontrak</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-slate-900">Rp {totals.po.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-emerald-300 transition-all">
                <div className="h-1.5 w-full bg-emerald-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-emerald-600 tracking-widest flex items-center gap-2"><CreditCard className="h-3 w-3" /> Total Realisasi Kas</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-emerald-700">Rp {totals.paid.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-white border-none shadow-sm ring-1 ring-slate-200 overflow-hidden rounded-2xl group hover:ring-red-300 transition-all">
                <div className="h-1.5 w-full bg-rose-500" />
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-rose-600 tracking-widest flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Sisa Piutang Aktif</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-black text-rose-700">Rp {totals.outstanding.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>

        <Card className="shadow-xl border-none ring-1 ring-slate-200 bg-white rounded-3xl overflow-hidden">
            <Tabs defaultValue="outstanding" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader className="bg-slate-50/50 border-b py-6 px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <TabsList className="bg-slate-200/50 p-1.5 rounded-2xl h-12">
                        <TabsTrigger value="outstanding" className="text-xs font-black uppercase rounded-xl px-8 h-9 data-[state=active]:bg-white data-[state=active]:text-rose-600">
                            <Clock className="h-4 w-4 mr-2" /> Outstanding
                        </TabsTrigger>
                        <TabsTrigger value="paid" className="text-xs font-black uppercase rounded-xl px-8 h-9 data-[state=active]:bg-white data-[state=active]:text-emerald-600">
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Lunas
                        </TabsTrigger>
                    </TabsList>
                    
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Cari No. PO atau Customer..." className="pl-11 h-12 bg-white border-slate-200 rounded-2xl font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                {isLoading ? (
                    <div className="py-40 text-center space-y-4">
                        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Membangun Buku Piutang...</p>
                    </div>
                ) : (
                    <div className="w-full overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-b-slate-100">
                                    <TableHead className="w-[60px] py-6 px-6"></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">PO & Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Term Checklist (Smart AR)</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Nilai Kontrak</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Sisa Piutang</TableHead>
                                    <TableHead className="text-right px-8"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-black uppercase text-xs tracking-widest italic opacity-40">Data nihil.</TableCell></TableRow>
                                ) : mergedData.map((item) => (
                                    <TableRow key={item.poNumber} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                        <TableCell className="px-6 py-5">
                                            <Wallet className={cn("h-5 w-5", item.outstanding > 0 ? "text-rose-400" : "text-emerald-400")} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-sm text-slate-900">{item.poNumber}</span>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter truncate max-w-[200px]">{item.customer}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {item.relatedInvoices.map(inv => {
                                                    const isOverdue = inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today);
                                                    return (
                                                        <div 
                                                            key={inv.id} 
                                                            onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                            className={cn(
                                                                "cursor-pointer flex items-center gap-2 border px-3 py-1.5 rounded-xl text-[10px] font-black transition-all hover:scale-105",
                                                                selectedInvoiceIds.has(inv.id) ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : 
                                                                inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                                                isOverdue ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-700 border-slate-200"
                                                            )}
                                                        >
                                                            {inv.id.split('/').pop()}
                                                            {inv.status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : selectedInvoiceIds.has(inv.id) ? <div className="h-3 w-3 rounded-full bg-white/30" /> : <div className="h-3 w-3 rounded-full border-2 border-slate-200" />}
                                                        </div>
                                                    );
                                                })}
                                                {item.relatedInvoices.length === 0 && <span className="text-[10px] font-bold text-slate-400 italic">Waiting for Billing...</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-sm text-slate-900">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn("font-black text-sm", item.outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                    Rp {item.outstanding.toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                                <ArrowRight className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                </CardContent>
            </Tabs>
        </Card>

        <PaymentDetailDialog isOpen={detailOpen} onOpenChange={setDetailOpen} sale={selectedSale} invoices={selectedSale?.relatedInvoices || []} />
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
