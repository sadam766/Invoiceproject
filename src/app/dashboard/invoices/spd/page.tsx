'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { 
    Search, 
    Truck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Eye, 
    Edit, 
    Trash2, 
    MoreVertical, 
    Calendar as CalendarIcon,
    Layers,
    FileCheck
  } from 'lucide-react';
  import { AddSpdDialog } from './_components/add-spd-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
  import { collection, doc, deleteDoc, writeBatch, query, updateDoc } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
  } from '@/components/ui/dropdown-menu';
  import type { SpdData, Invoice, SpdInvoiceEntry } from '@/app/lib/data';
  
  export default function SpdPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const [editingSpd, setEditingSpd] = useState<SpdData | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; spdId?: string }>({ isOpen: false });

    // State for pre-selected invoices from shortcut
    const [initialPreselected, setInitialPreselected] = useState<SpdInvoiceEntry[] | undefined>(undefined);

    const spdsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data: spds, isLoading } = useCollection<SpdData>(spdsCollection);

    // Effect to check for pre-selected invoices from Invoice List shortcut
    useEffect(() => {
        const data = sessionStorage.getItem('preselectedSpdInvoices');
        if (data) {
            try {
                const invoices = JSON.parse(data) as Invoice[];
                const entries: SpdInvoiceEntry[] = invoices.map(inv => ({
                    invoiceId: inv.id,
                    customer: inv.customer,
                    address: inv.billingAddress,
                    status: 'pending',
                    sjNumbers: inv.sjNumbers || []
                }));
                setInitialPreselected(entries);
                setIsDialogOpen(true);
                sessionStorage.removeItem('preselectedSpdInvoices');
            } catch (e) {
                console.error("Failed to parse preselected invoices", e);
            }
        }
    }, []);

    const filteredData = useMemo(() => {
        if (!spds) return [];
        return spds.filter(s => 
            s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.courier.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.invoices.some(inv => inv.customer.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a, b) => b.date.localeCompare(a.date));
    }, [spds, searchQuery]);

    const handleAdd = () => {
      setEditingSpd(undefined);
      setInitialPreselected(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (spdItem: SpdData) => {
        setEditingSpd(spdItem);
        setInitialPreselected(undefined);
        setIsDialogOpen(true);
    }
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !deleteDialogState.spdId) return;
        
        const spdToDelete = spds?.find(s => s.id === deleteDialogState.spdId);
        const batch = writeBatch(firestore);

        // RESET: Melepaskan invoice dari SPD yang dihapus (Status Sync)
        spdToDelete?.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: null });
        });

        batch.delete(doc(firestore, 'spds', deleteDialogState.spdId.replace(/\//g, '_')));

        await batch.commit();
        toast({ title: "SPD Dihapus", description: "Seluruh invoice terkait dikembalikan ke daftar Siap Kirim." });
        setDeleteDialogState({ isOpen: false, spdId: undefined });
    };

    const handleSave = async (newItem: SpdData) => {
        if (!firestore || !user) return;
        
        const safeId = newItem.id.replace(/\//g, '_');
        const batch = writeBatch(firestore);
        const spdRef = doc(firestore, 'spds', safeId);
        
        // 1. UPDATE INVOICES: Tandai invoice dengan No. SPD (Pencegahan Duplikasi)
        newItem.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: newItem.id });
        });

        // 2. SAVE SPD
        batch.set(spdRef, { ...newItem, ownerId: user.uid }, { merge: true });

        await batch.commit();
        toast({ 
            title: editingSpd ? "SPD Berhasil Diperbarui" : "SPD Berhasil Diterbitkan",
            description: `${newItem.invoices.length} Invoice telah berhasil ditambahkan ke SPD Nomor ${newItem.id}`
        });
        setIsDialogOpen(false);
        setEditingSpd(undefined);
        setInitialPreselected(undefined);
    };

    const handleUpdateStatus = async (spd: SpdData, newStatus: SpdData['status']) => {
        if (!firestore) return;
        const safeId = spd.id.replace(/\//g, '_');
        await updateDoc(doc(firestore, 'spds', safeId), { status: newStatus });
        toast({ title: `Status SPD: ${newStatus.replace('_', ' ').toUpperCase()}` });
    };

    const statusConfig = {
        in_delivery: { label: 'In Delivery', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
        received: { label: 'Received', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
        rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">SPD Digital Dispatch</h1>
            <p className="text-muted-foreground font-medium">Konsolidasi dokumen pengiriman dalam satu sistem terpadu.</p>
          </div>
          <AddSpdDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSave}
                spdData={editingSpd}
                onAddClick={handleAdd}
                initialPreselectedInvoices={initialPreselected}
            />
        </div>
        
        <div className="flex items-center gap-4 bg-background p-4 rounded-xl border shadow-sm">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Cari Nomor SPD, Kurir, atau Nama Customer..." 
                    className="pl-10 h-11 bg-muted/20 border-none shadow-none" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="hidden lg:flex gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-auto">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> In Delivery</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Received</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected</div>
            </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted/30" />)
            ) : filteredData.length === 0 ? (
                <div className="col-span-full py-20 text-center space-y-4">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <p className="text-muted-foreground font-medium">Belum ada daftar pengiriman aktif hari ini.</p>
                </div>
            ) : filteredData.map((spd) => {
                const Conf = statusConfig[spd.status];
                return (
                    <Card key={spd.id} className="group relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-border">
                        <div className={cn("absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10")}>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spd.id)}`)}><FileCheck className="mr-2 h-4 w-4" /> Cetak Summary</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(spd)}><Edit className="mr-2 h-4 w-4" /> Edit Batch</DropdownMenuItem>
                                    <DropdownMenuItem className="text-rose-600 font-bold" onClick={() => setDeleteDialogState({ isOpen: true, spdId: spd.id })}><Trash2 className="mr-2 h-4 w-4" /> Hapus SPD</DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                        </div>

                        <CardHeader className="pb-3 border-b bg-muted/5">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-black font-mono text-indigo-700 tracking-tighter">{spd.id}</CardTitle>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                        <CalendarIcon className="h-3 w-3" /> {spd.date}
                                    </div>
                                </div>
                                <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-2", Conf.color)}>
                                    <Conf.icon className="h-3 w-3 mr-1" /> {Conf.label}
                                </Badge>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-5 pt-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-600/10 p-2.5 rounded-xl"><Truck className="h-5 w-5 text-indigo-600" /></div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground/60 leading-none tracking-widest">Kurir Pembawa</span>
                                    <span className="text-sm font-black truncate text-slate-800">{spd.courier}</span>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                                        <Layers className="h-3 w-3" /> Consolidated Invoices ({spd.invoices.length})
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {spd.invoices.slice(0, 3).map((inv, idx) => (
                                        <div key={idx} className="flex flex-col gap-0.5 bg-muted/30 p-2 rounded-lg border border-transparent hover:border-indigo-100 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase truncate max-w-[140px] text-slate-700">{inv.customer}</span>
                                                <span className="text-[9px] font-mono font-bold text-indigo-600">{inv.invoiceId.split('/').pop()}</span>
                                            </div>
                                            <span className="text-[8px] text-muted-foreground line-clamp-1 italic">{inv.address}</span>
                                        </div>
                                    ))}
                                    {spd.invoices.length > 3 && (
                                        <div className="text-center pt-1">
                                            <Badge variant="secondary" className="text-[9px] font-bold cursor-pointer hover:bg-muted" onClick={() => router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spd.id)}`)}>
                                                + {spd.invoices.length - 3} Dokumen Lainnya
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                {spd.status === 'in_delivery' ? (
                                    <>
                                        <Button variant="outline" size="sm" className="flex-1 h-9 text-[10px] font-black border-emerald-200 hover:bg-emerald-50 text-emerald-700 shadow-sm" onClick={() => handleUpdateStatus(spd, 'received')}>
                                            MARK RECEIVED
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-9 text-[10px] font-black text-rose-600" onClick={() => handleUpdateStatus(spd, 'rejected')}>
                                            REJECT
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" size="sm" className="w-full h-9 text-[10px] font-black tracking-widest" onClick={() => handleUpdateStatus(spd, 'in_delivery')}>
                                        RESET TO DELIVERY
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen} 
            onOpenChange={(o) => setDeleteDialogState({isOpen: o, spdId: o ? deleteDialogState.spdId : undefined})} 
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
