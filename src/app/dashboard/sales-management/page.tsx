
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
    BadgeCheck
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

            const paid = related.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            
            let status: any = 'Waiting';
            if (paid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (paid > 0) status = 'Partial';

            const latestInv = [...related].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestTax = related.find(r => r.taxInfo)?.taxInfo?.taxInvoiceNumber;

            return {
                ...sale,
                status,
                relatedInvoices: related,
                totalPaid: paid,
                outstanding: sale.amount - paid,
                latestInvoiceDate: latestInv?.date,
                latestTaxNumber: latestTax
            };
        }).filter(item => 
            item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.soNumber && item.soNumber.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a, b) => b.outstanding - a.outstanding);
    }, [salesList, invoiceList, taxInvoiceList, searchQuery]);

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

        // Get selected invoices full data
        const selectedInvoices = invoiceList?.filter(inv => selectedInvoiceIds.has(inv.id)) || [];

        selectedInvoices.forEach(inv => {
            const safeId = inv.id.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeId);
            
            // For collective payment, we usually apply the specific portion if split, 
            // but for MVP, let's assume full settlement for the selected invoices 
            // OR distributed if multiple.
            
            // Logic: Mark as Paid
            batch.update(invRef, {
                status: 'paid',
                payments: [
                    ...(inv.payments || []),
                    {
                        id: doc(collection(firestore, 'dummy')).id,
                        date: paymentData.date,
                        amount: inv.amount, // Set to full inv amount for collective verification
                        reference: paymentData.reference,
                        method: paymentData.method,
                        recordedBy: recorder
                    }
                ],
                lastUpdatedAt: timestamp,
                lastUpdatedBy: recorder,
                revisionLogs: [
                    ...(inv.revisionLogs || []),
                    { updatedAt: timestamp, updatedBy: recorder, action: `Full payment recorded via Payment Center: ${paymentData.reference}` }
                ]
            });
        });

        await batch.commit();
        toast({ title: "Pembayaran Berhasil", description: `${selectedInvoiceIds.size} Invoice telah dilunaskan.` });
        setSelectedInvoiceIds(new Set());
        setRecordPaymentOpen(false);
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Payment & Receivables</h1>
                <p className="text-muted-foreground font-medium">Pusat pelunasan invoice dan monitoring buku piutang.</p>
            </div>
            <div className="flex gap-2">
                {selectedInvoiceIds.size > 0 && (
                    <Button onClick={handleRecordBulkPayment} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg font-black uppercase">
                        <Wallet className="mr-2 h-4 w-4" /> Pelunasan Kolektif ({selectedInvoiceIds.size})
                    </Button>
                )}
                <div className="flex bg-muted rounded-md p-1 border">
                    <Button 
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-8 gap-2"
                        onClick={() => handleViewChange('list')}
                    >
                        <List className="h-4 w-4" /> <span className="hidden sm:inline">List View</span>
                    </Button>
                    <Button 
                        variant={viewMode === 'book' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-8 gap-2"
                        onClick={() => handleViewChange('book')}
                    >
                        <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Book Mode</span>
                    </Button>
                </div>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5 border-primary/20 shadow-sm border-l-4 border-l-primary">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-primary tracking-widest flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Total PO Aktif</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black">Rp {totals.po.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-emerald-50/50 border-emerald-200 shadow-sm border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-emerald-700 tracking-widest flex items-center gap-2"><CreditCard className="h-3 w-3" /> Dana Masuk (Paid)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black text-emerald-700">Rp {totals.paid.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-red-50/50 border-red-200 shadow-sm border-l-4 border-l-red-500">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase font-black text-red-700 tracking-widest flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Sisa Piutang (Unpaid)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black text-red-700">Rp {totals.outstanding.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>

        <Card className="shadow-md border-none ring-1 ring-border">
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari No. PO, SO, atau Customer..." className="pl-8 bg-muted/20 border-none font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center space-y-4">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                        <p className="text-muted-foreground font-bold">Menganalisa Buku Piutang...</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">PO & Customer</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Status Invoice</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4">Nilai PO</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4">Piutang</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">Status</TableHead>
                                    <TableHead className="text-right py-4"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">Tidak ada piutang aktif.</TableCell></TableRow>
                                ) : mergedData.map((item) => (
                                    <TableRow key={item.poNumber} className="hover:bg-muted/5 border-b last:border-0">
                                        <TableCell className="py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-sm text-slate-800">{item.poNumber}</span>
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground truncate max-w-[200px]">{item.customer}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex flex-wrap gap-1.5">
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
                                                        {inv.status === 'paid' && <BadgeCheck className="h-2.5 w-2.5" />}
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
                                                "text-[9px] font-black uppercase px-2 py-0.5",
                                                item.status === 'Paid' ? 'bg-emerald-600' : 
                                                item.status === 'Partial' ? 'bg-amber-500' : 'bg-slate-400'
                                            )}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setSelectedSale(item); setDetailOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Buka Buku Pembayaran</DropdownMenuItem>
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
                            <Card key={item.poNumber} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-border group">
                                <div className={cn(
                                    "h-1.5 w-full",
                                    item.status === 'Paid' ? "bg-emerald-500" : 
                                    item.status === 'Partial' ? "bg-amber-500" : "bg-slate-300"
                                )} />
                                <CardHeader className="pb-2 bg-muted/5 border-b">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 leading-none tracking-widest">PO Number</span>
                                            <CardTitle className="text-sm font-black text-slate-800">{item.poNumber}</CardTitle>
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
                                        <User className="h-4 w-4 text-primary mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="font-black text-xs uppercase leading-tight truncate">{item.customer}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground">Sales: {item.sales}</p>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-xl space-y-2 border border-dashed">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 tracking-widest">
                                            <ReceiptText className="h-3 w-3" /> Linked Invoices
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {item.relatedInvoices.slice(0, 4).map(inv => (
                                                <div 
                                                    key={inv.id} 
                                                    onClick={() => inv.status !== 'paid' && handleToggleInvoice(inv.id)}
                                                    className={cn(
                                                        "p-1.5 rounded-lg border text-center text-[9px] font-black transition-all cursor-pointer",
                                                        selectedInvoiceIds.has(inv.id) ? "bg-primary text-white border-primary shadow-sm" : 
                                                        inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100 opacity-60" : "bg-white text-slate-500 hover:border-primary"
                                                    )}
                                                >
                                                    {inv.id.split('/').pop()}
                                                </div>
                                            ))}
                                            {item.relatedInvoices.length > 4 && (
                                                <div className="text-[9px] text-muted-foreground font-bold flex items-center justify-center">+ {item.relatedInvoices.length - 4} More</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-2 flex flex-col gap-1 border-t border-dashed">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Total Piutang</span>
                                            <span className="text-sm font-black text-red-600">Rp {item.outstanding.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Sudah Dibayar</span>
                                            <span className="text-[10px] font-black text-emerald-600">Rp {item.totalPaid.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3 bg-muted/5 border-t mt-auto">
                                    <Button variant="outline" className="w-full h-8 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-colors" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
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
