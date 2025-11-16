
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
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { type InvoiceNumber } from '@/app/lib/data';
  import { Search, Upload, Download, Filter } from 'lucide-react';
  import { AddInvoiceNumberDialog } from './_components/add-invoice-number-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { Skeleton } from '@/components/ui/skeleton';
  import { exportToExcel, importFromExcel } from '@/lib/utils';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

  export default function InvoiceNumberPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingInvoice, setEditingInvoice] = useState<InvoiceNumber | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const invoiceNumbersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'invoiceNumbers');
    }, [firestore]);
    const { data: invoices, isLoading } = useCollection<InvoiceNumber>(invoiceNumbersCollection);

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        if (!searchQuery) {
            return invoices;
        }
        return invoices.filter((invoice) => 
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

    const handleDelete = (invoiceId: string) => {
        if (!firestore || !invoiceId) return;
        const docRef = doc(firestore, 'invoiceNumbers', invoiceId);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: 'Invoice Number Deleted' });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleSave = (invoice: Omit<InvoiceNumber, 'id'> & {id: string}) => {
      if (!firestore) return;
      const { id, ...invoiceData } = invoice;
      
      const docRef = doc(firestore, 'invoiceNumbers', id);
      setDoc(docRef, invoiceData, { merge: true })
        .then(() => {
            if (!editingInvoice) { // Only redirect for new invoices
                const safeId = id.replace(/\//g, '_');
                router.push(`/dashboard/invoices/add?invoiceNumberId=${safeId}`);
            }
             toast({
                title: editingInvoice ? 'Invoice Number Updated' : 'Invoice Number Created',
             });
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: editingInvoice ? 'update' : 'create',
                requestResourceData: invoiceData,
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
        exportToExcel(invoices, 'invoice-numbers');
      }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && firestore) {
        try {
          const data = await importFromExcel(file) as InvoiceNumber[];
          const batch = writeBatch(firestore);
          const importedDataForError: any[] = [];
          
          data.forEach(item => {
              if (item.id) {
                const docRef = doc(firestore, 'invoiceNumbers', item.id);
                batch.set(docRef, item);
                importedDataForError.push(item);
              }
          });

          await batch.commit();

          toast({
            title: "Success",
            description: `${data.length} records imported successfully.`,
          });
        } catch (error: any) {
          console.error("Error importing file:", error);
           const permissionError = new FirestorePermissionError({
              path: 'invoiceNumbers',
              operation: 'create', // Batch write is treated as multiple creates
              requestResourceData: 'Batch import data',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to import the Excel file.",
          });
        }
      }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Nomor Faktur</h1>
          <p className="text-muted-foreground">
            Kelola semua nomor faktur Anda.
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
                       <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Ekspor</Button>
                       <Button variant="outline"><Filter className="mr-2 h-4 w-4"/> Filter Duplikat</Button>
                       <AddInvoiceNumberDialog
                        isOpen={isDialogOpen}
                        onOpenChange={handleDialogStateChange}
                        onSave={handleSave}
                        invoiceData={editingInvoice}
                        onAddClick={handleAddClick}
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
                                <TableHead>TINDAKAN</TableHead>
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
                                filteredInvoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.id.replace(/_/g, '/')}</TableCell>
                                        <TableCell>{invoice.customer}</TableCell>
                                        <TableCell>{invoice.salesOrder}</TableCell>
                                        <TableCell>{invoice.date}</TableCell>
                                        <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(invoice)}>Edit</Button>
                                                <DeleteConfirmationDialog onConfirm={() => handleDelete(invoice.id!)} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
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
