
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
  Calendar as CalendarIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type SalesListItem, type SalesOrder, type Invoice, type TaxInvoice, type SpdData } from '@/app/lib/data';
import { cn } from '@/lib/utils';
import { isBefore, parseISO, startOfToday, differenceInDays } from 'date-fns';

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
};

export default function SalesMonitoringPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Data Fetching from All Modules
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

  // 2. Logic: Global Tracking Mapping
  const trackedData = useMemo((): GlobalTrackRecord[] => {
    if (!salesList) return [];

    const today = startOfToday();

    return salesList.map(sale => {
      // Link to SO
      const linkedSo = soList?.find(so => so.poNumber === sale.poNumber)?.soNumber || sale.soNumber || '';
      
      // Link to Invoices
      const relatedInvoices = (invoiceList || [])
        .filter(inv => inv.poNumber === sale.poNumber)
        .map(inv => ({
          ...inv,
          taxInfo: taxList?.find(t => t.invoiceNumber === inv.id)
        }));

      // Link to latest SPD
      const spdForPo = spdList?.find(s => 
        s.invoices.some(si => relatedInvoices.some(ri => ri.id === si.invoiceId))
      );

      const totalPaid = relatedInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0);

      const isOverdue = relatedInvoices.some(inv => 
        inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)
      );

      // Late Return Alert (5 Days)
      let isSpdLate = false;
      if (spdForPo && spdForPo.status === 'in_delivery') {
          const aging = differenceInDays(today, parseISO(spdForPo.date));
          if (aging > 5) isSpdLate = true;
      }

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
        hasInvoices: relatedInvoices.length > 0
      };
    }).filter(item => 
      item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.soNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [salesList, soList, invoiceList, taxList, spdList, searchQuery]);

  // 3. Stats Calculations
  const stats = useMemo(() => {
    const pipeline = trackedData.filter(d => d.isWaitingProduction).length;
    const outstanding = trackedData.reduce((sum, d) => sum + (d.poAmount - d.totalPaid), 0);
    const late = trackedData.filter(d => d.isOverdue || d.isSpdLate).length;
    return { pipeline, outstanding, late };
  }, [trackedData]);

  // 4. Tab Filtering
  const filteredData = useMemo(() => {
    if (activeTab === 'not-invoiced') return trackedData.filter(d => !d.hasInvoices);
    if (activeTab === 'piutang') return trackedData.filter(d => d.hasInvoices && d.totalPaid < d.poAmount);
    if (activeTab === 'done') return trackedData.filter(d => d.totalPaid >= d.poAmount && d.poAmount > 0);
    return trackedData;
  }, [trackedData, activeTab]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Global Monitoring Hub</h1>
          <p className="text-muted-foreground font-medium">Pelacakan dokumen end-to-end dari PO hingga Lunas.</p>
        </div>
      </div>

      {/* Header Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-yellow-50/50 border-yellow-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-yellow-700 flex items-center gap-2 tracking-widest">
              <Clock className="h-3.5 w-3.5" /> PO Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{stats.pipeline} <span className="text-xs font-normal text-muted-foreground">Waiting Production</span></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-blue-700 flex items-center gap-2 tracking-widest">
              <TrendingUp className="h-3.5 w-3.5" /> Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-red-700 flex items-center gap-2 tracking-widest">
              <FileWarning className="h-3.5 w-3.5" /> Late Returns & Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{stats.late} <span className="text-xs font-normal text-muted-foreground">Overdue Alerts</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-none ring-1 ring-border">
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari No. PO, SO, atau Pelanggan..."
                  className="pl-8 bg-muted/20 border-none shadow-none font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="all" className="text-xs font-bold uppercase px-4">Semua ({trackedData.length})</TabsTrigger>
                <TabsTrigger value="not-invoiced" className="text-xs font-bold uppercase px-4">Belum Tagih</TabsTrigger>
                <TabsTrigger value="piutang" className="text-xs font-bold uppercase px-4">Piutang</TabsTrigger>
                <TabsTrigger value="done" className="text-xs font-bold uppercase px-4">Selesai</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab}>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest py-4">Identitas (PO / PT)</TableHead>
                      <TableHead className="w-[180px] text-[10px] font-black uppercase tracking-widest py-4 text-center">Produksi (SO)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Penagihan & SPD</TableHead>
                      <TableHead className="w-[220px] text-[10px] font-black uppercase tracking-widest py-4">Progress Uang</TableHead>
                      <TableHead className="text-right py-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 animate-pulse font-bold text-muted-foreground">Sinkronisasi Data Global...</TableCell></TableRow>
                    ) : filteredData.map((item) => (
                      <TableRow key={item.poNumber} className={cn(
                        "transition-colors",
                        item.isOverdue || item.isSpdLate ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-muted/5",
                        item.isWaitingProduction ? "bg-yellow-50/20" : ""
                      )}>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-sm text-slate-800">{item.poNumber}</span>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground truncate max-w-[150px]">{item.customer}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          {item.soNumber ? (
                            <Badge variant="outline" className="font-mono bg-blue-50 border-blue-200 text-blue-700 px-3 font-bold">
                              {item.soNumber}
                            </Badge>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 text-amber-600 text-[10px] font-black uppercase bg-amber-50 py-1 rounded-lg border border-amber-100">
                              <AlertCircle className="h-3 w-3" /> Waiting Production
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-3">
                            {/* Invoices List */}
                            {item.invoices.length > 0 ? (
                                <div className="space-y-1.5">
                                    {item.invoices.map(inv => (
                                      <div key={inv.id} className="flex flex-col gap-0.5 border-l-2 border-primary/20 pl-2">
                                        <div className="flex items-center gap-2">
                                          <Link href={`/dashboard/invoices`} className="text-[10px] font-black text-primary hover:underline flex items-center gap-0.5">
                                            {inv.id} <ArrowUpRight className="h-2.5 w-2.5" />
                                          </Link>
                                          <Badge variant={inv.status === 'paid' ? 'outline' : inv.status === 'received' ? 'secondary' : 'destructive'} 
                                          className={cn("text-[8px] h-3.5 px-1.5 py-0 uppercase font-black", inv.status === 'received' ? 'bg-blue-50 text-blue-700' : '')}>
                                            {inv.status}
                                          </Badge>
                                        </div>
                                        {inv.taxInfo && (
                                          <div className="flex items-center gap-1 text-[9px] text-teal-600 font-bold uppercase">
                                            <ReceiptText className="h-2.5 w-2.5" /> FP: {inv.taxInfo.taxInvoiceNumber}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic font-medium">No invoices issued yet</span>
                            )}

                            {/* SPD Info (Physical Document Tracking) */}
                            {item.spdInfo && (
                                <div className={cn(
                                    "p-2 rounded-lg border flex flex-col gap-1.5",
                                    item.isSpdLate ? "bg-amber-50 border-amber-200" : "bg-indigo-50/30 border-indigo-100"
                                )}>
                                    <div className="flex justify-between items-center">
                                        <Link href={`/dashboard/invoices/spd/preview/${encodeURIComponent(item.spdInfo.id)}`} className="text-[9px] font-black font-mono text-indigo-700 hover:underline flex items-center gap-1">
                                            <Truck className="h-2.5 w-2.5" /> {item.spdInfo.id}
                                        </Link>
                                        <Badge variant="outline" className={cn("text-[8px] h-3 px-1", item.spdInfo.status === 'received' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700')}>
                                            {item.spdInfo.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    {item.isSpdLate && (
                                        <div className="flex items-center gap-1 text-[8px] font-black text-amber-700 animate-pulse">
                                            <AlertTriangle className="h-2.5 w-2.5" /> LATE RETURN (>5 DAYS)
                                        </div>
                                    )}
                                </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                <span className={item.totalPaid >= item.poAmount ? "text-emerald-600" : "text-slate-500"}>
                                    {(item.totalPaid / item.poAmount * 100 || 0).toFixed(0)}% PAID
                                </span>
                                <span className={cn(item.totalPaid < item.poAmount ? "text-red-600" : "text-emerald-600")}>
                                  Rp {(item.poAmount - item.totalPaid).toLocaleString('id-ID')} Left
                                </span>
                             </div>
                             <Progress value={item.totalPaid / item.poAmount * 100 || 0} className="h-2 bg-muted shadow-inner" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10" onClick={() => {
                            sessionStorage.setItem('activePoPreview', item.poNumber);
                            router.push('/dashboard/sales-management');
                          }}>
                            <Eye className="h-5 w-5 text-slate-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">Tidak ada data yang sesuai filter monitoring.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}

function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 16 8.5 11 2 18" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function AlertTriangle(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
