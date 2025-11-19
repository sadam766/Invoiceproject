
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
  import type { ProductListItem } from '@/app/lib/data';
  import { Search, Upload, Download } from 'lucide-react';
  import { AddProductDialog } from './_components/add-product-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
  
  export default function ProductListPage() {
    const firestore = useFirestore();
    const [editingProduct, setEditingProduct] = useState<ProductListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const productsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'products');
    }, [firestore]);

    const { data: products, isLoading } = useCollection<ProductListItem>(productsCollection);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        let filtered = products;
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(p => p.category === categoryFilter);
        }
        if (searchQuery) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return filtered;
    }, [products, searchQuery, categoryFilter]);


    const handleAddClick = () => {
      setEditingProduct(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (product: ProductListItem) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    };

    const handleDelete = (productId: string) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'products', productId);
        deleteDoc(docRef)
          .then(() => {
            toast({ title: 'Product deleted' });
          })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
    };

    const handleSave = (product: Omit<ProductListItem, 'id'> & { id?: string }) => {
        if (!firestore) return;

        let productId = product.id;
        const isNewProduct = !productId;
        if (isNewProduct) {
            // Create a new ID for a new product if it's not being edited
            productId = doc(collection(firestore, 'products')).id;
        }

        const docRef = doc(firestore, 'products', productId!);
        const dataToSave = { ...product, id: productId };

        setDoc(docRef, dataToSave, { merge: !isNewProduct })
            .then(() => {
                toast({
                    title: editingProduct ? 'Product Updated' : 'Product Added',
                    description: `Product ${product.name} has been saved.`,
                });
                setIsDialogOpen(false);
                setEditingProduct(undefined);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: isNewProduct ? 'create' : 'update',
                  requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingProduct(undefined);
      }
    }
    
    const handleDownloadTemplate = () => {
        const headers = ['name', 'category', 'quantity', 'unit', 'price'];
        generateExcelTemplate(headers, 'product_template');
        toast({ title: "Template Downloaded", description: "Product template has been downloaded." });
    };

    const handleExport = () => {
        if (products) {
            exportToExcel(products, 'products');
            toast({ title: "Export Successful", description: "Product data has been exported to Excel." });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore) {
            try {
                const data = await importFromExcel(file) as Omit<ProductListItem, 'id'>[];
                const batch = writeBatch(firestore);

                data.forEach(productData => {
                    const newDocRef = doc(collection(firestore, 'products'));
                    batch.set(newDocRef, { ...productData, id: newDocRef.id });
                });

                await batch.commit();

                toast({
                    title: "Import Successful",
                    description: `${data.length} products imported successfully.`,
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
                        <Input 
                            type="search" 
                            placeholder="Search products..." 
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
                       <AddProductDialog
                          isOpen={isDialogOpen}
                          onOpenChange={handleDialogStateChange}
                          onSave={handleSave}
                          productData={editingProduct}
                          onAddClick={handleAddClick}
                       />
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
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">Loading products...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredProducts?.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.quantity} units</TableCell>
                                    <TableCell>{product.unit}</TableCell>
                                    <TableCell>Rp {product.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(product)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(product.id!)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredProducts?.length || 0} of {products?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
