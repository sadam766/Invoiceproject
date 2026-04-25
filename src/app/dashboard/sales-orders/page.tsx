'use client';
import { useState, useMemo, useRef } from 'react';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { type SalesOrder, type Invoice, type UserProfile } from '@/app/lib/data';
  import { Search, Upload, Download, Trash2, Edit } from 'lucide-react';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { AddSalesOrderDialog } from './_components/add-sales-order-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
  
  export default function SalesOrderListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; orderId?: string; soNumber?: string }>({ isOpen: false });

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const salesOrdersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'salesOrders'));
    }, [firestore]);
    const { data: orders, isLoading } = useCollection<SalesOrder>(salesOrdersCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: linkedInvoices } = useCollection<Invoice>(invoicesCollection);


    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        let filtered = orders;
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(o => o.category === categoryFilter);
        }
        if (searchQuery) {
            filtered = filtered.filter(o => 
                o.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (o.poNumber && o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        return filtered;
    }, [orders, searchQuery, categoryFilter]);


    const handleAddClick = () => {
      setEditingOrder(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (order: SalesOrder) => {
        setEditingOrder(order);
        setIsDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !deleteDialogState.orderId || !deleteDialogState.soNumber) return;
    
        // SECURITY: LOCK & TRACE logic
        const isLinkedToSentInvoice = linkedInvoices?.some(inv => 
            inv.soNumber === deleteDialogState.soNumber && 
            (inv.status === 'sent' || inv.status === 'paid')
        );

        if (isLinkedToSentInvoice) {
            toast({
                variant: "destructive",
                title: "Aksi Ditolak",
                description: "Sales Order tidak dapat dihapus karena sudah memiliki Invoice terkait yang sudah dikirim ke customer."
            });
            setDeleteDialogState({ isOpen: false });
            return;
        }

        const docRef = doc(firestore, 'salesOrders', deleteDialogState.orderId);
        try {
            await deleteDoc(docRef);
            toast({ title: 'Sales Order item dihapus' });
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setDeleteDialogState({ isOpen: false });
        }
    };
    
    const openDeleteDialog = (orderId: string, soNumber: string) => {
        if (!isAdmin) {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Admin/Leader yang boleh menghapus Sales Order." });
            return;
        }
        setDeleteDialogState({ isOpen: true, orderId, soNumber });
    };

    const handleSave = (order: SalesOrder) => {
        if (!firestore || !user) return;
        let orderId = order.id || editingOrder?.id;
        const isNew = !orderId;
        if (!orderId) {
            orderId = doc(collection(firestore, 'salesOrders')).id;
        }

        const docRef = doc(firestore, 'salesOrders', orderId);
        const dataToSave = { ...order, id: orderId, ownerId: user.uid };

        setDoc(docRef, dataToSave, { merge: !isNew })
            .then(() => {
                 toast({
                    title: editingOrder ? 'Sales Order Updated' : 'Sales Order Added',
                });
                setIsDialogOpen(false);
                setEditingOrder(undefined);
            })
            .catch((error) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: isNew ? 'create' : 'update',
                    requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleDownloadTemplate = () => {
        const headers = ['soNumber', 'poNumber', 'customer', 'productName', 'category', 'quantity', 'unit', 'price'];
        generateExcelTemplate(headers, 'sales_order_template');
    };

    const handleExport = () => {
        if(orders) {
            exportToExcel(orders, 'sales-orders');
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as Omit<SalesOrder, 'id' | 'ownerId'>[];
                const batch = writeBatch(firestore);
                data.forEach(orderData => {
                    const newDocRef = doc(collection(firestore, 'salesOrders'));
                    batch.set(newDocRef, { ...orderData, id: newDocRef.id, ownerId: user.uid });
                });
                await batch.commit();
                toast({ title: "Import Berhasil", description: `${data.length} baris SO ditambahkan.` });
            } catch (error) {
                toast({ variant: "destructive", title: "Gagal Import" });
            }
        }
    };


    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Order List</h1>
            <p className="text-muted-foreground">Manage your sales orders items and track links to invoices.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
            <Button variant="outline" onClick={handleDownloadTemplate}><Download className="mr-2 h-4 w-4"/> Template</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
            <AddSalesOrderDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSave}
                orderData={editingOrder}
                onAddClick={handleAddClick}
            />
          </div>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Cari SO, PO, atau Produk..." 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        <SelectItem value="kabel">Kabel</SelectItem>
                        <SelectItem value="aksesoris">Aksesoris</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SO NUMBER</TableHead>
                                <TableHead>PO NUMBER</TableHead>
                                <TableHead>CUSTOMER</TableHead>
                                <TableHead>PRODUCT (ALIAS)</TableHead>
                                <TableHead className="w-[80px] text-center">QTY</TableHead>
                                <TableHead className="w-[80px] text-center">UNIT</TableHead>
                                <TableHead className="w-[140px] text-right">PRICE</TableHead>
                                <TableHead className="text-right">TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className='text-center py-8'>Memuat data...</TableCell></TableRow>
                            ) : filteredOrders?.map((order) => {
                                const isLinked = linkedInvoices?.some(inv => inv.soNumber === order.soNumber && (inv.status === 'sent' || inv.status === 'paid'));
                                return (
                                    <TableRow key={order.id} className={isLinked ? "bg-muted/20" : ""}>
                                        <TableCell className="font-medium">{order.soNumber}</TableCell>
                                        <TableCell className="text-muted-foreground">{order.poNumber || '-'}</TableCell>
                                        <TableCell>{order.customer}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={order.productName}>{order.productName}</TableCell>
                                        <TableCell className="text-center">{order.quantity}</TableCell>
                                        <TableCell className="text-center uppercase">{order.unit}</TableCell>
                                        <TableCell className="text-right">Rp {order.price.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {isAdmin && (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(order)}><Edit className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(order.id!, order.soNumber)} disabled={isLinked}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <DeleteConfirmationDialog
            open={deleteDialogState.isOpen}
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open}))}
            onConfirm={handleDeleteConfirm}
        >
            <span />
        </DeleteConfirmationDialog>
      </main>
    );
  }
