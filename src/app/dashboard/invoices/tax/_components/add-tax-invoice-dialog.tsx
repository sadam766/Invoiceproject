
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
import { Plus } from 'lucide-react';

export function AddTaxInvoiceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-teal-500 hover:bg-teal-600">
          <Plus className="mr-2 h-4 w-4" /> New Tax Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Tax Invoice</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new tax invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="buyer-npwp" className="text-right">
              NPWP Pembeli
            </Label>
            <Input id="buyer-npwp" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="buyer-name" className="text-right">
              Nama Pembeli
            </Label>
            <Input id="buyer-name" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="transaction-code" className="text-right">
              Kode Transaksi
            </Label>
            <Input id="transaction-code" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tax-invoice-number" className="text-right">
              Nomor Faktur
            </Label>
            <Input id="tax-invoice-number" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tax-invoice-date" className="text-right">
              Tanggal Faktur
            </Label>
            <Input id="tax-invoice-date" type="date" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tax-period" className="text-right">
              Masa Pajak
            </Label>
            <Input id="tax-period" type="number" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save Tax Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
