
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
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '') { setter(''); return; }
    
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
        setter(num.toLocaleString('id-ID'));
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
      <DialogContent className="sm:max-w-[550px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="uppercase font-black">Sales Order Data</DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400">Masukkan detail pesanan. Mendukung angka skala besar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="so-number" className="text-right text-[10px] font-black uppercase text-slate-400">SO Number</Label>
            <Input id="so-number" value={soNumber} onChange={(e) => setSoNumber(e.target.value)} className="col-span-3 font-bold h-11" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="po-number" className="text-right text-[10px] font-black uppercase text-slate-400">PO Reference</Label>
            <Input id="po-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="col-span-3 h-11" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="quantity" className="text-[10px] font-black uppercase text-slate-400">Quantity</Label>
                <div className="flex gap-2">
                    <Input type="text" id="quantity" value={quantity} onChange={handleNumericChange(setQuantity)} className="font-black h-11" />
                    <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="UOM" className="w-24 h-11 font-bold bg-slate-50" />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="price" className="text-[10px] font-black uppercase text-slate-400">Unit Price (IDR)</Label>
                <Input type="text" id="price" value={price} onChange={handleNumericChange(setPrice)} className="font-black h-11 border-indigo-100" />
            </div>
          </div>
        </div>
        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
          <Button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest px-8 h-12">Update Sales Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
