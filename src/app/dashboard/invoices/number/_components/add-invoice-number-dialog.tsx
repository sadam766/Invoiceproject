
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { InvoiceNumber } from '@/app/lib/data';

type AddInvoiceNumberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (invoice: Omit<InvoiceNumber, 'id'>) => void;
  invoiceData?: InvoiceNumber;
  onAddClick: () => void;
};


export function AddInvoiceNumberDialog({ isOpen, onOpenChange, onSave, invoiceData, onAddClick }: AddInvoiceNumberDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [invoiceType, setInvoiceType] = useState<'sar' | 'kw'>('kw');
  const [isAutoNumber, setIsAutoNumber] = useState(true);
  
  const [prefix, setPrefix] = useState('');
  const [mainNumber, setMainNumber] = useState('');
  const [suffix, setSuffix] = useState('');
  
  const [fullInvoiceNumber, setFullInvoiceNumber] = useState('');
  
  const [salesOrder, setSalesOrder] = useState('');
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (invoiceData) {
      if (invoiceData.id.startsWith('SAR/')) {
        setInvoiceType('sar');
        setPrefix('SAR/');
        setSuffix('');
        setMainNumber(invoiceData.id.replace('SAR/', ''));
      } else {
        setInvoiceType('kw');
        const parts = invoiceData.id.split('/');
        setPrefix('KW/');
        setSuffix(`/${parts[2]}/${parts[3]}`);
        setMainNumber(parts[1]);
      }
      setCustomer(invoiceData.customer);
      setSalesOrder(invoiceData.salesOrder);
      setDate(new Date(invoiceData.date.split('/').reverse().join('-')));
      setAmount(invoiceData.amount);
    } else {
      // Reset for new entry
      const currentYear = new Date().getFullYear();
      if (invoiceType === 'sar') {
        setPrefix('SAR/');
        setSuffix('');
        if (isAutoNumber) setMainNumber('25000003');
        else setMainNumber('');
      } else { // kw
        setPrefix('KW/');
        setSuffix(`/KEU/${currentYear}`);
        if (isAutoNumber) setMainNumber('0001');
        else setMainNumber('');
      }
      setCustomer('');
      setSalesOrder('');
      setDate(new Date());
      setAmount(0);
    }
  }, [invoiceData, isOpen, invoiceType, isAutoNumber]);

  useEffect(() => {
    setFullInvoiceNumber(`${prefix}${mainNumber}${suffix}`);
  }, [prefix, mainNumber, suffix]);


  const handleMainNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMainNumber(e.target.value);
  }

  const handleSave = () => {
    const formattedDate = date ? format(date, 'dd/MM/yyyy') : '';
    onSave({
      id: fullInvoiceNumber,
      customer,
      salesOrder,
      date: formattedDate,
      amount
    });
  }

  const dialogTitle = invoiceData ? "Edit Invoice Number" : "Add New Invoice Number";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Number
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <Label htmlFor="invoice-type">Tipe Faktur</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
                <Button variant={invoiceType === 'sar' ? 'default' : 'ghost'} onClick={() => setInvoiceType('sar')} className="h-8">SAR</Button>
                <Button variant={invoiceType === 'kw' ? 'default' : 'ghost'} onClick={() => setInvoiceType('kw')} className="h-8">KW / Proforma</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nomor Faktur</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="auto-number" checked={isAutoNumber} onCheckedChange={(checked) => setIsAutoNumber(Boolean(checked))} />
              <Label htmlFor="auto-number" className="font-normal">Nomor Otomatis</Label>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Input value={prefix} className="bg-muted text-right" readOnly />
              <Input value={mainNumber} onChange={handleMainNumberChange} />
              {suffix && <Input value={suffix} className="bg-muted" readOnly />}
            </div>
            <Input id="full-invoice-number" value={fullInvoiceNumber} disabled className="bg-muted font-semibold text-center" />
          </div>
           <div className="space-y-2">
            <Label htmlFor="sales-order">Sales Order / SO (Opsional)</Label>
            <Input id="sales-order" placeholder="Search and select a Sales Order" value={salesOrder} onChange={e => setSalesOrder(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer">Pelanggan</Label>
            <Input id="customer" placeholder="e.g., PT. XYZ Corp" value={customer} onChange={e => setCustomer(e.target.value)}/>
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
              <Input id="amount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}/>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave}>Save & Create Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
