
'use client';
import { useState, useMemo, useRef } from 'react';
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
import { taxInvoiceData, type TaxInvoice } from '@/app/lib/data';
import { Search, Upload, Download, Filter, ArrowUpDown } from 'lucide-react';
import { AddTaxInvoiceDialog } from './_components/add-tax-invoice-dialog';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, importFromExcel } from '@/lib/utils';

export default function TaxInvoicePage() {
    const [data, setData] = useState(taxInvoiceData);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const filteredData = useMemo(() => {
        let filtered = data;
        if (activeTab !== 'all') {
            filtered = data.filter(i => i.status.toLowerCase() === activeTab);
        }
        if (searchQuery) {
            filtered = filtered.filter(i =>
                Object.values(i).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        return filtered;
    }, [data, searchQuery, activeTab]);
    
    const handleExport = () => {
        exportToExcel(data, 'tax-invoices');
        toast({ title: "Export Successful", description: "Tax invoice data has been exported to Excel." });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const imported = await importFromExcel(file) as TaxInvoice[];
                setData(prev => [...prev, ...imported]);
                toast({
                    title: "Import Successful",
                    description: `${imported.length} tax invoices imported successfully.`,
                });
            } catch (error) {
                console.error("Error importing file:", error);
                toast({
                    variant: "destructive",
                    title: "Import Error",
                    description: "Failed to import the Excel file. Please check the file format.",
                });
            }
        }
    };


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ikhtisar Faktur Pajak</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-2 bg-blue-50/50 border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-900/80">Total Nilai Faktur (Filtered)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-950">Rp 1.008.000,00</div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Nilai Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 1.008.000,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Nilai (Kode 01)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 1.008.000,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total DPP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 900.000,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total PPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 108.000,00</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Tax Invoices</h2>
              </div>
              <div className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                 <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                 <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                 <Button variant="outline"><Filter className="mr-2 h-4 w-4"/> Filter Duplikat</Button>
                 <AddTaxInvoiceDialog />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{data.length}</Badge></TabsTrigger>
                <TabsTrigger value="approved">APPROVED <Badge variant="secondary" className="ml-2">{data.filter(i=>i.status === 'APPROVED').length}</Badge></TabsTrigger>
                <TabsTrigger value="cancelled">Dibatalkan <Badge variant="secondary" className="ml-2">{data.filter(i=>i.status === 'Dibatalkan').length}</Badge></TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Search" className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
              </div>
            </div>
            <TabsContent value={activeTab}>
              <div className="mt-4 w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"><Checkbox /></TableHead>
                      <TableHead>NPWP PEMBELI / IDENTITAS LAINNYA <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                      <TableHead>NAMA PEMBELI <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                      <TableHead>STATUS <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                      <TableHead>NOMOR FAKTUR PAJAK <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                      <TableHead>TANGGAL FAKTUR PAJAK <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                      <TableHead>NOMOR INVOICE <ArrowUpDown className="inline-block ml-2 h-4 w-4" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((invoice) => (
                      <TableRow key={invoice.taxInvoiceNumber}>
                        <TableCell><Checkbox /></TableCell>
                        <TableCell className="font-medium">{invoice.buyerNpwp}</TableCell>
                        <TableCell>{invoice.buyerName}</TableCell>
                        <TableCell>
                            <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">{invoice.status}</Badge>
                        </TableCell>
                        <TableCell>{invoice.taxInvoiceNumber}</TableCell>
                        <TableCell>{invoice.taxInvoiceDate}</TableCell>
                        <TableCell>{invoice.invoiceNumber}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                Showing 1 to {filteredData.length} of {data.length} entries
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
