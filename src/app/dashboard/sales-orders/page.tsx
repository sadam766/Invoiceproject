
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
  import { type SalesOrder, type Invoice } from '@/app/lib/data';
  import { Search, Upload, Download } from 'lucide-react';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { AddSalesOrderDialog } from './_components/add-sales-order-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query, getDocs, where } from 'firebase/firestore';
  
  export default function SalesOrderListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const salesOrdersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'salesOrders'));
    }, [firestore]);
    const { data: orders, isLoading } = useCollection<SalesOrder>(salesOrdersCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);


    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        let filtered = orders;
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(o => o.category === categoryFilter);
        }
        if (searchQuery) {
            filtered = filtered.filter(o => 
                o.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.productName.toLowerCase().includes(searchQuery.toLowerCase())
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

    const handleDelete = async (orderId: string, soNumber: string) => {
        if (!firestore) return;
    
        // Check if the soNumber is used in any invoice
        if (invoiceList && invoiceList.some(invoice => invoice.soNumber === soNumber)) {
            toast({
                variant: 'destructive',
                title: "Deletion Failed",
                description: "Sales Order cannot be deleted because it is linked to an existing invoice.",
            });
            return;
        }

        // Proceed with deletion if not linked
        const docRef = doc(firestore, 'salesOrders', orderId);
        try {
            await deleteDoc(docRef);
            toast({ title: 'Sales Order deleted' });
        } catch (error) {
            console.error("Error deleting sales order:", error);
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Could not delete the sales order. Please check permissions.",
            });
        }
    };

    const handleSave = (order: SalesOrder) => {
        if (!firestore || !user) return;
        let orderId = order.id || editingOrder?.id;
        if (!orderId) {
            orderId = doc(collection(firestore, 'salesOrders')).id;
        }

        const docRef = doc(firestore, 'salesOrders', orderId);
        setDoc(docRef, { ...order, id: orderId, ownerId: user.uid }, { merge: true });
        
        toast({
            title: editingOrder ? 'Sales Order Updated' : 'Sales Order Added',
            description: `Sales Order ${order.soNumber} has been saved.`,
        });
        setIsDialogOpen(false);
        setEditingOrder(undefined);
    };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingOrder(undefined);
      }
    }
    
    const handleDownloadTemplate = () => {
        const headers = ['soNumber', 'customer', 'productName', 'category', 'quantity', 'unit', 'price'];
        generateExcelTemplate(headers, 'sales_order_template');
        toast({ title: "Template Downloaded", description: "Sales Order template has been downloaded." });
    };

    const handleExport = () => {
        if(orders) {
            exportToExcel(orders, 'sales-orders');
            toast({ title: "Export Successful", description: "Sales order data has been exported to Excel." });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

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

                toast({
                    title: "Import Successful",
                    description: `${data.length} sales orders imported successfully.`,
                });
            } catch (error) {
                console.error("Error importing file:", error);
                toast({
                    variant: "destructive",
                    title: "Import Error",
                    description: "Failed to import the Excel file. Please check the file format.",
                });
            }
        }
    };


    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Order List</h1>
          <p className="text-muted-foreground">
            Manage your sales orders.
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search orders..." 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="kabel">Kabel</SelectItem>
                            <SelectItem value="aksesoris">Aksesoris</SelectItem>
                          </SelectContent>
                        </Select>
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                       <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                       <Button variant="outline" onClick={handleDownloadTemplate}><Download className="mr-2 h-4 w-4"/> Download Template</Button>
                       <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddSalesOrderDialog
                            isOpen={isDialogOpen}
                            onOpenChange={handleDialogStateChange}
                            onSave={handleSave}
                            orderData={editingOrder}
                            onAddClick={handleAddClick}
                        />
                    </div>
                </div>

                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SO NUMBER</TableHead>
                                <TableHead>PRODUCT NAME</TableHead>
                                <TableHead>CATEGORY</TableHead>
                                <TableHead>QUANTITY</TableHead>
                                <TableHead>SATUAN</TableHead>
                                <TableHead>PRICE</TableHead>
                                <TableHead>TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={7} className='text-center'>Loading...</TableCell></TableRow>}
                            {filteredOrders?.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.soNumber}</TableCell>
                                    <TableCell>{order.productName}</TableCell>
                                    <TableCell>{order.category}</TableCell>
                                    <TableCell>{order.quantity}</TableCell>
                                    <TableCell>{order.unit}</TableCell>
                                    <TableCell>Rp {order.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(order)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(order.id!, order.soNumber)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredOrders?.length || 0} of {orders?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }

    
