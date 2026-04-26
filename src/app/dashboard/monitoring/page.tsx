
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
  FileSpreadsheet,
  TrendingUp,
  ReceiptText,
  Scale,
  Tag,
  ArrowRightLeft,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type SalesListItem, type SalesOrder, type Invoice, type TaxInvoice, type InvoiceItem } from '@/app/lib/data';
import { exportToExcel } from '@/lib/utils';
import { isBefore, parseISO, startOfToday, isWithinInterval, format } from 'date-fns';
import { DateRangePicker } from '@/app/components/date-range-picker';
import { cn } from '@/lib/utils';
import * as React from 'react';

type GlobalTrackRecord = {
  poNumber: string;
  customer: string;
  sales: string;
  poAmount: number;
  actualDeliveryValue: number;
  priceVariance: number;
  volumeVariance: number;
  paidOffline: number;
  soNumber: string;
  invoices: (Invoice & { taxInfo?: TaxInvoice })[];
  totalPaid: number;
  isOverdue: boolean;
  hasItemVariance: boolean;
  itemProgress: { invoiced: number; total: number; percent: number };
  itemVariances: (InvoiceItem & { invoiceId: string })[];
};

export default function SalesMonitoringPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
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
      
      let priceVar = 0;
      let volVar = 0;
      let hasItemVariance = false;
      const variances: (InvoiceItem & { invoiceId: string })[] = [];

      relatedInvoices.forEach(inv => {
          inv.items?.forEach(item => {
              const pOrig = item.originalPrice || item.price;
              const qOrig = item.originalQty || item.quantity;
              
              const pVarItem = (item.price - pOrig) * item.quantity;
              const vVarItem = (item.quantity - (item.originalQty || item.quantity)) * pOrig;

              priceVar += pVarItem;
              volVar += vVarItem;

              if (Math.abs(pVarItem) > 0 || Math.abs(vVarItem) > 0 || item.name !== item.originalName) {
                  hasItemVariance = true;
                  variances.push({ ...item, invoiceId: inv.id });
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
        priceVariance: priceVar,
        volumeVariance: volVar,
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
        },
        itemVariances: variances
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
    const totalActualValue = trackedData.reduce((sum, item) => sum + item.actualDeliveryValue, 0);
    const totalPriceVar = trackedData.reduce((sum, item) => sum + item.priceVariance, 0);
    const totalVolVar = trackedData.reduce((sum, item) => sum + item.volumeVariance, 0);

    return { invoicesCreated, totalActualValue, totalPriceVar, totalVolVar, netImpact: totalPriceVar + totalVolVar };
  }, [trackedData]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-50">Variance Analytics Hub</h1>
          <div className="text-slate-400 font-medium flex items-center gap-2 text-sm">
            Financial & Material Discrepancy Monitoring (PO vs Actual).
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM')}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToExcel(trackedData, 'Discrepancy-Audit-Report')} className="h-9 font-bold text-[10px] uppercase tracking-widest border-slate-200">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Export Audit
            </Button>
            <DateRangePicker onRangeChange={setDateRange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-indigo-600" /> Price Variance (Gain/Loss)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", stats.totalPriceVar < 0 ? "text-rose-600" : "text-emerald-600")}>
                {stats.totalPriceVar >= 0 ? '+' : ''} Rp {stats.totalPriceVar.toLocaleString('id-ID')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Scale className="h-3 w-3 text-amber-600" /> Volume Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", stats.totalVolVar < 0 ? "text-rose-600" : "text-emerald-600")}>
                {stats.totalVolVar >= 0 ? '+' : ''} Rp {stats.totalVolVar.toLocaleString('id-ID')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-emerald-600" /> Net Margin Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", stats.netImpact < 0 ? "text-rose-600" : "text-emerald-600")}>
                {stats.netImpact >= 0 ? '+' : ''} Rp {stats.netImpact.toLocaleString('id-ID')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-indigo-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] font-black uppercase text-indigo-100 tracking-widest flex items-center gap-2">
                <ReceiptText className="h-3 w-3 text-white" /> Total Billing Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">Rp {stats.totalActualValue.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
        <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Cari PO, Customer, atau No. Invoice..." 
                    className="pl-8 bg-slate-50 dark:bg-slate-800 border-none font-medium text-xs h-9" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-black uppercase text-slate-400">Gain</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> <span className="text-[10px] font-black uppercase text-slate-400">Loss</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-[10px] font-black uppercase text-slate-400">High Risk (>10%)</span></div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">PO & Hub Identity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Physical Progress</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Financial Discrepancy</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-slate-400">Variance Status</TableHead>
                        <TableHead className="text-right py-4"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 font-black uppercase text-slate-400 animate-pulse tracking-widest">Syncing Triple Variance Matrix...</TableCell></TableRow>
                    ) : trackedData.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 font-black uppercase text-slate-400 opacity-30 tracking-widest italic">No data found.</TableCell></TableRow>
                    ) : trackedData.map((item) => {
                        const totalVar = item.priceVariance + item.volumeVariance;
                        const lossPercent = (Math.abs(Math.min(0, totalVar)) / (item.poAmount || 1)) * 100;
                        const isRedFlag = lossPercent > 10;
                        const isExpanded = expandedPo === item.poNumber;

                        return (
                            <React.Fragment key={item.poNumber}>
                                <TableRow className={cn("hover:bg-indigo-50/10 border-b last:border-0 transition-colors", isRedFlag && "bg-rose-50/20")}>
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
                                            <span className="text-xs font-black">Actual: Rp {item.actualDeliveryValue.toLocaleString('id-ID')}</span>
                                            {isRedFlag && <Badge className="text-[7px] bg-rose-600 text-white border-none h-3.5"><AlertTriangle className="h-2 w-2 mr-1" /> HIGH LOSS</Badge>}
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={cn("text-[8px] font-black uppercase", item.priceVariance < 0 ? "text-rose-600" : "text-emerald-600")}>
                                                Price Var: Rp {item.priceVariance.toLocaleString('id-ID')}
                                            </span>
                                            <span className={cn("text-[8px] font-black uppercase", item.volumeVariance < 0 ? "text-rose-600" : "text-emerald-600")}>
                                                Vol Var: Rp {item.volumeVariance.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4">
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-black uppercase h-5",
                                        totalVar > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                        totalVar < 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-500"
                                    )}>
                                        {totalVar > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : totalVar < 0 ? <ArrowDownRight className="h-3 w-3 mr-1" /> : null}
                                        {totalVar > 0 ? 'Gain' : totalVar < 0 ? 'Loss' : 'Balanced'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right py-4">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="rounded-full hover:bg-indigo-50"
                                        onClick={() => setExpandedPo(isExpanded ? null : item.poNumber)}
                                    >
                                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                                    </Button>
                                </TableCell>
                                </TableRow>

                                {isExpanded && (
                                    <TableRow className="bg-slate-50/30 dark:bg-slate-900/30">
                                        <TableCell colSpan={5} className="p-0 border-b">
                                            <div className="p-6 space-y-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">
                                                    <Tag className="h-3 w-3 text-indigo-600" /> Detail Variansi Per Item (Audit Trail)
                                                </div>
                                                <Table>
                                                    <TableHeader className="bg-transparent border-none">
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="h-8 text-[8px] font-black uppercase text-slate-400">Item Name</TableHead>
                                                            <TableHead className="h-8 text-center text-[8px] font-black uppercase text-slate-400">Qty (PO vs Bill)</TableHead>
                                                            <TableHead className="h-8 text-right text-[8px] font-black uppercase text-slate-400">Price (PO vs Bill)</TableHead>
                                                            <TableHead className="h-8 text-right text-[8px] font-black uppercase text-slate-400">Impact (Rp)</TableHead>
                                                            <TableHead className="h-8 text-[8px] font-black uppercase text-slate-400">Reason for Change</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {item.itemVariances.map((v, idx) => {
                                                            const pOrig = v.originalPrice || v.price;
                                                            const qOrig = v.originalQty || v.quantity;
                                                            const pDiff = v.price - pOrig;
                                                            const qDiff = v.quantity - qOrig;
                                                            const totalDiff = (v.price * v.quantity) - (pOrig * qOrig);

                                                            return (
                                                                <TableRow key={idx} className="border-none hover:bg-indigo-50/5">
                                                                    <TableCell className="py-2">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-bold">{v.name}</span>
                                                                            {v.name !== v.originalName && <span className="text-[7px] text-slate-400 italic">PO Ref: {v.originalName}</span>}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="py-2 text-center">
                                                                        <div className="text-[10px] font-bold">
                                                                            {qOrig} <ArrowRightLeft className="inline h-2 w-2 mx-1 opacity-30" /> {v.quantity} {v.unit}
                                                                        </div>
                                                                        {qDiff !== 0 && <span className={cn("text-[7px] font-black", qDiff > 0 ? "text-emerald-600" : "text-rose-600")}>{qDiff > 0 ? '+' : ''}{qDiff} Var</span>}
                                                                    </TableCell>
                                                                    <TableCell className="py-2 text-right">
                                                                        <div className="text-[10px] font-bold">
                                                                            Rp {pOrig.toLocaleString()} <ArrowRightLeft className="inline h-2 w-2 mx-1 opacity-30" /> Rp {v.price.toLocaleString()}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className={cn("py-2 text-right text-[10px] font-black", totalDiff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                        {totalDiff >= 0 ? '+' : ''} Rp {totalDiff.toLocaleString('id-ID')}
                                                                    </TableCell>
                                                                    <TableCell className="py-2">
                                                                        <span className="text-[9px] font-medium text-slate-500 italic bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100">
                                                                            {v.varianceReason || 'No reason provided'}
                                                                        </span>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
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
