
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
  import { Search, MoreHorizontal, Download, Eye, Edit, FileSpreadsheet, RefreshCw, XCircle, FilePlus, Trash2, Wallet, Layers } from 'lucide-react';
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

    const [editingSale, setEditingSale] = useState<SalesListItem & { id?: string } | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Void & Delete State
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [targetPoId, setTargetPoId] = useState<string | null>(null);
    const [hardDeleteState, setHardDeleteState] = useState<{ isOpen: boolean; docId?: string; poNumber?: string }>({ isOpen: false });

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
            const totalInvoiced = relatedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            
            let status: any = 'Waiting';
            if (totalPaid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (totalPaid > 0 || totalInvoiced > 0) status = 'Partial';

            return { ...sale, status, totalPaid, totalInvoiced, relatedInvoicesCount: relatedInvoices.length };
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

    const handleHardDeletePo = async () => {
        if (!firestore || !hardDeleteState.docId || !isSuperAdmin) return;
        const docRef = doc(firestore, 'sales', hardDeleteState.docId);
        try {
            await deleteDoc(docRef);
            toast({ title: "PO Dihapus Permanen" });
            setHardDeleteState({ isOpen: false });
        } catch (error: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        }
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
            .then(() => { toast({ title: "SO Number Updated" }); setSoUpdateState({ isOpen: false }); })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { soNumber: tempSo } }));
            });
    };

    const handleSaveSale = (saleData: Omit<SalesListItem, 'ownerId'>) => {
        if (!firestore || !user) return;
        const safeId = saleData.poNumber.replace(/\//g, '_');
        const docRef = doc(firestore, 'sales', safeId);
        const dataToSave = { ...saleData, ownerId: user.uid, createdBy: userProfile?.displayName || user.email || 'System' };
        setDoc(docRef, dataToSave, { merge: true })
            .then(() => { toast({ title: "PO Berhasil Disimpan" }); setIsDialogOpen(false); })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: editingSale ? 'update' : 'create', requestResourceData: dataToSave }));
            });
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-slate-900">Sales Order Hub</h1>
                <p className="text-muted-foreground font-medium text-sm">Registrasi kontrak PO dan monitoring integrasi penagihan.</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => exportToExcel(filteredSales, 'daftar_po')} className="font-black uppercase text-[10px] tracking-widest h-10"><Download className="mr-2 h-4 w-4"/> Export</Button>
                <AddSaleDialog 
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSave={handleSaveSale}
                    saleData={editingSale}
                    onAddClick={() => { setEditingSale(undefined); setIsDialogOpen(true); }}
                />
            </div>
        </div>

        <Card className="shadow-xl border-none ring-1 ring-slate-200 bg-white rounded-3xl overflow-hidden">
            <CardContent className="pt-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Cari PO atau Customer..." className="pl-11 bg-slate-50 border-none font-medium h-12 rounded-2xl focus-visible:ring-indigo-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>
                
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-b-slate-100">
                                <TableHead className="w-[40px] px-4"><Checkbox onCheckedChange={(checked) => setSelectedIds(checked ? new Set(filteredSales.map(s => s.poNumber)) : new Set())} /></TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Identity / PO Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Legal Customer</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">AR Status Blueprint</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Nilai Kontrak</TableHead>
                                <TableHead className="text-right py-4 px-6"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 font-black uppercase text-[10px] tracking-widest animate-pulse text-slate-400">Syncing Master Sales Database...</TableCell></TableRow>
                            ) : filteredSales.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 font-bold italic">Belum ada PO terdaftar.</TableCell></TableRow>
                            ) : filteredSales.map((sale: any) => {
                                const hasScheme = sale.paymentScheme && sale.paymentScheme.length > 0;
                                return (
                                    <TableRow key={sale.poNumber} className={cn("hover:bg-indigo-50/10 border-b-slate-100 last:border-0 transition-colors", selectedIds.has(sale.poNumber) ? "bg-indigo-50/30" : "", sale.status === 'Cancelled' && "opacity-40 grayscale")}>
                                        <TableCell className="px-4"><Checkbox checked={selectedIds.has(sale.poNumber)} onCheckedChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(sale.poNumber) ? n.delete(sale.poNumber) : n.add(sale.poNumber); return n; })} /></TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-indigo-700">{sale.poNumber}</span>
                                                <span className="text-[8px] font-black uppercase text-slate-400">SO: {sale.soNumber || 'Pending'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-black uppercase text-slate-700">{sale.customer}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex gap-1">
                                                    {hasScheme ? sale.paymentScheme.map((stage: any, sIdx: number) => {
                                                        const isDone = sIdx < sale.relatedInvoicesCount;
                                                        return (
                                                            <TooltipProvider key={sIdx}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className={cn(
                                                                            "h-2 w-8 rounded-full border transition-all",
                                                                            isDone ? "bg-emerald-500 border-emerald-600 shadow-sm" : "bg-slate-100 border-slate-200"
                                                                        )} />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-slate-900 text-white text-[9px] uppercase font-black">
                                                                        {stage.label}: {isDone ? 'INVOICED' : 'PENDING'}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        );
                                                    }) : (
                                                        <Badge variant="outline" className="text-[8px] font-black opacity-30 uppercase">No Scheme</Badge>
                                                    )}
                                                </div>
                                                <Badge className={cn(
                                                    "text-[8px] font-black uppercase px-2 py-0 border-none",
                                                    sale.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                                                    sale.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' : 
                                                    sale.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                                )}>
                                                    {sale.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-black text-slate-900 text-right">Rp {sale.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right px-6">
                                            <div className="flex justify-end gap-2">
                                                {sale.status !== 'Cancelled' && (
                                                    <Button 
                                                        size="sm" 
                                                        className="h-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[9px] tracking-widest shadow-md px-4 rounded-xl"
                                                        onClick={() => router.push(`/dashboard/invoices/number?poNumber=${encodeURIComponent(sale.poNumber)}`)}
                                                    >
                                                        <FilePlus className="mr-1.5 h-3.5 w-3.5" /> Billing
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4 text-slate-400" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        {isAdmin && sale.status !== 'Cancelled' && (
                                                            <>
                                                                <DropdownMenuItem onClick={() => { setEditingSale(sale); setIsDialogOpen(true); }} className="text-[10px] font-black uppercase tracking-widest">
                                                                  <Edit className="mr-2 h-4 w-4" /> Edit Kontrak & Scheme
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="text-rose-600 font-black uppercase text-[10px] tracking-widest" onClick={() => { setTargetPoId(sale.poNumber); setVoidDialogOpen(true); }}>
                                                                  <XCircle className="mr-2 h-4 w-4" /> Batal / Void PO
                                                                </DropdownMenuItem>
                                                            </>
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
            </CardContent>
        </Card>

        {/* Void Dialog */}
        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="uppercase font-black tracking-tight">Pembatalan PO</DialogTitle>
                    <DialogDescription>Nomor PO ini akan ditandai Batal secara permanen dan piutangnya akan dinolkan.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Alasan Void</Label>
                    <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Contoh: Kesalahan rute, Customer ganti vendor..." className="text-sm font-medium rounded-xl border-slate-200" />
                </div>
                <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl mt-4">
                    <Button variant="ghost" onClick={() => setVoidDialogOpen(false)} className="font-bold">Batal</Button>
                    <Button variant="destructive" onClick={handleVoidPo} disabled={!voidReason} className="font-black uppercase tracking-widest px-8">Kunci Void</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Hard Delete Dialog */}
        <DeleteConfirmationDialog 
            open={hardDeleteState.isOpen}
            onOpenChange={(open) => setHardDeleteState(prev => ({ ...prev, isOpen: open }))}
            onConfirm={handleHardDeletePo}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
