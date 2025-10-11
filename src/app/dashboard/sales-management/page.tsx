
'use client';
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
  
  export default function SalesManagementPage() {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Customers</span>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">PT. Sejahtera Abadi</span>
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
              <Badge variant="secondary">1</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp1.0jt</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                OUTSTANDING (1)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Change Orders</CardTitle>
              <Badge variant="secondary">0</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp0.0jt</div>
              <p className="text-xs text-muted-foreground flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                TOTAL PAID (0)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <Badge variant="secondary">1</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp1.0jt</div>
              <p className="text-xs text-muted-foreground flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                INVOICED (1)
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

                <div className="rounded-lg border p-4">
                    <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <div className="font-medium text-muted-foreground">NO. SO</div>
                            <div className="font-medium">SO-2024-001</div>
                            <div className="font-medium text-muted-foreground">NO. PO</div>
                            <div>-</div>
                        </div>
                         <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <div>
                            <div className="text-xs text-muted-foreground">Customer</div>
                            <div className="font-medium">PT. Sejahtera Abadi</div>
                        </div>
                         <div>
                            <div className="text-xs text-muted-foreground">Sales</div>
                            <div className="font-medium">Budi</div>
                        </div>
                    </div>
                    <Badge variant="destructive" className="mt-2">UNPAID</Badge>
                    <div className="flex justify-between items-end mt-4">
                        <div>
                            <div className="text-xs text-muted-foreground">Nilai Pembayaran</div>
                            <div className="font-medium">Rp 0</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Nilai Invoice</div>
                            <div className="font-medium">Rp 1.000.000</div>
                        </div>
                    </div>
                    <div className="border-t my-4"></div>
                     <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div>
                            <div className="text-muted-foreground">No. Invoice</div>
                            <div className="font-medium">INV/2024/001</div>
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
                            <div className="font-medium">11/05/2024</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Jatuh Tempo</div>
                            <div className="font-medium">10/06/2024</div>
                        </div>
                    </div>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to 1 of 1 entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  