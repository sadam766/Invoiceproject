
'use client';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
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
import { getSalesMonitoringData, SalesMonitoringData, SalesOrder, Invoice, TaxInvoice, SpdData } from '@/app/lib/data';
import { Search, Eye, AlertCircle, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';


const statusVariant: { [key: string]: 'outline' | 'destructive' | 'secondary' } = {
    'Paid': 'outline',
    'Unpaid': 'destructive',
    'Sent': 'secondary',
    'Draft': 'secondary',
};

const statusStyle: { [key: string]: string } = {
    'Paid': 'border-green-500 text-green-500 bg-green-50',
    'Unpaid': 'border-red-500 text-red-500 bg-red-50',
    'Sent': 'border-blue-500 text-blue-500 bg-blue-50',
    'Draft': 'border-gray-500 text-gray-500 bg-gray-50',
};

function cn(...inputs: (string | undefined | null | false)[]): string {
    return inputs.filter(Boolean).join(' ');
}

export default function SalesMonitoringPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const salesOrdersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salesOrders'));
  }, [firestore]);
  const { data: salesOrderListData, isLoading: isSalesOrdersLoading } = useCollection<SalesOrder>(salesOrdersCollection);

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: invoiceListData, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

  const taxInvoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'taxInvoices'));
  }, [firestore]);
  const { data: taxInvoiceListData, isLoading: isTaxInvoicesLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);

  const spdsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'spds'));
  }, [firestore]);
  const { data: spdListData, isLoading: isSpdsLoading } = useCollection<SpdData>(spdsCollection);


  const isLoading = isSalesOrdersLoading || isInvoicesLoading || isTaxInvoicesLoading || isSpdsLoading;
  
  const salesMonitoringData = useMemo(() => {
    if (!salesOrderListData || !invoiceListData || !taxInvoiceListData || !spdListData) return [];
    return getSalesMonitoringData(salesOrderListData, invoiceListData, taxInvoiceListData, spdListData);
  }, [salesOrderListData, invoiceListData, taxInvoiceListData, spdListData]);

  const poPipelineData = salesMonitoringData.filter(d => d.isPoOnly);
  const needsInvoiceData = salesMonitoringData.filter(d => d.needsInvoice);
  const unpaidData = salesMonitoringData.filter(d => d.paymentStatus === 'Unpaid');

  const filteredData = useMemo(() => {
    let data: SalesMonitoringData[];
    switch (activeTab) {
        case 'po-pipeline':
            data = poPipelineData;
            break;
        case 'needs-invoice':
            data = needsInvoiceData;
            break;
        case 'unpaid':
            data = unpaidData;
            break;
        case 'all':
        default:
            data = salesMonitoringData;
            break;
    }

    if (!searchQuery) return data;

    return data.filter(item => 
        item.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.poNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

  }, [activeTab, searchQuery, salesMonitoringData, poPipelineData, needsInvoiceData, unpaidData]);


  const renderTable = (data: typeof salesMonitoringData) => (
    <div className="mt-4 w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SO Number</TableHead>
            <TableHead>PO Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={7} className="text-center">Loading data...</TableCell></TableRow>}
          {!isLoading && data.map((sale) => (
            <TableRow key={sale.invoice || sale.soNumber}>
              <TableCell className="font-medium">
                {sale.isPoOnly ? (
                    <div className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Waiting SO</span>
                    </div>
                ) : sale.soNumber}
              </TableCell>
              <TableCell>{sale.poNumber || '-'}</TableCell>
              <TableCell>{sale.customer}</TableCell>
              <TableCell>Rp {sale.amount.toLocaleString('id-ID')}</TableCell>
              <TableCell>
                {sale.invoice ? (
                   <div className="flex items-center gap-2">
                    <span className="text-xs">{sale.invoice}</span>
                    <Badge
                        variant={statusVariant[sale.invoiceStatus] || 'secondary'}
                        className={cn(statusStyle[sale.invoiceStatus] || '', "text-[10px] py-0 h-4")}
                    >
                        {sale.invoiceStatus}
                    </Badge>
                   </div>
                ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-blue-600 underline" asChild>
                       <Link href={`/dashboard/invoices/number`}>Tarik Tagihan</Link>
                    </Button>
                )}
              </TableCell>
              <TableCell>
                <Badge
                    variant={statusVariant[sale.paymentStatus] || 'secondary'}
                    className={cn(statusStyle[sale.paymentStatus] || '', "text-[10px]")}
                >
                  {sale.paymentStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {sale.isPoOnly && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                        <LinkIcon className="h-3 w-3" /> Hubungkan ke SO
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Monitoring</h1>
          <p className="text-muted-foreground">Lacak progres penagihan dari tahap PO hingga pelunasan.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center gap-4">
              <div className="relative w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari PO, SO, atau Customer..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">Semua ({salesMonitoringData.length})</TabsTrigger>
                <TabsTrigger value="po-pipeline" className="gap-2">
                    PO Pipeline
                    {poPipelineData.length > 0 && <Badge className="h-4 px-1 bg-yellow-500">{poPipelineData.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="needs-invoice">Belum Tagih ({needsInvoiceData.length})</TabsTrigger>
                <TabsTrigger value="unpaid">Piutang ({unpaidData.length})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value={activeTab}>
              {renderTable(filteredData)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
