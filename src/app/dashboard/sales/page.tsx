
'use client';
import { useState, useMemo, useRef } from 'react';
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
  import { type SalesListItem, type UserProfile } from '@/app/lib/data';
  import { Search, MoreHorizontal, ArrowUpDown, Upload, Download, Eye, Edit, Trash2, FileSpreadsheet } from 'lucide-react';
  import { AddSaleDialog } from './_components/add-sale-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  
  export default function SalesListPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingSale, setEditingSale] = useState<SalesListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; soNumber?: string; isBulk?: boolean }>({ isOpen: false });

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const salesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sales'));
    }, [firestore]);
    const { data: sales, isLoading } = useCollection<SalesListItem>(salesCollection);

    const filteredSales = useMemo(() => {
        if (!sales) return [];
        let filtered = sales;
        if (activeTab !== 'all') {
            filtered = sales.filter(s => s.status.toLowerCase() === activeTab);
        }
        if (searchQuery) {
            filtered = filtered.filter(s => 
                s.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.sales.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return filtered;
    }, [sales, activeTab, searchQuery]);

    const totalFiltered = filteredSales.reduce((sum, item) => sum + item.amount, 0);

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredSales.map(s => s.soNumber)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !isAdmin) return;

        if (deleteDialogState.isBulk) {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                batch.delete(doc(firestore, 'sales', id));
            });
            await batch.commit();
            toast({ title: `${selectedIds.size} sales dihapus` });
            setSelectedIds(new Set());
        } else if (deleteDialogState.soNumber) {
            const docRef = doc(firestore, 'sales', deleteDialogState.soNumber);
            await deleteDoc(docRef);
            toast({ title: "Sale Berhasil Dihapus" });
        }
        setDeleteDialogState({ isOpen: false });
    };

    const handleExport = () => {
        const dataToExport = selectedIds.size > 0 
            ? filteredSales.filter(s => selectedIds.has(s.soNumber))
            : filteredSales;
        
        exportToExcel(dataToExport, 'sales_data');
        toast({ title: "Export Berhasil", description: `${dataToExport.length} data diekspor.` });
    };

    const handleDownloadTemplate = () => {
        generateExcelTemplate(['soNumber', 'customer', 'sales', 'poNumber', 'amount', 'status', 'paidDate'], 'template_sales');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as SalesListItem[];
                const batch = writeBatch(firestore);
                data.forEach(item => {
                    const docRef = doc(firestore, 'sales', item.soNumber);
                    batch.set(docRef, { ...item, ownerId: user.uid });
                });
                await batch.commit();
                toast({ title: "Import Berhasil", description: `${data.length} data ditambahkan.` });
            } catch (e) {
                toast({ variant: "destructive", title: "Gagal Import" });
            }
        }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight">Payment Overview</h1>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                <Button variant="outline" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                <AddSaleDialog 
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSave={(s) => setDoc(doc(firestore!, 'sales', s.soNumber), {...s, ownerId: user!.uid}, {merge: true}).then(() => toast({title: "Berhasil"}))}
                    saleData={editingSale}
                    onAddClick={() => { setEditingSale(undefined); setIsDialogOpen(true); }}
                />
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total (Filtered)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">Rp {totalFiltered.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>
  
        <Card>
            <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex justify-between items-center mb-4">
                        <TabsList>
                            <TabsTrigger value="all">Semua Sales</TabsTrigger>
                            <TabsTrigger value="paid">Lunas</TabsTrigger>
                            <TabsTrigger value="unpaid">Piutang</TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-2">
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            {selectedIds.size > 0 && isAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox 
                                            checked={filteredSales.length > 0 && selectedIds.size === filteredSales.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>NUMBER SO</TableHead>
                                    <TableHead>CUSTOMER</TableHead>
                                    <TableHead>SALES</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>STATUS</TableHead>
                                    <TableHead className="text-right">AKSI</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8">Memuat data...</TableCell></TableRow>
                                ) : filteredSales.map((sale) => (
                                    <TableRow key={sale.soNumber} className={selectedIds.has(sale.soNumber) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedIds.has(sale.soNumber)} 
                                                onCheckedChange={() => handleSelectRow(sale.soNumber)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{sale.soNumber}</TableCell>
                                        <TableCell>{sale.customer}</TableCell>
                                        <TableCell>{sale.sales}</TableCell>
                                        <TableCell>Rp {sale.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell>
                                            <Badge variant={sale.status === 'Paid' ? 'outline' : 'destructive'} 
                                            className={sale.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                                {sale.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { sessionStorage.setItem('salesPreviewData', JSON.stringify(sale)); router.push('/dashboard/sales-management'); }}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
                                                    {isAdmin && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => { setEditingSale(sale); setIsDialogOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialogState({ isOpen: true, soNumber: sale.soNumber, isBulk: false })}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                        </>
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
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open}))} 
            onConfirm={handleDeleteConfirm}
        >
            <span />
        </DeleteConfirmationDialog>
      </main>
    );
  }
