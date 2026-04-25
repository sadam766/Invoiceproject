
'use client';
import { useState, useRef, useMemo } from 'react';
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
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { type InvoiceNumber, type Invoice } from '@/app/lib/data';
  import { Search, Upload, Download, MoreHorizontal, Edit, Trash2, Lock, Database, Hash } from 'lucide-react';
  import { AddInvoiceNumberDialog } from './_components/add-invoice-number-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { Skeleton } from '@/components/ui/skeleton';
  import { cn, exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';

  export default function InvoiceNumberPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingInvoice, setEditingInvoice] = useState<InvoiceNumber | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; invoiceId?: string }>({ isOpen: false });

    
    const invoiceNumbersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoiceNumbers'));
    }, [firestore]);
    const { data: invoices, isLoading } = useCollection<InvoiceNumber>(invoiceNumbersCollection);

    // Fetch Invoice List untuk pengecekan relasi/status
    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: linkedInvoices } = useCollection<Invoice>(invoicesCollection);

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        
        const sortedInvoices = [...invoices].sort((a, b) => {
            const getNum = (id: string) => {
                const matchSAR = id.match(/SAR_\d{2}01(\d+)A/);
                const matchKW = id.match(/KW[\/_](\d+)[\/_]KEU[\/_]\d{4}/);
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
            invoice.salesOrder.toLowerCase().includes(searchQuery.toLowerCase())
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

        // Cek apakah nomor sudah ada di Invoice List (Sent/Draft)
        const isLinked = linkedInvoices?.some(inv => inv.id === deleteDialogState.invoiceId);
        
        if (isLinked) {
            toast({
                variant: "destructive",
                title: "Aksi Ditolak",
                description: "Nomor ini sudah digunakan dalam Invoice List dan tidak dapat dihapus untuk menjaga urutan audit.",
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

    const handleDownloadTemplate = () => {
        const headers = ['id', 'customer', 'salesOrder', 'date', 'amount'];
        generateExcelTemplate(headers, 'invoice_identity_template');
    };
    
    const handleExport = () => {
      if (invoices) {
        exportToExcel(invoices, 'invoice-identities');
      }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice Identity Switching</h1>
          <p className="text-muted-foreground">
            Kelola identitas penagihan tunggal (SAR Manual atau ERP Pusat).
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Cari Identitas Faktur" 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Ekspor</Button>
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

                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>INVOICE NUMBER</TableHead>
                                <TableHead>PELANGGAN</TableHead>
                                <TableHead>SALES ORDER/SO</TableHead>
                                <TableHead>TANGGAL</TableHead>
                                <TableHead>JUMLAH</TableHead>
                                <TableHead className="text-right">TINDAKAN</TableHead>
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
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                filteredInvoices?.map((invoice) => {
                                    const isLinked = linkedInvoices?.some(inv => inv.id === invoice.id);
                                    const isERP = !(invoice.id.startsWith('SAR') || invoice.id.startsWith('KW'));
                                    return (
                                        <TableRow key={invoice.id} className={isLinked ? "bg-muted/30" : ""}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {invoice.id}
                                                    {isLinked ? <Lock className="h-3 w-3 text-muted-foreground" /> : (
                                                        isERP ? <Database className="h-3 w-3 text-emerald-600" /> : <Hash className="h-3 w-3 text-indigo-400" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{invoice.customer}</TableCell>
                                            <TableCell>{invoice.salesOrder}</TableCell>
                                            <TableCell>{invoice.date}</TableCell>
                                            <TableCell>Rp {invoice.amount.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DeleteConfirmationDialog 
                                                            open={deleteDialogState.isOpen && deleteDialogState.invoiceId === invoice.id}
                                                            onOpenChange={(open) => setDeleteDialogState({isOpen: open, invoiceId: open ? invoice.id : undefined})}
                                                            onConfirm={handleDeleteConfirm}
                                                        >
                                                            <DropdownMenuItem
                                                                className={cn(
                                                                    "text-destructive focus:text-destructive focus:bg-destructive/10",
                                                                    isLinked && "opacity-50 cursor-not-allowed"
                                                                )}
                                                                onSelect={(e) => {
                                                                    e.preventDefault();
                                                                    if (isLinked) {
                                                                        toast({ variant: "destructive", title: "Data Terkunci", description: "Nomor ini sudah digunakan dalam Invoice List." });
                                                                        return;
                                                                    }
                                                                    openDeleteDialog(invoice.id);
                                                                }}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                {isLinked ? 'Hapus (Terkunci)' : 'Hapus'}
                                                            </DropdownMenuItem>
                                                        </DeleteConfirmationDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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
