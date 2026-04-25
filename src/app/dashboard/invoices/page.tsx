
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
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Eye, Pencil, Trash2, CreditCard, Download, Truck, CheckCircle2 } from 'lucide-react';
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
  import { exportToExcel, cn } from '@/lib/utils';


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
    
    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        let filtered = invoices;
        if (activeTab !== 'all') {
            filtered = invoices.filter(i => {
                if (activeTab === 'paid') return i.status === 'paid';
                if (activeTab === 'received') return i.status === 'received';
                if (activeTab === 'unpaid') return i.status !== 'paid' && i.status !== 'received';
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

    const handleCreateSpdFromSelected = () => {
        if (selectedInvoices.size === 0) return;
        
        // Simpan invoice yang dipilih ke session storage untuk diambil di menu SPD
        const selectedList = filteredInvoices.filter(inv => selectedInvoices.has(inv.id));
        sessionStorage.setItem('preselectedSpdInvoices', JSON.stringify(selectedList));
        
        toast({
            title: "Siap Melakukan Pengiriman",
            description: `${selectedInvoices.size} Invoice telah disiapkan. Mengalihkan ke menu SPD...`
        });
        
        router.push('/dashboard/invoices/spd');
    };

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
            <div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">Invoice List</h1>
                <p className="text-muted-foreground font-medium">Kelola penagihan dan pantau jadwal pengiriman dokumen fisik.</p>
            </div>
            <div className="flex items-center gap-2">
                {selectedInvoices.size > 0 && (
                    <Button variant="secondary" size="sm" onClick={handleCreateSpdFromSelected} className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold">
                        <Truck className="mr-2 h-4 w-4" /> Create SPD ({selectedInvoices.size})
                    </Button>
                )}
                {isSuperAdmin && selectedInvoices.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })} className="font-bold">
                        <Trash2 className="mr-2 h-4 w-4" /> Leader Delete
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredInvoices, 'invoices')} className="font-bold"><Download className="mr-2 h-4 w-4" /> Export</Button>
                <Link href="/dashboard/invoices/add" passHref><Button size="sm" className="font-bold"><Plus className="mr-2 h-4 w-4"/> New Invoice</Button></Link>
            </div>
        </div>

        <Card className="shadow-md border-none ring-1 ring-border">
            <CardContent className="pt-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <TabsList className="bg-muted/50 p-1">
                            <TabsTrigger value="all" className="text-xs font-bold uppercase">Semua ({invoices?.length || 0})</TabsTrigger>
                            <TabsTrigger value="paid" className="text-xs font-bold uppercase px-4">Lunas</TabsTrigger>
                            <TabsTrigger value="received" className="text-xs font-bold uppercase px-4">Diterima PT</TabsTrigger>
                            <TabsTrigger value="unpaid" className="text-xs font-bold uppercase px-4">Draft/Sent</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari invoice, customer, PO..." className="pl-8 h-9 bg-muted/20 border-none font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={(c) => c ? setSelectedInvoices(new Set(filteredInvoices.map(i => i.id))) : setSelectedInvoices(new Set())} /></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Invoice & SPD Info</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Customer</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Amount</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-20"><Skeleton className="h-8 w-full" /></TableCell></TableRow> : 
                                    filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id} className="hover:bg-muted/5 transition-colors">
                                        <TableCell><Checkbox checked={selectedInvoices.has(invoice.id)} onCheckedChange={() => setSelectedInvoices(prev => { const n = new Set(prev); n.has(invoice.id) ? n.delete(invoice.id) : n.add(invoice.id); return n; })} /></TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-xs text-indigo-700">{invoice.id}</span>
                                                {invoice.spdNumber ? (
                                                    <div className="flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit border border-indigo-100">
                                                        <Truck className="h-2.5 w-2.5" /> {invoice.spdNumber}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-50 tracking-tighter">Not Picked (Gudang)</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="font-black uppercase text-slate-800">{invoice.customer}</div>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px] italic">{invoice.billingAddress}</div>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">{invoice.date}</TableCell>
                                        <TableCell className="text-xs font-black">Rp {invoice.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant={invoice.status === 'paid' ? 'outline' : invoice.status === 'received' ? 'secondary' : 'destructive'} 
                                                className={cn(
                                                    "text-[9px] uppercase font-black px-2 py-0",
                                                    invoice.status === 'received' ? "bg-blue-50 text-blue-700 border-blue-100" : 
                                                    invoice.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : ""
                                                )}
                                            >
                                                {invoice.status === 'received' ? (
                                                    <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> RECEIVED</span>
                                                ) : invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 transition-colors"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
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
