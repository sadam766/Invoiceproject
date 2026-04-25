
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Customer, CustomerAddress } from '@/app/lib/data';
import { Plus, Trash2, MapPin, BadgeCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type AddCustomerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  customerData?: Customer;
  onAddClick: () => void;
};

export function AddCustomerDialog({ isOpen, onOpenChange, onSave, customerData, onAddClick }: AddCustomerDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  
  // New address form state
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNpwp, setNewNpwp] = useState('');

  useEffect(() => {
    if (customerData && isOpen) {
      setName(customerData.name);
      setEmail(customerData.email || '');
      setAddresses(customerData.addresses || []);
    } else if (!isOpen) {
      setName('');
      setEmail('');
      setAddresses([]);
      resetNewAddressForm();
    }
  }, [customerData, isOpen]);

  const resetNewAddressForm = () => {
    setNewLabel('');
    setNewAddress('');
    setNewNpwp('');
  };

  const handleAddAddress = () => {
    if (!newLabel || !newAddress) return;
    
    const newEntry: CustomerAddress = {
      id: Math.random().toString(36).substr(2, 9),
      label: newLabel,
      address: newAddress,
      npwp: newNpwp,
      isDefault: addresses.length === 0, // First one is default
    };

    setAddresses([...addresses, newEntry]);
    resetNewAddressForm();
  };

  const handleRemoveAddress = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
  };

  const handleSetDefault = (id: string) => {
    setAddresses(addresses.map(a => ({
      ...a,
      isDefault: a.id === id
    })));
  };

  const handleSave = () => {
    onSave({ id: customerData?.id, name, email, addresses });
    onOpenChange(false);
  };
  
  const dialogTitle = customerData ? "Edit Customer Profile" : "Register New Customer";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Manage multiple addresses for this customer entitiy.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Main Info */}
          <div className="grid gap-4">
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right font-bold">Company PT</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3 font-bold" placeholder="Nama Legal Pusat" />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Contact Email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" placeholder="email@customer.com" />
             </div>
          </div>

          <Separator />

          {/* Address List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Address Book (Cabang/Proyek)
            </h3>
            
            <div className="space-y-2">
                {addresses.map((addr) => (
                    <Card key={addr.id} className={cn("border-l-4", addr.isDefault ? "border-l-primary bg-primary/5" : "border-l-muted")}>
                        <CardContent className="p-3 flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-wider">{addr.label}</span>
                                    {addr.isDefault && <BadgeCheck className="h-3 w-3 text-primary" />}
                                </div>
                                <p className="text-[11px] leading-tight text-muted-foreground">{addr.address}</p>
                                {addr.npwp && <p className="text-[10px] font-mono bg-muted inline-block px-1 rounded mt-1">NPWP: {addr.npwp}</p>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveAddress(addr.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                {!addr.isDefault && (
                                    <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleSetDefault(addr.id)}>
                                        Set Default
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Add New Address Section */}
            <Card className="border-dashed bg-muted/20">
                <CardContent className="p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Tambah Alamat Cabang Baru</p>
                    <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Label (e.g. Kantor Cabang A)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="NPWP Cabang (Opsional)" value={newNpwp} onChange={e => setNewNpwp(e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                    <textarea 
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs h-16"
                        placeholder="Alamat lengkap pengiriman/penagihan..."
                        value={newAddress}
                        onChange={e => setNewAddress(e.target.value)}
                    />
                    <Button type="button" size="sm" className="w-full h-8" onClick={handleAddAddress} disabled={!newLabel || !newAddress}>
                        <Plus className="h-3 w-3 mr-2" /> Simpan ke Address Book
                    </Button>
                </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" onClick={handleSave} className="w-full">Simpan Profil Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
