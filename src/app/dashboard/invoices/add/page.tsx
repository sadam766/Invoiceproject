
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
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Send,
  Settings,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { type InvoiceNumber, invoiceNumberData, salesOrderListData } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type InvoiceItem = {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
};

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const invoiceNumberId = searchParams.get('invoiceNumberId');

  const [invoiceNumberDataState, setInvoiceNumberDataState] = useState<InvoiceNumber | undefined>(undefined);
  const [isInvoiceNumberLoading, setIsInvoiceNumberLoading] = useState(!!invoiceNumberId);
  
  const isLoading = isInvoiceNumberLoading;

  const [invoiceId, setInvoiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState('draft');

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiation, setNegotiation] = useState(0);
  const [dpPercent, setDpPercent] = useState(0);
  const [dpValue, setDpValue] = useState(0);
  const [dpPelunasanPercent, setDpPelunasanPercent] = useState(0);
  const [pelunasan, setPelunasan] = useState(0);
  const [goods, setGoods] = useState(0);
  const [dppVat, setDppVat] = useState(0);
  const [vat12, setVat12] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    if (invoiceNumberId) {
      setIsInvoiceNumberLoading(true);
      // Simulate fetching data
      setTimeout(() => {
        const foundInvoice = invoiceNumberData.find(inv => inv.id.replace(/\//g, '_') === invoiceNumberId);
        setInvoiceNumberDataState(foundInvoice);
        setIsInvoiceNumberLoading(false);
      }, 500);
    }
  }, [invoiceNumberId]);


  useEffect(() => {
    if (invoiceNumberDataState) {
      setInvoiceId(invoiceNumberDataState.id);
      setCustomerName(invoiceNumberDataState.customer);
      setSoNumber(invoiceNumberDataState.salesOrder);
      if (invoiceNumberDataState.date) {
        // Assuming date is dd/MM/yyyy
        const parts = invoiceNumberDataState.date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            setIssueDate(new Date(`${year}-${month}-${day}`));
        }
      }
      // Populate items from sales order data
      const relatedItems = salesOrderListData.filter(so => so.soNumber === invoiceNumberDataState.salesOrder);
      const newItems: InvoiceItem[] = relatedItems.map((item, index) => ({
          id: Date.now() + index,
          name: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          total: item.quantity * item.price,
      }));
      setItems(newItems);
    }
  }, [invoiceNumberDataState]);

  useEffect(() => {
    const newSubtotal = items.reduce((acc, item) => acc + item.total, 0);
    setSubtotal(newSubtotal);

    const newGoods = newSubtotal - negotiation;
    setGoods(newGoods);

    const newDppVat = newGoods * 11 / 12;
    setDppVat(newDppVat);
    
    const newVat12 = newDppVat * 0.12;
    setVat12(newVat12);

    setGrandTotal(newGoods);

  }, [items, negotiation]);

  
  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' = 'draft') => {
    toast({
      title: "Invoice Saved",
      description: `Invoice ${invoiceId} has been successfully saved as ${invoiceStatus}.`,
    });
    router.push('/dashboard/invoices');
  };

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), name: '', quantity: 1, unit: 'pcs', price: 0, total: 0 }]);
  };

  const handleItemChange = (id: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
            const quantity = field === 'quantity' ? Number(value) : item.quantity;
            const price = field === 'price' ? Number(value) : item.price;
            updatedItem.total = quantity * price;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };
  
  const handleNumericItemChange = (id: number, field: 'quantity' | 'price', value: string) => {
    const parsedValue = parseFormattedNumber(value);
    if (!isNaN(parsedValue) || value === '') {
        handleItemChange(id, field, value === '' ? 0 : parsedValue);
    }
  };


  const handleRemoveItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };


  if (isLoading && !invoiceNumberDataState) {
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
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input 
                        placeholder="Search for a product..." 
                        value={item.name} 
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} 
                       />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="text" 
                        value={formatNumberWithCommas(item.quantity)}
                        onChange={(e) => handleNumericItemChange(item.id, 'quantity', e.target.value)}
                        className="w-16" 
                      />
                    </TableCell>
                    <TableCell>
                        <Input 
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                            className="w-20"
                        />
                    </TableCell>
                    <TableCell>
                      <Input 
                        placeholder="Rp 0,00"
                        value={formatNumberWithCommas(item.price)}
                        onChange={(e) => handleNumericItemChange(item.id, 'price', e.target.value)}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">Rp {formatNumberWithCommas(item.total)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" className="mt-4" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" /> Add item
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-4">
                <div className="lg:col-start-3 lg:col-span-2">
                    <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">Subtotal:</span>
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">A/Negotiation:</span>
                        <Input 
                           className="h-8 w-28 text-right" 
                           placeholder="e.g. -10.000"
                           value={formatNumberWithCommas(negotiation)}
                           onChange={(e) => setNegotiation(parseFormattedNumber(e.target.value) || 0)}
                        />
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
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(goods)}</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DPP VAT (11/12):</span>
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(dppVat)}</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">VAT 12%:</span>
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(vat12)}</span>
                    </div>
                     <div className="flex justify-between items-center py-2 mt-2 border-t">
                        <span className="text-base font-bold">Total:</span>
                        <span className="text-base font-bold">Rp {formatNumberWithCommas(grandTotal)}</span>
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
              <Link href={`/dashboard/invoices/preview/${encodeURIComponent(invoiceId)}`} passHref>
                <Button variant="outline" className="w-full">
                    <Eye className="mr-2 h-4 w-4" /> Preview
                </Button>
              </Link>
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

    