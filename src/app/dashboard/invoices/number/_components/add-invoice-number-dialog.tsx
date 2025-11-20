
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Calendar as CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Calendar } from '@/components/ui/calendar';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { format } from 'date-fns';
import type { InvoiceNumber, Customer, SalesOrder } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';


type AddInvoiceNumberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (invoice: Omit<InvoiceNumber, 'id'> & {id: string}) => void;
  invoiceData?: InvoiceNumber;
  onAddClick: () => void;
  allInvoiceNumbers: InvoiceNumber[] | null;
};


export function AddInvoiceNumberDialog({ isOpen, onOpenChange, onSave, invoiceData, onAddClick, allInvoiceNumbers }: AddInvoiceNumberDialogProps) {
  const firestore = useFirestore();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [invoiceType, setInvoiceType] = useState<'sar' | 'kw'>('kw');
  const [isAutoNumber, setIsAutoNumber] = useState(true);
  
  const [prefix, setPrefix] = useState('');
  const [mainNumber, setMainNumber] = useState('');
  const [suffix, setSuffix] = useState('');
  
  const [fullInvoiceNumber, setFullInvoiceNumber] = useState('');
  
  const [salesOrder, setSalesOrder] = useState('');
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState<string | number>(0);

  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const { toast } = useToast();

  const customersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const salesOrdersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'salesOrders');
  }, [firestore]);
  const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);

  const uniqueSalesOrders = useMemo(() => {
    if (!salesOrderListData) return [];
    return Array.from(new Set(salesOrderListData.map(item => item.soNumber)))
  },[salesOrderListData]);

  const generateNextNumber = (type: 'sar' | 'kw') => {
    if (!allInvoiceNumbers) return;
    const currentYear = new Date().getFullYear();
    let nextNum = 1;

    const relevantNumbers = allInvoiceNumbers
      .map(inv => {
        const id = inv.id || '';
        let match;
        if (type === 'sar') {
          match = id.match(/^(?:SAR\/|SAR_)([0-9]+)/);
          if (match && match[1]) return parseInt(match[1], 10);
        } else { // kw
          match = id.match(/^KW\/([0-9]+)\//);
          if (match && match[1]) return parseInt(match[1], 10);
        }
        return 0;
      })
      .filter(num => !isNaN(num) && num > 0);

    if (relevantNumbers.length > 0) {
      nextNum = Math.max(...relevantNumbers) + 1;
    }
  
    if (type === 'sar') {
        setPrefix('SAR/');
        setSuffix('');
        setMainNumber(nextNum.toString());
    } else { // kw
        setPrefix('KW/');
        setSuffix(`/KEU/${currentYear}`);
        setMainNumber(nextNum.toString().padStart(4, '0'));
    }
  };
  
  // This effect runs only when the dialog opens.
  useEffect(() => {
    if (!isOpen) {
      return; // Do nothing if dialog is closed
    }

    if (invoiceData) {
      // ===== EDIT MODE =====
      const type = invoiceData.id.startsWith('SAR/') || invoiceData.id.startsWith('SAR_') ? 'sar' : 'kw';
      
      let extractedMainNumber = '';
      let extractedPrefix = '';
      let extractedSuffix = '';
      
      if (type === 'sar') {
        const match = invoiceData.id.match(/^(SAR\/|SAR_)(.+)/);
        if (match) {
          extractedPrefix = match[1];
          extractedMainNumber = match[2];
        }
      } else { // type === 'kw'
        const match = invoiceData.id.match(/^(KW\/)(.*?)(?=\/KEU|$)(.*)/);
        if (match) {
          extractedPrefix = match[1];
          extractedMainNumber = match[2];
          extractedSuffix = match[3];
        }
      }

      setInvoiceType(type);
      setPrefix(extractedPrefix);
      setMainNumber(extractedMainNumber);
      setSuffix(extractedSuffix);
      setIsAutoNumber(false); // ALWAYS start in manual for editing

      // Populate other fields
      setCustomer(invoiceData.customer);
      setSalesOrder(invoiceData.salesOrder);
      if (invoiceData.date) {
        const dateParts = invoiceData.date.split('/');
        if (dateParts.length === 3) {
          const [day, month, year] = dateParts;
          setDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else {
          setDate(new Date());
        }
      } else {
        setDate(new Date());
      }
      setAmount(formatNumberWithCommas(invoiceData.amount));
    } else {
      // ===== ADD NEW MODE =====
      setIsAutoNumber(true);
      const initialType = 'kw';
      setInvoiceType(initialType);
      generateNextNumber(initialType);
      
      // Reset other fields for a new entry
      setCustomer('');
      setSalesOrder('');
      setDate(new Date());
      setAmount(0);
    }
  }, [isOpen, invoiceData, allInvoiceNumbers]); // Dependency on allInvoiceNumbers ensures it uses fresh data

  // This effect updates the full invoice number whenever its parts change
  useEffect(() => {
    setFullInvoiceNumber(`${prefix}${mainNumber}${suffix}`);
  }, [prefix, mainNumber, suffix]);

  // Handle manual change of invoice type in ADD mode
  const handleInvoiceTypeChange = (newType: 'sar' | 'kw') => {
    if (invoiceData) return; // Don't allow type change in edit mode
    setInvoiceType(newType);
    if (isAutoNumber) {
        generateNextNumber(newType);
    }
  }

  // Handle toggling of the auto-number checkbox
  const handleAutoNumberToggle = (checked: boolean) => {
    setIsAutoNumber(checked);
    if (checked && !invoiceData) { // Only regenerate number in add mode
        generateNextNumber(invoiceType);
    }
  }

  const handleSalesOrderSelect = (currentValue: string) => {
    const newSalesOrder = currentValue === salesOrder ? '' : currentValue;
    setSalesOrder(newSalesOrder);

    if (newSalesOrder && salesOrderListData) {
      const soDetails = salesOrderListData.filter(item => item.soNumber === newSalesOrder);
      
      if (soDetails.length > 0) {
        const totalAmount = soDetails.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        setAmount(formatNumberWithCommas(totalAmount));
        const customerName = soDetails[0].customer;
        if(customerName) {
            setCustomer(customerName);
        }
      } else {
        setAmount(0);
        setCustomer('');
      }

    } else {
        setCustomer('');
        setAmount(0);
    }

    setSoPopoverOpen(false);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseFormattedNumber(value);
    if (!isNaN(parsedValue) || value === '') {
        setAmount(value === '' ? '' : formatNumberWithCommas(parsedValue));
    }
  };

  const handleSave = () => {
    if (!mainNumber) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Nomor Faktur tidak boleh kosong.",
        });
        return;
    }
    const finalInvoiceNumber = `${prefix}${mainNumber}${suffix}`;
    // In edit mode, invoiceData.id will be the original ID. Check if it's different from the new one.
    const isChangingId = invoiceData && invoiceData.id !== finalInvoiceNumber;
    
    // Check for duplicates only if it's a new invoice OR if the ID is being changed in edit mode.
    if ((!invoiceData || isChangingId) && allInvoiceNumbers?.some(inv => inv.id === finalInvoiceNumber)) {
      toast({
        variant: "destructive",
        title: "Duplicate Invoice Number",
        description: `Invoice number "${finalInvoiceNumber}" already exists. Please use a different number.`,
      });
      return; 
    }

    const formattedDate = date ? format(date, 'dd/MM/yyyy') : '';
    const numericAmount = typeof amount === 'string' ? parseFormattedNumber(amount) : amount;
    onSave({
      id: finalInvoiceNumber,
      customer,
      salesOrder,
      date: formattedDate,
      amount: numericAmount
    });
    onOpenChange(false);
  }

  const dialogTitle = invoiceData ? "Edit Invoice Number" : "Add New Invoice Number";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Number
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          
              <div className="space-y-2">
                <Label>Tipe Faktur</Label>
                 <div className="flex w-full rounded-md border border-input">
                    <Button
                        variant={invoiceType === 'sar' ? 'default' : 'ghost'}
                        onClick={() => handleInvoiceTypeChange('sar')}
                        className="flex-1 rounded-r-none"
                        disabled={!!invoiceData}
                    >
                        SAR
                    </Button>
                    <Button
                        variant={invoiceType === 'kw' ? 'default' : 'ghost'}
                        onClick={() => handleInvoiceTypeChange('kw')}
                        className="flex-1 rounded-l-none"
                        disabled={!!invoiceData}
                    >
                        KW / Proforma
                    </Button>
                </div>
              </div>
            

           <div className="space-y-2">
            <Label>Nomor Faktur</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="auto-number" checked={isAutoNumber} onCheckedChange={(checked) => handleAutoNumberToggle(!!checked)} />
              <Label htmlFor="auto-number" className="font-normal">Nomor Otomatis</Label>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Input value={prefix} className="bg-muted text-right" readOnly tabIndex={-1} />
              <Input value={mainNumber} onChange={(e) => setMainNumber(e.target.value)} disabled={isAutoNumber} />
              {suffix && <Input value={suffix} className="bg-muted" readOnly tabIndex={-1} />}
            </div>
            <Input id="full-invoice-number" value={fullInvoiceNumber} disabled className="bg-muted font-semibold text-center" />
          </div>
           <div className="space-y-2">
            <Label htmlFor="sales-order">Sales Order / SO (Opsional)</Label>
            <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={soPopoverOpen}
                    className="w-full justify-between"
                    >
                    {salesOrder
                        ? uniqueSalesOrders.find((so) => so === salesOrder)
                        : "Search and select a Sales Order"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[375px] p-0">
                    <Command>
                    <CommandInput placeholder="Search sales order..." />
                    <CommandList>
                      <CommandEmpty>No sales order found.</CommandEmpty>
                      <CommandGroup>
                          {uniqueSalesOrders.map((so) => (
                          <CommandItem
                              key={so}
                              value={so}
                              onSelect={handleSalesOrderSelect}
                          >
                              <Check
                              className={cn(
                                  "mr-2 h-4 w-4",
                                  salesOrder === so ? "opacity-100" : "opacity-0"
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
          <div className="space-y-2">
            <Label htmlFor="customer">Pelanggan</Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerPopoverOpen}
                    className="w-full justify-between"
                    disabled={!!salesOrder}
                    >
                    {customer && customerListData
                        ? customerListData.find((c) => c.name.toLowerCase() === customer.toLowerCase())?.name
                        : "e.g., PT. XYZ Corp"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[375px] p-0">
                    <Command>
                    <CommandInput placeholder="Search customer..." />
                     <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                            {customerListData?.map((c) => (
                            <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={(currentValue) => {
                                    setCustomer(currentValue.toLowerCase() === customer.toLowerCase() ? "" : c.name);
                                    setCustomerPopoverOpen(false);
                                }}
                            >
                                <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    customer.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0"
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
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        format(date, 'dd/MM/yyyy')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Jumlah</Label>
              <Input id="amount" value={amount} onChange={handleAmountChange} placeholder="0" disabled={!!salesOrder} />
            </div>
          </div>
        </div>
        <div className="pt-6 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave}>Save & Create Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
