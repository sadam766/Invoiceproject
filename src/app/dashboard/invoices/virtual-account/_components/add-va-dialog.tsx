
'use client';
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
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VirtualAccount } from '@/app/lib/data';

type AddVaDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (va: VirtualAccount) => void;
  vaData?: VirtualAccount;
  onAddClick: () => void;
};

export function AddVaDialog({ isOpen, onOpenChange, onSave, vaData, onAddClick }: AddVaDialogProps) {
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [bankName, setBankName] = useState('');
  const [vaNumber, setVaNumber] = useState('');

  useEffect(() => {
    if (vaData && isOpen) {
      setCustomerCode(vaData.customerCode || '');
      setCustomerName(vaData.customerName);
      setBankName(vaData.bankName);
      setVaNumber(vaData.vaNumber);
    } else if (!isOpen) {
      setCustomerCode('');
      setCustomerName('');
      setBankName('');
      setVaNumber('');
    }
  }, [vaData, isOpen]);

  const handleSave = () => {
    onSave({ 
        id: vaData?.id,
        customerCode,
        customerName,
        bankName,
        vaNumber
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Virtual Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{vaData ? "Edit VA" : "Add VA"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Code</Label>
            <Input id="code" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customer" className="text-right">Customer</Label>
            <Input id="customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bank" className="text-right">Bank</Label>
            <Input id="bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="va" className="text-right">VA Number</Label>
            <Input id="va" value={vaNumber} onChange={(e) => setVaNumber(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save VA</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
