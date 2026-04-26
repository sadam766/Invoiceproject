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
    Filter
  } from 'lucide-react';
  import { type SalesListItem, type Invoice, type TaxInvoice, type UserProfile } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
  import { collection, query, doc, writeBatch, updateDoc } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { PaymentDetailDialog } from './_components/payment-detail-dialog';
  import { RecordPaymentDialog } from './_components/record-payment-dialog';
  import { useToast } from '@/hooks/use-toast';
  
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
    const [showOnlyOutstanding, setShowOnlyOutstanding] = useState(false);
    
    // Multi-select for bulk payment
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

    const firestore = useFirestore();
    const { user } = useUser();

    const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

    useEffect(() => {
        const savedView = localStorage.getItem('salesManagementViewMode');
        if (savedView === 'list' || savedView === 'book') {
            setViewMode(savedView);
        }
    }, []);

    const handleViewChange = (mode: 'list' | 'book') => {
        setViewMode(mode);
        localStorage.setItem('salesManagementViewMode', mode);
    };

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
            const related = invoiceList.filter(inv => inv.poNumber === sale.poNumber).map(inv => {
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
                outstanding: sale.amount - totalPaid,
                latestInvoiceDate: latestInv?.date,
                latestTaxNumber: latestTax
            };
        }).filter(item => {
            const searchMatch = item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (item.soNumber && item.soNumber.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (showOnlyOutstanding && item.outstanding <= 0) return false;
            return searchMatch;
        }).sort((a, b) => b.outstanding - a.outstanding);
    }, [salesList, invoiceList, taxInvoiceList, searchQuery, showOnlyOutstanding]);

    const totals = useMemo(() => {
        const totalPo = mergedData.reduce((sum, item) => sum + item.amount, 0);
        const totalPaid = mergedData.reduce((sum, item) => sum + item.totalPaid, 0);
        return {
            po: totalPo,
            paid: totalPaid,
            outstanding: totalPo - totalPaid
        };
    }, [mergedData]);

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
                    { updatedAt: timestamp, updatedBy: recorder, action: `Payment Verified by ${recorder}: ${paymentData.reference}` }
                ]
            });
        });

        await batch.commit();
        toast({ title: "Pelunasan Berhasil", description: `${selectedInvoiceIds.size} Invoice telah ditandai lunas.` });
        setSelectedInvoiceIds(new Set());
        setRecordPaymentOpen(false);
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Payment & Receivables (Buku Piutang)</h1>
                <p className="text-muted-foreground font-medium">Monitoring dana masuk dan rekonsiliasi pembayaran invoice.</p>
            </div>
            <div className="flex gap-2">
                {selectedInvoiceIds.size > 0 && (
                    <Button onClick={handleRecordBulkPayment} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg font-black uppercase text-[10px] tracking-widest px-6 h-10">
                        <BadgeCheck className="mr-2 h-4 w-4" /> Verifikasi Pelunasan ({selectedInvoiceIds.size})
                    </Button>
                )}
                <div className="flex bg-muted rounded-md p-1 border shadow-sm h-10">
                    <Button 
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-8 gap-2 text-[10px] font-black uppercase"
                        onClick={() => handleViewChange('list')}
                    >
                        <List className="h-4 w-4" /> <span className="hidden sm:inline">List</span>
                    </Button>
                    <Button 
                        variant={viewMode === 'book' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-8 gap-2 text-[10px] font-black uppercase"
                        onClick={() => handleViewChange('book')}
                    >
                        <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Books</span>
                    </Button>
                </div>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5 border-primary/20 shadow-sm border-l-4 border-l-primary overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-primary tracking-widest flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Nilai Kontrak Aktif</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black">Rp {totals.po.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-emerald-50/50 border-emerald-200 shadow-sm border-l-4 border-l-emerald-500 overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-emerald-700 tracking-widest flex items-center gap-2"><CreditCard className="h-3 w-3" /> Total Dana Masuk</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black text-emerald-700">Rp {totals.paid.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-red-50/50 border-red-200 shadow-sm border-l-4 border-l-red-500 overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-red-700 tracking-widest flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Sisa Piutang Berjalan</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black text-red-700">Rp {totals.outstanding.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>

        <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari No. PO, SO, atau Customer..." className="pl-8 bg-muted/20 border-none font-medium h-9 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border">
                        <Label htmlFor="outstanding-only" className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest flex items-center gap-2">
                           <Filter className="h-3 w-3" /> Lihat Piutang Saja
                        </Label>
                        <Switch id="outstanding-only" checked={showOnlyOutstanding} onCheckedChange={setShowOnlyOutstanding} />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center space-y-4">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                        <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest animate-pulse">Syncing AR Matrix...</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">PO & Hub Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Payment Status Tracker</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Kontrak PO</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Outstanding AR</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Final Status</TableHead>
                                    <TableHead className="text-right py-4"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 font-black uppercase text-[10px] tracking-widest italic">Tidak ada piutang aktif dalam periode ini.</TableCell></TableRow>
                                ) : mergedData.map((item) => (
                                    <TableRow key={item.poNumber} className={cn("hover:bg-indigo-50/10 border-b last:border-0 transition-colors", (item.paidOffline || 0) > 0 && "bg-blue-50/5")}>
                                        <TableCell className="py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-indigo-700">{item.poNumber}</span>
                                                    {(item.paidOffline || 0) > 0 && <Badge variant="outline" className="text-[8px] h-3.5 bg-blue-50 text-blue-700 font-black uppercase">Legacy</Badge>}
                                                </div>
                                                <span className="text-[10px] font-bold uppercase text-slate-400 truncate max-w-[200px] tracking-tighter">{item.customer}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(item.paidOffline || 0) > 0 && (
                                                    <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 border px-2 py-1 rounded-md text-[9px] font-black opacity-80" title="Saldo Migrasi Sistem Lama">
                                                        <History className="h-2.5 w-2.5" /> OPENING
                                                    </div>
                                                )}
                                                {item.relatedInvoices.map(inv => (
                                                    <div 
                                                        key={inv.id} 
                                                        onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                        className={cn(
                                                            "group cursor-pointer flex items-center gap-2 border px-2 py-1 rounded-md text-[9px] font-black transition-all",
                                                            selectedInvoiceIds.has(inv.id) ? "bg-primary text-white border-primary" : 
                                                            inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60" : "bg-white text-slate-700 hover:border-primary"
                                                        )}
                                                    >
                                                        {inv.id.split('/').pop()}
                                                        {inv.status === 'paid' && <BadgeCheck className="h-2.5 w-2.5 text-emerald-600" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-4 font-bold text-sm">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right py-4">
                                            <span className={cn("font-black text-sm", item.outstanding > 0 ? "text-red-600" : "text-emerald-600")}>
                                                Rp {item.outstanding.toLocaleString('id-ID')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <Badge className={cn(
                                                "text-[9px] font-black uppercase px-2 py-0.5 tracking-tighter",
                                                item.status === 'Paid' ? 'bg-emerald-600' : 
                                                item.status === 'Partial' ? 'bg-amber-500' : 'bg-slate-400'
                                            )}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full hover:bg-indigo-50"><MoreVertical className="h-4 w-4 text-slate-400" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56">
                                                    <DropdownMenuItem onClick={() => { setSelectedSale(item); setDetailOpen(true); }} className="text-[10px] font-black uppercase tracking-widest py-3">
                                                        <Eye className="mr-2 h-4 w-4" /> Buka Buku Pembayaran
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {mergedData.map((item) => (
                            <Card key={item.poNumber} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 group">
                                <div className={cn(
                                    "h-1.5 w-full",
                                    item.status === 'Paid' ? "bg-emerald-500" : 
                                    item.status === 'Partial' ? "bg-amber-500" : "bg-slate-300"
                                )} />
                                <CardHeader className="pb-2 bg-slate-50/50 dark:bg-slate-800/20 border-b">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 leading-none tracking-widest">PO Identity</span>
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-sm font-black text-indigo-700">{item.poNumber}</CardTitle>
                                                {(item.paidOffline || 0) > 0 && <Badge className="text-[7px] h-3.5 bg-blue-50 text-blue-600 font-black uppercase">Migrasi</Badge>}
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "text-[8px] font-black uppercase",
                                            item.status === 'Paid' ? 'bg-emerald-600' : 
                                            item.status === 'Partial' ? 'bg-amber-500' : 'bg-slate-400'
                                        )}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <User className="h-4 w-4 text-indigo-600 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="font-black text-xs uppercase leading-tight truncate text-slate-800 dark:text-slate-200">{item.customer}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Sales Hub: {item.sales}</p>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl space-y-2 border border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest">
                                            <ReceiptText className="h-3 w-3" /> Linked AR Documents
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(item.paidOffline || 0) > 0 && (
                                                <div className="bg-indigo-50 text-indigo-700 border-indigo-100 border p-1.5 rounded-lg text-center text-[9px] font-black opacity-80 flex items-center justify-center gap-1">
                                                    <History className="h-2.5 w-2.5" /> OPENING
                                                </div>
                                            )}
                                            {item.relatedInvoices.slice(0, 4).map(inv => (
                                                <div 
                                                    key={inv.id} 
                                                    onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                    className={cn(
                                                        "p-1.5 rounded-lg border text-center text-[9px] font-black transition-all cursor-pointer",
                                                        selectedInvoiceIds.has(inv.id) ? "bg-primary text-white border-primary shadow-sm" : 
                                                        inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60" : "bg-white text-slate-500 hover:border-primary"
                                                    )}
                                                >
                                                    {inv.id.split('/').pop()}
                                                </div>
                                            ))}
                                            {item.relatedInvoices.length > 4 && (
                                                <div className="text-[9px] text-slate-400 font-bold flex items-center justify-center">+ {item.relatedInvoices.length - 4} More</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-2 flex flex-col gap-1 border-t border-dashed border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sisa Piutang</span>
                                            <span className="text-sm font-black text-red-600">Rp {item.outstanding.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Kas Diterima</span>
                                            <span className="text-[10px] font-black text-emerald-600">Rp {item.totalPaid.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3 bg-slate-50/50 dark:bg-slate-800/20 border-t mt-auto">
                                    <Button variant="outline" className="w-full h-9 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm border-indigo-100" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                        <Eye className="mr-2 h-3.5 w-3.5" /> BUKA BUKU PEMBAYARAN
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
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
