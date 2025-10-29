
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
  import { productListData, type ProductListItem } from '@/app/lib/data';
  import { Search, Upload, Download } from 'lucide-react';
  import { AddProductDialog } from './_components/add-product-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, importFromExcel } from '@/lib/utils';
  
  export default function ProductListPage() {
    const [products, setProducts] = useState(productListData);
    const [editingProduct, setEditingProduct] = useState<ProductListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const filteredProducts = useMemo(() => {
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

    const handleDelete = (productName: string) => {
        setProducts(products.filter((p) => p.name !== productName));
    };

    const handleSave = (product: ProductListItem) => {
      if (editingProduct && editingProduct.name === product.name) {
        // Editing existing product
        setProducts(products.map((p) => p.name === product.name ? product : p));
      } else if (editingProduct) {
        // Editing existing product but with new name
        const filteredProducts = products.filter(p => p.name !== editingProduct.name);
        setProducts([...filteredProducts, product]);
      } else {
        // Adding new product
        setProducts([...products, product]);
      }
      setIsDialogOpen(false);
      setEditingProduct(undefined);
    };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingProduct(undefined);
      }
    }

    const handleExport = () => {
        exportToExcel(products, 'products');
        toast({ title: "Export Successful", description: "Product data has been exported to Excel." });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const data = await importFromExcel(file) as ProductListItem[];
                setProducts(prev => [...prev, ...data]);
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
                            {filteredProducts.map((product) => (
                                <TableRow key={product.name}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.quantity} units</TableCell>
                                    <TableCell>{product.unit}</TableCell>
                                    <TableCell>Rp {product.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(product)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(product.name)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredProducts.length} of {products.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
