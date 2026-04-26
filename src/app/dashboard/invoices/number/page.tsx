
'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
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
  import { type InvoiceNumber, type Invoice } from '@/app/lib/data';
  import { Search, Upload, Download, MoreHorizontal, Edit, Trash2, Lock, Database, Hash, Info } from 'lucide-react';
  import { AddInvoiceNumberDialog } from './_components/add-invoice-number-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { Skeleton } from '@/components/ui/skeleton';
  import { cn, exportToExcel, generateExcelTemplate } from '@/lib/utils';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, query } from 'firebase/firestore';

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

    // Auto-open dialog if coming from Sales List with PO
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

    // Fetch Invoice List for linking checks
    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: linkedInvoices } = useCollection<Invoice>(invoicesCollection);

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        
        const sortedInvoices = [...invoices].sort((a, b) => {
            const getNum = (id: string) => {
                const matchSAR = id.match(/SAR\/\d{2}(\d+)A/);
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

        const isLinked = linkedInvoices?.some(inv => inv.id === deleteDialogState.invoiceId);
        
        if (isLinked) {
            toast({
                variant: "destructive",
                title: "Aksi Ditolak",
                description: "Nomor ini sudah digunakan dalam Invoice List.",
            });
            setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            return;
        }

        const safeId = deleteDialogState.invoiceId.replace(/\//g, '_');
        const docRef = doc(firestore, 'invoiceNumbers', safeId);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: 'Nomor Faktur Berhasil Dihapus' });
                setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                setDeleteDialogState({ isOpen: false, invoiceId: undefined });
            });
    };
    
    const openDeleteDialog = (invoiceId: string) => {
        setDeleteDialogState({ isOpen: true, invoiceId: invoiceId });
    };

    const handleSave = (invoice: Omit<InvoiceNumber, 'id' | 'ownerId'> & {id: string}, action: 'save' | 'create') => {
      if (!firestore || !user) return;
      const { id, ...invoiceData } = invoice;
      const safePathId = id.replace(/\//g, '_');
      
      const docRef = doc(firestore, 'invoiceNumbers', safePathId);
      const dataToSave = { ...invoiceData, id: id, ownerId: user.uid };

      setDoc(docRef, dataToSave, { merge: true })
        .then(() => {
             toast({
                title: editingInvoice ? 'Identity Updated' : 'Identity Registered',
             });
             if (action === 'create') {
                router.push(`/dashboard/invoices/add?invoiceNumberId=${safePathId}`);
             }
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: editingInvoice ? 'update' : 'create',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
      
      setIsDialogOpen(false);
      setEditingInvoice(undefined);
    };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingInvoice(undefined);
      }
    }

    const handleExport = () => {
      if (invoices) {
        exportToExcel(invoices, 'invoice-identities');
      }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Invoice Identities</h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Tahap 1: Registrasi identitas penagihan tunggal (SAR Manual atau ERP Pusat).
                </p>
            </div>
            <div className="flex bg-blue-50 p-3 rounded-xl border border-blue-100 gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-900/70 max-w-xs leading-tight font-bold">
                    Pastikan identitas nomor sudah sah sebelum membuka Constructor untuk menyusun item barang.
                </p>
            </div>
        </div>
        
        <Card className="shadow-md border-none ring-1 ring-border">
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Cari No. Invoice, PO, atau Customer..." 
                            className="pl-8 h-10 bg-muted/20 border-none font-medium" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" onClick={handleExport} className="font-bold"><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddInvoiceNumberDialog
                        isOpen={isDialogOpen}
                        onOpenChange={handleDialogStateChange}
                        onSave={handleSave}
                        invoiceData={editingInvoice}
                        onAddClick={handleAddClick}
                        allInvoiceNumbers={invoices}
                       />
                    </div>
                </div>

                <div className="w-full overflow-auto rounded-xl border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Invoice Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Customer</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">PO / SO Reference</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center">Tgl Registrasi</TableHead>
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
                                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic font-bold">Belum ada identitas terdaftar.</TableCell></TableRow>
                            ) : (
                                filteredInvoices?.map((invoice) => {
                                    const isLinked = linkedInvoices?.some(inv => inv.id === invoice.id);
                                    const isERP = !(invoice.id.startsWith('SAR') || invoice.id.startsWith('KW'));
                                    return (
                                        <TableRow key={invoice.id} className={cn("hover:bg-muted/5 border-b last:border-0", isLinked ? "bg-muted/30" : "")}>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-indigo-700">{invoice.id}</span>
                                                        <span className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                                            {isERP ? <Database className="h-2 w-2" /> : <Hash className="h-2 w-2" />}
                                                            {isERP ? 'ERP Pusat' : 'Manual SAR'}
                                                        </span>
                                                    </div>
                                                    {isLinked && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-bold uppercase text-slate-600">{invoice.customer}</TableCell>
                                            <TableCell className="text-xs font-mono font-medium">
                                                <div className="flex flex-col">
                                                    <span>PO: {invoice.poNumber || '-'}</span>
                                                    <span className="text-[10px] text-muted-foreground">SO: {invoice.salesOrder || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-bold text-slate-500">{invoice.date}</TableCell>
                                            <TableCell className="text-right py-4">
                                                <div className="flex justify-end gap-2">
                                                    {!isLinked && (
                                                        <Button 
                                                            size="sm" 
                                                            className="h-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest shadow-md"
                                                            onClick={() => router.push(`/dashboard/invoices/add?invoiceNumberId=${invoice.id.replace(/\//g, '_')}`)}
                                                        >
                                                            Open Constructor
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Identitas
                                                            </DropdownMenuItem>
                                                            <DeleteConfirmationDialog 
                                                                open={deleteDialogState.isOpen && deleteDialogState.invoiceId === invoice.id}
                                                                onOpenChange={(open) => setDeleteDialogState({isOpen: open, invoiceId: open ? invoice.id : undefined})}
                                                                onConfirm={handleDeleteConfirm}
                                                            >
                                                                <DropdownMenuItem
                                                                    className={cn(
                                                                        "text-destructive font-bold focus:text-destructive focus:bg-destructive/10",
                                                                        isLinked && "opacity-50 cursor-not-allowed"
                                                                    )}
                                                                    onSelect={(e) => {
                                                                        e.preventDefault();
                                                                        if (isLinked) {
                                                                            toast({ variant: "destructive", title: "Data Terkunci", description: "Nomor ini sudah memiliki item barang di Invoice List." });
                                                                            return;
                                                                        }
                                                                        openDeleteDialog(invoice.id);
                                                                    }}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    {isLinked ? 'Hapus (Terkunci)' : 'Hapus Identitas'}
                                                                </DropdownMenuItem>
                                                            </DeleteConfirmationDialog>
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
      </main>
    );
  }
