
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
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

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

    const handleDeleteConfirm = async () => {
      if (!firestore || !isSuperAdmin) return;

      if (deleteDialogState.isBulk) {
          const batch = writeBatch(firestore);
          selectedInvoices.forEach(id => {
              const safeId = id.replace(/\//g, '_');
              batch.delete(doc(firestore, 'invoices', safeId));
          });
          try {
              await batch.commit();
              toast({ title: 'Hapus Berhasil', description: `${selectedInvoices.size} invoice telah dihapus oleh Leader.` });
              setSelectedInvoices(new Set());
          } catch (e) {
              toast({ variant: 'destructive', title: 'Gagal Hapus', description: 'Terjadi kesalahan sistem.' });
          }
      } else if (deleteDialogState.invoiceId) {
          const safeId = deleteDialogState.invoiceId.replace(/\//g, '_');
          const docRef = doc(firestore, 'invoices', safeId);
          try {
              await deleteDoc(docRef);
              toast({ title: 'Invoice Dihapus', description: `Invoice ${deleteDialogState.invoiceId} telah dihapus permanen.` });
          } catch (e) {
              errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
          }
      }
      setDeleteDialogState({ isOpen: false, invoiceId: undefined, isBulk: false });
    };

    const openDeleteDialog = (invoiceId: string) => {
      if (!isSuperAdmin) {
        toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Leader yang diizinkan menghapus data secara permanen." });
        return;
      }
      setDeleteDialogState({ isOpen: true, invoiceId: invoiceId, isBulk: false });
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight">Invoice List</h1>
            <div className="flex items-center gap-2">
                {isSuperAdmin && selectedInvoices.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                        <Trash2 className="mr-2 h-4 w-4" /> Leader Delete ({selectedInvoices.size})
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredInvoices, 'invoices')}><Download className="mr-2 h-4 w-4" /> Export</Button>
                <Link href="/dashboard/invoices/add" passHref><Button size="sm"><Plus className="mr-2 h-4 w-4"/> New Invoice</Button></Link>
            </div>
        </div>

        <Card>
            <CardContent className="pt-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex justify-between items-center mb-6">
                        <TabsList>
                            <TabsTrigger value="all">Semua ({invoices?.length || 0})</TabsTrigger>
                            <TabsTrigger value="paid">Lunas</TabsTrigger>
                            <TabsTrigger value="unpaid">Belum Bayar</TabsTrigger>
                        </TabsList>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari invoice..." className="pl-8 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={(c) => c ? setSelectedInvoices(new Set(filteredInvoices.map(i => i.id))) : setSelectedInvoices(new Set())} /></TableHead>
                                    <TableHead>INVOICE</TableHead>
                                    <TableHead>CUSTOMER</TableHead>
                                    <TableHead>DATE</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>STATUS</TableHead>
                                    <TableHead className="text-right">AKSI</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-20"><Skeleton className="h-8 w-full" /></TableCell></TableRow> : 
                                    filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell><Checkbox checked={selectedInvoices.has(invoice.id)} onCheckedChange={() => setSelectedInvoices(prev => { const n = new Set(prev); n.has(invoice.id) ? n.delete(invoice.id) : n.add(invoice.id); return n; })} /></TableCell>
                                        <TableCell className="font-bold text-xs">{invoice.id}</TableCell>
                                        <TableCell className="text-xs">{invoice.customer}</TableCell>
                                        <TableCell className="text-xs">{invoice.date}</TableCell>
                                        <TableCell className="text-xs font-bold">Rp {invoice.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell><Badge variant={invoice.status === 'paid' ? 'outline' : 'destructive'} className="text-[9px] uppercase">{invoice.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoice.id)}`)}><Eye className="mr-2 h-4 w-4" /> Pratinjau</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/add?editInvoiceId=${invoice.id.replace(/\//g, '_')}`)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                    {isSuperAdmin && (
                                                      <DropdownMenuItem className="text-destructive font-bold" onClick={() => openDeleteDialog(invoice.id)}><Trash2 className="mr-2 h-4 w-4" /> Hapus (Leader)</DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
