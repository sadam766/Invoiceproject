
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
import { Search, Eye } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


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
    if (!firestore || !user) return null;
    return query(collection(firestore, 'salesOrders'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: salesOrderListData, isLoading: isSalesOrdersLoading } = useCollection<SalesOrder>(salesOrdersCollection);

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'invoices'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: invoiceListData, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);

  const taxInvoicesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'taxInvoices'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: taxInvoiceListData, isLoading: isTaxInvoicesLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);

  const spdsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'spds'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: spdListData, isLoading: isSpdsLoading } = useCollection<SpdData>(spdsCollection);


  const isLoading = isSalesOrdersLoading || isInvoicesLoading || isTaxInvoicesLoading || isSpdsLoading;
  
  const salesMonitoringData = useMemo(() => {
    if (!salesOrderListData || !invoiceListData || !taxInvoiceListData || !spdListData) return [];
    return getSalesMonitoringData(salesOrderListData, invoiceListData, taxInvoiceListData, spdListData);
  }, [salesOrderListData, invoiceListData, taxInvoiceListData, spdListData]);

  const needsInvoiceData = salesMonitoringData.filter(d => d.needsInvoice);
  const needsSpdData = salesMonitoringData.filter(d => d.needsSpd);
  const unpaidData = salesMonitoringData.filter(d => d.paymentStatus === 'Unpaid');

  const filteredData = useMemo(() => {
    let data: SalesMonitoringData[];
    switch (activeTab) {
        case 'needs-invoice':
            data = needsInvoiceData;
            break;
        case 'needs-spd':
            data = needsSpdData;
            break;
        case 'unpaid':
            data = unpaidData;
            break;
        case 'all':
        default:
            data = salesMonitoringData;
            break;
    }

    if (!searchQuery) {
        return data;
    }

    return data.filter(item => 
        item.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customer.toLowerCase().includes(searchQuery.toLowerCase())
    );

  }, [activeTab, searchQuery, salesMonitoringData, needsInvoiceData, needsSpdData, unpaidData]);


  const renderTable = (data: typeof salesMonitoringData) => (
    <div className="mt-4 w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SO Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Tax Invoice</TableHead>
            <TableHead>SPD</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={9} className="text-center">Loading data...</TableCell></TableRow>}
          {!isLoading && data.map((sale) => (
            <TableRow key={sale.soNumber}>
              <TableCell className="font-medium">
                {sale.soNumber}
              </TableCell>
              <TableCell>{sale.customer}</TableCell>
              <TableCell>{sale.date}</TableCell>
              <TableCell>
                Rp {sale.amount.toLocaleString('id-ID')}
              </TableCell>
              <TableCell>
                {sale.invoice ? (
                   <div className="flex items-center gap-2">
                    <span>{sale.invoice}</span>
                    <Badge
                        variant={statusVariant[sale.invoiceStatus] || 'secondary'}
                        className={cn(statusStyle[sale.invoiceStatus] || '')}
                    >
                        {sale.invoiceStatus}
                    </Badge>
                   </div>
                ) : (
                    <Button size="sm" asChild>
                       <Link href={`/dashboard/invoices/number`}>Create Invoice</Link>
                    </Button>
                )}
              </TableCell>
              <TableCell>{sale.taxInvoice || '-'}
              </TableCell>
              <TableCell>
                {sale.spd ? sale.spd : (sale.invoice && sale.needsSpd ? (
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/invoices/spd`}>Create SPD</Link>
                  </Button>
                ) : (
                  '-'
                ))}
              </TableCell>
              <TableCell>
                <Badge
                    variant={statusVariant[sale.paymentStatus] || 'secondary'}
                    className={cn(statusStyle[sale.paymentStatus] || '')}
                >
                  {sale.paymentStatus}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
       <div className="text-sm text-muted-foreground mt-4">
        Showing 1 to {data.length} of {data.length} entries
      </div>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Monitoring</h1>
          <p className="text-muted-foreground">
            Track sales orders from creation to completion.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center">
              <div className="relative w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by SO, customer..."
                  className="w-full appearance-none bg-background pl-8 shadow-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <TabsList>
                <TabsTrigger value="all">All Sales ({salesMonitoringData.length})</TabsTrigger>
                <TabsTrigger value="needs-invoice">Needs Invoice ({needsInvoiceData.length})</TabsTrigger>
                <TabsTrigger value="needs-spd">Needs SPD ({needsSpdData.length})</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid ({unpaidData.length})</TabsTrigger>
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
