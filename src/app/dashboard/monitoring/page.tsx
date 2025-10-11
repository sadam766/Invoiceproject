
import {
  Card,
  CardContent,
  CardDescription,
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
import { salesMonitoringData } from '@/app/lib/data';
import { Search, Eye } from 'lucide-react';

export default function SalesMonitoringPage() {
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
          <Tabs defaultValue="all">
            <div className="flex justify-between items-center">
              <div className="relative w-1/3">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by SO, customer..."
                  className="w-full appearance-none bg-background pl-8 shadow-none"
                />
              </div>
              <TabsList>
                <TabsTrigger value="all">All Sales</TabsTrigger>
                <TabsTrigger value="needs-invoice">Needs Invoice</TabsTrigger>
                <TabsTrigger value="needs-spd">Needs SPD</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="all">
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
                    {salesMonitoringData.map((sale) => (
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
                          {sale.invoice}
                          <Badge
                            variant={
                              sale.invoiceStatus === 'Paid'
                                ? 'outline'
                                : 'destructive'
                            }
                            className={`ml-2 ${
                              sale.invoiceStatus === 'Paid'
                                ? 'border-green-500 text-green-500'
                                : ''
                            }`}
                          >
                            {sale.invoiceStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{sale.taxInvoice}</TableCell>
                        <TableCell>
                          {sale.needsSpd ? (
                            <Button size="sm">Create SPD</Button>
                          ) : (
                            sale.spd
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              sale.paymentStatus === 'Paid'
                                ? 'outline'
                                : 'destructive'
                            }
                            className={`${
                              sale.paymentStatus === 'Paid'
                                ? 'border-green-500 text-green-500'
                                : ''
                            }`}
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
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                Showing 1 to 2 of 2 entries
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
