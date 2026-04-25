
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Check, ChevronsUpDown } from 'lucide-react';
import type { SalesListItem, Customer, UserProfile } from '@/app/lib/data';
import { useState, useEffect, useMemo } from 'react';
import { formatNumberWithCommas, parseFormattedNumber, cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

type AddSaleDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (sale: Omit<SalesListItem, 'ownerId'>) => void;
    saleData?: SalesListItem;
    onAddClick: () => void;
};

export function AddSaleDialog({ isOpen, onOpenChange, onSave, saleData, onAddClick }: AddSaleDialogProps) {
    const firestore = useFirestore();
    const [poNumber, setPoNumber] = useState('');
    const [customer, setCustomer] = useState('');
    const [sales, setSales] = useState('');
    const [soNumber, setSoNumber] = useState('');
    const [amount, setAmount] = useState<number | string>('');
    
    const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
    const [salesPopoverOpen, setSalesPopoverOpen] = useState(false);

    // Data Fetching for Dropdowns
    const customersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'customers'));
    }, [firestore]);
    const { data: customerListData } = useCollection<Customer>(customersCollection);

    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: userListData } = useCollection<UserProfile>(usersCollection);

    useEffect(() => {
        if (saleData && isOpen) {
            setPoNumber(saleData.poNumber);
            setCustomer(saleData.customer);
            setSales(saleData.sales);
            setSoNumber(saleData.soNumber || '');
            setAmount(formatNumberWithCommas(saleData.amount));
        } else if (!isOpen) {
            setPoNumber('');
            setCustomer('');
            setSales('');
            setSoNumber('');
            setAmount('');
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
            poNumber,
            customer,
            sales,
            soNumber,
            amount: numericAmount,
            status: saleData?.status || 'Unpaid',
        });
        onOpenChange(false);
    };

    return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Register New PO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{saleData ? "Edit PO Data" : "Register Incoming PO"}</DialogTitle>
          <DialogDescription>
            Masukkan data sesuai Purchase Order (PO) dari Customer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="po-number">Nomor PO Customer <span className="text-red-500">*</span></Label>
            <Input id="po-number" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Contoh: PO/2024/001" disabled={!!saleData} />
          </div>

          <div className="grid gap-2">
            <Label>Customer</Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                        {customer || "Pilih Customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 shadow-xl border border-muted" align="start">
                    <Command>
                        <CommandInput placeholder="Cari customer..." />
                        <CommandList>
                            <CommandEmpty>Customer tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                                {customerListData?.map((c) => (
                                    <CommandItem key={c.id} value={c.name} onSelect={(val) => { setCustomer(val); setCustomerPopoverOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", customer === c.name ? "opacity-100" : "opacity-0")} />
                                        {c.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Sales Person</Label>
            <Popover open={salesPopoverOpen} onOpenChange={setSalesPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                        {sales || "Pilih Sales..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 shadow-xl border border-muted" align="start">
                    <Command>
                        <CommandInput placeholder="Cari sales..." />
                        <CommandList>
                            <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                                {userListData?.map((u) => (
                                    <CommandItem key={u.uid} value={u.displayName || u.email} onSelect={(val) => { setSales(val); setSalesPopoverOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", sales === (u.displayName || u.email) ? "opacity-100" : "opacity-0")} />
                                        {u.displayName || u.email}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Nilai PO (Total)</Label>
                <Input id="amount" value={amount} onChange={handleAmountChange} placeholder="Rp 0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="so-number">No. SO (Jika ada)</Label>
                <Input id="so-number" value={soNumber} onChange={e => setSoNumber(e.target.value)} placeholder="Waiting SO" />
              </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave} className="w-full">Simpan Data PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    );
}
