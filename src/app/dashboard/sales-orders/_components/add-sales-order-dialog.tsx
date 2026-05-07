
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
import { useEffect, useState } from 'react';
import type { SalesOrder } from '@/app/lib/data';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

type AddSalesOrderDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (order: SalesOrder) => void;
  orderData?: SalesOrder;
  onAddClick: () => void;
};

export function AddSalesOrderDialog({ isOpen, onOpenChange, onSave, orderData, onAddClick }: AddSalesOrderDialogProps) {
  const [soNumber, setSoNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [productName, setProductName] = useState('');
  const [customer, setCustomer] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState<string>('0');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<string>('0');

  useEffect(() => {
    if (orderData && isOpen) {
      setSoNumber(orderData.soNumber);
      setPoNumber(orderData.poNumber || '');
      setProductName(orderData.productName);
      setCategory(orderData.category);
      setQuantity(formatNumberWithCommas(orderData.quantity));
      setUnit(orderData.unit);
      setPrice(formatNumberWithCommas(orderData.price));
      setCustomer(orderData.customer);
    } else if (!isOpen) {
      setSoNumber('');
      setPoNumber('');
      setProductName('');
      setCategory('');
      setQuantity('0');
      setUnit('');
      setPrice('0');
      setCustomer('');
    }
  }, [orderData, isOpen]);

  const handleNumericChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') { setter(''); return; }
    
    if (!/^[0-9.,-]*$/.test(value)) return;
    
    const num = parseFormattedNumber(value);
    if (!isNaN(num)) {
        let formatted = formatNumberWithCommas(num);
        if (value.endsWith(',') || value.endsWith('.')) {
            const sep = value.includes(',') ? ',' : '.';
            if (!formatted.includes(sep)) formatted += sep;
        }
        setter(formatted);
    }
  };

  const handleSave = () => {
    onSave({ 
        id: orderData?.id,
        soNumber, 
        poNumber,
        productName,
        category, 
        quantity: parseFormattedNumber(quantity), 
        unit, 
        price: parseFormattedNumber(price),
        customer,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}><Plus className="mr-2 h-4 w-4" /> Add Sales Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{orderData ? "Edit Sales Order" : "Add New Sales Order"}</DialogTitle>
          <DialogDescription>Fill in the details below to add a new sales order.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="so-number" className="text-right">SO Number</Label>
            <Input id="so-number" value={soNumber} onChange={(e) => setSoNumber(e.target.value)} className="col-span-3 font-bold" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="po-number" className="text-right">PO Reference</Label>
            <Input id="po-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="col-span-3" />
          </div>
          <div className="my-2 border-t" />
          <div className="grid grid-cols-2 gap-4 ml-[25%]">
            <div className="space-y-1">
                <Label htmlFor="quantity">Quantity</Label>
                <Input type="text" step="any" id="quantity" value={quantity} onChange={handleNumericChange(setQuantity)} />
            </div>
            <div className="space-y-1">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">Price</Label>
            <Input type="text" step="any" id="price" value={price} onChange={handleNumericChange(setPrice)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>Save Sales Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
