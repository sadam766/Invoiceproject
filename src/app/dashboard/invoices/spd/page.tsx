
'use client';
import { useState, useMemo } from 'react';
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
    Plus, 
    Truck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Eye, 
    Edit, 
    Trash2, 
    MoreVertical,
    MapPin,
    FileText,
    Calendar as CalendarIcon
  } from 'lucide-react';
  import { AddSpdDialog } from './_components/add-spd-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query, updateDoc } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
  } from '@/components/ui/dropdown-menu';
  import type { SpdData } from '@/app/lib/data';
  
  export default function SpdPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const [editingSpd, setEditingSpd] = useState<SpdData | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; spdId?: string }>({ isOpen: false });

    const spdsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data: spds, isLoading } = useCollection<SpdData>(spdsCollection);

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
      setIsDialogOpen(true);
    };

    const handleEdit = (spdItem: SpdData) => {
        setEditingSpd(spdItem);
        setIsDialogOpen(true);
    }
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !deleteDialogState.spdId) return;
        
        const spdToDelete = spds?.find(s => s.id === deleteDialogState.spdId);
        const batch = writeBatch(firestore);

        // 1. Reset spdNumber on all linked invoices
        spdToDelete?.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: null });
        });

        // 2. Delete SPD doc
        batch.delete(doc(firestore, 'spds', deleteDialogState.spdId.replace(/\//g, '_')));

        await batch.commit();
        toast({ title: "SPD Berhasil Dihapus", description: "Status invoice terkait telah di-reset." });
        setDeleteDialogState({ isOpen: false, spdId: undefined });
    };

    const handleSave = async (newItem: SpdData) => {
        if (!firestore || !user) return;
        
        const safeId = newItem.id.replace(/\//g, '_');
        const batch = writeBatch(firestore);
        const spdRef = doc(firestore, 'spds', safeId);
        
        // 1. Update Invoices status & spd link
        newItem.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: newItem.id });
        });

        // 2. Save SPD
        batch.set(spdRef, { ...newItem, ownerId: user.uid }, { merge: true });

        await batch.commit();
        toast({ title: editingSpd ? "SPD Diperbarui" : "SPD Berhasil Terbit" });
        setIsDialogOpen(false);
        setEditingSpd(undefined);
    };

    const handleUpdateStatus = async (spd: SpdData, newStatus: SpdData['status']) => {
        if (!firestore) return;
        const safeId = spd.id.replace(/\//g, '_');
        await updateDoc(doc(firestore, 'spds', safeId), { status: newStatus });
        toast({ title: `Status SPD: ${newStatus.replace('_', ' ').toUpperCase()}` });
    };

    const statusConfig = {
        in_delivery: { label: 'In Delivery', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
        received: { label: 'Received', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
        rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Digital Dispatch (SPD)</h1>
            <p className="text-muted-foreground">Kelola pengiriman dokumen fisik invoice ke pelanggan.</p>
          </div>
          <AddSpdDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSave}
                spdData={editingSpd}
                onAddClick={handleAdd}
            />
        </div>
        
        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Cari No. SPD, Kurir, atau Customer..." 
                    className="pl-8 bg-background" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="flex gap-4 text-xs font-medium text-muted-foreground ml-auto">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400" /> In Delivery</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> Received</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Rejected</div>
            </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-48 animate-pulse bg-muted/50" />)
            ) : filteredData.map((spd) => {
                const Conf = statusConfig[spd.status];
                return (
                    <Card key={spd.id} className="group relative overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-primary">
                        <div className={cn("absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity")}>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spd.id)}`)}><Eye className="mr-2 h-4 w-4" /> Cetak SPD</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(spd)}><Edit className="mr-2 h-4 w-4" /> Edit Dispatch</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialogState({ isOpen: true, spdId: spd.id })}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                        </div>

                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-mono font-bold">{spd.id}</CardTitle>
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <CalendarIcon className="h-3 w-3" /> {spd.date}
                                    </div>
                                </div>
                                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", Conf.color)}>
                                    <Conf.icon className="h-3 w-3 mr-1" /> {Conf.label}
                                </Badge>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                                <div className="bg-primary/10 p-2 rounded-full"><Truck className="h-4 w-4 text-primary" /></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Kurir / Ekspedisi</span>
                                    <span className="text-sm font-bold truncate max-w-[180px]">{spd.courier}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <FileText className="h-3 w-3" /> Dokumen Terlampir ({spd.invoices.length})
                                </p>
                                <div className="space-y-1">
                                    {spd.invoices.slice(0, 2).map((inv, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] border-b border-dashed pb-1">
                                            <span className="font-medium truncate max-w-[150px]">{inv.customer}</span>
                                            <span className="font-mono text-muted-foreground">{inv.invoiceId.split('/').pop()}</span>
                                        </div>
                                    ))}
                                    {spd.invoices.length > 2 && (
                                        <p className="text-[9px] italic text-primary font-medium">+ {spd.invoices.length - 2} invoice lainnya</p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                {spd.status === 'in_delivery' ? (
                                    <>
                                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] border-green-200 hover:bg-green-50 text-green-700" onClick={() => handleUpdateStatus(spd, 'received')}>
                                            MARK RECEIVED
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600" onClick={() => handleUpdateStatus(spd, 'rejected')}>
                                            REJECT
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px]" onClick={() => handleUpdateStatus(spd, 'in_delivery')}>
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
