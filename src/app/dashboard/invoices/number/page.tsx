'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { type InvoiceNumber, type Invoice, type UserProfile } from '@/app/lib/data';
  import { Search, Download, MoreHorizontal, Edit, Trash2, Lock, Database, Hash, Info, FilePlus, AlertTriangle } from 'lucide-react';
  import { AddInvoiceNumberDialog } from './_components/add-invoice-number-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { Skeleton } from '@/components/ui/skeleton';
  import { cn, exportToExcel } from '@/lib/utils';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, deleteDoc, query, setDoc, writeBatch } from 'firebase/firestore';

  export default function InvoiceNumberPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const poNumberParam = searchParams.get('poNumber');
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [searchQuery, setSearchQuery] = useState(poNumberParam || '');

    const [editingInvoice, setEditingInvoice] = useState<InvoiceNumber | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; invoiceId?: string }>({ isOpen: false });

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    useEffect(() => {
        if (poNumberParam && !isDialogOpen && !editingInvoice) {
            setIsDialogOpen(true);
        }
    }, [poNumberParam]);

    const invoiceNumbersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoiceNumbers'));
    }, [firestore]);
    const { data: invoices, isLoading } = useCollection<InvoiceNumber>(invoiceNumbersCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: linkedInvoices } = useCollection<Invoice>(invoicesCollection);

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        
        const sortedInvoices = [...invoices].sort((a, b) => {
            const getNum = (id: string) => {
                const matchSAR = id.match(/SAR\/\d{2}01(\d+)A/);
                const matchKW = id.match(/KW\/(\d+)\/KEU\/\d{4}/);
                if (matchSAR) return parseInt(matchSAR[1], 10);
                if (matchKW) return parseInt(matchKW[1], 10);
                return 0;
            };
            return getNum(b.id) - getNum(a.id);
        });

        if (!searchQuery) {
            return sortedInvoices;
        }
        return sortedInvoices.filter((invoice) => 
            invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (invoice.salesOrder && invoice.salesOrder.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (invoice.poNumber && invoice.poNumber.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [invoices, searchQuery]);

    const handleAddClick = () => {
      setEditingInvoice(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (invoice: InvoiceNumber) => {
        setEditingInvoice(invoice);
        setIsDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!firestore || !deleteDialogState.invoiceId) return;

        // Smart Check: Only block if the invoice is finalized or has actual items/amount
        const linkedInv = linkedInvoices?.find(inv => inv.id === deleteDialogState.invoiceId);
        
        // Allowed to delete if:
        // 1. No linked invoice document exists yet
        // 2. Linked doc is draft AND has 0 amount AND has 0 items
        const canDelete = !linkedInv || (
            linkedInv.status === 'draft' && 
            (linkedInv.amount === 0 || !linkedInv.items || linkedInv.items.length === 0)
        );

        if (!canDelete) {
            toast({ 
                variant: "destructive", 
                title: "Aksi Ditolak", 
                description: "Nomor ini sudah memiliki data transaksi (Item/Nilai) yang terkunci di Invoice List." 
            });
            setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            return;
        }

        const safeId = deleteDialogState.invoiceId.replace(/\//g, '_');
        const docRef = doc(firestore, 'invoiceNumbers', safeId);
        const invRef = doc(firestore, 'invoices', safeId);
        
        const batch = writeBatch(firestore);
        batch.delete(docRef);
        // Cascade delete placeholder if it exists and is empty
        if (linkedInv) {
            batch.delete(invRef);
        }

        batch.commit()
            .then(() => {
                toast({ title: 'Identitas Berhasil Dibersihkan' });
                setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ 
                    path: docRef.path, 
                    operation: 'delete' 
                }));
                setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            });
    };
    
    const openDeleteDialog = (invoiceId: string) => {
        setDeleteDialogState({ isOpen: true, invoiceId: invoiceId });
    };

    const handleSave = async (invoice: Omit<InvoiceNumber, 'id' | 'ownerId'> & {id: string}, action: 'save' | 'create') => {
      if (!firestore || !user) return;

      const safeId = invoice.id.replace(/\//g, '_');
      const docRef = doc(firestore, 'invoiceNumbers', safeId);
      
      const dataToSave = {
          ...invoice,
          ownerId: user.uid,
          createdBy: userProfile?.displayName || user.email || 'System'
      };

      try {
          await setDoc(docRef, dataToSave, { merge: true });
          
          if (action === 'create') {
              const invoiceDocRef = doc(firestore, 'invoices', safeId);
              await setDoc(invoiceDocRef, {
                  ...dataToSave,
                  status: 'draft',
                  amount: 0,
                  lastUpdatedAt: new Date().toISOString(),
                  lastUpdatedBy: dataToSave.createdBy
              }, { merge: true });
              
              router.push(`/dashboard/invoices/add?invoiceNumberId=${safeId}`);
          } else {
              toast({ 
                  title: editingInvoice ? "Identitas Diperbarui" : "Identitas Terdaftar",
                  description: `Nomor ${invoice.id} berhasil dikunci secara global.`
              });
              setIsDialogOpen(false);
              setEditingInvoice(undefined);
          }
      } catch (err) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: docRef.path,
              operation: editingInvoice ? 'update' : 'create',
              requestResourceData: dataToSave
          }));
      }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-background">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-slate-50">Invoice Identities</h1>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-tight mt-1">
                    Tahap 1: Registrasi identitas penagihan tunggal (SAR Manual atau ERP Pusat).
                </p>
            </div>
            <div className="flex bg-indigo-600/5 p-3 rounded-xl border border-indigo-600/10 gap-3">
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 max-w-xs leading-tight font-bold uppercase tracking-tighter">
                    Sinkronisasi Multi-User Aktif. Nomor urut akan otomatis mengikuti input terakhir dari admin manapun untuk mencegah duplikasi.
                </p>
            </div>
        </div>
        
        <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                            type="search" 
                            placeholder="Cari No. Invoice, PO, atau Customer..." 
                            className="pl-8 h-10 bg-slate-50 dark:bg-slate-800/50 border-none font-medium placeholder:text-slate-500" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" onClick={() => invoices && exportToExcel(invoices, 'invoice-identities')} className="font-black uppercase text-[10px] tracking-widest border-slate-200"><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddInvoiceNumberDialog
                        isOpen={isDialogOpen}
                        onOpenChange={(o) => { setIsDialogOpen(o); if(!o) setEditingInvoice(undefined); }}
                        onSave={handleSave}
                        invoiceData={editingInvoice}
                        onAddClick={handleAddClick}
                        allInvoiceNumbers={invoices}
                        initialPoNumber={poNumberParam || undefined}
                       />
                    </div>
                </div>

                <div className="w-full overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="border-b-slate-200 dark:border-b-slate-800">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Invoice Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Customer</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">PO / SO Reference</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center text-slate-400">Status Identitas</TableHead>
                                <TableHead className="text-right py-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredInvoices.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic font-black uppercase tracking-widest opacity-30">Belum ada identitas terdaftar.</TableCell></TableRow>
                            ) : (
                                filteredInvoices?.map((invoice) => {
                                    const linkedInv = linkedInvoices?.find(inv => inv.id === invoice.id);
                                    // Visual lock only if it has content or is not a draft
                                    const isLocked = linkedInv && (linkedInv.status !== 'draft' || (linkedInv.amount > 0 && linkedInv.items && linkedInv.items.length > 0));
                                    const isERP = !(invoice.id.startsWith('SAR') || invoice.id.startsWith('KW'));
                                    return (
                                        <TableRow key={invoice.id} className={cn("hover:bg-indigo-50/10 border-b last:border-0", isLocked ? "bg-slate-50/50 dark:bg-slate-800/20" : "")}>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-indigo-600 tracking-tight">{invoice.id}</span>
                                                        <span className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1">
                                                            {isERP ? <Database className="h-2 w-2" /> : <Hash className="h-2 w-2" />}
                                                            {isERP ? 'ERP Pusat' : 'Manual SAR'}
                                                        </span>
                                                    </div>
                                                    {isLocked && <Lock className="h-3 w-3 text-slate-300" />}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{invoice.customer}</TableCell>
                                            <TableCell className="text-[10px] font-mono font-bold text-slate-500">
                                                <div className="flex flex-col">
                                                    <span>PO: {invoice.poNumber || '-'}</span>
                                                    <span className="text-[8px] opacity-60">SO: {invoice.salesOrder || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={isLocked ? "default" : "secondary"} className={cn("text-[8px] uppercase font-black tracking-widest h-4", isLocked ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                                                    {isLocked ? 'FINALIZED / ACTIVE' : 'DRAFT / REGISTERED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <div className="flex justify-end gap-2">
                                                    {!isLocked && (
                                                        <Button 
                                                            size="sm" 
                                                            className="h-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest shadow-md"
                                                            onClick={() => handleSave(invoice, 'create')}
                                                        >
                                                            <FilePlus className="mr-1.5 h-3.5 w-3.5" /> Constructor
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-indigo-50">
                                                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleEdit(invoice)} className="text-[10px] font-black uppercase tracking-widest" disabled={isLocked}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Identitas
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className={cn(
                                                                    "text-rose-600 font-black uppercase text-[10px] tracking-widest focus:text-rose-600 focus:bg-rose-50",
                                                                    isLocked && "opacity-50 cursor-not-allowed"
                                                                )}
                                                                onSelect={(e) => {
                                                                    e.preventDefault();
                                                                    if (isLocked) {
                                                                        toast({ variant: "destructive", title: "Data Terkunci", description: "Nomor ini sudah memiliki item barang yang valid. Batalkan invoice di repository jika ingin menghapus." });
                                                                        return;
                                                                    }
                                                                    openDeleteDialog(invoice.id);
                                                                }}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                {isLocked ? 'Hapus (Terkunci)' : 'Hapus Identitas'}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen}
            onOpenChange={(open) => setDeleteDialogState({isOpen: open, invoiceId: open ? deleteDialogState.invoiceId : undefined})}
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
