
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
  import { Checkbox } from '@/components/ui/checkbox';
  import { invoiceListData } from '@/app/lib/data';
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus } from 'lucide-react';
  
  export default function InvoiceListPage() {
    const totalFiltered = invoiceListData.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = invoiceListData.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
    const totalUnpaid = invoiceListData.filter(item => item.status === 'Unpaid').reduce((sum, item) => sum + item.amount, 0);
  
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Overview</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="lg:col-span-2 bg-blue-50/50 border-blue-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Total (Filtered)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">Rp {totalFiltered.toLocaleString('id-ID')},00</div>
                    <div className="h-4 w-full bg-blue-200 rounded-full mt-2 relative overflow-hidden">
                        <div className="absolute h-full bg-primary" style={{ width: '60%' }}></div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rp {totalPaid.toLocaleString('id-ID')},00</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rp {totalUnpaid.toLocaleString('id-ID')},00</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Pending / Draft</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rp 0,00</div>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader>
                    <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rp 0,00</div>
                </CardContent>
            </Card>
        </div>
  
        <Card>
            <CardContent className="pt-6">
                <Tabs defaultValue="all">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold">Invoices</h2>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button variant="outline">Buat SPD dari Pilihan</Button>
                           <Button><Plus className="mr-2 h-4 w-4"/> New Invoice</Button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All Invoices <Badge variant="secondary" className="ml-2">2</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">1</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">1</Badge></TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="search" placeholder="Search" className="pl-8" />
                        </div>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                    </div>
                    </div>
                    <TabsContent value="all">
                        <div className="mt-4 w-full overflow-auto">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox />
                                    </TableHead>
                                    <TableHead>INVOICE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>SO NUMBER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>CUSTOMER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>DATE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>AMOUNT <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>STATUS <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>NOMOR SPD <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoiceListData.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell className="font-medium">{invoice.id}</TableCell>
                                    <TableCell>{invoice.soNumber}</TableCell>
                                    <TableCell>{invoice.customer}</TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>Rp {invoice.amount.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <Badge variant={invoice.status === 'Paid' ? 'outline' : 'destructive'} 
                                        className={invoice.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                                            {invoice.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{invoice.spdNumber}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
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
  