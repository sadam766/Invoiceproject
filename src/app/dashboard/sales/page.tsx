
'use client';
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
  import { Checkbox } from '@/components/ui/checkbox';
  import { salesListData } from '@/app/lib/data';
  import { Search, Filter, MoreHorizontal, ArrowUpDown, Plus, Upload, Download } from 'lucide-react';
  import { AddSaleDialog } from './_components/add-sale-dialog';
  
  export default function SalesListPage() {
    const totalFiltered = salesListData.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = salesListData.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
    const totalUnpaid = salesListData.filter(item => item.status === 'Unpaid').reduce((sum, item) => sum + item.amount, 0);
  
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Overview</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="lg:col-span-2 bg-blue-50/50 border-blue-200 shadow-sm relative overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-blue-900/80">Total (Filtered)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-blue-950">Rp {totalFiltered.toLocaleString('id-ID')},00</div>
                </CardContent>
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-blue-100 to-transparent">
                   <div className="w-full h-full" style={{
                       background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(167,207,255,0.2) 50%, rgba(132,189,255,0.4) 100%)',
                       clipPath: 'polygon(0 80%, 30% 60%, 70% 85%, 100% 70%, 100% 100%, 0% 100%)'
                   }}>
                       <div className="w-full h-px bg-primary/50" style={{
                           position: 'absolute',
                           bottom: 'calc(20% + (85% - 70%) / 2)',
                           clipPath: 'polygon(0 80%, 30% 60%, 70% 85%, 100% 70%)'
                       }}></div>
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 h-10 w-full" style={{
                        backgroundImage: 'linear-gradient(to top, #DBEAFE, transparent)'
                   }}></div>
                   <svg width="100%" height="30" viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute bottom-0 left-0">
                       <path d="M 0 16 L 60 12 L 140 17 L 200 14" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none"></path>
                   </svg>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-4">
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
        </div>
  
        <Card>
            <CardContent className="pt-6">
                <Tabs defaultValue="all">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold">Sales</h2>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button variant="outline"><Upload className="mr-2 h-4 w-4"/> Import</Button>
                           <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                           <AddSaleDialog />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="all">All Sales <Badge variant="secondary" className="ml-2">96</Badge></TabsTrigger>
                        <TabsTrigger value="draft">Draft <Badge variant="secondary" className="ml-2">12</Badge></TabsTrigger>
                        <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-2">62</Badge></TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid <Badge variant="secondary" className="ml-2">17</Badge></TabsTrigger>
                        <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-2">5</Badge></TabsTrigger>
                        <TabsTrigger value="overdue">Overdue <Badge variant="secondary" className="ml-2">0</Badge></TabsTrigger>
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
                                    <TableHead>NUMBER SO <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>CUSTOMER <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>SALES <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>NO. PO <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>AMOUNT <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead>STATUS <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesListData.map((sale) => (
                                <TableRow key={sale.soNumber}>
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell className="font-medium">{sale.soNumber}</TableCell>
                                    <TableCell>{sale.customer}</TableCell>
                                    <TableCell>{sale.sales}</TableCell>
                                    <TableCell>{sale.poNumber}</TableCell>
                                    <TableCell>Rp {sale.amount.toLocaleString('id-ID')},00</TableCell>
                                    <TableCell>
                                        <Badge variant={sale.status === 'Paid' ? 'outline' : 'destructive'} 
                                        className={sale.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                                            {sale.status}
                                        </Badge>
                                        {sale.paidDate && <div className="text-xs text-muted-foreground">on: {sale.paidDate}</div>}
                                    </TableCell>
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
  