
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
  import { invoiceListData, type Invoice, spdData, type SpdData, type SalesOrder, type Customer } from '@/app/lib/data';
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Eye, Pencil } from 'lucide-react';
  import { Skeleton } from '@/components/ui/skeleton';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
  import { collection, query, where } from 'firebase/firestore';


  export default function InvoiceListPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>(invoiceListData);
    const [currentSpdData, setCurrentSpdData] = useState<SpdData[]>(spdData);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const customersCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'customers'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: customerListData } = useCollection<Customer>(customersCollection);

    const salesOrdersCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'salesOrders'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);


    const filteredInvoices = useMemo(() => {
        let filtered = invoices;
        if (activeTab !== 'all') {
            filtered = invoices.filter(i => {
                if (activeTab === 'paid') return i.status === 'paid';
                if (activeTab === 'unpaid') return i.status !== 'paid';
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

    const totalFiltered = filteredInvoices?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalPaid = invoices?.filter(item => item.status === 'Paid' || item.status === 'paid').reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalUnpaid = invoices?.filter(item => item.status === 'unpaid' || item.status === 'sent' || item.status === 'draft').reduce((sum, item) => sum + item.amount, 0) || 0;

    const handleDelete = (invoiceId: string) => {
        setInvoices(invoices.filter((inv) => inv.id !== invoiceId));
    };

    const handleEdit = (invoice: Invoice) => {
      const safeId = invoice.id.replace(/\//g, '_');
      router.push(`/dashboard/invoices/add?editInvoiceId=${safeId}`);
    }

    const handlePreview = (invoice: Invoice) => {
        if (!salesOrderListData) return;
        const relatedSalesOrders = salesOrderListData.filter(so => so.soNumber === invoice.soNumber);
        const invoiceItems = relatedSalesOrders.map((so, index) => ({
            id: index,
            no: index + 1,
            item: so.productName,
            name: so.productName,
            quantity: so.quantity,
            unit: so.unit,
            price: so.price,
            total: so.quantity * so.price,
            amount: so.quantity * so.price
        }));
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        
        const negotiation = 0;
        const dpValue = 0;
        const pelunasan = 0;

        const grandTotal = subtotal - negotiation - dpValue - pelunasan;
        const dppVat = grandTotal / 1.12;
        const vat12 = dppVat * 0.12;

        const foundCustomer = customerListData?.find(c => c.name === invoice.customer);

        const previewData = {
            id: invoice.id,
            soNumber: invoice.soNumber,
            poNumber: invoice.poNumber,
            customer: foundCustomer,
            date: invoice.date,
            amount: invoice.amount,
            status: invoice.status,
            items: invoiceItems,
            subtotal,
            dppVat,
            vat12,
            negotiation,
            dpValue,
            pelunasan,
            grandTotal,
        };
        sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
        router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoice.id)}`);
    };

    const handleSelectionChange = (invoiceId: string) => {
        setSelectedInvoices(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(invoiceId)) {
                newSelection.delete(invoiceId);
            } else {
                newSelection.add(invoiceId);
            }
            return newSelection;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(new Set(filteredInvoices.map(i => i.id)));
        } else {
            setSelectedInvoices(new Set());
        }
    };
    
    const handleCreateSpd = () => {
        if (selectedInvoices.size === 0) {
            toast({
                variant: 'destructive',
                title: 'No Invoices Selected',
                description: 'Please select at least one invoice to create an SPD.',
            });
            return;
        }

        const selected = invoices.filter(inv => selectedInvoices.has(inv.id));
        
        // Cek jika ada invoice yang sudah punya SPD
        const alreadyHasSpd = selected.some(inv => inv.spdNumber && inv.spdNumber !== '-');
        if (alreadyHasSpd) {
            toast({
                variant: "destructive",
                title: "SPD Already Exists",
                description: "One or more selected invoices already have an SPD number.",
            });
            return;
        }
        
        const newSpdNumber = `SPD-${Date.now().toString().slice(-6)}`;
        const totalAmount = selected.reduce((sum, inv) => sum + inv.amount, 0);
        const customerNames = Array.from(new Set(selected.map(inv => inv.customer))).join(', ');
        const invoiceNumbers = selected.map(inv => inv.id).join(', ');

        const newSpdEntry: SpdData = {
            spd: newSpdNumber,
            tanggal: new Date().toISOString().split('T')[0],
            sales: 'System', // Placeholder
            customer: customerNames,
            noInvoice: invoiceNumbers,
            tanggalInvoice: selected[0]?.date || new Date().toISOString().split('T')[0],
            tglTerimaCustomer: '-',
            tglJatuhTempo: '-',
            totalPiutang: totalAmount,
            keterangan: `Generated from ${selected.length} invoices.`,
            noKuitansi: '-',
            noFakturPajak: '-',
            suratJalan: '-',
        };
        
        // This is a simulation, in a real app you would send this to a server
        setCurrentSpdData(prev => [...prev, newSpdEntry]);
        console.log("New SPD created:", newSpdEntry); // For debugging

        // Update invoices with the new SPD number
        setInvoices(prevInvoices => 
            prevInvoices.map(inv => 
                selectedInvoices.has(inv.id) ? { ...inv, spdNumber: newSpdNumber } : inv
            )
        );

        toast({
            title: 'SPD Created Successfully',
            description: `SPD ${newSpdNumber} has been created for ${selected.size} invoices.`,
        });

        setSelectedInvoices(new Set());
    };
  
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Overview</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="lg:col-span-2 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50 shadow-sm relative overflow-hidden">
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
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold">Invoices</h2>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button variant="outline" onClick={handleCreateSpd} disabled={selectedInvoices.size === 0}>Buat SPD dari Pilihan</Button>
                           <Link href="/dashboard/invoices/add" passHref>
                            <Button><Plus className="mr-2 h-4 w-4"/> New Invoice</Button>
                           </Link>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All Invoices <Badge variant="secondary" className="ml-2">{invoices?.length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status === 'paid').length || 0}</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">{invoices?.filter(i => i.status !== 'paid').length || 0}</Badge></TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search" 
                                placeholder="Search" 
                                className="pl-8" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                    </div>
                    </div>
                    <TabsContent value={activeTab}>
                        <div className="mt-4 w-full overflow-auto">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox 
                                          onCheckedChange={handleSelectAll}
                                          checked={filteredInvoices.length > 0 && selectedInvoices.size === filteredInvoices.length}
                                          aria-label="Select all rows"
                                        />
                                    </TableHead>
                                    <TableHead>INVOICE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>SO NUMBER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>CUSTOMER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>DATE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>AMOUNT <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>STATUS <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>NOMOR SPD <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    filteredInvoices?.map((invoice) => (
                                    <TableRow key={invoice.id} data-state={selectedInvoices.has(invoice.id) ? "selected" : ""}>
                                        <TableCell>
                                            <Checkbox
                                              onCheckedChange={() => handleSelectionChange(invoice.id)}
                                              checked={selectedInvoices.has(invoice.id)}
                                              aria-label={`Select row ${invoice.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{invoice.id}</TableCell>
                                        <TableCell>{invoice.soNumber}</TableCell>
                                        <TableCell>{invoice.customer}</TableCell>
                                        <TableCell>{invoice.date}</TableCell>
                                        <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
                                        <TableCell>
                                            <Badge variant={invoice.status === 'Paid' || invoice.status === 'paid' ? 'outline' : 'destructive'} 
                                            className={invoice.status === 'Paid' || invoice.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200 capitalize'}>
                                                {invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{invoice.spdNumber}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handlePreview(invoice)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Preview
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                        <DeleteConfirmationDialog onConfirm={() => handleDelete(invoice.id)} />
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    ))
                                )}
                            </TableBody>
                            </Table>
                        </div>
                        <div className="text-sm text-muted-foreground mt-4">
                            Showing 1 to {filteredInvoices?.length || 0} of {invoices?.length || 0} entries
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </main>
    );
  }

    
