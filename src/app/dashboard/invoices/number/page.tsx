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
  import { Search, Upload, Download, Filter, MoreHorizontal, Edit, Trash2, Lock } from 'lucide-react';
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

    // Fetch Invoice List untuk pengecekan relasi/status (Sequential Guard)
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

    /**
     * Proteksi Penghapusan:
     * Menjamin nomor faktur yang sudah dikirim (Sent) tidak bisa dihapus permanen.
     */
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
                title: editingInvoice ? 'Invoice Number Updated' : 'Invoice Number Created',
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
        generateExcelTemplate(headers, 'invoice_number_template');
        toast({ title: "Template Downloaded", description: "Invoice number template has been downloaded." });
    };
    
    const handleExport = () => {
      if (invoices) {
        exportToExcel(invoices, 'invoice-numbers');
      }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && firestore && user) {
        try {
          const data = await importFromExcel(file) as Omit<InvoiceNumber, 'ownerId'>[];
          const batch = writeBatch(firestore);
          
          data.forEach(item => {
              if (item.id) {
                const safeId = item.id.replace(/\//g, '_');
                const docRef = doc(firestore, 'invoiceNumbers', safeId);
                const dataToSave = { ...item, id: item.id, ownerId: user.uid };
                batch.set(docRef, dataToSave);
              }
          });

          await batch.commit();

          toast({
            title: "Success",
            description: `${data.length} records imported successfully.`,
          });
        } catch (error: any) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'invoiceNumbers',
              operation: 'create',
              requestResourceData: 'Batch import data',
          }));
        }
      }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Nomor Faktur</h1>
          <p className="text-muted-foreground">
            Kelola dan proteksi urutan nomor faktur Anda.
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Cari Faktur" 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                       <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Impor</Button>
                       <Button variant="outline" onClick={handleDownloadTemplate}><Download className="mr-2 h-4 w-4"/> Template</Button>
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
                                <TableHead>NOMOR FAKTUR</TableHead>
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
                                    return (
                                        <TableRow key={invoice.id} className={isLinked ? "bg-muted/30" : ""}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {invoice.id}
                                                    {isLinked && <Lock className="h-3 w-3 text-muted-foreground" title="Locked by Audit" />}
                                                </div>
                                            </TableCell>
                                            <TableCell>{invoice.customer}</TableCell>
                                            <TableCell>{invoice.salesOrder}</TableCell>
                                            <TableCell>{invoice.date}</TableCell>
                                            <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
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
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredInvoices?.length || 0} of {invoices?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
