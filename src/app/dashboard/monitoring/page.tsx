
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Eye, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  FileWarning, 
  ArrowUpRight,
  ReceiptText,
  Truck,
  MapPin,
  Calendar as CalendarIcon,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Banknote,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type SalesListItem, type SalesOrder, type Invoice, type TaxInvoice, type SpdData } from '@/app/lib/data';
import { cn, exportToExcel } from '@/lib/utils';
import { isBefore, parseISO, startOfToday, differenceInDays, isWithinInterval, format } from 'date-fns';
import { DateRangePicker } from '@/app/components/date-range-picker';
import { useToast } from '@/hooks/use-toast';

type GlobalTrackRecord = {
  poNumber: string;
  customer: string;
  sales: string;
  poAmount: number;
  soNumber: string;
  invoices: (Invoice & { taxInfo?: TaxInvoice })[];
  spdInfo?: SpdData;
  totalPaid: number;
  isOverdue: boolean;
  isWaitingProduction: boolean;
  isSpdLate: boolean;
  hasInvoices: boolean;
  latestInvoiceDate?: string;
};

export default function SalesMonitoringPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfToday(),
    to: startOfToday(),
  });

  // 1. Data Fetching
  const salesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'sales')) : null), [firestore]);
  const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesQuery);

  const soQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'salesOrders')) : null), [firestore]);
  const { data: soList, isLoading: isSoLoading } = useCollection<SalesOrder>(soQuery);

  const invQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'invoices')) : null), [firestore]);
  const { data: invoiceList, isLoading: isInvLoading } = useCollection<Invoice>(invQuery);

  const taxQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'taxInvoices')) : null), [firestore]);
  const { data: taxList } = useCollection<TaxInvoice>(taxQuery);

  const spdQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'spds')) : null), [firestore]);
  const { data: spdList } = useCollection<SpdData>(spdQuery);

  const isLoading = isSalesLoading || isSoLoading || isInvLoading;

  // 2. Logic: Global Tracking Mapping & Filtering
  const trackedData = useMemo((): GlobalTrackRecord[] => {
    if (!salesList || !invoiceList) return [];

    const today = startOfToday();

    return salesList.map(sale => {
      const linkedSo = soList?.find(so => so.poNumber === sale.poNumber)?.soNumber || sale.soNumber || '';
      
      const relatedInvoices = invoiceList
        .filter(inv => inv.poNumber === sale.poNumber && inv.status !== 'cancelled')
        .map(inv => ({
          ...inv,
          taxInfo: taxList?.find(t => t.invoiceNumber === inv.id)
        }));

      const spdForPo = spdList?.find(s => 
        s.invoices.some(si => relatedInvoices.some(ri => ri.id === si.invoiceId))
      );

      const totalPaid = relatedInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0);

      const isOverdue = relatedInvoices.some(inv => 
        inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)
      );

      let isSpdLate = false;
      if (spdForPo && spdForPo.status === 'in_delivery') {
          const aging = differenceInDays(today, parseISO(spdForPo.date));
          if (aging > 5) isSpdLate = true;
      }

      const invoicesInRange = relatedInvoices.filter(inv => 
        isWithinInterval(parseISO(inv.date), { start: dateRange.from, end: dateRange.to })
      );

      return {
        poNumber: sale.poNumber,
        customer: sale.customer,
        sales: sale.sales,
        poAmount: sale.amount,
        soNumber: linkedSo,
        invoices: relatedInvoices,
        spdInfo: spdForPo,
        totalPaid,
        isOverdue,
        isSpdLate,
        isWaitingProduction: !linkedSo,
        hasInvoices: relatedInvoices.length > 0,
        invoicesInRange,
        latestInvoiceDate: relatedInvoices.sort((a,b) => b.date.localeCompare(a.date))[0]?.date
      };
    }).filter(item => {
        if (activeTab === 'cancelled') return false; // Handled differently if needed
        
        const dateMatch = item.invoicesInRange!.length > 0;
        const searchMatch = item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.customer.toLowerCase().includes(searchQuery.toLowerCase());

        return dateMatch && searchMatch;
    });
  }, [salesList, soList, invoiceList, taxList, spdList, searchQuery, dateRange, activeTab]);

  const quickSummary = useMemo(() => {
    const invoicesCreated = trackedData.reduce((sum, item) => sum + item.invoicesInRange!.length, 0);
    const totalValue = trackedData.reduce((sum, item) => 
        sum + item.invoicesInRange!.reduce((s, i) => s + i.amount, 0), 0);
    const taxPending = trackedData.reduce((sum, item) => 
        sum + item.invoicesInRange!.filter(i => !i.taxInfo).length, 0);

    return { invoicesCreated, totalValue, taxPending };
  }, [trackedData]);

  const filteredData = useMemo(() => {
    if (activeTab === 'pajak') return trackedData.filter(d => d.invoicesInRange!.some(i => !i.taxInfo));
    if (activeTab === 'piutang') return trackedData.filter(d => d.totalPaid < d.poAmount);
    return trackedData;
  }, [trackedData, activeTab]);

  const handleExport = () => {
    const dataToExport = filteredData.map(d => ({
        'PO Number': d.poNumber,
        'Customer': d.customer,
        'Sales': d.sales,
        'PO Amount': d.poAmount,
        'Total Paid': d.totalPaid,
        'Outstanding': d.poAmount - d.totalPaid,
        'Latest Inv Date': d.latestInvoiceDate,
        'Status': d.totalPaid >= d.poAmount ? 'Lunas' : 'Piutang'
    }));
    exportToExcel(dataToExport, `Dakota-Monitoring-${format(dateRange.from, 'yyyyMMdd')}`);
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Global Monitoring Hub</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Pusat pelacakan dokumen harian. 
            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded">
                Range: {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 font-bold text-[11px] uppercase tracking-wider">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Export Filtered
            </Button>
            <DateRangePicker onRangeChange={setDateRange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20 shadow-sm border-t-4 border-t-primary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary">Invoices Created</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">{quickSummary.invoicesCreated} <span className="text-xs font-normal">Docs</span></div></CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-200 shadow-sm border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-emerald-700">Total Value</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">Rp {quickSummary.totalValue.toLocaleString('id-ID')}</div></CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-200 shadow-sm border-t-4 border-t-red-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-red-700">Pajak Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">{quickSummary.taxPending} <span className="text-xs font-normal">Serial Missing</span></div></CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-none ring-1 ring-border">
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari No. PO, Customer..." className="pl-8 bg-muted/20 border-none font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="all" className="text-xs font-bold uppercase px-4">Semua</TabsTrigger>
                <TabsTrigger value="pajak" className="text-xs font-bold uppercase px-4 text-red-600">Pajak Pending</TabsTrigger>
                <TabsTrigger value="piutang" className="text-xs font-bold uppercase px-4">Piutang Aktif</TabsTrigger>
              </TabsList>
            </div>

            <div className="rounded-xl border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">PO & Customer</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center">SO Produksi</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Penagihan & SPD</TableHead>
                        <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest py-4">Kesehatan Bayar</TableHead>
                        <TableHead className="text-right py-4"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground">Sinkronisasi...</TableCell></TableRow>
                    ) : filteredData.map((item) => (
                        <TableRow key={item.poNumber} className="hover:bg-muted/5 border-b last:border-0">
                        <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                            <span className="font-black text-sm text-slate-800">{item.poNumber}</span>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">{item.customer}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                            {item.soNumber ? (
                            <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 font-bold">
                                {item.soNumber}
                            </Badge>
                            ) : (
                            <Badge variant="secondary" className="text-[9px] opacity-50">NO SO</Badge>
                            )}
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="flex flex-wrap gap-2">
                                {item.invoicesInRange!.map(inv => (
                                    <div key={inv.id} className="flex flex-col gap-1 bg-white border p-2 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-primary">{inv.id}</span>
                                            {!inv.taxInfo && <AlertCircle className="h-3 w-3 text-red-500" />}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black">{inv.status}</Badge>
                                            {inv.spdNumber && <Truck className="h-2.5 w-2.5 text-indigo-600" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                <span>{((item.totalPaid / item.poAmount) * 100 || 0).toFixed(0)}%</span>
                                <span className={item.totalPaid < item.poAmount ? "text-red-600" : "text-emerald-600"}>
                                    Sisa: Rp {(item.poAmount - item.totalPaid).toLocaleString('id-ID')}
                                </span>
                                </div>
                                <Progress value={(item.totalPaid / item.poAmount) * 100 || 0} className="h-2" />
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {
                                sessionStorage.setItem('activePoPreview', item.poNumber);
                                router.push('/dashboard/sales-management');
                            }}>
                            <Eye className="h-5 w-5 text-slate-600" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
