
'use client';
import { useState } from 'react';
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
  import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
  import { collection, doc, addDoc, setDoc } from 'firebase/firestore';
  import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
  import { Skeleton } from '@/components/ui/skeleton';

  export default function InvoiceNumberPage() {
    const router = useRouter();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const invoiceNumbersCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'invoiceNumbers');
    }, [firestore, user]);

    const { data: invoices, isLoading: isInvoicesLoading } = useCollection<InvoiceNumber>(invoiceNumbersCollection);
    const isLoading = isUserLoading || isInvoicesLoading;

    const [editingInvoice, setEditingInvoice] = useState<InvoiceNumber | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleAdd = () => {
      setEditingInvoice(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (invoice: InvoiceNumber) => {
        setEditingInvoice(invoice);
        setIsDialogOpen(true);
    };

    const handleDelete = (invoiceId: string) => {
        if (!firestore) return;
        const invoiceDocRef = doc(firestore, 'invoiceNumbers', invoiceId);
        deleteDocumentNonBlocking(invoiceDocRef);
    };

    const handleSave = async (invoice: Omit<InvoiceNumber, 'id'> & {id: string}) => {
      if (!firestore) return;

      if (editingInvoice) {
        const invoiceDocRef = doc(firestore, 'invoiceNumbers', editingInvoice.id!);
        updateDocumentNonBlocking(invoiceDocRef, invoice);
      } else {
        const newDocRef = doc(firestore, 'invoiceNumbers', invoice.id);
        await setDoc(newDocRef, invoice);
        router.push(`/dashboard/invoices/add?invoiceNumberId=${newDocRef.id}`);
      }
      
      setIsDialogOpen(false);
      setEditingInvoice(undefined);
    };

    const handleDialogClose = () => {
      setIsDialogOpen(false);
      setEditingInvoice(undefined);
    }

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
                        <Input type="search" placeholder="Cari Faktur" className="pl-8" />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline"><Upload className="mr-2 h-4 w-4"/> Impor</Button>
                       <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Ekspor</Button>
                       <Button variant="outline"><Filter className="mr-2 h-4 w-4"/> Filter Duplikat</Button>
                       <AddInvoiceNumberDialog
                        isOpen={isDialogOpen}
                        onOpenChange={handleDialogClose}
                        onSave={handleSave}
                        invoiceData={editingInvoice}
                        onAddClick={handleAdd}
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
                                invoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.id}</TableCell>
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
                    Showing 1 to {invoices?.length || 0} of {invoices?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }

    