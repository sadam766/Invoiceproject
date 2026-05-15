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
import type { ProductListItem } from '@/app/lib/data';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

type AddProductDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (product: Omit<ProductListItem, 'id'> & { id?: string }) => void;
  productData?: ProductListItem;
  onAddClick: () => void;
};

export function AddProductDialog({ isOpen, onOpenChange, onSave, productData, onAddClick }: AddProductDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState<string>('0');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<string>('0');

  useEffect(() => {
    if (productData && isOpen) {
      setName(productData.name);
      setCategory(productData.category);
      setQuantity(formatNumberWithCommas(productData.quantity));
      setUnit(productData.unit);
      setPrice(formatNumberWithCommas(productData.price));
    } else if (!isOpen) {
      setName('');
      setCategory('');
      setQuantity('0');
      setUnit('');
      setPrice('0');
    }
  }, [productData, isOpen]);
  
  const handleNumericChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.,-]/g, '');
    if (value === '') { setter(''); return; }
    
    const num = parseFormattedNumber(value);
    if (!isNaN(num)) {
        let formatted = formatNumberWithCommas(num);
        if (value.endsWith(',') || value.endsWith('.')) {
            const sep = value.includes(',') ? ',' : '.';
            if (!formatted.includes(sep)) formatted += sep;
        }
        setter(formatted);
    } else {
        setter(value);
    }
  };

  const handleSave = () => {
    if (!name || !unit) return;
    onSave({ 
        id: productData?.id,
        name, 
        category: category || 'kabel', 
        quantity: parseFormattedNumber(quantity), 
        unit, 
        price: parseFormattedNumber(price)
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl shadow-lg shadow-indigo-100">
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="uppercase font-black tracking-tight">{productData ? "Edit Master Item" : "Add New Master Item"}</DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400">Update item specifications and standard pricing.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-[10px] font-black uppercase text-slate-400">Official Product Name</Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} className="font-bold h-11 bg-slate-50 border-slate-200 rounded-md px-4" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[10px] font-black uppercase text-slate-400">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 font-bold bg-slate-50 border-slate-200 rounded-md"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kabel">Kabel</SelectItem>
                    <SelectItem value="aksesoris">Aksesoris</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-[10px] font-black uppercase text-slate-400">Unit (UOM)</Label>
                <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-11 font-black text-indigo-600 bg-indigo-50/50 border-indigo-100 rounded-[6px] px-[15px] min-w-[100px]" />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-[10px] font-black uppercase text-slate-400">Initial Stock</Label>
                <Input type="text" id="quantity" value={quantity} onChange={handleNumericChange(setQuantity)} className="h-11 font-bold rounded-[6px] px-[15px] min-w-[100px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-[10px] font-black uppercase text-slate-400">Standard Price (IDR)</Label>
                <Input type="text" id="price" value={price} onChange={handleNumericChange(setPrice)} className="h-11 font-black text-slate-900 rounded-[6px] px-[15px] min-w-[160px]" />
              </div>
          </div>
        </div>
        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest px-8">Save Master Data</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}