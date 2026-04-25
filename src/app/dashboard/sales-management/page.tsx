
'use client';
import { useEffect, useState, useMemo } from 'react';
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
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Search, Eye, TrendingUp, CreditCard, AlertCircle, ArrowUpDown } from 'lucide-react';
  import { type SalesListItem, type Invoice } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
  import { collection, query } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { PaymentDetailDialog } from './_components/payment-detail-dialog';
  
  type MergedRecord = SalesListItem & {
    relatedInvoices: Invoice[];
    totalPaid: number;
    outstanding: number;
  };

  export default function SalesManagementPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState<MergedRecord | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const firestore = useFirestore();
    const { user } = useUser();

    // Fetch necessary data
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
    
    const isLoading = isSalesLoading || isInvoicesLoading;

    // Logic: Combine PO data with real-time Invoice payments
    const mergedData = useMemo((): MergedRecord[] => {
        if (!salesList || !invoiceList) return [];

        return salesList.map(sale => {
            const related = invoiceList.filter(inv => inv.poNumber === sale.poNumber);
            const paid = related.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
            
            // Dynamic Status Calculation
            let status: any = 'Waiting';
            if (paid >= sale.amount && sale.amount > 0) status = 'Paid';
            else if (paid > 0) status = 'Partial';

            return {
                ...sale,
                status,
                relatedInvoices: related,
                totalPaid: paid,
                outstanding: sale.amount - paid
            };
        }).filter(item => 
            item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.customer.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => b.outstanding - a.outstanding); // Sort by highest outstanding first
    }, [salesList, invoiceList, searchQuery]);

    // Financial KPIs
    const totals = useMemo(() => {
        const totalPo = mergedData.reduce((sum, item) => sum + item.amount, 0);
        const totalPaid = mergedData.reduce((sum, item) => sum + item.totalPaid, 0);
        return {
            po: totalPo,
            paid: totalPaid,
            outstanding: totalPo - totalPaid
        };
    }, [mergedData]);

    // Handle deep-link from Sales List
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
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Management (Buku Piutang)</h1>
            <p className="text-muted-foreground">Monitoring arus kas masuk per-dokumen PO.</p>
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
                        <Input placeholder="Cari nomor PO atau customer..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Data diurutkan berdasarkan Sisa Piutang tertinggi.</p>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>PO NUMBER</TableHead>
                                <TableHead>CUSTOMER</TableHead>
                                <TableHead className="text-right">TOTAL PO</TableHead>
                                <TableHead className="text-right">TERBAYAR</TableHead>
                                <TableHead className="text-right">OUTSTANDING</TableHead>
                                <TableHead className="text-center">PROGRES</TableHead>
                                <TableHead className="text-right">TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8">Menganalisa Buku Piutang...</TableCell></TableRow>
                            ) : mergedData.map((item) => (
                                <TableRow key={item.poNumber}>
                                    <TableCell className="font-bold">{item.poNumber}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{item.customer}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{item.sales}</span>
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
                                        <Button variant="outline" size="sm" onClick={() => { setSelectedSale(item); setDetailOpen(true); }}>
                                            <Eye className="mr-2 h-4 w-4" /> Buku Pembayaran
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* Payment Detail Buku Piutang */}
        <PaymentDetailDialog 
            isOpen={detailOpen} 
            onOpenChange={setDetailOpen} 
            sale={selectedSale} 
            invoices={selectedSale?.relatedInvoices || []} 
        />
      </main>
    );
  }
