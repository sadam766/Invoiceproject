
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
import type { InvoiceNumber, Customer, SalesOrder, Invoice } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';


type AddInvoiceNumberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (invoice: Omit<InvoiceNumber, 'id'> & {id: string}, action: 'save' | 'create') => void;
  invoiceData?: InvoiceNumber;
  onAddClick: () => void;
  allInvoiceNumbers: InvoiceNumber[] | null;
};


export function AddInvoiceNumberDialog({ isOpen, onOpenChange, onSave, invoiceData, onAddClick, allInvoiceNumbers }: AddInvoiceNumberDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [invoiceType, setInvoiceType] = useState<'sar' | 'kw'>('kw');
  const [isAutoNumber, setIsAutoNumber] = useState(true);
  
  const [startingNumber, setStartingNumber] = useState<string>('');
  
  const [prefix, setPrefix] = useState('');
  const [mainNumber, setMainNumber] = useState('');
  const [suffix, setSuffix] = useState('');
  
  const [fullInvoiceNumber, setFullInvoiceNumber] = useState('');
  
  const [salesOrder, setSalesOrder] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState<string>('');

  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const { toast } = useToast();

  const customersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customers'));
  }, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const salesOrdersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salesOrders'));
  }, [firestore]);
  const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: existingInvoices } = useCollection<Invoice>(invoicesCollection);

  const uniqueSalesOrders = useMemo(() => {
    if (!salesOrderListData) return [];
    return Array.from(new Set(salesOrderListData.map(item => item.soNumber)))
  },[salesOrderListData]);

  const generateNextNumber = (type: 'sar' | 'kw', startFrom: string = '') => {
    let currentMax = 0;
    const now = new Date();
    const currentYearShort = format(now, 'yy');
    const currentYearLong = format(now, 'yyyy');
    
    const allIds = [
        ...(allInvoiceNumbers?.map(inv => inv.id) || []),
        ...(existingInvoices?.map(inv => inv.id) || [])
    ];

    allIds.forEach(id => {
        let match;
        if (type === 'sar') {
            const pattern = new RegExp(`SAR_${currentYearShort}01(\\d+)A`);
            match = id.match(pattern);
        } else {
            const pattern = new RegExp(`KW[\\/_](\\d+)[\\/_]KEU[\\/_]${currentYearLong}`);
            match = id.match(pattern);
        }

        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > currentMax) currentMax = num;
        }
    });

    const userStart = parseInt(startFrom, 10);
    const baseNumber = !isNaN(userStart) ? Math.max(currentMax, userStart - 1) : currentMax;
    const nextNum = baseNumber + 1;

    return type === 'sar' 
        ? nextNum.toString().padStart(3, '0') 
        : nextNum.toString().padStart(4, '0');
  };
  
  const setupForAddMode = (type: 'sar' | 'kw', startVal: string = '') => {
    const nextNumStr = generateNextNumber(type, startVal);
    const now = new Date();
    const currentYearShort = format(now, 'yy');
    const currentYearLong = format(now, 'yyyy');

    if (type === 'sar') {
      setPrefix(`SAR_${currentYearShort}01`);
      setSuffix('A');
      setMainNumber(nextNumStr);
    } else {
      setPrefix('KW/');
      setSuffix(`/KEU/${currentYearLong}`);
      setMainNumber(nextNumStr);
    }
  };

  const handleManualSetup = (invoice: InvoiceNumber) => {
    const id = invoice.id;
    const sarMatch = id.match(/^(SAR_\d{2}01)(\d+)(A)$/);
    const kwMatch = id.match(/^(KW[\/_])(\d+)([\/_]KEU[\/_]\d{4})$/);

    if (sarMatch) {
        setInvoiceType('sar');
        setPrefix(sarMatch[1]);
        setMainNumber(sarMatch[2]);
        setSuffix(sarMatch[3]);
    } else if (kwMatch) {
        setInvoiceType('kw');
        setPrefix(kwMatch[1]);
        setMainNumber(kwMatch[2]);
        setSuffix(kwMatch[3]);
    } else {
        setInvoiceType('kw');
        setPrefix('KW/');
        setSuffix(`/KEU/${format(new Date(), 'yyyy')}`);
        setMainNumber(id);
    }
    
    setIsAutoNumber(false); 
    setCustomer(invoice.customer);
    setSalesOrder(invoice.salesOrder);
    setPoNumber(invoice.poNumber || '');
    if (invoice.date) {
      const dateParts = invoice.date.split('/');
      if (dateParts.length === 3) {
        const [day, month, year] = dateParts;
        setDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
      } else {
        setDate(new Date());
      }
    } else {
      setDate(new Date());
    }
    setAmount(formatNumberWithCommas(invoice.amount));
  }

  useEffect(() => {
      if (!isOpen) return;

      if (invoiceData) {
          handleManualSetup(invoiceData);
      } else {
          setInvoiceType('sar');
          setIsAutoNumber(true);
          setupForAddMode('sar', startingNumber);
          
          setCustomer('');
          setSalesOrder('');
          setPoNumber('');
          setDate(new Date());
          setAmount('');
      }
  }, [isOpen, invoiceData]);

  useEffect(() => {
      if (isAutoNumber && !invoiceData && isOpen) {
          setupForAddMode(invoiceType, startingNumber);
      }
  }, [startingNumber, invoiceType, isAutoNumber, isOpen]);

  useEffect(() => {
    setFullInvoiceNumber(`${prefix}${mainNumber}${suffix}`);
  }, [prefix, mainNumber, suffix]);

  const handleInvoiceTypeChange = (newType: 'sar' | 'kw') => {
    if (invoiceType === newType) return;
    setInvoiceType(newType);
  }

  const handleAutoNumberToggle = (checked: boolean) => {
    setIsAutoNumber(checked);
  }

  const handleSalesOrderSelect = (currentValue: string) => {
    const cleanSo = currentValue.split('|')[0];
    const newSalesOrder = cleanSo === salesOrder ? '' : cleanSo;
    setSalesOrder(newSalesOrder);

    if (newSalesOrder && salesOrderListData) {
      const soDetails = salesOrderListData.filter(item => item.soNumber === newSalesOrder);
      
      if (soDetails.length > 0) {
        const totalAmount = soDetails.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        setAmount(formatNumberWithCommas(totalAmount));
        setCustomer(soDetails[0].customer);
        setPoNumber(soDetails[0].poNumber || '');
      } else {
        setAmount('');
        setCustomer('');
        setPoNumber('');
      }

    } else {
        setCustomer('');
        setAmount('');
    }

    setSoPopoverOpen(false);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d.,]/g, '');
    setAmount(value);
  };

  const handleBlurAmount = () => {
    const numeric = parseFormattedNumber(amount);
    if (!isNaN(numeric) && amount !== '') {
        setAmount(formatNumberWithCommas(numeric));
    }
  };

  const handleSave = (action: 'save' | 'create') => {
    if (!mainNumber) {
        toast({ variant: "destructive", title: "Validation Error", description: "Nomor urut tidak boleh kosong." });
        return;
    }

    if (!salesOrder && !poNumber) {
        toast({ variant: "destructive", title: "Validation Error", description: "Nomor PO wajib diisi jika SO belum tersedia." });
        return;
    }
    
    const finalInvoiceNumber = fullInvoiceNumber;
    const existsInNumberList = allInvoiceNumbers?.some(inv => inv.id === finalInvoiceNumber);
    const existsInInvoiceList = existingInvoices?.some(inv => inv.id === finalInvoiceNumber);
    const isChangingId = invoiceData && invoiceData.id !== finalInvoiceNumber;
    
    if ((!invoiceData || isChangingId) && (existsInNumberList || existsInInvoiceList)) {
      toast({
        variant: "destructive",
        title: "Nomor Faktur Duplikat",
        description: `Nomor "${finalInvoiceNumber}" sudah terdaftar dalam sistem.`,
      });
      return; 
    }

    const formattedDate = date ? format(date, 'dd/MM/yyyy') : '';
    const numericAmount = parseFormattedNumber(amount);
    onSave({
      id: finalInvoiceNumber,
      customer,
      salesOrder,
      poNumber,
      date: formattedDate,
      amount: numericAmount
    }, action);
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
            <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="auto-number" checked={isAutoNumber} onCheckedChange={(checked) => handleAutoNumberToggle(!!checked)} />
                  <Label htmlFor="auto-number" className="font-normal">Nomor Otomatis</Label>
                </div>
                
                {isAutoNumber && (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="mulai-dari" className="text-xs font-normal text-muted-foreground whitespace-nowrap">Mulai Dari:</Label>
                        <Input 
                            id="mulai-dari"
                            placeholder={invoiceType === 'sar' ? "001" : "0001"}
                            className="h-7 w-24 text-xs"
                            value={startingNumber}
                            onChange={(e) => setStartingNumber(e.target.value)}
                        />
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              {prefix && <div className="bg-muted px-3 py-2 rounded-md border text-sm font-mono">{prefix}</div>}
              <Input 
                value={mainNumber} 
                onChange={(e) => setMainNumber(e.target.value)} 
                disabled={isAutoNumber} 
                placeholder={invoiceType === 'sar' ? "000" : "0000"}
              />
              {suffix && <div className="bg-muted px-3 py-2 rounded-md border text-sm font-mono">{suffix}</div>}
            </div>
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
                        : "Cari SO (Kosongkan jika hanya penagihan awal/DP)"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[375px] p-0 shadow-xl border border-muted overflow-hidden">
                    <Command>
                    <CommandInput placeholder="Search sales order..." />
                    <CommandList>
                      <CommandEmpty />
                      <CommandGroup>
                          {uniqueSalesOrders.map((so) => (
                          <CommandItem
                              key={so}
                              value={`${so}|${so}`}
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
            <Label htmlFor="po-number">Nomor PO Customer { !salesOrder && <span className="text-red-500">*</span> }</Label>
            <Input 
                id="po-number" 
                value={poNumber} 
                onChange={e => setPoNumber(e.target.value)} 
                placeholder="Misal: PO-ABC-2024" 
                disabled={!!salesOrder}
            />
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
                        : "Pilih Pelanggan"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 shadow-xl border border-muted" align="start">
                    <Command>
                    <CommandInput placeholder="Search customer..." />
                     <CommandList>
                        <CommandEmpty />
                        <CommandGroup>
                            {customerListData?.map((c) => (
                            <CommandItem
                                key={c.id}
                                value={`${c.name}|${c.id}`}
                                onSelect={(v) => {
                                    const [name] = v.split('|');
                                    setCustomer(name === customer ? "" : name);
                                    setCustomerPopoverOpen(false);
                                }}
                                className="flex flex-col items-start gap-1"
                            >
                                <div className="flex items-center gap-2">
                                  <Check
                                    className={cn(
                                        "h-4 w-4",
                                        customer.toLowerCase() === c.name.toLowerCase() ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-bold">{c.name}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground ml-6 truncate w-full">{c.address}</p>
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
              <Input 
                id="amount" 
                value={amount} 
                onChange={handleAmountChange} 
                onBlur={handleBlurAmount}
                placeholder="0" 
                disabled={!!salesOrder} 
              />
            </div>
          </div>
        </div>
        <div className="pt-6 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave('save')}>Save</Button>
          <Button type="button" onClick={() => handleSave('create')} className="bg-primary text-primary-foreground">Create Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
