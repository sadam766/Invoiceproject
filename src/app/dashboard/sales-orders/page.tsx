
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
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { salesOrderListData, type SalesOrder } from '@/app/lib/data';
  import { Search, Upload, Download, Plus } from 'lucide-react';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { AddSalesOrderDialog } from './_components/add-sales-order-dialog';
  
  export default function SalesOrderListPage() {
    const [orders, setOrders] = useState(salesOrderListData);
    const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleAdd = () => {
      setEditingOrder(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (order: SalesOrder) => {
        setEditingOrder(order);
        setIsDialogOpen(true);
    };

    const handleDelete = (soNumber: string, productName: string) => {
        setOrders(orders.filter(o => !(o.soNumber === soNumber && o.productName === productName)));
    };

    const handleSave = (order: SalesOrder) => {
        const orderKey = `${order.soNumber}-${order.productName}`;
        if (editingOrder) {
            const editingKey = `${editingOrder.soNumber}-${editingOrder.productName}`;
            if (editingKey === orderKey) {
                // Editing existing order, key hasn't changed
                setOrders(orders.map(o => (`${o.soNumber}-${o.productName}` === orderKey ? order : o)));
            } else {
                // Editing existing order, but key (soNumber or productName) has changed
                const filteredOrders = orders.filter(o => `${o.soNumber}-${o.productName}` !== editingKey);
                setOrders([...filteredOrders, order]);
            }
        } else {
            // Adding new order
            setOrders([...orders, order]);
        }
        setIsDialogOpen(false);
        setEditingOrder(undefined);
    };

    const handleDialogClose = () => {
      setIsDialogOpen(false);
      setEditingOrder(undefined);
    }

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
                        <Input type="search" placeholder="Search orders..." className="pl-8" />
                    </div>
                    <div className="flex items-center gap-2">
                       <Select>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kabel">Kabel</SelectItem>
                            <SelectItem value="aksesoris">Aksesoris</SelectItem>
                          </SelectContent>
                        </Select>
                       <Button variant="outline"><Upload className="mr-2 h-4 w-4"/> Import</Button>
                       <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddSalesOrderDialog
                            isOpen={isDialogOpen}
                            onOpenChange={handleDialogClose}
                            onSave={handleSave}
                            orderData={editingOrder}
                            onAddClick={handleAdd}
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
                            {orders.map((order, index) => (
                                <TableRow key={`${order.soNumber}-${order.productName}-${index}`}>
                                    <TableCell className="font-medium">{order.soNumber}</TableCell>
                                    <TableCell>{order.productName}</TableCell>
                                    <TableCell>{order.category}</TableCell>
                                    <TableCell>{order.quantity}</TableCell>
                                    <TableCell>{order.unit}</TableCell>
                                    <TableCell>Rp {order.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(order)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(order.soNumber, order.productName)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {orders.length} of {orders.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  
