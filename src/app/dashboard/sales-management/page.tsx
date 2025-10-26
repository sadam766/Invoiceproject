
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Calendar, ChevronRight, Edit, Search, ArrowUpDown, List, LayoutGrid, Plus, MoreVertical } from 'lucide-react';
  import { AddDocumentDialog } from './_components/add-document-dialog';
  import { salesListData, invoiceListData, type SalesListItem, type Invoice } from '@/app/lib/data';

  type SaleDetails = {
    totalEstimates: number;
    totalEstimatesCount: number;
    totalPaid: number;
    totalPaidCount: number;
    totalInvoiced: number;
    totalInvoicedCount: number;
    relatedInvoices: Invoice[];
  }

  export default function SalesManagementPage() {
    const router = useRouter();
    const [selectedSale, setSelectedSale] = useState<SalesListItem | null>(null);
    const [details, setDetails] = useState<SaleDetails | null>(null);

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('salesPreviewData');
        if (dataFromSession) {
            const sale = JSON.parse(dataFromSession);
            setSelectedSale(sale);

            const relatedInvoices = invoiceListData.filter(
                inv => inv.soNumber === sale.soNumber
            );
            
            const totalEstimates = relatedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            const totalPaid = relatedInvoices
                .filter(inv => inv.status === 'paid')
                .reduce((sum, inv) => sum + inv.amount, 0);
            
            setDetails({
                totalEstimates: totalEstimates,
                totalEstimatesCount: relatedInvoices.length,
                totalPaid: totalPaid,
                totalPaidCount: relatedInvoices.filter(inv => inv.status === 'paid').length,
                totalInvoiced: totalEstimates,
                totalInvoicedCount: relatedInvoices.length,
                relatedInvoices: relatedInvoices,
            });
        }
    }, []);

    if (!selectedSale || !details) {
        return (
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                <div className="text-center text-muted-foreground">
                    Loading sale details or no sale selected. Please go back to the <a href="/dashboard/sales" className="underline">Sales page</a> and preview a sale.
                </div>
            </main>
        );
    }
    
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <a href="/dashboard/customers" className="hover:underline">Customers</a>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedSale.customer}</span>
            </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>All Time</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Last 30 Days</DropdownMenuItem>
                <DropdownMenuItem>Last 90 Days</DropdownMenuItem>
                <DropdownMenuItem>Last Year</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline">VIEW STATEMENT</Button>
            <Button className="bg-slate-800 hover:bg-slate-900">
              <Edit className="mr-2 h-4 w-4" />
              EDIT CUSTOMER DETAILS
            </Button>
          </div>
        </div>
  
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Estimates</CardTitle>
              <Badge variant="secondary">{details.totalEstimatesCount}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {details.totalEstimates.toLocaleString('id-ID')}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                OUTSTANDING ({details.totalInvoicedCount - details.totalPaidCount})
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Change Orders</CardTitle>
              <Badge variant="secondary">{details.totalPaidCount}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {details.totalPaid.toLocaleString('id-ID')}</div>
              <p className="text-xs text-muted-foreground flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                TOTAL PAID ({details.totalPaidCount})
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <Badge variant="secondary">{details.totalInvoicedCount}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {details.totalInvoiced.toLocaleString('id-ID')}</div>
              <p className="text-xs text-muted-foreground flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                INVOICED ({details.totalInvoicedCount})
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search documents" className="pl-8" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select>
                            <SelectTrigger className="w-[120px]">
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="amount">Amount</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-background shadow-sm">
                                <List className="h-4 w-4"/>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <LayoutGrid className="h-4 w-4"/>
                            </Button>
                        </div>
                        <AddDocumentDialog />
                    </div>
                </div>

                {details.relatedInvoices.map(invoice => (
                    <div className="rounded-lg border p-4 mb-4" key={invoice.id}>
                        <div className="flex justify-between items-start">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                <div className="font-medium text-muted-foreground">NO. SO</div>
                                <div className="font-medium">{invoice.soNumber}</div>
                                <div className="font-medium text-muted-foreground">NO. PO</div>
                                <div>{selectedSale.poNumber}</div>
                            </div>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <div>
                                <div className="text-xs text-muted-foreground">Customer</div>
                                <div className="font-medium">{invoice.customer}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Sales</div>
                                <div className="font-medium">{selectedSale.sales}</div>
                            </div>
                        </div>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'} className="mt-2 capitalize">{invoice.status}</Badge>
                        <div className="flex justify-between items-end mt-4">
                            <div>
                                <div className="text-xs text-muted-foreground">Nilai Pembayaran</div>
                                <div className="font-medium">Rp {invoice.status === 'paid' ? invoice.amount.toLocaleString('id-ID') : 0}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Nilai Invoice</div>
                                <div className="font-medium">Rp {invoice.amount.toLocaleString('id-ID')}</div>
                            </div>
                        </div>
                        <div className="border-t my-4"></div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                            <div>
                                <div className="text-muted-foreground">No. Invoice</div>
                                <div className="font-medium">{invoice.id}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">No. Faktur Pajak</div>
                                <div>-</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Tgl. Faktur Pajak</div>
                                <div>-</div>
                            </div>
                            <div>
                                <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">APPROVED</Badge>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Tanggal Invoice</div>
                                <div className="font-medium">{invoice.date}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Jatuh Tempo</div>
                                <div className="font-medium">N/A</div>
                            </div>
                        </div>
                    </div>
                ))}
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {details.relatedInvoices.length} of {details.relatedInvoices.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  
