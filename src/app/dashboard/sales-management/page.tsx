

'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
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
  import { collection, query, where } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  
  type DocumentView = 'grid' | 'list';

  type MergedDocument = SalesListItem & {
    invoice?: Invoice;
    taxInvoice?: TaxInvoice;
  };

  export default function SalesManagementPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<DocumentView>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('soNumber-desc');

    const firestore = useFirestore();
    const { user } = useUser();

    // Fetch all necessary data collections
    const salesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'sales'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: salesList, isLoading: isSalesLoading } = useCollection<SalesListItem>(salesCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'invoices'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: invoiceList, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesCollection);
    
    const taxInvoicesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'taxInvoices'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
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
                doc.invoice?.id.toLowerCase().includes(searchQuery.toLowerCase())
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
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });


        return docs;
    }, [salesList, invoiceList, taxInvoiceList, searchQuery, sortOption]);
    
    const GridView = ({ documents }: { documents: MergedDocument[] }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
                 <div className="rounded-lg border p-4" key={doc.soNumber}>
                    <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <div className="font-medium text-muted-foreground">NO. SO</div>
                            <div className="font-medium">{doc.soNumber}</div>
                            <div className="font-medium text-muted-foreground">NO. PO</div>
                            <div>{doc.poNumber || '-'}</div>
                        </div>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <div>
                            <div className="text-xs text-muted-foreground">Customer</div>
                            <div className="font-medium">{doc.customer}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Sales</div>
                            <div className="font-medium">{doc.sales}</div>
                        </div>
                    </div>
                    <Badge variant={doc.status === 'Paid' ? 'outline' : 'destructive'} className={cn("mt-2 capitalize", doc.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{doc.status}</Badge>
                    <div className="flex justify-between items-end mt-4">
                        <div>
                            <div className="text-xs text-muted-foreground">Nilai Pembayaran</div>
                            <div className="font-medium">Rp {(doc.status === 'Paid' ? doc.amount : 0).toLocaleString('id-ID')}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Nilai Invoice</div>
                            <div className="font-medium">Rp {doc.amount.toLocaleString('id-ID')}</div>
                        </div>
                    </div>
                    <div className="border-t my-4"></div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div>
                            <div className="text-muted-foreground">No. Invoice</div>
                            <div className="font-medium">{doc.invoice?.id || '-'}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">No. Faktur Pajak</div>
                            <div className="font-medium">{doc.taxInvoice?.taxInvoiceNumber || '-'}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Tanggal Invoice</div>
                            <div className="font-medium">{doc.invoice?.date ? new Date(doc.invoice.date).toLocaleDateString('id-ID') : '-'}</div>
                        </div>
                         <div>
                            <div className="text-muted-foreground">Jatuh Tempo</div>
                            <div className="font-medium">{doc.invoice?.date ? new Date(new Date(doc.invoice.date).setDate(new Date(doc.invoice.date).getDate() + 30)).toLocaleDateString('id-ID') : '-'}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
    
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

                {!isLoading && viewMode === 'grid' && <GridView documents={mergedDocuments} />}
                
                {/* Placeholder for List View */}
                {!isLoading && viewMode === 'list' && (
                    <div className="text-center p-8 text-muted-foreground">
                        List view is not yet implemented.
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

