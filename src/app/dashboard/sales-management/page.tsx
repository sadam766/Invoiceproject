'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
  } from '@/components/ui/card';
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
  import { type SalesListItem, type Invoice, type TaxInvoice } from '@/app/lib/data';
  import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
  import { collection, query } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  
  type DocumentView = 'grid' | 'list';

  type MergedDocument = SalesListItem & {
    invoice?: Invoice;
    taxInvoice?: TaxInvoice;
  };

  export default function SalesManagementPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<DocumentView>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('soNumber-desc');

    const firestore = useFirestore();
    const { user } = useUser();

    // Fetch all necessary data collections
    const salesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sales'));
    }, [firestore]);
    const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);
    
    const taxInvoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'taxInvoices'));
    }, [firestore]);
    const { data: taxInvoiceList, isLoading: isTaxInvoicesLoading } = useCollection<TaxInvoice>(taxInvoicesCollection);
    
    const isLoading = isSalesLoading || isInvoicesLoading || isTaxInvoicesLoading;

    const mergedDocuments = useMemo((): MergedDocument[] => {
        if (!salesList || !invoiceList || !taxInvoiceList) return [];

        let docs = salesList.map(sale => {
            const invoice = invoiceList.find(inv => inv.soNumber === sale.soNumber);
            const taxInvoice = invoice ? taxInvoiceList.find(ti => ti.invoiceNumber === invoice.id) : undefined;
            return {
                ...sale,
                invoice,
                taxInvoice,
            };
        });

        // Search Filter
        if (searchQuery) {
            docs = docs.filter(doc =>
                doc.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (doc.invoice?.id && doc.invoice.id.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // Sorting Logic
        const [key, direction] = sortOption.split('-');
        docs.sort((a, b) => {
            let valA, valB;
            if (key === 'amount') {
                valA = a.amount;
                valB = b.amount;
            } else { // Default to soNumber
                valA = a.soNumber;
                valB = b.soNumber;
            }

            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;
            
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });


        return docs;
    }, [salesList, invoiceList, taxInvoiceList, searchQuery, sortOption]);
    
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search documents" 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={sortOption} onValueChange={setSortOption}>
                            <SelectTrigger className="w-[180px]">
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="soNumber-desc">SO Number (Desc)</SelectItem>
                                <SelectItem value="soNumber-asc">SO Number (Asc)</SelectItem>
                                <SelectItem value="amount-desc">Amount (Desc)</SelectItem>
                                <SelectItem value="amount-asc">Amount (Asc)</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                            <Button 
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4"/>
                            </Button>
                            <Button 
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4"/>
                            </Button>
                        </div>
                        <AddDocumentDialog />
                    </div>
                </div>

                {isLoading && <div className="text-center p-8">Loading documents...</div>}

                {!isLoading && viewMode === 'grid' && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mergedDocuments.map((doc) => (
                            <Card key={doc.soNumber} className="flex flex-col">
                                <CardHeader className="flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base font-bold">{doc.soNumber}</CardTitle>
                                    <Badge variant={doc.status === 'Paid' ? 'outline' : 'destructive'} className={cn(doc.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200', "capitalize")}>{doc.status}</Badge>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{doc.customer}</p>
                                    <p className="text-xs text-muted-foreground">{doc.sales}</p>
                                    <div className="my-3 border-t border-dashed" />
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">PO Number:</span>
                                            <span className="font-medium">{doc.poNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Amount:</span>
                                            <span className="font-medium">Rp {doc.amount.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Invoice:</span>
                                            <span className="font-medium">{doc.invoice?.id || 'Not Invoiced'}</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tax Invoice:</span>
                                            <span className="font-medium">{doc.taxInvoice?.taxInvoiceNumber || '-'}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/50 p-3 flex justify-end">
                                     <Button variant="ghost" size="sm">View Details</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
                
                {!isLoading && viewMode === 'list' && (
                    <div className="w-full overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SO Number</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice ID</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {mergedDocuments.map((doc) => (
                                    <tr key={doc.soNumber}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{doc.soNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{doc.customer}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">Rp {doc.amount.toLocaleString('id-ID')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Badge variant={doc.status === 'Paid' ? 'outline' : 'destructive'} className={cn(doc.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200', "capitalize")}>{doc.status}</Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{doc.invoice?.id || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {!isLoading && (
                    <div className="text-sm text-muted-foreground mt-4">
                        Showing 1 to {mergedDocuments.length} of {mergedDocuments.length} entries
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    );
  }
