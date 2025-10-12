
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Send,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { type InvoiceNumber } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const invoiceNumberId = searchParams.get('invoiceNumberId');

  const invoiceNumberDocRef = useMemoFirebase(() => {
    if (!firestore || !invoiceNumberId || !user) return null;
    return doc(firestore, 'invoiceNumbers', invoiceNumberId);
  }, [firestore, invoiceNumberId, user]);

  const { data: invoiceNumberData, isLoading: isInvoiceNumberLoading } = useDoc<InvoiceNumber>(invoiceNumberDocRef);
  
  const isLoading = isUserLoading || (!!invoiceNumberId && isInvoiceNumberLoading);

  const [invoiceId, setInvoiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState('draft');


  useEffect(() => {
    if (invoiceNumberData) {
      setInvoiceId(invoiceNumberData.id);
      setCustomerName(invoiceNumberData.customer);
      setSoNumber(invoiceNumberData.salesOrder);
      setTotalAmount(invoiceNumberData.amount);
      if (invoiceNumberData.date) {
        // Assuming date is dd/MM/yyyy
        const parts = invoiceNumberData.date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            setIssueDate(new Date(`${year}-${month}-${day}`));
        }
      }
    }
  }, [invoiceNumberData]);
  
  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' = 'draft') => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Firestore is not initialized.",
      });
      return;
    }

    const invoiceData = {
      id: invoiceId,
      customer: customerName,
      soNumber: soNumber,
      date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      amount: totalAmount,
      status: invoiceStatus,
      spdNumber: '-',
      createdAt: serverTimestamp(),
    };
    
    try {
      await addDoc(collection(firestore, 'invoices'), invoiceData);
      toast({
        title: "Invoice Saved",
        description: `Invoice ${invoiceId} has been successfully saved.`,
      });
      router.push('/dashboard/invoices');
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
      });
    }
  };


  if (isLoading) {
    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="flex items-center gap-4">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-6 w-32" />
            </div>
             <Card className="p-6">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                 </div>
             </Card>
        </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/invoices" passHref>
          <Button variant="outline" size="icon" className="h-7 w-7">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
        </Link>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Create Invoice
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <div className="lg:col-span-5">
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Invoice No.</label>
                <Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">SO/Sales Order</label>
                <Input placeholder="Search an SO..." value={soNumber} onChange={e => setSoNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">No. PO</label>
                <Input />
              </div>
              <div>
                <label className="text-sm font-medium">Payment</label>
                <Input placeholder="e.g. Bank Transfer" />
              </div>
              <div className="lg:col-span-2">
                <label className="text-sm font-medium">Bill To</label>
                <Input placeholder="Search for a customer..." value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Issue Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !issueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {issueDate ? (
                        format(issueDate, 'dd/MM/yyyy')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={issueDate}
                      onSelect={setIssueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? (
                        format(dueDate, 'dd/MM/yyyy')
                      ) : (
                        <span>mm/dd/yyyy</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-2/5">Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Input placeholder="Search for a product..." />
                    </TableCell>
                    <TableCell>
                      <Input type="number" defaultValue="1" className="w-16" />
                    </TableCell>
                    <TableCell>pcs</TableCell>
                    <TableCell>
                      <Input placeholder="Rp 0,00" />
                    </TableCell>
                    <TableCell className="text-right">Rp {totalAmount.toLocaleString('id-ID')},00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Add item
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-4">
                <div className="lg:col-start-3 lg:col-span-2">
                    <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">Subtotal:</span>
                        <span className="text-sm font-medium">Rp {totalAmount.toLocaleString('id-ID')},00</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">A/Negotiation:</span>
                        <Input className="h-8 w-28 text-right" placeholder="e.g. -10.000"/>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP (%):</span>
                        <Input className="h-8 w-28 text-right" placeholder="e.g. 20"/>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP Value:</span>
                        <Input className="h-8 w-28 text-right" placeholder="Override value"/>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP Pelunasan (%):</span>
                        <Input className="h-8 w-28 text-right" placeholder="e.g. 10"/>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">Pelunasan:</span>
                         <Input className="h-8 w-28 text-right" placeholder="e.g. 50.000"/>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">Goods:</span>
                        <span className="text-sm font-medium">Rp 0,00</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DPP VAT (11/12):</span>
                        <span className="text-sm font-medium">Rp 0,00</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-mutedforeground">VAT 12%:</span>
                        <span className="text-sm font-medium">Rp 0,00</span>
                    </div>
                     <div className="flex justify-between items-center py-2 mt-2 border-t">
                        <span className="text-base font-bold">Total:</span>
                        <span className="text-base font-bold">Rp {totalAmount.toLocaleString('id-ID')},00</span>
                    </div>
                </div>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleSaveInvoice('sent')}>
                  <Send className="mr-2 h-4 w-4" /> Send Invoice
                </Button>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" className="w-full">
                Preview
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice('draft')}>
                Save
              </Button>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Print Type</label>
                <Select defaultValue="original">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="copy">Copy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pembuat Invoice</label>
                <Input placeholder="Nama pembuat" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

    