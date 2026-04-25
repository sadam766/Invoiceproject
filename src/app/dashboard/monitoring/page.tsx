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
  ReceiptText
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type SalesListItem, type SalesOrder, type Invoice, type TaxInvoice } from '@/app/lib/data';
import { cn } from '@/lib/utils';
import { isBefore, parseISO, startOfToday } from 'date-fns';

type GlobalTrackRecord = {
  poNumber: string;
  customer: string;
  sales: string;
  poAmount: number;
  soNumber: string;
  invoices: (Invoice & { taxInfo?: TaxInvoice })[];
  totalPaid: number;
  isOverdue: boolean;
  isWaitingProduction: boolean;
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

  const isLoading = isSalesLoading || isSoLoading || isInvLoading;

  // 2. Logic: Global Tracking Mapping
  const trackedData = useMemo((): GlobalTrackRecord[] => {
    if (!salesList) return [];

    const today = startOfToday();

    return salesList.map(sale => {
      // Link to SO (from Sales Orders)
      const linkedSo = soList?.find(so => so.poNumber === sale.poNumber)?.soNumber || sale.soNumber || '';
      
      // Link to Invoices
      const relatedInvoices = (invoiceList || [])
        .filter(inv => inv.poNumber === sale.poNumber)
        .map(inv => ({
          ...inv,
          taxInfo: taxList?.find(t => t.invoiceNumber === inv.id)
        }));

      const totalPaid = relatedInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0);

      const isOverdue = relatedInvoices.some(inv => 
        inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)
      );

      return {
        poNumber: sale.poNumber,
        customer: sale.customer,
        sales: sale.sales,
        poAmount: sale.amount,
        soNumber: linkedSo,
        invoices: relatedInvoices,
        totalPaid,
        isOverdue,
        isWaitingProduction: !linkedSo,
        hasInvoices: relatedInvoices.length > 0
      };
    }).filter(item => 
      item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.soNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [salesList, soList, invoiceList, taxList, searchQuery]);

  // 3. Stats Calculations
  const stats = useMemo(() => {
    const pipeline = trackedData.filter(d => d.isWaitingProduction).length;
    const outstanding = trackedData.reduce((sum, d) => sum + (d.poAmount - d.totalPaid), 0);
    const late = trackedData.filter(d => d.isOverdue).length;
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
          <h1 className="text-2xl font-bold tracking-tight">Global Monitoring Hub</h1>
          <p className="text-muted-foreground">Pelacakan dokumen end-to-end dari PO hingga Lunas.</p>
        </div>
      </div>

      {/* Header Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-yellow-50/50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-yellow-700 flex items-center gap-2">
              <Clock className="h-3 w-3" /> PO Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pipeline} <span className="text-xs font-normal text-muted-foreground">Waiting Production</span></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-blue-700 flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-red-700 flex items-center gap-2">
              <FileWarning className="h-3 w-3" /> Late Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.late} <span className="text-xs font-normal text-muted-foreground">Overdue Alerts</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari No. PO, SO, atau Pelanggan..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <TabsList>
                <TabsTrigger value="all">Semua ({trackedData.length})</TabsTrigger>
                <TabsTrigger value="not-invoiced">Belum Tagih</TabsTrigger>
                <TabsTrigger value="piutang">Piutang</TabsTrigger>
                <TabsTrigger value="done">Selesai</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab}>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[200px]">IDENTITAS (PO / CUST)</TableHead>
                      <TableHead className="w-[180px]">PRODUKSI (SO)</TableHead>
                      <TableHead>PENAGIHAN & PAJAK</TableHead>
                      <TableHead className="w-[220px]">PROGRESS UANG</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20">Sinkronisasi Data Global...</TableCell></TableRow>
                    ) : filteredData.map((item) => (
                      <TableRow key={item.poNumber} className={cn(
                        item.isOverdue ? "bg-red-50/30" : "",
                        item.isWaitingProduction ? "bg-yellow-50/20" : ""
                      )}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{item.poNumber}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{item.customer}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.soNumber ? (
                            <Badge variant="outline" className="font-mono bg-blue-50 border-blue-200 text-blue-700">
                              {item.soNumber}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5 text-yellow-600 text-[10px] font-bold uppercase">
                              <AlertCircle className="h-3 w-3" /> Waiting Production
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {item.invoices.length > 0 ? item.invoices.map(inv => (
                              <div key={inv.id} className="flex flex-col gap-0.5 border-l-2 border-primary/20 pl-2">
                                <div className="flex items-center gap-2">
                                  <Link href={`/dashboard/invoices`} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                                    {inv.id} <ArrowUpRight className="h-2 w-2" />
                                  </Link>
                                  <Badge variant={inv.status === 'paid' ? 'outline' : 'destructive'} className="text-[8px] h-3 px-1 py-0">
                                    {inv.status}
                                  </Badge>
                                </div>
                                {inv.taxInfo && (
                                  <div className="flex items-center gap-1 text-[9px] text-teal-600 font-medium">
                                    <ReceiptText className="h-2 w-2" /> {inv.taxInfo.taxInvoiceNumber}
                                  </div>
                                )}
                              </div>
                            )) : (
                              <span className="text-[10px] text-muted-foreground italic">No invoices yet</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                             <div className="flex justify-between text-[10px] font-bold">
                                <span>{(item.totalPaid / item.poAmount * 100 || 0).toFixed(0)}% PAID</span>
                                <span className={cn(item.totalPaid < item.poAmount ? "text-red-600" : "text-green-600")}>
                                  Rp {(item.poAmount - item.totalPaid).toLocaleString('id-ID')} Left
                                </span>
                             </div>
                             <Progress value={item.totalPaid / item.poAmount * 100 || 0} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            sessionStorage.setItem('activePoPreview', item.poNumber);
                            router.push('/dashboard/sales-management');
                          }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground">Tidak ada data yang sesuai filter.</TableCell></TableRow>
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
