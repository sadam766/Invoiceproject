
'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
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
  import { Checkbox } from '@/components/ui/checkbox';
  import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
  } from '@/components/ui/dialog';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { type Invoice, type UserProfile } from '@/app/lib/data';
  import { Search, MoreHorizontal, Eye, Pencil, Download, Truck, FileSpreadsheet, XCircle, ShieldCheck, Layers, Cpu } from 'lucide-react';
  import { Skeleton } from '@/components/ui/skeleton';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
  import { collection, query, doc, updateDoc, arrayUnion } from 'firebase/firestore';
  import { exportToExcel, cn } from '@/lib/utils';
  import { DateRangePicker } from '@/app/components/date-range-picker';
  import { isWithinInterval, parseISO, startOfToday, format } from 'date-fns';


  export default function InvoiceListPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfToday(),
        to: startOfToday(),
    });
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    // Void State
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoices, isLoading } = useCollection<Invoice>(invoicesCollection);
    
    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        let filtered = invoices;

        filtered = filtered.filter(inv => {
            const invDate = parseISO(inv.date);
            return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
        });

        if (activeTab !== 'all') {
            filtered = filtered.filter(i => {
                if (activeTab === 'paid') return i.status === 'paid';
                if (activeTab === 'received') return i.status === 'received';
                if (activeTab === 'unpaid') return i.status === 'sent' || i.status === 'unpaid' || i.status === 'draft';
                if (activeTab === 'cancelled') return i.status === 'cancelled';
                return true;
            });
        }

        if (searchQuery) {
            filtered = filtered.filter(invoice => 
                String(invoice.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(invoice.erpInvoiceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(invoice.customer).toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(invoice.poNumber).toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered.sort((a,b) => b.date.localeCompare(a.date));
    }, [invoices, activeTab, searchQuery, dateRange]);

    const handleVoidInvoice = async () => {
        if (!firestore || !targetInvoiceId || !voidReason || !user) return;

        const safeId = targetInvoiceId.replace(/\//g, '_');
        const docRef = doc(firestore, 'invoices', safeId);
        
        const timestamp = new Date().toISOString();
        const updateData = {
            status: 'cancelled',
            voidReason: voidReason,
            lastUpdatedAt: timestamp,
            lastUpdatedBy: userProfile?.displayName || user.email || 'Unknown',
            revisionLogs: arrayUnion({
                updatedBy: userProfile?.displayName || user.email || 'Unknown',
                updatedAt: timestamp,
                action: `Invoice VOIDED: ${voidReason}`
            })
        };

        try {
            await updateDoc(docRef, updateData);
            toast({ title: "Invoice Dibatalkan", description: `Invoice ${targetInvoiceId} kini berstatus VOID.` });
            setVoidDialogOpen(false);
            setVoidReason('');
            setTargetInvoiceId(null);
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Membatalkan", description: "Kesalahan sistem." });
        }
    };

    const handleCreateSpdFromSelected = () => {
        if (selectedInvoices.size === 0) return;
        const selectedList = filteredInvoices.filter(inv => selectedInvoices.has(inv.id) && inv.status !== 'cancelled');
        if (selectedList.length === 0) {
            toast({ variant: 'destructive', title: "Aksi Dibatalkan", description: "Invoice VOID tidak dapat dikirim." });
            return;
        }
        sessionStorage.setItem('preselectedSpdInvoices', JSON.stringify(selectedList));
        router.push('/dashboard/invoices/spd');
    };

    const handleFinalize = async (invoiceId: string) => {
        if (!firestore || !isSuperAdmin || !user) return;
        const safeId = invoiceId.replace(/\//g, '_');
        const docRef = doc(firestore, 'invoices', safeId);
        
        try {
            await updateDoc(docRef, { 
                status: 'finalized',
                lastUpdatedAt: new Date().toISOString(),
                lastUpdatedBy: userProfile?.displayName || user.email || 'Leader'
            });
            toast({ title: "Invoice Finalized", description: "Data sekarang terkunci untuk audit." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Error" });
        }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">Invoice List</h1>
                <div className="text-muted-foreground font-medium flex items-center gap-2">
                    Ditemukan {filteredInvoices.length} Data 
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Periode: {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM/yy')}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DateRangePicker onRangeChange={setDateRange} />
                <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredInvoices, `Invoice-Laporan-${format(dateRange.from, 'yyyyMMdd')}`)} className="font-bold h-9">
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Export
                </Button>
                <Button size="sm" className="font-black uppercase h-9 shadow-md bg-indigo-600 hover:bg-indigo-700" onClick={() => router.push('/dashboard/sales')}>
                    <Layers className="mr-2 h-4 w-4" /> Start from Sales List
                </Button>
            </div>
        </div>

        <Card className="shadow-md border-none ring-1 ring-border">
            <CardContent className="pt-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <TabsList className="bg-muted/50 p-1">
                            <TabsTrigger value="all" className="text-xs font-bold uppercase">Semua</TabsTrigger>
                            <TabsTrigger value="paid" className="text-xs font-bold uppercase px-4 text-emerald-600">Lunas</TabsTrigger>
                            <TabsTrigger value="received" className="text-xs font-bold uppercase px-4 text-blue-600">Diterima PT</TabsTrigger>
                            <TabsTrigger value="unpaid" className="text-xs font-bold uppercase px-4 text-red-600">Unpaid</TabsTrigger>
                            <TabsTrigger value="cancelled" className="text-xs font-bold uppercase px-4 opacity-50">Void</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari No. SAR, ERP, Customer..." className="pl-8 h-9 bg-muted/20 border-none font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={(c) => c ? setSelectedInvoices(new Set(filteredInvoices.map(i => i.id))) : setSelectedInvoices(new Set())} /></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Invoice Numbers</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Customer & PO</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">SPD INFO</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Amount</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-20 font-bold animate-pulse text-muted-foreground">Menganalisa Data Invoices...</TableCell></TableRow> : 
                                    filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id} className={cn("hover:bg-muted/5 transition-colors", invoice.status === 'cancelled' && "opacity-40 grayscale")}>
                                        <TableCell><Checkbox checked={selectedInvoices.has(invoice.id)} onCheckedChange={() => setSelectedInvoices(prev => { const n = new Set(prev); n.has(invoice.id) ? n.delete(invoice.id) : n.add(invoice.id); return n; })} /></TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className={cn("font-black text-xs", invoice.status === 'cancelled' ? "line-through" : "text-indigo-700")}>{invoice.id}</span>
                                                {invoice.erpInvoiceId && (
                                                    <span className="text-[9px] font-mono font-bold text-muted-foreground flex items-center gap-1">
                                                        <Cpu className="h-2 w-2" /> {invoice.erpInvoiceId}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-bold text-muted-foreground">{invoice.date}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="font-black uppercase text-slate-800">{invoice.customer}</div>
                                            <div className="text-[9px] text-muted-foreground truncate max-w-[200px] italic">PO: {invoice.poNumber}</div>
                                        </TableCell>
                                        <TableCell>
                                            {invoice.spdNumber ? (
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] font-black uppercase">
                                                    <Truck className="h-3 w-3 mr-1" /> {invoice.spdNumber.split('/').pop()}
                                                </Badge>
                                            ) : (
                                                <span className="text-[9px] font-bold text-muted-foreground/40 italic">Not Picked</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs font-black">Rp {invoice.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant={invoice.status === 'paid' ? 'outline' : invoice.status === 'cancelled' ? 'destructive' : 'secondary'} 
                                                className={cn(
                                                    "text-[9px] uppercase font-black px-2 py-0",
                                                    invoice.status === 'received' ? "bg-blue-50 text-blue-700 border-blue-100" : 
                                                    invoice.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                                                    invoice.status === 'finalized' ? "bg-indigo-600 text-white" : ""
                                                )}
                                            >
                                                {invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoice.id)}`)}><Eye className="mr-2 h-4 w-4" /> Pratinjau</DropdownMenuItem>
                                                    {invoice.status !== 'finalized' && invoice.status !== 'cancelled' && (
                                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/add?editInvoiceId=${invoice.id.replace(/\//g, '_')}`)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                    )}
                                                    {isSuperAdmin && invoice.status !== 'finalized' && invoice.status !== 'cancelled' && (
                                                        <DropdownMenuItem onClick={() => handleFinalize(invoice.id)} className="text-indigo-600 font-bold"><ShieldCheck className="mr-2 h-4 w-4" /> Finalisasi (Lock)</DropdownMenuItem>
                                                    )}
                                                    {invoice.status !== 'cancelled' && (
                                                        <DropdownMenuItem className="text-destructive font-bold" onClick={() => { setTargetInvoiceId(invoice.id); setVoidDialogOpen(true); }}>
                                                            <XCircle className="mr-2 h-4 w-4" /> Batal / VOID
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Tabs>
            </CardContent>
        </Card>

        {selectedInvoices.size > 0 && (
            <div className="fixed bottom-6 right-6 z-50">
                <Button size="lg" onClick={handleCreateSpdFromSelected} className="bg-indigo-600 hover:bg-indigo-700 shadow-2xl rounded-full px-8 py-6 font-black uppercase tracking-widest">
                    <Truck className="mr-3 h-5 w-5" /> Buat SPD ({selectedInvoices.size})
                </Button>
            </div>
        )}

        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Konfirmasi VOID Invoice</DialogTitle>
                    <DialogDescription>Data tidak akan dihapus fisik, namun nomor ini akan ditandai sebagai Batal dalam riwayat audit.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Alasan Pembatalan</Label>
                        <Textarea 
                            placeholder="Contoh: Salah nominal, ganti rincian barang, customer cancel..." 
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Batal</Button>
                    <Button variant="destructive" onClick={handleVoidInvoice} disabled={!voidReason}>SIMPAN SEBAGAI VOID</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    );
  }
