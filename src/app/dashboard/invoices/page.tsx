'use client';
import Link from 'next/link';
import { useState, useMemo } from 'react';
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
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { type Invoice, type SpdData, type SalesOrder, type Customer, type UserProfile } from '@/app/lib/data';
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Eye, Pencil, Trash2, CreditCard, Download } from 'lucide-react';
  import { Skeleton } from '@/components/ui/skeleton';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useCollection, useMemoFirebase, useUser, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, query, doc, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
  import { exportToExcel } from '@/lib/utils';


  export default function InvoiceListPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; invoiceId?: string; isBulk?: boolean }>({ isOpen: false });
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const userRole = isSuperAdmin ? 'admin' : (userProfile?.role || 'staff');
    const isAdmin = userRole === 'admin';

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoices, isLoading } = useCollection<Invoice>(invoicesCollection);
    
    const customersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'customers'));
    }, [firestore]);
    const { data: customerListData } = useCollection<Customer>(customersCollection);

    const salesOrdersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'salesOrders'));
    }, [firestore]);
    const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);


    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        let filtered = invoices;
        if (activeTab !== 'all') {
            filtered = invoices.filter(i => {
                if (activeTab === 'paid') return i.status === 'paid';
                if (activeTab === 'unpaid') return i.status !== 'paid';
                return true;
            });
        }

        if (searchQuery) {
            filtered = filtered.filter(invoice => 
                Object.values(invoice).some(value => 
                    String(value).toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }

        return filtered;
    }, [invoices, activeTab, searchQuery]);

    const totalFiltered = filteredInvoices?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalPaid = invoices?.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalUnpaid = invoices?.filter(item => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0) || 0;

    const handleDeleteConfirm = async () => {
      if (!firestore || !isAdmin) return;

      if (deleteDialogState.isBulk) {
          const batch = writeBatch(firestore);
          selectedInvoices.forEach(id => {
              const safeId = id.replace(/\//g, '_');
              batch.delete(doc(firestore, 'invoices', safeId));
          });
          try {
              await batch.commit();
              toast({ title: 'Hapus Berhasil', description: `${selectedInvoices.size} invoice telah dihapus dari sistem.` });
              setSelectedInvoices(new Set());
          } catch (e) {
              toast({ variant: 'destructive', title: 'Gagal Hapus', description: 'Terjadi kesalahan saat menghapus data massal.' });
          }
      } else if (deleteDialogState.invoiceId) {
          const safeId = deleteDialogState.invoiceId.replace(/\//g, '_');
          const docRef = doc(firestore, 'invoices', safeId);
          try {
              await deleteDoc(docRef);
              toast({ title: 'Invoice Dihapus', description: `Invoice ${deleteDialogState.invoiceId} berhasil dihapus.` });
          } catch (e) {
              const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: 'delete',
              });
              errorEmitter.emit('permission-error', permissionError);
          }
      }
      setDeleteDialogState({ isOpen: false, invoiceId: undefined, isBulk: false });
    };

    const openDeleteDialog = (invoiceId: string) => {
      if (!isAdmin) {
        toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Admin yang diizinkan untuk menghapus invoice." });
        return;
      }
      setDeleteDialogState({ isOpen: true, invoiceId: invoiceId, isBulk: false });
    };

    const handleEdit = (invoice: Invoice) => {
      const safeId = invoice.id.replace(/\//g, '_');
      router.push(`/dashboard/invoices/add?editInvoiceId=${safeId}`);
    }

    const handlePreview = (invoice: Invoice) => {
        if (!salesOrderListData) return;
        const relatedSalesOrders = salesOrderListData.filter(so => so.soNumber === invoice.soNumber);
        const invoiceItems = relatedSalesOrders.map((so, index) => ({
            id: index, no: index + 1, item: so.productName, name: so.productName,
            quantity: so.quantity, unit: so.unit, price: so.price,
            total: so.quantity * so.price, amount: so.quantity * so.price
        }));
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        const grandTotal = subtotal; 
        const dppVat = grandTotal / 1.12;
        const vat12 = dppVat * 0.12;

        const foundCustomer = customerListData?.find(c => c.name === invoice.customer);

        const previewData = {
            id: invoice.id, soNumber: invoice.soNumber, poNumber: invoice.poNumber, customer: foundCustomer,
            date: invoice.date, amount: invoice.amount, status: invoice.status,
            items: invoiceItems, subtotal, dppVat, vat12, negotiation: 0, dpValue: 0, pelunasan: 0, grandTotal,
            paymentMethod: invoice.paymentMethod,
        };
        sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
        router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoice.id)}`);
    };

    const handleSelectionChange = (invoiceId: string) => {
        setSelectedInvoices(prev => {
            const newSelection = new Set(prev);
            newSelection.has(invoiceId) ? newSelection.delete(invoiceId) : newSelection.add(invoiceId);
            return newSelection;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        checked ? setSelectedInvoices(new Set(filteredInvoices.map(i => i.id))) : setSelectedInvoices(new Set());
    };
    
    const handleCreateSpd = async () => {
        if (!firestore || !user || selectedInvoices.size === 0 || !invoices) return;
        const selected = invoices.filter(inv => selectedInvoices.has(inv.id));
        const newSpdNumber = `SPD-${Date.now().toString().slice(-6)}`;
        const spdDocRef = doc(firestore, 'spds', newSpdNumber);
        const batch = writeBatch(firestore);
        batch.set(spdDocRef, {
            spd: newSpdNumber, tanggal: new Date().toISOString().split('T')[0], sales: user.displayName || 'System',
            customer: Array.from(new Set(selected.map(inv => inv.customer))).join(', '),
            noInvoice: selected.map(inv => inv.id).join(', '),
            tanggalInvoice: selected[0]?.date || '', tglTerimaCustomer: '-', tglJatuhTempo: '-',
            totalPiutang: selected.reduce((sum, inv) => sum + inv.amount, 0), keterangan: 'Auto-generated',
            noKuitansi: '-', noFakturPajak: '-', suratJalan: '-', ownerId: user.uid
        });
        selected.forEach(inv => batch.update(doc(firestore, 'invoices', inv.id.replace(/\//g, '_')), { spdNumber: newSpdNumber }));
        await batch.commit();
        toast({ title: 'SPD Berhasil Dibuat', description: `Nomor: ${newSpdNumber}` });
        setSelectedInvoices(new Set());
    };

    const handleExport = () => {
        const dataToExport = selectedInvoices.size > 0 
            ? invoices?.filter(inv => selectedInvoices.has(inv.id)) 
            : filteredInvoices;
        
        if (dataToExport && dataToExport.length > 0) {
            exportToExcel(dataToExport, 'daftar_invoice');
            toast({ title: "Export Berhasil", description: `${dataToExport.length} data invoice telah diunduh.` });
        } else {
            toast({ variant: 'destructive', title: "Export Gagal", description: "Tidak ada data untuk diekspor." });
        }
    };
  
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div><h1 className="text-2xl font-bold tracking-tight">Invoice List</h1></div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="lg:col-span-2 bg-blue-50/50 border-blue-200 shadow-sm relative overflow-hidden dark:bg-blue-950/20">
                <CardHeader><CardTitle className="text-sm font-medium">Total (Filtered)</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">Rp {totalFiltered.toLocaleString('id-ID')},00</div></CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-4">
                <Card><CardHeader><CardTitle className="text-sm font-medium">Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Rp {totalPaid.toLocaleString('id-ID')},00</div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium">Unpaid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Rp {totalUnpaid.toLocaleString('id-ID')},00</div></CardContent></Card>
            </div>
        </div>
  
        <Card>
            <CardContent className="pt-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Invoices</h2>
                        <div className="flex items-center gap-2">
                           {selectedInvoices.size > 0 && isAdmin && (
                               <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                                   <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedInvoices.size})
                               </Button>
                           )}
                           <Button variant="outline" size="sm" onClick={handleExport}>
                               <Download className="mr-2 h-4 w-4" /> Export Excel
                           </Button>
                           <Button variant="outline" size="sm" onClick={handleCreateSpd} disabled={selectedInvoices.size === 0}>Buat SPD</Button>
                           <Link href="/dashboard/invoices/add" passHref><Button size="sm"><Plus className="mr-2 h-4 w-4"/> New Invoice</Button></Link>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{invoices?.length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status === 'paid').length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status !== 'paid').length || 0}</Badge></TabsTrigger>
                    </TabsList>
                    <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search invoice, customer, or status..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                    </div>
                    <TabsContent value={activeTab}>
                        <div className="mt-4 w-full overflow-auto">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={handleSelectAll} checked={filteredInvoices.length > 0 && selectedInvoices.size === filteredInvoices.length} /></TableHead>
                                    <TableHead>INVOICE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>CUSTOMER</TableHead>
                                    <TableHead>PAYMENT METHOD</TableHead>
                                    <TableHead>DATE</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>STATUS</TableHead>
                                    <TableHead>PEMBUAT</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)) : 
                                    filteredInvoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell><Checkbox onCheckedChange={() => handleSelectionChange(invoice.id)} checked={selectedInvoices.has(invoice.id)} /></TableCell>
                                        <TableCell className="font-medium">{invoice.id}</TableCell>
                                        <TableCell>{invoice.customer}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs">{invoice.paymentMethod || 'Transfer Manual'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{invoice.date}</TableCell>
                                        <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
                                        <TableCell><Badge variant={invoice.status === 'paid' ? 'outline' : 'destructive'} className={invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{invoice.status}</Badge></TableCell>
                                        <TableCell><span className="text-xs text-muted-foreground font-bold">{invoice.createdBy || '-'}</span></TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handlePreview(invoice)}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleEdit(invoice)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                    {isAdmin && (
                                                      <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(invoice.id)}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!isLoading && filteredInvoices.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground font-medium">Data tidak ditemukan.</TableCell></TableRow>
                                )}
                            </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen} 
            onOpenChange={(o) => setDeleteDialogState(prev => ({...prev, isOpen: o}))} 
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
