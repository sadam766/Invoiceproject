
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
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { type Invoice, type UserProfile } from '@/app/lib/data';
  import { Search, MoreHorizontal, Eye, Pencil, Download, Truck, FileSpreadsheet, XCircle, ShieldCheck, Layers, Database, Hash, History, Trash2, AlertTriangle, CheckCircle2, FileJson } from 'lucide-react';
  import { Skeleton } from '@/components/ui/skeleton';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, query, doc, updateDoc, arrayUnion, deleteDoc, writeBatch, addDoc } from 'firebase/firestore';
  import { exportToExcel, exportTaxInvoicesToExcel, cn } from '@/lib/utils';
  import { DateRangePicker } from '@/app/components/date-range-picker';
  import { isWithinInterval, parseISO, startOfToday, format, subDays, startOfMonth, endOfMonth } from 'date-fns';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useDashboardData } from '../layout';

  export default function InvoiceListPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    // Consume Cached Data
    const { invoices, customers, isLoading: isGlobalLoading } = useDashboardData();

    // Void State
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);

    // Hard Delete State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // e-Faktur Export State
    const [taxExportOpen, setTaxExportOpen] = useState(false);
    const [taxCode, setTaxCode] = useState('04');
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isLeader = userProfile?.role === 'admin' || isSuperAdmin;

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        let filtered = invoices;

        if (!searchQuery) {
            filtered = filtered.filter(inv => {
                const invDate = parseISO(inv.date);
                return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
            });
        }

        if (activeTab !== 'all') {
            filtered = filtered.filter(i => {
                if (activeTab === 'paid') return i.status === 'paid';
                if (activeTab === 'received') return i.status === 'received' || i.status === 'in_transit';
                if (activeTab === 'unpaid') return i.status === 'sent' || i.status === 'unpaid' || i.status === 'draft' || i.status === 'partial';
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

    const handleApproveVA = async (invoice: Invoice) => {
        if (!firestore || !user || !isLeader) return;
        const safeId = invoice.id.replace(/\//g, '_');
        const docRef = doc(firestore, 'invoices', safeId);
        const timestamp = new Date().toISOString();

        try {
            await updateDoc(docRef, {
                status: 'sent', // Ready to Send
                vaStatus: 'approved',
                vaApprovedBy: user.email,
                vaApprovedAt: timestamp,
                revisionLogs: arrayUnion({
                    updatedBy: userProfile?.displayName || user.email || 'Leader',
                    updatedAt: timestamp,
                    action: "Virtual Account APPROVED by Leader"
                })
            });

            // NOTIFY BACK TO ADMIN (Creator)
            if (invoice.creatorId) {
                await addDoc(collection(firestore, 'notifications'), {
                    recipientId: invoice.creatorId,
                    senderId: user.uid,
                    title: "VA Approved",
                    message: `Virtual Account untuk Invoice ${invoice.id} telah disetujui. Dokumen siap dikirim.`,
                    invoiceId: invoice.id,
                    status: 'unread',
                    createdAt: timestamp
                });
            }

            toast({ title: "VA Approved", description: "Status pembayaran VA kini aktif dan Admin telah dinotifikasi." });
        } catch (error) {
            toast({ variant: "destructive", title: "Approval Gagal" });
        }
    };

    const handleVoidInvoice = () => {
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
        
        updateDoc(docRef, updateData)
            .then(() => {
                toast({ title: "Invoice Dibatalkan", description: `Invoice ${targetInvoiceId} kini berstatus VOID.` });
                setVoidDialogOpen(false);
                setVoidReason('');
                setTargetInvoiceId(null);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            });
    };

    const handleHardDelete = () => {
        if (!firestore || !deleteTargetId || !isSuperAdmin) return;
        
        const safeId = deleteTargetId.replace(/\//g, '_');
        const invoiceRef = doc(firestore, 'invoices', safeId);
        const identityRef = doc(firestore, 'invoiceNumbers', safeId);

        const batch = writeBatch(firestore);
        batch.delete(invoiceRef);
        batch.delete(identityRef);

        batch.commit()
            .then(() => {
                toast({ 
                    title: "Data Dihapus Permanen", 
                    description: `Nomor ${deleteTargetId} telah dihapus total dari repository.` 
                });
                setDeleteDialogOpen(false);
                setDeleteTargetId(null);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: invoiceRef.path,
                    operation: 'delete',
                }));
            });
    };

    const triggerTaxExport = () => {
        const toExport = invoices?.filter(inv => selectedInvoices.has(inv.id)) || [];
        if (toExport.length === 0) {
            toast({ variant: "destructive", title: "Pilih Invoice", description: "Pilih minimal satu invoice untuk diexport ke e-Faktur." });
            return;
        }
        if (!customers) return;
        exportTaxInvoicesToExcel(toExport, customers, taxCode);
        setTaxExportOpen(false);
        setSelectedInvoices(new Set());
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">Invoice Repository</h1>
                <div className="text-muted-foreground font-medium flex items-center gap-2">
                    Database penagihan terpusat.
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {filteredInvoices.length} Dokumen Tampil
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DateRangePicker onRangeChange={setDateRange} />
                <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredInvoices, `Invoice-Log-${format(new Date(), 'yyyyMMdd')}`)} className="font-bold h-9">
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Export CSV
                </Button>
                <Button size="sm" className="font-black uppercase h-9 shadow-md bg-indigo-600 hover:bg-indigo-700" onClick={() => router.push('/dashboard/sales')}>
                    <Layers className="mr-2 h-4 w-4" /> Mulai Penagihan
                </Button>
            </div>
        </div>

        <Card className="shadow-md border-none ring-1 ring-border bg-white">
            <CardContent className="pt-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <TabsList className="bg-muted/50 p-1">
                                <TabsTrigger value="all" className="text-xs font-bold uppercase">Semua</TabsTrigger>
                                <TabsTrigger value="paid" className="text-xs font-bold uppercase px-4 text-emerald-600">Lunas</TabsTrigger>
                                <TabsTrigger value="unpaid" className="text-xs font-bold uppercase px-4 text-red-600">Terutang</TabsTrigger>
                                <TabsTrigger value="cancelled" className="text-xs font-bold uppercase px-4 opacity-50">Void</TabsTrigger>
                            </TabsList>
                            {selectedInvoices.size > 0 && (
                                <Button size="sm" onClick={() => setTaxExportOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-xl shadow-lg shadow-emerald-100">
                                    <FileJson className="mr-2 h-3.5 w-3.5" /> Export e-Faktur ({selectedInvoices.size})
                                </Button>
                            )}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari No. Invoice, Customer, PO..." className="pl-8 h-9 bg-muted/20 border-none font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={(c) => c ? setSelectedInvoices(new Set(filteredInvoices.map(i => i.id))) : setSelectedInvoices(new Set())} /></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Identitas Penagihan</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Legal Customer & PO</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Tagihan</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">VA Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(isGlobalLoading && !invoices) ? <TableRow><TableCell colSpan={7} className="text-center py-20 font-bold animate-pulse text-muted-foreground">Menghubungkan ke Database...</TableCell></TableRow> : 
                                    filteredInvoices.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400 font-bold italic">Tidak ada invoice ditemukan.</TableCell></TableRow> :
                                    filteredInvoices.map((invoice) => {
                                    const totalPaid = invoice.payments?.reduce((s, p) => s + p.amount, 0) || (invoice.status === 'paid' ? invoice.amount : 0);
                                    const outstandingDoc = Math.max(0, invoice.amount - totalPaid);
                                    const isEmpty = invoice.amount === 0 || !invoice.items || invoice.items.length === 0;
                                    const isVaPending = invoice.paymentMethod === 'va' && invoice.vaStatus === 'pending';
                                    
                                    return (
                                        <TableRow key={invoice.id} className={cn("hover:bg-muted/5 transition-colors", invoice.status === 'cancelled' && "opacity-40 grayscale")}>
                                            <TableCell><Checkbox checked={selectedInvoices.has(invoice.id)} onCheckedChange={() => setSelectedInvoices(prev => { const n = new Set(prev); n.has(invoice.id) ? n.delete(invoice.id) : n.add(invoice.id); return n; })} /></TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn("font-black text-sm", invoice.status === 'cancelled' ? "line-through" : "text-indigo-700")}>{invoice.id}</span>
                                                        {invoice.erpInvoiceId && <Database className="h-3 w-3 text-emerald-600" />}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-muted-foreground">{invoice.date}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <div className="font-black uppercase text-slate-800">{invoice.customer}</div>
                                                <div className="text-[9px] text-muted-foreground truncate max-w-[200px] italic">PO: {invoice.poNumber}</div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-right">Rp {invoice.amount.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-center">
                                                {invoice.paymentMethod === 'va' ? (
                                                    <Badge className={cn(
                                                        "text-[8px] font-black uppercase",
                                                        invoice.vaStatus === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                                    )}>
                                                        {invoice.vaStatus === 'approved' ? 'Approved/Ready' : 'Awaiting Lead Approval'}
                                                    </Badge>
                                                ) : <span className="text-[8px] text-slate-300">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={invoice.status === 'paid' ? 'outline' : invoice.status === 'cancelled' ? 'destructive' : 'secondary'} 
                                                    className={cn(
                                                        "text-[9px] uppercase font-black px-2 py-0",
                                                        invoice.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                                                        isVaPending ? "bg-amber-100 text-amber-900 border-amber-200" :
                                                        invoice.status === 'sent' || invoice.status === 'unpaid' ? "bg-emerald-50 text-emerald-800 border-emerald-100" : ""
                                                    )}
                                                >
                                                    {isVaPending ? 'Awaiting Lead Approval' : (invoice.status === 'sent' ? 'Ready to Send' : invoice.status.replace('_', ' '))}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    {isLeader && invoice.vaStatus === 'pending' && (
                                                        <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 font-black text-[9px] uppercase shadow-lg shadow-amber-100" onClick={() => handleApproveVA(invoice)}>
                                                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approve VA
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoice.id)}`)}><Eye className="mr-2 h-4 w-4" /> Pratinjau Cetak</DropdownMenuItem>
                                                            
                                                            {isLeader && invoice.vaStatus === 'pending' && (
                                                                <DropdownMenuItem onClick={() => handleApproveVA(invoice)} className="text-amber-600 font-black uppercase text-[10px]">
                                                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve VA
                                                                </DropdownMenuItem>
                                                            )}

                                                            {invoice.status !== 'finalized' && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/add?editInvoiceId=${invoice.id.replace(/\//g, '_')}`)}><Pencil className="mr-2 h-4 w-4" /> Ubah Data</DropdownMenuItem>
                                                            )}
                                                            {isSuperAdmin && (
                                                                <DropdownMenuItem 
                                                                    className="text-red-600 font-bold" 
                                                                    onClick={() => { setDeleteTargetId(invoice.id); setDeleteDialogOpen(true); }}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" /> {isEmpty ? 'Hapus Kosong' : 'Hapus Permanen'}
                                                                </DropdownMenuItem>
                                                            )}
                                                            {invoice.status !== 'cancelled' && (
                                                                <DropdownMenuItem className="text-destructive font-bold" onClick={() => { setTargetInvoiceId(invoice.id); setVoidDialogOpen(true); }}>
                                                                    <XCircle className="mr-2 h-4 w-4" /> Tandai VOID
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Tabs>
            </CardContent>
        </Card>

        {/* Export e-Faktur Configuration */}
        <Dialog open={taxExportOpen} onOpenChange={setTaxExportOpen}>
            <DialogContent className="sm:max-w-[400px] rounded-3xl overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-4 bg-slate-50">
                    <DialogTitle className="flex items-center gap-2 text-emerald-700 uppercase font-black text-sm">
                        <FileJson className="h-5 w-5" /> Config Export e-Faktur
                    </DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilih Kode Transaksi</Label>
                        <Select value={taxCode} onValueChange={setTaxCode}>
                            <SelectTrigger className="h-12 rounded-xl font-bold border-emerald-100 bg-emerald-50/20">
                                <SelectValue placeholder="Pilih Kode" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                <SelectItem value="01">01 - DPP Murni (Standard)</SelectItem>
                                <SelectItem value="02">02 - Pemungut Bendaharawan</SelectItem>
                                <SelectItem value="03">03 - Pemungut Selain Bendaharawan</SelectItem>
                                <SelectItem value="04">04 - DPP Nilai Lain (11/12 Rumus)</SelectItem>
                                <SelectItem value="07">07 - Tidak Dipungut</SelectItem>
                                <SelectItem value="08">08 - Dibebaskan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {taxCode === '04' && (
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 border-dashed">
                            <p className="text-[10px] font-bold text-blue-700 leading-relaxed italic">
                                Info: Kode 04 akan otomatis menerapkan pembulatan 11/12 pada DPP per baris item.
                            </p>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 p-3 rounded-xl">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {selectedInvoices.size} Dokumen Terpilih
                    </div>
                </div>
                <DialogFooter className="p-6 border-t bg-slate-50/30">
                    <Button variant="ghost" onClick={() => setTaxExportOpen(false)} className="h-12 font-bold px-6">Batal</Button>
                    <Button onClick={triggerTaxExport} className="h-12 flex-1 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-emerald-100">
                        UNDUH TEMPLATE EXCEL
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Void Dialog */}
        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Konfirmasi VOID Invoice</DialogTitle>
                    <DialogDescription>Invoice ini akan ditandai sebagai Batal dan tidak akan dihitung dalam total piutang.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label className="text-xs font-bold uppercase">Alasan Pembatalan</Label>
                    <Textarea 
                        placeholder="Masukkan alasan..." 
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Batal</Button>
                    <Button variant="destructive" onClick={handleVoidInvoice} disabled={!voidReason}>YA, BATALKAN</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Hard Delete Confirmation */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" /> Hapus Total
                    </DialogTitle>
                    <DialogDescription>
                        Data invoice <b>{deleteTargetId}</b> akan dihapus permanen dari seluruh sistem.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
                    <Button variant="destructive" onClick={handleHardDelete} className="font-black uppercase">KONFIRMASI HAPUS</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    );
  }
