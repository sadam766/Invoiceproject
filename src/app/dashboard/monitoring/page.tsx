
'use client';

import { useState, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Eye, 
  CheckCircle2, 
  FileSpreadsheet,
  Database,
  Hash,
  TrendingUp,
  ReceiptText,
  AlertCircle,
  Scale,
  Tag,
  ArrowRightLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type SalesListItem, type SalesOrder, type Invoice, type TaxInvoice } from '@/app/lib/data';
import { exportToExcel } from '@/lib/utils';
import { isBefore, parseISO, startOfToday, isWithinInterval, format } from 'date-fns';
import { DateRangePicker } from '@/app/components/date-range-picker';
import { cn } from '@/lib/utils';

type GlobalTrackRecord = {
  poNumber: string;
  customer: string;
  sales: string;
  poAmount: number;
  actualDeliveryValue: number;
  priceVariance: number;
  paidOffline: number;
  soNumber: string;
  invoices: (Invoice & { taxInfo?: TaxInvoice })[];
  totalPaid: number;
  isOverdue: boolean;
  hasItemVariance: boolean;
  itemProgress: { invoiced: number; total: number; percent: number };
};

export default function SalesMonitoringPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfToday(),
    to: startOfToday(),
  });

  const salesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'sales')) : null), [firestore]);
  const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesQuery);

  const soQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'salesOrders')) : null), [firestore]);
  const { data: soList, isLoading: isSoLoading } = useCollection<SalesOrder>(soQuery);

  const invQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'invoices')) : null), [firestore]);
  const { data: invoiceList, isLoading: isInvLoading } = useCollection<Invoice>(invQuery);

  const taxQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'taxInvoices')) : null), [firestore]);
  const { data: taxList } = useCollection<TaxInvoice>(taxQuery);

  const isLoading = isSalesLoading || isSoLoading || isInvLoading;

  const trackedData = useMemo((): GlobalTrackRecord[] => {
    if (!salesList || !invoiceList) return [];

    const today = startOfToday();

    return salesList.map(sale => {
      const linkedSos = soList?.filter(so => so.poNumber === sale.poNumber) || [];
      const relatedInvoices = invoiceList
        .filter(inv => inv.poNumber === sale.poNumber && inv.status !== 'cancelled')
        .map(inv => ({
          ...inv,
          taxInfo: taxList?.find(t => t.invoiceNumber === inv.id)
        }));

      const totalUnits = linkedSos.reduce((sum, s) => sum + s.quantity, 0);
      const invoicedUnits = relatedInvoices.reduce((sum, inv) => {
          return sum + (inv.items?.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 0);
      }, 0);

      const actualValue = relatedInvoices.filter(i => !i.isDpInvoice).reduce((sum, inv) => sum + inv.amount, 0);
      
      // TRIPLE VARIANCE DETECTION: Price Variance Calculation
      let totalAdjustedPriceImpact = 0;
      let hasItemVariance = false;
      relatedInvoices.forEach(inv => {
          inv.items?.forEach(item => {
              if (item.originalPrice && item.price !== item.originalPrice) {
                  totalAdjustedPriceImpact += (item.price - item.originalPrice) * item.quantity;
              }
              if (item.originalName && item.name !== item.originalName) {
                  hasItemVariance = true;
              }
          });
      });

      const systemPaid = relatedInvoices.reduce((sum, inv) => {
          const paidOnInv = inv.payments?.reduce((s, p) => s + p.amount, 0) || (inv.status === 'paid' ? inv.amount : 0);
          return sum + paidOnInv;
      }, 0);
      const totalPaid = (sale.paidOffline || 0) + systemPaid;

      const isOverdue = relatedInvoices.some(inv => 
        inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)
      );

      return {
        poNumber: sale.poNumber,
        customer: sale.customer,
        sales: sale.sales,
        poAmount: sale.amount,
        actualDeliveryValue: actualValue,
        priceVariance: totalAdjustedPriceImpact,
        hasItemVariance: hasItemVariance,
        paidOffline: sale.paidOffline || 0,
        soNumber: sale.soNumber || linkedSos[0]?.soNumber || '',
        invoices: relatedInvoices,
        totalPaid,
        isOverdue,
        itemProgress: {
            invoiced: invoicedUnits,
            total: totalUnits,
            percent: totalUnits > 0 ? (invoicedUnits / totalUnits) * 100 : 0
        }
      };
    }).filter(item => {
        const searchMatch = item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.customer.toLowerCase().includes(searchQuery.toLowerCase());
        
        const hasInvoiceInPeriod = item.invoices.some(inv => 
            isWithinInterval(parseISO(inv.date), { start: dateRange.from, end: dateRange.to })
        );

        if (!searchQuery) return hasInvoiceInPeriod;
        return searchMatch;
    });
  }, [salesList, soList, invoiceList, taxList, searchQuery, dateRange]);

  const stats = useMemo(() => {
    const invoicesCreated = trackedData.reduce((sum, item) => sum + item.invoices.length, 0);
    const actualTotalValue = trackedData.reduce((sum, item) => 
        sum + item.invoices.reduce((s, i) => s + i.amount, 0), 0);
    const totalVariance = trackedData.reduce((sum, item) => sum + item.priceVariance, 0);

    return { invoicesCreated, actualTotalValue, totalVariance };
  }, [trackedData]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-50">Global Hub Audit</h1>
          <div className="text-slate-400 font-medium flex items-center gap-2 text-sm">
            Triple Variance Monitoring: Name, Qty, & Price Audit.
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM')}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToExcel(trackedData, 'Actual-Audit-Report')} className="h-9 font-bold text-[10px] uppercase tracking-widest border-slate-200">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Export Audit
            </Button>
            <DateRangePicker onRangeChange={setDateRange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <ReceiptText className="h-3 w-3 text-indigo-600" /> Invoices in Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">{stats.invoicesCreated} <span className="text-xs font-normal text-slate-400">Docs</span></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-emerald-600" /> Actual Billing Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">Rp {stats.actualTotalValue.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-amber-600" /> Global Price Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", stats.totalVariance < 0 ? "text-rose-600" : "text-emerald-600")}>
                {stats.totalVariance > 0 ? '+' : ''} Rp {stats.totalVariance.toLocaleString('id-ID')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
        <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search PO, Customer, or Reference..." 
                    className="pl-8 bg-slate-50 dark:bg-slate-800 border-none font-medium text-xs" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">PO & Hub Identity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Physical Flow</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Variance Audit</TableHead>
                        <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Financial Progress</TableHead>
                        <TableHead className="text-right py-4"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 font-black uppercase text-slate-400 animate-pulse tracking-widest">Syncing Triple Variance Matrix...</TableCell></TableRow>
                    ) : trackedData.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 font-black uppercase text-slate-400 opacity-30 tracking-widest italic">No data found.</TableCell></TableRow>
                    ) : trackedData.map((item) => {
                        const hasQtyVariance = item.itemProgress.percent > 100 || item.itemProgress.percent < 100;
                        const hasPriceVariance = Math.abs(item.priceVariance) > 0;
                        return (
                        <TableRow key={item.poNumber} className="hover:bg-indigo-50/10 border-b last:border-0 transition-colors">
                        <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                                <span className="font-black text-sm text-slate-900 dark:text-slate-50">{item.poNumber}</span>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tight truncate max-w-[200px]">{item.customer}</span>
                            </div>
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="space-y-2 max-w-[180px]">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-slate-500">
                                    <span className="flex items-center gap-1">
                                        {item.hasItemVariance && <Tag className="h-2.5 w-2.5 text-indigo-600" />}
                                        {item.itemProgress.invoiced} / {item.itemProgress.total} Items
                                    </span>
                                    <span className={cn(item.itemProgress.percent > 100 ? "text-amber-600 font-black" : item.itemProgress.percent === 100 ? "text-emerald-600" : "")}>
                                        {item.itemProgress.percent.toFixed(0)}%
                                    </span>
                                </div>
                                <Progress 
                                    value={Math.min(100, item.itemProgress.percent)} 
                                    className={cn("h-1 bg-slate-100 dark:bg-slate-800", item.itemProgress.percent > 100 ? "bg-amber-100" : "")} 
                                />
                            </div>
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black">Rp {item.actualDeliveryValue.toLocaleString('id-ID')}</span>
                                    {item.hasItemVariance && <Badge className="text-[7px] bg-indigo-50 text-indigo-600 border-indigo-100 h-3.5">Specs Change</Badge>}
                                </div>
                                <div className="space-y-0.5">
                                    {Math.abs(item.actualDeliveryValue - item.poAmount) > 1000 && (
                                        <div className="flex items-center gap-1">
                                            <Scale className="h-2.5 w-2.5 text-amber-600" />
                                            <span className="text-[8px] font-black uppercase text-amber-600">
                                                Qty Variance: Rp {(item.actualDeliveryValue - item.poAmount - item.priceVariance).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    )}
                                    {hasPriceVariance && (
                                        <div className="flex items-center gap-1">
                                            <Tag className="h-2.5 w-2.5 text-indigo-600" />
                                            <span className="text-[8px] font-black uppercase text-indigo-600">
                                                Price Variance: Rp {item.priceVariance.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                                <span className="text-slate-500">{((item.totalPaid / (item.actualDeliveryValue || 1)) * 100).toFixed(0)}% Collected</span>
                                <span className={item.totalPaid < item.actualDeliveryValue ? "text-rose-600" : "text-emerald-600"}>
                                    Bal: Rp {(item.actualDeliveryValue - item.totalPaid).toLocaleString('id-ID')}
                                </span>
                                </div>
                                <Progress value={(item.totalPaid / (item.actualDeliveryValue || 1)) * 100} className="h-1" />
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-indigo-50" onClick={() => {
                                sessionStorage.setItem('activePoPreview', item.poNumber);
                                router.push('/dashboard/sales-management');
                            }}>
                            <Eye className="h-4 w-4 text-slate-400" />
                            </Button>
                        </TableCell>
                        </TableRow>
                        );
                    })}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
