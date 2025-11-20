
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
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { type SalesListItem } from '@/app/lib/data';
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Upload, Download, Eye, Edit } from 'lucide-react';
  import { AddSaleDialog } from './_components/add-sale-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { exportToExcel, importFromExcel } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
  
  export default function SalesListPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [editingSale, setEditingSale] = useState<SalesListItem | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const salesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'sales'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: sales, isLoading } = useCollection<SalesListItem>(salesCollection);

    const totalFiltered = sales?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalPaid = sales?.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalUnpaid = sales?.filter(item => item.status === 'Unpaid').reduce((sum, item) => sum + item.amount, 0) || 0;
  
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
                s.sales.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.poNumber.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return filtered;
    }, [sales, activeTab, searchQuery]);

    const handleAddClick = () => {
        setEditingSale(undefined);
        setIsDialogOpen(true);
    };

    const handleEdit = (sale: SalesListItem) => {
        setEditingSale(sale);
        setIsDialogOpen(true);
    };

    const handleDelete = (soNumber: string) => {
        if (!firestore || !user) return;
        const docRef = doc(firestore, 'sales', soNumber);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: "Sale Deleted", description: `Sale ${soNumber} has been removed.` });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handlePreview = (sale: SalesListItem) => {
        sessionStorage.setItem('salesPreviewData', JSON.stringify(sale));
        router.push('/dashboard/sales-management');
    };

    const handleSave = (sale: SalesListItem) => {
        if (!firestore || !user) return;

        const isNew = !editingSale;
        const docRef = doc(firestore, 'sales', sale.soNumber);
        const dataToSave = { ...sale, ownerId: user.uid };
        
        setDoc(docRef, dataToSave, { merge: !isNew })
            .then(() => {
                toast({ title: isNew ? "Sale Added" : "Sale Updated" });
                setIsDialogOpen(false);
                setEditingSale(undefined);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: isNew ? 'create' : 'update',
                    requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleDialogStateChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingSale(undefined);
        }
    };
    
    const handleExport = () => {
        if(sales) exportToExcel(sales, 'sales');
        toast({ title: "Export Successful", description: "Sales data has been exported to Excel." });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

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
                toast({
                    title: "Import Successful",
                    description: `${data.length} sales records imported successfully.`,
                });
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Import Error",
                    description: error.message || "Failed to import the Excel file.",
                });
            }
        }
    };


    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Overview</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="lg:col-span-2 bg-blue-50/50 border-blue-200 shadow-sm relative overflow-hidden dark:bg-blue-950/20 dark:border-blue-800/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-blue-900/80 dark:text-blue-200">Total (Filtered)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-blue-950 dark:text-blue-100">Rp {totalFiltered.toLocaleString('id-ID')},00</div>
                </CardContent>
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-blue-100 to-transparent dark:from-blue-950/30">
                   <div className="w-full h-full" style={{
                       background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(167,207,255,0.2) 50%, rgba(132,189,255,0.4) 100%)',
                       clipPath: 'polygon(0 80%, 30% 60%, 70% 85%, 100% 70%, 100% 100%, 0% 100%)'
                   }}>
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 h-10 w-full" style={{
                        backgroundImage: 'linear-gradient(to top, hsl(220 90% 96% / 1), transparent)'
                   }}></div>
                   <svg width="100%" height="30" viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute bottom-0 left-0">
                       <path d="M 0 16 L 60 12 L 140 17 L 200 14" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none"></path>
                   </svg>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {totalPaid.toLocaleString('id-ID')},00</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {totalUnpaid.toLocaleString('id-ID')},00</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Pending / Draft</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 0,00</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 0,00</div>
                    </CardContent>
                </Card>
            </div>
        </div>
  
        <Card>
            <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold">Sales</h2>
                        </div>
                        <div className="flex items-center gap-2">
                           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                           <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                           <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                           <AddSaleDialog 
                                isOpen={isDialogOpen}
                                onOpenChange={handleDialogStateChange}
                                onSave={handleSave}
                                saleData={editingSale}
                                onAddClick={handleAddClick}
                           />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All Sales <Badge variant="secondary" className="ml-2">{sales?.length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">{sales?.filter(s=>s.status === 'Paid').length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">{sales?.filter(s=>s.status === 'Unpaid').length || 0}</Badge></TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search" 
                                placeholder="Search" 
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                    </div>
                    </div>
                    <TabsContent value="all" className="mt-4">
                    </TabsContent>
                    <TabsContent value="paid" className="mt-4">
                    </TabsContent>
                    <TabsContent value="unpaid" className="mt-4">
                    </TabsContent>
                    
                    <div className="mt-4 w-full overflow-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox />
                                </TableHead>
                                <TableHead>NUMBER SO <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead>CUSTOMER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead>SALES <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead>NO. PO <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead>AMOUNT <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead>STATUS <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={8} className="text-center">Loading sales...</TableCell></TableRow>}
                            {filteredSales?.map((sale) => (
                            <TableRow key={sale.soNumber}>
                                <TableCell>
                                    <Checkbox />
                                </TableCell>
                                <TableCell className="font-medium">{sale.soNumber}</TableCell>
                                <TableCell>{sale.customer}</TableCell>
                                <TableCell>{sale.sales}</TableCell>
                                <TableCell>{sale.poNumber}</TableCell>
                                <TableCell>Rp {sale.amount.toLocaleString('id-ID')},00</TableCell>
                                <TableCell>
                                    <Badge variant={sale.status === 'Paid' ? 'outline' : 'destructive'} 
                                    className={sale.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                                        {sale.status}
                                    </Badge>
                                    {sale.paidDate && <div className="text-xs text-muted-foreground">on: {sale.paidDate}</div>}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handlePreview(sale)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Preview
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(sale)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <DeleteConfirmationDialog onConfirm={() => handleDelete(sale.soNumber)} />
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                    <div className="text-sm text-muted-foreground mt-4">
                        Showing 1 to {filteredSales?.length || 0} of {sales?.length || 0} entries
                    </div>

                </Tabs>
            </CardContent>
        </Card>
      </main>
    );
  }
