
'use client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import type { SalesListItem } from '@/app/lib/data';
import { useState, useEffect } from 'react';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

type AddSaleDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (sale: SalesListItem) => void;
    saleData?: SalesListItem;
    onAddClick: () => void;
};


export function AddSaleDialog({ isOpen, onOpenChange, onSave, saleData, onAddClick }: AddSaleDialogProps) {
    const [soNumber, setSoNumber] = useState('');
    const [customer, setCustomer] = useState('');
    const [sales, setSales] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [amount, setAmount] = useState<number | string>('');
    const [status, setStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
    const [paidDate, setPaidDate] = useState('');

    useEffect(() => {
        if (saleData && isOpen) {
            setSoNumber(saleData.soNumber);
            setCustomer(saleData.customer);
            setSales(saleData.sales);
            setPoNumber(saleData.poNumber);
            setAmount(formatNumberWithCommas(saleData.amount));
            setStatus(saleData.status);
            setPaidDate(saleData.paidDate || '');
        } else if (!isOpen) {
            // Reset form
            setSoNumber('');
            setCustomer('');
            setSales('');
            setPoNumber('');
            setAmount('');
            setStatus('Unpaid');
            setPaidDate('');
        }
    }, [saleData, isOpen]);
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const parsedValue = parseFormattedNumber(value);
        if (!isNaN(parsedValue) || value === '') {
            setAmount(value === '' ? '' : formatNumberWithCommas(parsedValue));
        }
    };

    const handleSave = () => {
        const numericAmount = typeof amount === 'string' ? parseFormattedNumber(amount) : amount;
        onSave({
            soNumber,
            customer,
            sales,
            poNumber,
            amount: numericAmount,
            status,
            paidDate,
        });
        onOpenChange(false);
    };
    
    const dialogTitle = saleData ? "Edit Sale" : "Add New Sale";
    const dialogDescription = saleData ? "Update the sale's details below." : "Fill in the details below to add a new sale.";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-teal-500 hover:bg-teal-600">
          <Plus className="mr-2 h-4 w-4" /> New Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="so-number" className="text-right">
              Number SO
            </Label>
            <Input id="so-number" value={soNumber} onChange={e => setSoNumber(e.target.value)} className="col-span-3" disabled={!!saleData} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customer" className="text-right">
              Customer
            </Label>
            <Input id="customer" value={customer} onChange={e => setCustomer(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sales" className="text-right">
              Sales
            </Label>
            <Input id="sales" value={sales} onChange={e => setSales(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="po-number" className="text-right">
              No. PO
            </Label>
            <Input id="po-number" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input id="amount" value={amount} onChange={handleAmountChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as 'Paid' | 'Unpaid')}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === 'Paid' && (
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paid-date" className="text-right">
                    Paid Date
                </Label>
                <Input id="paid-date" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="col-span-3" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>Save Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
