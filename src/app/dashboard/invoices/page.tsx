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
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
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


  export default function InvoiceListPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; invoiceId?: string }>({ isOpen: false });
    
    // Get user profile for roles
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    // Leader / Super Admin Bypass
    const isSuperAdmin = userProfile?.email === 'fa@gmail.com';
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

    const handleDeleteConfirm = () => {
      if (!firestore || !deleteDialogState.invoiceId || !isAdmin) return;
      const safeId = deleteDialogState.invoiceId.replace(/\//g, '_');
      const docRef = doc(firestore, 'invoices', safeId);
      
      deleteDoc(docRef)
          .then(() => {
              toast({ title: 'Invoice Deleted', description: `Invoice ${deleteDialogState.invoiceId} has been removed.` });
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
      if (!isAdmin) {
        toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Admin yang diizinkan untuk menghapus invoice." });
        return;
      }
      setDeleteDialogState({ isOpen: true, invoiceId: invoiceId });
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
        const grandTotal = subtotal; // Simplified for basic lookup
        const dppVat = grandTotal / 1.12;
        const vat12 = dppVat * 0.12;

        const foundCustomer = customerListData?.find(c => c.name === invoice.customer);

        const previewData = {
            id: invoice.id, soNumber: invoice.soNumber, poNumber: invoice.poNumber, customer: foundCustomer,
            date: invoice.date, amount: invoice.amount, status: invoice.status,
            items: invoiceItems, subtotal, dppVat, vat12, negotiation: 0, dpValue: 0, pelunasan: 0, grandTotal,
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
                           <Button variant="outline" onClick={handleCreateSpd} disabled={selectedInvoices.size === 0}>Buat SPD</Button>
                           <Link href="/dashboard/invoices/add" passHref><Button><Plus className="mr-2 h-4 w-4"/> New Invoice</Button></Link>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{invoices?.length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status === 'paid').length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status !== 'paid').length || 0}</Badge></TabsTrigger>
                    </TabsList>
                    <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search" className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                    </div>
                    <TabsContent value={activeTab}>
                        <div className="mt-4 w-full overflow-auto">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={handleSelectAll} checked={filteredInvoices.length > 0 && selectedInvoices.size === filteredInvoices.length} /></TableHead>
                                    <TableHead>INVOICE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>CUSTOMER</TableHead>
                                    <TableHead>DATE</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>STATUS</TableHead>
                                    <TableHead>PEMBUAT</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)) : 
                                    filteredInvoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell><Checkbox onCheckedChange={() => handleSelectionChange(invoice.id)} checked={selectedInvoices.has(invoice.id)} /></TableCell>
                                        <TableCell className="font-medium">{invoice.id}</TableCell>
                                        <TableCell>{invoice.customer}</TableCell>
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
                                                      <DeleteConfirmationDialog open={deleteDialogState.isOpen && deleteDialogState.invoiceId === invoice.id} onOpenChange={(o) => setDeleteDialogState({isOpen: o, invoiceId: o ? invoice.id : undefined})} onConfirm={handleDeleteConfirm}>
                                                          <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); openDeleteDialog(invoice.id); }}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                      </DeleteConfirmationDialog>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </main>
    );
  }
