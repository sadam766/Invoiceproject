
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
  import { Checkbox } from '@/components/ui/checkbox';
  import type { ProductListItem, UserProfile } from '@/app/lib/data';
  import { Search, Upload, Download, Trash2, Edit, FileSpreadsheet } from 'lucide-react';
  import { AddProductDialog } from './_components/add-product-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
  
  export default function ProductListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingProduct, setEditingProduct] = useState<ProductListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; productId?: string; isBulk?: boolean }>({ isOpen: false });

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const productsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'products'));
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

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredProducts.map(p => p.id!)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleAddClick = () => {
      setEditingProduct(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (product: ProductListItem) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !isAdmin) return;

        if (deleteDialogState.isBulk) {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                batch.delete(doc(firestore, 'products', id));
            });
            await batch.commit();
            toast({ title: `${selectedIds.size} produk dihapus` });
            setSelectedIds(new Set());
        } else if (deleteDialogState.productId) {
            const docRef = doc(firestore, 'products', deleteDialogState.productId);
            await deleteDoc(docRef);
            toast({ title: 'Produk dihapus' });
        }
        setDeleteDialogState({ isOpen: false });
    };
    
    const openDeleteDialog = (productId: string) => {
        if (!isAdmin) {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Admin yang boleh menghapus data." });
            return;
        }
        setDeleteDialogState({ isOpen: true, productId, isBulk: false });
    };

    const handleSave = (product: Omit<ProductListItem, 'id'> & { id?: string }) => {
        if (!firestore || !user) return;

        let productId = product.id;
        const isNewProduct = !productId;
        if (isNewProduct) {
            productId = doc(collection(firestore, 'products')).id;
        }

        const docRef = doc(firestore, 'products', productId!);
        const dataToSave = { ...product, id: productId, ownerId: user.uid };

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

    const handleExport = () => {
        const dataToExport = selectedIds.size > 0 
            ? filteredProducts.filter(p => selectedIds.has(p.id!))
            : filteredProducts;
        
        exportToExcel(dataToExport, 'products');
        toast({ title: "Export Berhasil", description: `${dataToExport.length} produk diekspor.` });
    };

    const handleDownloadTemplate = () => {
        generateExcelTemplate(['name', 'category', 'quantity', 'unit', 'price'], 'product_template');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as Omit<ProductListItem, 'id'|'ownerId'>[];
                const batch = writeBatch(firestore);
                data.forEach(item => {
                    const newDocRef = doc(collection(firestore, 'products'));
                    batch.set(newDocRef, { ...item, id: newDocRef.id, ownerId: user.uid });
                });
                await batch.commit();
                toast({ title: "Import Berhasil", description: `${data.length} produk ditambahkan.` });
            } catch (error) {
                toast({ variant: "destructive", title: "Import Gagal" });
            }
        }
    };


    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product List</h1>
            <p className="text-muted-foreground">Manage your products inventory.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
            <Button variant="outline" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
            <AddProductDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSave}
                productData={editingProduct}
                onAddClick={handleAddClick}
            />
          </div>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari produk..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Semua Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                <SelectItem value="kabel">Kabel</SelectItem>
                                <SelectItem value="aksesoris">Aksesoris</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedIds.size > 0 && isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                        </Button>
                    )}
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox 
                                        checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>PRODUCT</TableHead>
                                <TableHead>CATEGORY</TableHead>
                                <TableHead>QUANTITY</TableHead>
                                <TableHead>SATUAN</TableHead>
                                <TableHead>PRICE</TableHead>
                                <TableHead className="text-right">TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8">Memuat data...</TableCell></TableRow>
                            ) : filteredProducts?.map((product) => (
                                <TableRow key={product.id} className={selectedIds.has(product.id!) ? "bg-muted/50" : ""}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedIds.has(product.id!)} 
                                            onCheckedChange={() => handleSelectRow(product.id!)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.quantity} units</TableCell>
                                    <TableCell>{product.unit}</TableCell>
                                    <TableCell>Rp {product.price.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell className="text-right">
                                        {isAdmin && (
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}><Edit className="h-4 w-4" /></Button>
                                                <DeleteConfirmationDialog 
                                                    open={deleteDialogState.isOpen && deleteDialogState.productId === product.id}
                                                    onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open, productId: open ? product.id : undefined, isBulk: false}))}
                                                    onConfirm={handleDeleteConfirm}
                                                >
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(product.id!); }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </DeleteConfirmationDialog>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Menampilkan {filteredProducts?.length || 0} dari {products?.length || 0} entri
                </div>
            </CardContent>
        </Card>

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen && deleteDialogState.isBulk} 
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open}))} 
            onConfirm={handleDeleteConfirm}
        >
            <span />
        </DeleteConfirmationDialog>
      </main>
    );
  }
