
'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
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
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { 
    Search, 
    Eye, 
    TrendingUp, 
    CreditCard, 
    AlertCircle, 
    LayoutGrid, 
    List, 
    MoreVertical, 
    FileText,
    User,
    ClipboardCheck,
    Banknote,
    ReceiptText,
    Scale
  } from 'lucide-react';
  import { type SalesListItem, type Invoice, type TaxInvoice } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
  import { collection, query } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { PaymentDetailDialog } from './_components/payment-detail-dialog';
  
  type MergedRecord = SalesListItem & {
    relatedInvoices: (Invoice & { taxInfo?: TaxInvoice })[];
    totalPaid: number;
    outstanding: number;
    latestInvoiceDate?: string;
    latestTaxNumber?: string;
  };

  export default function SalesManagementPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState<MergedRecord | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'book'>('list');

    const firestore = useFirestore();
    const { user } = useUser();

    useEffect(() => {
        const savedView = localStorage.getItem('salesManagementViewMode');
        if (savedView === 'list' || savedView === 'book') {
            setViewMode(savedView);
        }
    }, []);

    const handleViewChange = (mode: 'list' | 'book') => {
        setViewMode(mode);
        localStorage.setItem('salesManagementViewMode', mode);
    };

    const salesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sales'));
    }, [firestore]);
    const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

    const taxInvoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'taxInvoices'));
    }, [firestore]);
    const { data: taxInvoiceList, isLoading: isTaxLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);
    
    const isLoading = isSalesLoading || isInvoicesLoading || isTaxLoading;

    const mergedData = useMemo((): MergedRecord[] => {
        if (!salesList || !invoiceList) return [];

        return salesList.map(sale => {
            const related = invoiceList.filter(inv => inv.poNumber === sale.poNumber).map(inv => {
                const tax = taxInvoiceList?.find(t => t.invoiceNumber === inv.id);
                return { ...inv, taxInfo: tax };
            });

            const paid = related.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            
            let status: any = 'Waiting';
            if (paid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (paid > 0) status = 'Partial';

            const latestInv = [...related].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestTax = related.find(r => r.taxInfo)?.taxInfo?.taxInvoiceNumber;

            return {
                ...sale,
                status,
                relatedInvoices: related,
                totalPaid: paid,
                outstanding: sale.amount - paid,
                latestInvoiceDate: latestInv?.date,
                latestTaxNumber: latestTax
            };
        }).filter(item => 
            item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.soNumber && item.soNumber.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a, b) => b.outstanding - a.outstanding);
    }, [salesList, invoiceList, taxInvoiceList, searchQuery]);

    const totals = useMemo(() => {
        const totalPo = mergedData.reduce((sum, item) => sum + item.amount, 0);
        const totalPaid = mergedData.reduce((sum, item) => sum + item.totalPaid, 0);
        return {
            po: totalPo,
            paid: totalPaid,
            outstanding: totalPo - totalPaid
        };
    }, [mergedData]);

    useEffect(() => {
        const poFromSession = sessionStorage.getItem('activePoPreview');
        if (poFromSession && mergedData.length > 0) {
            const found = mergedData.find(m => m.poNumber === poFromSession);
            if (found) {
                setSelectedSale(found);
                setDetailOpen(true);
            }
            sessionStorage.removeItem('activePoPreview');
        }
    }, [mergedData]);
    
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sales Management (Buku Piutang)</h1>
                <p className="text-muted-foreground">Monitoring arus kas, penagihan, dan perpajakan per-PO.</p>
            </div>
            <div className="flex bg-muted rounded-md p-1 border">
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-8 gap-2"
                    onClick={() => handleViewChange('list')}
                >
                    <List className="h-4 w-4" /> <span className="hidden sm:inline">List View</span>
                </Button>
                <Button 
                    variant={viewMode === 'book' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-8 gap-2"
                    onClick={() => handleViewChange('book')}
                >
                    <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Book Mode</span>
                </Button>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-blue-50/30 border-blue-100 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-blue-600 flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Total PO Terdaftar</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">Rp {totals.po.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-green-50/30 border-green-100 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-green-600 flex items-center gap-2"><CreditCard className="h-3 w-3" /> Total Terbayar (Paid)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-700">Rp {totals.paid.toLocaleString('id-ID')}</div></CardContent>
            </Card>
            <Card className="bg-red-50/30 border-red-100 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-red-600 flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Sisa Piutang (Unpaid)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-700">Rp {totals.outstanding.toLocaleString('id-ID')}</div></CardContent>
            </Card>
        </div>

        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari nomor PO, SO, atau customer..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Data diurutkan berdasarkan Sisa Piutang tertinggi.</p>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center space-y-4">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                        <p className="text-muted-foreground">Menganalisa Buku Piutang & Perpajakan...</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>SO / PO NUMBER</TableHead>
                                    <TableHead>CUSTOMER</TableHead>
                                    <TableHead>LATEST INVOICE / TAX</TableHead>
                                    <TableHead className="text-right">TOTAL PO</TableHead>
                                    <TableHead className="text-right">TERBAYAR</TableHead>
                                    <TableHead className="text-right">OUTSTANDING</TableHead>
                                    <TableHead className="text-center">STATUS</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8">Tidak ada data ditemukan.</TableCell></TableRow>
                                ) : mergedData.map((item) => (
                                    <TableRow key={item.poNumber}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{item.soNumber || '(Waiting SO)'}</span>
                                                <span className="text-[10px] text-muted-foreground">{item.poNumber}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{item.customer}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{item.sales}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] font-medium text-blue-600 truncate max-w-[120px]">{item.latestInvoiceDate || '-'}</span>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.latestTaxNumber || 'No Tax Invoice'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right text-green-600 font-medium">Rp {item.totalPaid.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right text-red-600 font-bold">Rp {item.outstanding.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(
                                                item.status === 'Paid' ? 'bg-green-600' : 
                                                item.status === 'Partial' ? 'bg-yellow-500' : 'bg-gray-400'
                                            )}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <FileText className="mr-2 h-4 w-4" /> Export Report
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {mergedData.map((item) => (
                            <Card key={item.poNumber} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                                <div className={cn(
                                    "h-1 w-full",
                                    item.status === 'Paid' ? "bg-green-500" : 
                                    item.status === 'Partial' ? "bg-yellow-500" : "bg-gray-400"
                                )} />
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">SO Number</span>
                                        <CardTitle className="text-sm font-bold">{item.soNumber || '(Waiting SO)'}</CardTitle>
                                    </div>
                                    <Badge className={cn(
                                        item.status === 'Paid' ? 'bg-green-600' : 
                                        item.status === 'Partial' ? 'bg-yellow-500' : 'bg-gray-400'
                                    )}>
                                        {item.status}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="flex-1 pt-2 pb-4 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2 text-sm">
                                            <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-bold leading-tight">{item.customer}</p>
                                                <p className="text-[10px] text-muted-foreground">Sales: {item.sales}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">PO:</span>
                                            <span className="font-medium">{item.poNumber}</span>
                                        </div>
                                    </div>

                                    {/* SEKSI BARU: PENAGIHAN & PAJAK */}
                                    <div className="p-3 bg-muted/20 rounded-lg border border-dashed space-y-2">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <ReceiptText className="h-3 w-3" /> Riwayat Penagihan & Pajak
                                        </p>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Latest Inv:</span>
                                                <span className="font-medium">{item.latestInvoiceDate || 'Not Issued'}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Tax Invoice:</span>
                                                <span className={item.latestTaxNumber ? "text-blue-600 font-bold" : "text-muted-foreground"}>
                                                    {item.latestTaxNumber || '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Total Amount</p>
                                            <p className="text-xs font-bold">Rp {item.amount.toLocaleString('id-ID')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Terbayar</p>
                                            <p className="text-xs font-bold text-green-600">Rp {item.totalPaid.toLocaleString('id-ID')}</p>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-dashed">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                <Banknote className="h-4 w-4 text-red-500" />
                                                <span className="text-xs font-bold text-red-600 uppercase">Sisa Piutang</span>
                                            </div>
                                            <span className="text-sm font-black text-red-600">Rp {item.outstanding.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/10 p-3 pt-0 mt-auto">
                                    <Button variant="outline" className="w-full h-8 text-xs font-bold" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                        <Eye className="mr-2 h-4 w-4" /> Buka Buku Pembayaran
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>

        <PaymentDetailDialog 
            isOpen={detailOpen} 
            onOpenChange={setDetailOpen} 
            sale={selectedSale} 
            invoices={selectedSale?.relatedInvoices || []} 
        />
      </main>
    );
  }
