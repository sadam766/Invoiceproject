
'use client';
import { useState } from 'react';
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
  import { invoiceNumberData, type InvoiceNumber } from '@/app/lib/data';
  import { Search, Upload, Download, Filter, Plus } from 'lucide-react';
  import { AddInvoiceNumberDialog } from './_components/add-invoice-number-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  
  export default function InvoiceNumberPage() {
    const [invoices, setInvoices] = useState(invoiceNumberData);
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
        setInvoices(invoices.filter((i) => i.id !== invoiceId));
    };

    const handleSave = (invoice: InvoiceNumber) => {
      if (editingInvoice && editingInvoice.id === invoice.id) {
        // Editing existing invoice
        setInvoices(invoices.map((i) => i.id === invoice.id ? invoice : i));
      } else if(editingInvoice) {
        const filteredInvoices = invoices.filter(i => i.id !== editingInvoice.id);
        setInvoices([...filteredInvoices, invoice]);
      }
      else {
        // Adding new invoice
        setInvoices([...invoices, invoice]);
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
                            {invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">{invoice.id}</TableCell>
                                    <TableCell>{invoice.customer}</TableCell>
                                    <TableCell>{invoice.salesOrder}</TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(invoice)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(invoice.id)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {invoices.length} of {invoices.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  
