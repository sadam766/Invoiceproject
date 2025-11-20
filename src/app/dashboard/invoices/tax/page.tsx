
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
import { type TaxInvoice } from '@/app/lib/data';
import { Search, Upload, Download, Filter, ArrowUpDown } from 'lucide-react';
import { AddTaxInvoiceDialog } from './_components/add-tax-invoice-dialog';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, importFromExcel } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, setDoc, writeBatch, query, where } from 'firebase/firestore';

export default function TaxInvoicePage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const taxInvoicesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'taxInvoices'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data, isLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);

    const filteredData = useMemo(() => {
        if (!data) return [];
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
        if (data) exportToExcel(data, 'tax-invoices');
        toast({ title: "Export Successful", description: "Tax invoice data has been exported to Excel." });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const importedData = await importFromExcel(file) as TaxInvoice[];
                const batch = writeBatch(firestore);
                importedData.forEach(item => {
                    const docRef = doc(firestore, 'taxInvoices', item.taxInvoiceNumber);
                    batch.set(docRef, { ...item, ownerId: user.uid });
                });
                await batch.commit();
                toast({
                    title: "Import Successful",
                    description: `${importedData.length} tax invoices imported successfully.`,
                });
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Import Error",
                    description: error.message || "Failed to import the Excel file.",
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
            <div className="text-3xl font-bold text-blue-950">Rp 0,00</div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Nilai Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 0,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Nilai (Kode 01)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 0,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total DPP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 0,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total PPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 0,00</div>
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
                <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{data?.length || 0}</Badge></TabsTrigger>
                <TabsTrigger value="approved">APPROVED <Badge variant="secondary" className="ml-2">{data?.filter(i=>i.status === 'APPROVED').length || 0}</Badge></TabsTrigger>
                <TabsTrigger value="cancelled">Dibatalkan <Badge variant="secondary" className="ml-2">{data?.filter(i=>i.status === 'Dibatalkan').length || 0}</Badge></TabsTrigger>
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
                    {isLoading && <TableRow><TableCell colSpan={7} className="text-center">Loading tax invoices...</TableCell></TableRow>}
                    {filteredData?.map((invoice) => (
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
                Showing 1 to {filteredData?.length || 0} of {data?.length || 0} entries
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
