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
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Label } from '@/components/ui/label';
  import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription 
  } from '@/components/ui/dialog';
  import { Textarea } from '@/components/ui/textarea';
  import { type SalesListItem, type UserProfile, type Invoice } from '@/app/lib/data';
  import { Search, MoreHorizontal, Download, Eye, Edit, FileSpreadsheet, RefreshCw, XCircle, FilePlus, Trash2 } from 'lucide-react';
  import { AddSaleDialog } from './_components/add-sale-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { cn, exportToExcel } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, query, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';

  export default function SalesListPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [editingSale, setEditingSale] = useState<SalesListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Void & Delete State
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [targetPoId, setTargetPoId] = useState<string | null>(null);
    const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);

    // SO Update State
    const [soUpdateState, setSoUpdateState] = useState<{ isOpen: boolean; poNumber?: string; currentSo?: string }>({ isOpen: false });
    const [tempSo, setTempSo] = useState('');

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const salesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sales'));
    }, [firestore]);
    const { data: sales, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoices, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

    const isLoading = isSalesLoading || isInvoicesLoading;

    const filteredSales = useMemo(() => {
        if (!sales || !invoices) return [];
        
        return sales.filter(s => 
            s.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.sales.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(sale => {
            if (sale.status === 'Cancelled') return sale;
            
            const relatedInvoices = invoices.filter(inv => inv.poNumber === sale.poNumber && inv.status !== 'cancelled');
            const totalPaid = relatedInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            
            let status: any = 'Waiting';
            if (totalPaid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (totalPaid > 0) status = 'Partial';

            return { ...sale, status };
        });
    }, [sales, invoices, searchQuery]);

    const handleVoidPo = () => {
        if (!firestore || !targetPoId || !voidReason || !user) return;
        const safeId = targetPoId.replace(/\//g, '_');
        const docRef = doc(firestore, 'sales', safeId);
        
        const timestamp = new Date().toISOString();
        const updateData = { 
            status: 'Cancelled', 
            voidReason: voidReason,
            lastUpdatedAt: timestamp,
            lastUpdatedBy: userProfile?.displayName || user.email || 'System'
        };

        updateDoc(docRef, updateData)
            .then(() => {
                toast({ title: "PO Dibatalkan (Void)", description: `PO ${targetPoId} ditandai sebagai Batal.` });
                setVoidDialogOpen(false);
                setVoidReason('');
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            });
    };

    const handleHardDeletePo = () => {
        if (!firestore || !targetPoId || !isSuperAdmin) return;
        
        const safeId = targetPoId.replace(/\//g, '_');
        const docRef = doc(firestore, 'sales', safeId);
        
        deleteDoc(docRef)
            .then(() => {
                toast({ 
                    title: "PO Dihapus Permanen", 
                    description: `Data PO ${targetPoId} telah dihapus sepenuhnya dari database.` 
                });
                setHardDeleteDialogOpen(false);
                setTargetPoId(null);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                }));
            });
    };

    const handleUpdateSo = () => {
        if (!firestore || !soUpdateState.poNumber) return;
        const safeId = soUpdateState.poNumber.replace(/\//g, '_');
        const docRef = doc(firestore, 'sales', safeId);
        
        const batch = writeBatch(firestore);
        batch.update(docRef, { soNumber: tempSo });

        const relatedInvoices = invoices?.filter(inv => inv.poNumber === soUpdateState.poNumber) || [];
        relatedInvoices.forEach(inv => {
            const invRef = doc(firestore, 'invoices', inv.id.replace(/\//g, '_'));
            batch.update(invRef, { soNumber: tempSo });
        });

        batch.commit()
            .then(() => {
                toast({ title: "SO Number Updated" });
                setSoUpdateState({ isOpen: false });
            })
            .catch(async (serverError) => {
                // Batch errors are harder to contextualize but we'll emit for the main ref
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: { soNumber: tempSo }
                }));
            });
    };

    const handleSaveSale = (saleData: Omit<SalesListItem, 'ownerId'>) => {
        if (!firestore || !user) return;
        
        const safeId = saleData.poNumber.replace(/\//g, '_');
        const docRef = doc(firestore, 'sales', safeId);
        
        const dataToSave = { 
            ...saleData, 
            ownerId: user.uid, 
            createdBy: userProfile?.displayName || user.email || 'System' 
        };

        setDoc(docRef, dataToSave, { merge: true })
            .then(() => {
                toast({ title: "PO Berhasil Disimpan" });
                setIsDialogOpen(false);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, 
                    operation: editingSale ? 'update' : 'create', 
                    requestResourceData: dataToSave
                }));
            });
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Sales List (Registrasi PO)</h1>
                <p className="text-muted-foreground font-medium text-sm">Pilih PO untuk menerbitkan invoice secara otomatis.</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => exportToExcel(filteredSales, 'daftar_po')} className="font-bold"><Download className="mr-2 h-4 w-4"/> Export</Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AddSaleDialog 
                            isOpen={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            onSave={handleSaveSale}
                            saleData={editingSale}
                            onAddClick={() => { setEditingSale(undefined); setIsDialogOpen(true); }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-none text-[10px] p-3 max-w-[200px]">
                      Langkah awal untuk membuat Sales Order (SO) baru. Masukkan data pelanggan dan detail barang di sini.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
            </div>
        </div>

        <Card className="shadow-md border-none ring-1 ring-border">
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari PO, Customer..." className="pl-8 bg-muted/20 border-none font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>
                
                <div className="rounded-xl border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[40px]"><Checkbox onCheckedChange={(checked) => setSelectedIds(checked ? new Set(filteredSales.map(s => s.poNumber)) : new Set())} /></TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">PO Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Customer</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">SO Produksi</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Nilai PO</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-right py-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-20 font-bold text-muted-foreground">Memuat Database Sales...</TableCell></TableRow>
                            ) : filteredSales.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-medium italic">Belum ada data PO terdaftar.</TableCell></TableRow>
                            ) : filteredSales.map((sale) => (
                                <TableRow key={sale.poNumber} className={cn("hover:bg-muted/5 border-b last:border-0", selectedIds.has(sale.poNumber) ? "bg-muted/30" : "", sale.status === 'Cancelled' && "opacity-40 grayscale")}>
                                    <TableCell><Checkbox checked={selectedIds.has(sale.poNumber)} onCheckedChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(sale.poNumber) ? n.delete(sale.poNumber) : n.add(sale.poNumber); return n; })} /></TableCell>
                                    <TableCell className="font-black text-slate-800">{sale.poNumber}</TableCell>
                                    <TableCell className="text-xs font-bold uppercase text-slate-600">{sale.customer}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {sale.soNumber ? (
                                                <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 font-bold border-blue-100">{sale.soNumber}</Badge>
                                            ) : (
                                                <span className="text-[10px] font-bold italic text-muted-foreground uppercase opacity-50">Waiting SO</span>
                                            )}
                                            {sale.status !== 'Cancelled' && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-blue-100" onClick={() => { setTempSo(sale.soNumber || ''); setSoUpdateState({ isOpen: true, poNumber: sale.poNumber }); }}>
                                                    <RefreshCw className="h-3 w-3 text-blue-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-black text-slate-800">Rp {sale.amount.toLocaleString('id-ID')}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={cn(
                                            "text-[9px] font-black uppercase px-2 py-0.5",
                                            sale.status === 'Paid' ? 'bg-emerald-600' : 
                                            sale.status === 'Cancelled' ? 'bg-red-600' : 
                                            sale.status === 'Partial' ? 'bg-amber-500' : 'bg-slate-400'
                                        )}>
                                            {sale.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {sale.status !== 'Cancelled' && (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button 
                                                          size="sm" 
                                                          className="h-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest shadow-md"
                                                          onClick={() => router.push(`/dashboard/invoices/number?poNumber=${encodeURIComponent(sale.poNumber)}`)}
                                                      >
                                                          <FilePlus className="mr-1.5 h-3.5 w-3.5" /> Terbitkan Invoice
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-slate-900 text-white border-none text-[10px] p-2">
                                                      Mengirim data SO ke bagian penagihan agar nomor PO muncul saat admin membuat Invoice.
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => { sessionStorage.setItem('activePoPreview', sale.poNumber); router.push('/dashboard/sales-management'); }}>
                                                        <Eye className="mr-2 h-4 w-4" /> Monitoring Piutang
                                                    </DropdownMenuItem>
                                                    {isAdmin && sale.status !== 'Cancelled' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => { setEditingSale(sale); setIsDialogOpen(true); }}>
                                                              <Edit className="mr-2 h-4 w-4" /> Edit Data PO
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive font-bold" onClick={() => { setTargetPoId(sale.poNumber); setVoidDialogOpen(true); }}>
                                                              <XCircle className="mr-2 h-4 w-4" /> Void / Batalkan
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {isSuperAdmin && (
                                                        <DropdownMenuItem 
                                                            className="text-red-600 font-bold" 
                                                            onSelect={(e) => { e.preventDefault(); setTargetPoId(sale.poNumber); setHardDeleteDialogOpen(true); }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Permanen
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* Void Dialog */}
        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Konfirmasi Pembatalan PO</DialogTitle>
                    <DialogDescription>Nomor PO ini akan ditandai Batal dan tidak akan muncul di penagihan baru.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Alasan Pembatalan</Label>
                    <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Contoh: Kesalahan input rute, Customer ganti vendor..." className="text-sm font-medium" />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setVoidDialogOpen(false)} className="font-bold">Batal</Button>
                    <Button variant="destructive" onClick={handleVoidPo} disabled={!voidReason} className="font-black uppercase tracking-widest">SIMPAN VOID</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Hard Delete Dialog */}
        <DeleteConfirmationDialog 
            open={hardDeleteDialogOpen}
            onOpenChange={setHardDeleteDialogOpen}
            onConfirm={handleHardDeletePo}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>

        {/* SO Update Modal */}
        <Dialog open={soUpdateState.isOpen} onOpenChange={(o) => setSoUpdateState(prev => ({...prev, isOpen: o}))}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle className="uppercase font-black tracking-tight">Sinkronisasi No. SO</DialogTitle></DialogHeader>
                <div className="py-4 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Nomor SO Produksi Baru</Label>
                    <Input value={tempSo} onChange={e => setTempSo(e.target.value)} placeholder="Contoh: SO-12345" className="font-mono font-bold text-blue-700" />
                </div>
                <DialogFooter><Button onClick={handleUpdateSo} className="w-full bg-blue-600 hover:bg-blue-700 font-bold uppercase tracking-widest">Update & Sinkronkan</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    );
  }
