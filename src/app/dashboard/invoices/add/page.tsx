
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from '@/components/ui/command';
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
  ChevronsUpDown,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { type InvoiceNumber, invoiceNumberData, salesOrderListData, customerListData, type Customer, productListData, type ProductListItem, invoiceListData, type Invoice } from '@/app/lib/data';
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
  const editInvoiceId = searchParams.get('editInvoiceId');

  const [invoiceNumberDataState, setInvoiceNumberDataState] = useState<InvoiceNumber | undefined>(undefined);
  const [isInvoiceNumberLoading, setIsInvoiceNumberLoading] = useState(!!invoiceNumberId || !!editInvoiceId);
  
  const isLoading = isInvoiceNumberLoading;

  const [invoiceId, setInvoiceId] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customer, setCustomer] = useState<Customer | undefined>(undefined);

  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'sent' | 'draft'>('draft');
  const [printType, setPrintType] = useState<'original' | 'copy'>('original');

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiation, setNegotiation] = useState<number | string>(0);
  
  const [dpPercent, setDpPercent] = useState<string | number>('');
  const [dpValue, setDpValue] = useState<string | number>('');
  
  const [dpPelunasanPercent, setDpPelunasanPercent] = useState<string | number>('');
  const [pelunasan, setPelunasan] = useState<string | number>('');

  const [grandTotal, setGrandTotal] = useState(0);
  const [dppVat, setDppVat] = useState(0);
  const [vat12, setVat12] = useState(0);

  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState<number | null>(null);
  const uniqueSalesOrders = Array.from(new Set(salesOrderListData.map(item => item.soNumber)));

  useEffect(() => {
    if (invoiceNumberId) {
      setIsInvoiceNumberLoading(true);
      setTimeout(() => {
        const foundInvoice = invoiceNumberData.find(inv => inv.id.replace(/\//g, '_') === invoiceNumberId);
        setInvoiceNumberDataState(foundInvoice);
        setIsInvoiceNumberLoading(false);
      }, 500);
    } else if (editInvoiceId) {
      setIsInvoiceNumberLoading(true);
      setTimeout(() => {
        const decodedId = editInvoiceId.replace(/_/g, '/');
        const foundInvoice = invoiceListData.find(inv => inv.id === decodedId);
        if (foundInvoice) {
            setInvoiceId(foundInvoice.id);
            setSoNumber(foundInvoice.soNumber);
            setPoNumber(foundInvoice.poNumber);
            setStatus(foundInvoice.status);
            
            const foundCustomer = customerListData.find(c => c.name === foundInvoice.customer);
            setCustomer(foundCustomer);

            if (foundInvoice.date) {
                setIssueDate(new Date(foundInvoice.date));
            }

            if(foundInvoice.soNumber) {
                const soItems = salesOrderListData.filter(so => so.soNumber === foundInvoice.soNumber);
                 if (soItems.length > 0) {
                    const newItems: InvoiceItem[] = soItems.map((item, index) => ({
                        id: Date.now() + index,
                        name: item.productName,
                        quantity: item.quantity,
                        unit: item.unit,
                        price: item.price,
                        total: item.quantity * item.price,
                    }));
                    setItems(newItems);
                }
            }
        }
        setIsInvoiceNumberLoading(false);
      }, 500);
    }
  }, [invoiceNumberId, editInvoiceId]);


  useEffect(() => {
    if (invoiceNumberDataState) {
      setInvoiceId(invoiceNumberDataState.id);
      
      // Pre-fill SO and customer if they exist
      if (invoiceNumberDataState.salesOrder) {
        handleSoSelect(invoiceNumberDataState.salesOrder);
      } else {
        const foundCustomer = customerListData.find(c => c.name === invoiceNumberDataState.customer);
        setCustomer(foundCustomer);
      }

      if (invoiceNumberDataState.date) {
        const parts = invoiceNumberDataState.date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            setIssueDate(new Date(`${year}-${month}-${day}`));
        }
      }
    }
  }, [invoiceNumberDataState]);
  
  const handleSoSelect = (selectedSo: string) => {
    setSoNumber(selectedSo);

    const soItems = salesOrderListData.filter(so => so.soNumber === selectedSo);
    if (soItems.length > 0) {
        const newItems: InvoiceItem[] = soItems.map((item, index) => ({
            id: Date.now() + index,
            name: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            total: item.quantity * item.price,
        }));
        setItems(newItems);

        const soCustomerName = soItems[0].customer;
        const foundCustomer = customerListData.find(c => c.name === soCustomerName);
        setCustomer(foundCustomer);
    } else {
        setItems([]);
        setCustomer(undefined);
    }
    setSoPopoverOpen(false);
  }

  const handleCustomerSelect = (customerName: string) => {
    const foundCustomer = customerListData.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    setCustomer(foundCustomer);
    setCustomerPopoverOpen(false);
  }

  useEffect(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + item.total, 0);
    setSubtotal(currentSubtotal);
  
    const numericNegotiation = typeof negotiation === 'string' && negotiation !== '' ? parseFormattedNumber(negotiation) : (typeof negotiation === 'number' ? negotiation : 0);
    
    const baseForCalculations = currentSubtotal - numericNegotiation;
  
    // DP Calculation
    const numericDpPercent = typeof dpPercent === 'string' && dpPercent !== '' ? parseFloat(dpPercent.toString()) : (typeof dpPercent === 'number' ? dpPercent : 0);
    let numericDpValue = typeof dpValue === 'string' && dpValue !== '' ? parseFormattedNumber(dpValue) : (typeof dpValue === 'number' ? dpValue : 0);
    
    if (numericDpPercent > 0 && (dpValue === '' || dpValue === 0)) {
      const calculatedDp = baseForCalculations * (numericDpPercent / 100);
      setDpValue(formatNumberWithCommas(calculatedDp));
      numericDpValue = calculatedDp;
    }
  
    // Pelunasan Calculation
    const numericPelunasanPercent = typeof dpPelunasanPercent === 'string' && dpPelunasanPercent !== '' ? parseFloat(dpPelunasanPercent.toString()) : (typeof dpPelunasanPercent === 'number' ? dpPelunasanPercent : 0);
    let numericPelunasan = typeof pelunasan === 'string' && pelunasan !== '' ? parseFormattedNumber(pelunasan) : (typeof pelunasan === 'number' ? pelunasan : 0);
  
    if (numericPelunasanPercent > 0 && (pelunasan === '' || pelunasan === 0)) {
        const calculatedPelunasan = baseForCalculations * (numericPelunasanPercent / 100);
        setPelunasan(formatNumberWithCommas(calculatedPelunasan));
        numericPelunasan = calculatedPelunasan;
    }
  
    const currentGrandTotal = baseForCalculations - numericDpValue - numericPelunasan;
    setGrandTotal(currentGrandTotal);
    
    const currentDppVat = currentGrandTotal / 1.12;
    setDppVat(currentDppVat);
    
    const currentVat12 = currentDppVat * 0.12;
    setVat12(currentVat12);
  
  }, [items, negotiation, dpPercent, dpValue, dpPelunasanPercent, pelunasan]);

  
  const handleSaveInvoice = async (invoiceStatus: 'draft' | 'sent' | 'paid' | 'unpaid' = 'draft') => {
    if (!invoiceId || !customer || !issueDate) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill in Invoice No, Customer, and Issue Date.",
        });
        return;
    }

    const newInvoice: Invoice = {
        id: invoiceId,
        soNumber: soNumber,
        poNumber: poNumber,
        customer: customer.name,
        date: format(issueDate, 'yyyy-MM-dd'),
        amount: grandTotal + vat12,
        status: invoiceStatus,
        spdNumber: '-', // Default value
    };
    
    // Check if invoice with the same ID already exists
    const existingInvoiceIndex = invoiceListData.findIndex(inv => inv.id === newInvoice.id);

    if (existingInvoiceIndex !== -1) {
        // Update existing invoice
        invoiceListData[existingInvoiceIndex] = newInvoice;
    } else {
        // Add new invoice to the beginning of the list
        invoiceListData.unshift(newInvoice);
    }

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
            const quantity = field === 'quantity' ? (typeof value === 'string' ? parseFormattedNumber(value) : value) : item.quantity;
            const price = field === 'price' ? (typeof value === 'string' ? parseFormattedNumber(value) : value) : item.price;
            updatedItem.total = quantity * price;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };
  
  const handleProductSelect = (itemId: number, product: ProductListItem) => {
    const newItems = items.map(item => {
        if (item.id === itemId) {
            return {
                ...item,
                name: product.name,
                unit: product.unit,
                price: product.price,
                total: item.quantity * product.price,
            };
        }
        return item;
    });
    setItems(newItems);
    setProductPopoverOpen(null);
  };
  
  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<string | number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseFormattedNumber(value);
    if (!isNaN(parsedValue)) {
        setter(formatNumberWithCommas(parsedValue));
    } else if (value === '') {
        setter('');
    }
  };

  const handleNumericItemChange = (id: number, field: 'quantity' | 'price', value: string) => {
    const parsedValue = parseFormattedNumber(value);
    if (!isNaN(parsedValue)) {
        const newItems = items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: parsedValue };
                updatedItem.total = updatedItem.quantity * updatedItem.price;
                return updatedItem;
            }
            return item;
        });
        setItems(newItems);
    } else if (value === '') {
         const newItems = items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: 0 };
                updatedItem.total = updatedItem.quantity * updatedItem.price;
                return updatedItem;
            }
            return item;
        });
        setItems(newItems);
    }
  };


  const handleRemoveItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };
  
  const handlePreview = () => {
    const previewData = {
      id: invoiceId,
      soNumber,
      poNumber,
      customer,
      date: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      amount: grandTotal + vat12,
      status,
      printType,
      items: items.map((item, index) => ({
        no: index + 1,
        item: item.name,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        amount: item.total,
        total: item.total
      })),
      subtotal,
      dppVat,
      vat12,
      negotiation: typeof negotiation === 'string' ? parseFormattedNumber(negotiation) : negotiation,
      dpPercent,
      dpValue: typeof dpValue === 'string' ? parseFormattedNumber(dpValue) : dpValue,
      dpPelunasanPercent,
      pelunasan: typeof pelunasan === 'string' ? parseFormattedNumber(pelunasan) : pelunasan,
      grandTotal,
    };
    sessionStorage.setItem('invoicePreviewData', JSON.stringify(previewData));
    router.push(`/dashboard/invoices/preview/${encodeURIComponent(invoiceId || 'new')}`);
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
  
  const pageTitle = editInvoiceId ? "Edit Invoice" : "Create Invoice";

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
          {pageTitle}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <div className="lg:col-span-5">
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Invoice No.</label>
                <Input value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!!editInvoiceId || !!invoiceNumberId} />
              </div>
              <div>
                <label className="text-sm font-medium">SO/Sales Order</label>
                <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={soPopoverOpen}
                        className="w-full justify-between"
                        >
                        {soNumber
                            ? uniqueSalesOrders.find((so) => so.toLowerCase() === soNumber.toLowerCase())
                            : "Search SO..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Search sales order..." />
                            <CommandList>
                                <CommandEmpty>No sales order found.</CommandEmpty>
                                <CommandGroup>
                                    {uniqueSalesOrders.map((so) => (
                                    <CommandItem
                                        key={so}
                                        value={so}
                                        onSelect={(currentValue) => handleSoSelect(currentValue.toUpperCase())}
                                    >
                                        <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            soNumber.toLowerCase() === so.toLowerCase() ? "opacity-100" : "opacity-0"
                                        )}
                                        />
                                        {so}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">No. PO</label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Payment</label>
                <Input placeholder="e.g. Bank Transfer" />
              </div>
              <div className="lg:col-span-2">
                 <label className="text-sm font-medium">Bill To</label>
                 <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerPopoverOpen}
                            className="w-full justify-between"
                        >
                            {customer?.name ?? "Search for a customer..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                        <Command>
                            <CommandInput placeholder="Search customer..." />
                            <CommandList>
                                <CommandEmpty>No customer found.</CommandEmpty>
                                <CommandGroup>
                                    {customerListData.map((c) => (
                                    <CommandItem
                                        key={c.id}
                                        value={c.name}
                                        onSelect={(currentValue) => handleCustomerSelect(currentValue)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                customer?.name.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {c.name}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                 </Popover>
                 {customer && (
                    <div className="mt-2 p-2 border rounded-md bg-muted text-sm text-muted-foreground">
                        <p>{customer.address}</p>
                        <p>{customer.spdAddress}</p>
                    </div>
                 )}
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
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[100px]">Unit</TableHead>
                    <TableHead className="w-[150px]">Price</TableHead>
                    <TableHead className="w-[150px] text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                        <Popover open={productPopoverOpen === item.id} onOpenChange={(isOpen) => setProductPopoverOpen(isOpen ? item.id : null)}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between font-normal"
                                >
                                    {item.name || "Search for a product..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search product..." />
                                    <CommandList>
                                        <CommandEmpty>No product found.</CommandEmpty>
                                        <CommandGroup>
                                            {productListData.map((product) => (
                                                <CommandItem
                                                    key={product.name}
                                                    value={product.name}
                                                    onSelect={() => handleProductSelect(item.id, product)}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            item.name.toLowerCase() === product.name.toLowerCase() ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {product.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="text" 
                        value={formatNumberWithCommas(item.quantity)}
                        onChange={(e) => handleNumericItemChange(item.id, 'quantity', e.target.value)}
                        className="text-right w-24" 
                      />
                    </TableCell>
                    <TableCell>
                        <Input 
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                            className="w-24"
                        />
                    </TableCell>
                    <TableCell>
                      <Input 
                        placeholder="Rp 0,00"
                        value={formatNumberWithCommas(item.price)}
                        onChange={(e) => handleNumericItemChange(item.id, 'price', e.target.value)}
                        className="text-right w-36"
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
                           placeholder="e.g. 10.000"
                           value={negotiation}
                           onChange={handleNumericInputChange(setNegotiation)}
                        />
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP (%):</span>
                        <Input 
                          className="h-8 w-28 text-right" 
                          placeholder="e.g. 20"
                          value={dpPercent}
                          onChange={(e) => setDpPercent(e.target.value)}
                        />
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP Value:</span>
                        <Input 
                          className="h-8 w-28 text-right" 
                          placeholder="Override value"
                          value={dpValue}
                          onChange={handleNumericInputChange(setDpValue)}
                        />
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DP Pelunasan (%):</span>
                        <Input 
                          className="h-8 w-28 text-right" 
                          placeholder="e.g. 10"
                          value={dpPelunasanPercent}
                          onChange={(e) => setDpPelunasanPercent(e.target.value)}
                          />
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">Pelunasan:</span>
                         <Input 
                           className="h-8 w-28 text-right" 
                           placeholder="e.g. 50.000"
                           value={pelunasan}
                           onChange={handleNumericInputChange(setPelunasan)}
                           />
                    </div>
                     <div className="flex justify-between items-center py-1 font-bold">
                        <span className="text-sm">Grand Total:</span>
                        <span className="text-sm">Rp {formatNumberWithCommas(grandTotal)}</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">DPP VAT:</span>
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(dppVat)}</span>
                    </div>
                     <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">VAT 12%:</span>
                        <span className="text-sm font-medium">Rp {formatNumberWithCommas(vat12)}</span>
                    </div>
                     <div className="flex justify-between items-center py-2 mt-2 border-t">
                        <span className="text-base font-bold">Total:</span>
                        <span className="text-base font-bold">Rp {formatNumberWithCommas(grandTotal + vat12)}</span>
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
                <Button variant="outline" className="w-full" onClick={handlePreview}>
                    <Eye className="mr-2 h-4 w-4" /> Preview
                </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice('draft')}>
                Save
              </Button>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={(value) => setStatus(value as 'paid' | 'unpaid' | 'sent' | 'draft')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Print Type</label>
                <Select value={printType} onValueChange={(value) => setPrintType(value as 'original' | 'copy')}>
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
