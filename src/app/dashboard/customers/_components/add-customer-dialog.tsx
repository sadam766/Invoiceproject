
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
import type { Customer } from '@/app/lib/data';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

type AddCustomerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (customer: Omit<Customer, 'id'>) => void;
  customerData?: Customer;
  onAddClick: () => void;
};

export function AddCustomerDialog({ isOpen, onOpenChange, onSave, customerData, onAddClick }: AddCustomerDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [spdAddress, setSpdAddress] = useState('');

  useEffect(() => {
    if (customerData && isOpen) {
      setName(customerData.name);
      setAddress(customerData.address);
      setSpdAddress(customerData.spdAddress);
    } else if (!isOpen) {
      // Reset form when dialog closes, also prepares for "Add"
      setName('');
      setAddress('');
      setSpdAddress('');
    }
  }, [customerData, isOpen]);

  const handleSave = () => {
    onSave({ name, address, spdAddress });
    onOpenChange(false);
  };
  
  const dialogTitle = customerData ? "Edit Customer" : "Add New Customer";
  const dialogDescription = customerData ? "Update the customer's details below." : "Fill in the details below to add a new customer.";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
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
            <Label htmlFor="name" className="text-right">
              Customer
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              Alamat
            </Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="spd-address" className="text-right">
              Alamat SPD
            </Label>
            <Input id="spd-address" value={spdAddress} onChange={(e) => setSpdAddress(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>Save Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
