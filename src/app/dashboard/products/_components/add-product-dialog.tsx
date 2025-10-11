
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

type AddProductDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (product: ProductListItem) => void;
  productData?: ProductListItem;
  onAddClick: () => void;
};

export function AddProductDialog({ isOpen, onOpenChange, onSave, productData, onAddClick }: AddProductDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (productData) {
      setName(productData.name);
      setCategory(productData.category);
      setQuantity(productData.quantity);
      setUnit(productData.unit);
      setPrice(productData.price);
    } else {
      setName('');
      setCategory('');
      setQuantity(0);
      setUnit('');
      setPrice(0);
    }
  }, [productData, isOpen]);

  const handleSave = () => {
    onSave({ name, category, quantity, unit, price });
  };

  const dialogTitle = productData ? "Edit Product" : "Add New Product";
  const dialogDescription = productData ? "Update the product's details below." : "Fill in the details below to add a new product.";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
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
            <Label htmlFor="product-name" className="text-right">
              Product
            </Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kabel">Kabel</SelectItem>
                <SelectItem value="aksesoris">Aksesoris</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">
              Satuan
            </Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price
            </Label>
            <Input id="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>Save Product</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
