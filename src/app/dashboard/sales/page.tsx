
'use client';
import { useState, useMemo, useRef } from 'react';
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
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
  } from '@/components/ui/dialog';
  import { type SalesListItem, type UserProfile, type Invoice } from '@/app/lib/data';
  import { Search, MoreHorizontal, Upload, Download, Eye, Edit, Trash2, FileSpreadsheet, RefreshCw, UserCheck } from 'lucide-react';
  import { AddSaleDialog } from './_components/add-sale-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { cn, exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query, updateDoc } from 'firebase/firestore';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  
  export default function SalesListPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingSale, setEditingSale] = useState<SalesListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; poNumber?: string; isBulk?: boolean }>({ isOpen: false });

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

    const filteredSales = useMemo(() => {
        if (!sales || !invoices) return [];
        
        return sales.filter(s => 
            s.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.sales.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(sale => {
            // Calculate dynamic status
            const relatedInvoices = invoices.filter(inv => inv.poNumber === sale.poNumber);
            const totalPaid = relatedInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            
            let status: 'Waiting' | 'Partial' | 'Paid' = 'Waiting';
            if (totalPaid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (totalPaid > 0) status = 'Partial';

            return { ...sale, status };
        });
    }, [sales, invoices, searchQuery]);

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !isAdmin) return;

        if (deleteDialogState.isBulk) {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                batch.delete(doc(firestore, 'sales', id));
            });
            await batch.commit();
            toast({ title: `${selectedIds.size} data dihapus` });
            setSelectedIds(new Set());
        } else if (deleteDialogState.poNumber) {
            const docRef = doc(firestore, 'sales', deleteDialogState.poNumber);
            await deleteDoc(docRef);
            toast({ title: "Data Berhasil Dihapus" });
        }
        setDeleteDialogState({ isOpen: false });
    };

    const handleUpdateSo = async () => {
        if (!firestore || !soUpdateState.poNumber) return;
        const docRef = doc(firestore, 'sales', soUpdateState.poNumber);
        
        // Batch update for all invoices linked to this PO
        const batch = writeBatch(firestore);
        batch.update(docRef, { soNumber: tempSo });

        const relatedInvoices = invoices?.filter(inv => inv.poNumber === soUpdateState.poNumber) || [];
        relatedInvoices.forEach(inv => {
            const invRef = doc(firestore, 'invoices', inv.id.replace(/\//g, '_'));
            batch.update(invRef, { soNumber: tempSo });
        });

        await batch.commit();
        toast({ title: "SO Number Updated", description: "Nomor SO telah sinkron dengan semua invoice terkait." });
        setSoUpdateState({ isOpen: false });
    };

    const handleSaveSale = (saleData: Omit<SalesListItem, 'ownerId'>) => {
        if (!firestore || !user) return;

        // ANTI-DUPLICATE CHECK
        const existing = sales?.find(s => s.poNumber.toLowerCase() === saleData.poNumber.toLowerCase());
        if (existing && !editingSale) {
            toast({ 
                variant: "destructive", 
                title: "Nomor PO Duplikat", 
                description: `Nomor PO ini sudah terdaftar oleh ${existing.createdBy || 'User lain'}. Anda tidak dapat menginput ulang.` 
            });
            return;
        }

        const docRef = doc(firestore, 'sales', saleData.poNumber);
        const dataToSave = { 
            ...saleData, 
            ownerId: user.uid, 
            createdBy: userProfile?.displayName || user.email || 'System' 
        };

        setDoc(docRef, dataToSave, { merge: true })
            .then(() => {
                toast({ title: editingSale ? "Berhasil Diperbarui" : "Berhasil Terdaftar" });
                setIsDialogOpen(false);
            })
            .catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: editingSale ? 'update' : 'create', requestResourceData: dataToSave
                }));
            });
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sales List (Registrasi PO)</h1>
                <p className="text-muted-foreground">Daftarkan PO Customer dan kelola status transaksinya dalam satu database terpusat.</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" />
                <Button variant="outline" onClick={() => generateExcelTemplate(['poNumber', 'customer', 'sales', 'soNumber', 'amount'], 'template_po')}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                <Button variant="outline" onClick={() => exportToExcel(filteredSales, 'daftar_po')}><Download className="mr-2 h-4 w-4"/> Export</Button>
                <AddSaleDialog 
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSave={handleSaveSale}
                    saleData={editingSale}
                    onAddClick={() => { setEditingSale(undefined); setIsDialogOpen(true); }}
                />
            </div>
        </div>

        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari PO, Customer, atau Sales..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    {selectedIds.size > 0 && isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                        </Button>
                    )}
                </div>
                
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox onCheckedChange={(checked) => setSelectedIds(checked ? new Set(filteredSales.map(s => s.poNumber)) : new Set())} />
                                </TableHead>
                                <TableHead>PO NUMBER</TableHead>
                                <TableHead>CUSTOMER</TableHead>
                                <TableHead>SO NUMBER</TableHead>
                                <TableHead>AMOUNT</TableHead>
                                <TableHead>STATUS</TableHead>
                                <TableHead>INPUT BY</TableHead>
                                <TableHead className="text-right">AKSI</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(isSalesLoading || isInvoicesLoading) ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-8">Memuat data...</TableCell></TableRow>
                            ) : filteredSales.map((sale) => (
                                <TableRow key={sale.poNumber} className={selectedIds.has(sale.poNumber) ? "bg-muted/50" : ""}>
                                    <TableCell>
                                        <Checkbox checked={selectedIds.has(sale.poNumber)} onCheckedChange={() => handleSelectRow(sale.poNumber)} />
                                    </TableCell>
                                    <TableCell className="font-bold">{sale.poNumber}</TableCell>
                                    <TableCell>{sale.customer}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className={sale.soNumber ? "font-medium" : "italic text-muted-foreground"}>{sale.soNumber || 'Waiting SO'}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTempSo(sale.soNumber || ''); setSoUpdateState({ isOpen: true, poNumber: sale.poNumber, currentSo: sale.soNumber }); }}>
                                                <RefreshCw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>Rp {sale.amount.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            sale.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                                            sale.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                        )}>
                                            {sale.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                            <UserCheck className="h-3 w-3" /> {sale.createdBy || 'Unknown'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { sessionStorage.setItem('activePoPreview', sale.poNumber); router.push('/dashboard/sales-management'); }}><Eye className="mr-2 h-4 w-4" /> Buka Buku Piutang</DropdownMenuItem>
                                                {isAdmin && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => { setEditingSale(sale); setIsDialogOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit PO</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialogState({ isOpen: true, poNumber: sale.poNumber, isBulk: false })}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* Update SO Modal */}
        <Dialog open={soUpdateState.isOpen} onOpenChange={(o) => setSoUpdateState(prev => ({...prev, isOpen: o}))}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Update SO Number</DialogTitle>
                    <p className="text-sm text-muted-foreground">Hubungkan PO <b>{soUpdateState.poNumber}</b> ke nomor SO produksi.</p>
                </DialogHeader>
                <div className="py-4">
                    <Label>Nomor Sales Order (SO)</Label>
                    <Input value={tempSo} onChange={e => setTempSo(e.target.value)} placeholder="Contoh: SO-12345" className="mt-2" />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setSoUpdateState(prev => ({...prev, isOpen: false}))}>Batal</Button>
                    <Button onClick={handleUpdateSo}>Update & Sinkron</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen} 
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open}))} 
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
