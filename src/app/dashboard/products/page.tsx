
'use client';

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
  import { productListData } from '@/app/lib/data';
  import { Search, Upload, Download, Plus } from 'lucide-react';
  import { AddProductDialog } from './_components/add-product-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  
  export default function ProductListPage() {
    const handleEdit = (productName: string) => {
        alert(`Edit product: ${productName}`);
    };

    const handleDelete = (productName: string) => {
        alert(`Delete product: ${productName}`);
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product List</h1>
          <p className="text-muted-foreground">
            Manage your products inventory.
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search products..." className="pl-8" />
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
                       <AddProductDialog />
                    </div>
                </div>

                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PRODUCT</TableHead>
                                <TableHead>CATEGORY</TableHead>
                                <TableHead>QUANTITY</TableHead>
                                <TableHead>SATUAN</TableHead>
                                <TableHead>PRICE</TableHead>
                                <TableHead>TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productListData.map((product) => (
                                <TableRow key={product.name}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.quantity} units</TableCell>
                                    <TableCell>{product.unit}</TableCell>
                                    <TableCell>Rp {product.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(product.name)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(product.name)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to 3 of 3 entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  