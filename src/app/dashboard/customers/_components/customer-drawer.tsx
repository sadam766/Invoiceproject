
'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
    Plus, 
    Trash2, 
    MapPin, 
    BadgeCheck, 
    Home, 
    Building2, 
    Mail, 
    User, 
    FilePlus, 
    Edit3,
    Copy,
    ExternalLink,
    Map as MapIcon,
    Phone,
    Clock
} from 'lucide-react';
import type { Customer, CustomerAddress } from '@/app/lib/data';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type CustomerDrawerProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customerData?: Customer;
  onSave: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
};

export function CustomerDrawer({ isOpen, onOpenChange, customerData, onSave }: CustomerDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [billingSchedule, setBillingSchedule] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  
  // New address state
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNpwp, setNewNpwp] = useState('');
  const [isEditingMain, setIsEditingMain] = useState(false);

  useEffect(() => {
    if (customerData && isOpen) {
      setName(customerData.name);
      setEmail(customerData.email || '');
      setContactPerson(customerData.contactPerson || '');
      setPhone(customerData.phone || '');
      setBillingSchedule(customerData.billingSchedule || '');
      setAddresses(customerData.addresses || []);
      setIsEditingMain(false);
    } else if (!isOpen) {
      setName('');
      setEmail('');
      setContactPerson('');
      setPhone('');
      setBillingSchedule('');
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
      isDefault: addresses.length === 0,
    };
    setAddresses([...addresses, newEntry]);
    resetNewAddressForm();
    toast({ title: "Alamat Ditambahkan", description: "Klik simpan di bawah untuk memperbarui data master." });
  };

  const handleRemoveAddress = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
  };

  const handleSetDefault = (id: string) => {
    setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));
  };

  const handleSave = () => {
    if (!name) return;
    onSave({ id: customerData?.id, name, email, contactPerson, phone, billingSchedule, addresses });
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Alamat Disalin", description: "Teks alamat telah siap di clipboard." });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col bg-slate-50 overflow-hidden border-l-0 shadow-2xl">
        <SheetHeader className="p-8 bg-white border-b space-y-4">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Legal Customer Profile</p>
                <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">
                    {customerData ? customerData.name : 'Register New PT'}
                </SheetTitle>
             </div>
             <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-3 py-1">
                {addresses.length} Active Address
             </Badge>
          </div>

          <div className="flex gap-3">
             <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase border-slate-200 gap-2 rounded-xl" onClick={() => setIsEditingMain(!isEditingMain)}>
                <Edit3 className="h-3.5 w-3.5" /> {isEditingMain ? 'Cancel Edit' : 'Edit Legal Info'}
             </Button>
             <Button size="sm" className="h-9 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 gap-2 rounded-xl px-4 shadow-lg shadow-indigo-100" onClick={() => router.push(`/dashboard/invoices/number`)}>
                <FilePlus className="h-3.5 w-3.5" /> Start Billing
             </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-8 pt-6">
          <div className="space-y-10">
            {/* LEGAL INFO SECTION */}
            <div className={cn("space-y-6 transition-all", isEditingMain ? "bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm" : "")}>
                <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Administrative Identity</h3>
                </div>
                {isEditingMain ? (
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Official PT Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="font-black uppercase h-11" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase">Contact Person</Label>
                                <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Bpk. John Doe" className="h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase">Phone / WA</Label>
                                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0812..." className="h-11" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Jadwal Terima Tagihan</Label>
                            <Input value={billingSchedule} onChange={e => setBillingSchedule(e.target.value)} placeholder="Contoh: Selasa (10.00 - 16.00)" className="h-11 border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Billing Contact Email</Label>
                            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="finance@customer.com" className="h-11" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Email</p>
                            <p className="text-sm font-bold flex items-center gap-2 text-slate-700"><Mail className="h-3.5 w-3.5 text-indigo-400" /> {email || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Point</p>
                            <p className="text-sm font-bold flex items-center gap-2 text-slate-700"><User className="h-3.5 w-3.5 text-indigo-400" /> {contactPerson || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                            <p className="text-sm font-bold flex items-center gap-2 text-slate-700"><Phone className="h-3.5 w-3.5 text-indigo-400" /> {phone || '-'}</p>
                        </div>
                        <div className="space-y-1 col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Clock className="h-3 w-3" /> Jadwal Terima Tagihan</p>
                            <p className="text-sm font-black text-amber-800 uppercase mt-1">{billingSchedule || 'BELUM DIATUR'}</p>
                        </div>
                    </div>
                )}
            </div>

            <Separator className="bg-slate-200" />

            {/* ADDRESS BOOK SECTION */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">Address Book Network</h3>
                    </div>
                </div>

                <div className="grid gap-4">
                    {addresses.map((addr) => (
                        <Card key={addr.id} className={cn(
                            "relative group overflow-hidden border-none shadow-sm ring-1 transition-all duration-300 rounded-2xl",
                            addr.isDefault ? "ring-indigo-600 bg-white" : "ring-slate-200 bg-slate-100/50 hover:ring-indigo-300 hover:bg-white"
                        )}>
                            <div className={cn("absolute top-0 left-0 w-1.5 h-full", addr.isDefault ? "bg-indigo-600" : "bg-slate-300")} />
                            <CardContent className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {addr.label.toLowerCase().includes('office') ? <Home className="h-4 w-4 text-indigo-600" /> : <Building2 className="h-4 w-4 text-slate-400" />}
                                        <span className={cn("text-[10px] font-black uppercase tracking-wider", addr.isDefault ? "text-indigo-700" : "text-slate-500")}>
                                            {addr.label}
                                        </span>
                                        {addr.isDefault && <BadgeCheck className="h-3.5 w-3.5 text-indigo-600" />}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-indigo-600" onClick={() => copyToClipboard(addr.address)}>
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-rose-400 hover:text-rose-600" onClick={() => handleRemoveAddress(addr.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                
                                <p className="text-[11px] leading-relaxed font-medium text-slate-600 italic mb-4">
                                    {addr.address}
                                </p>

                                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">NPWP Cabang:</span>
                                        <span className="text-[10px] font-mono font-black text-slate-700">{addr.npwp || 'NOT SET'}</span>
                                    </div>
                                    {!addr.isDefault && (
                                        <Button variant="link" size="sm" className="h-auto p-0 text-[9px] font-black uppercase text-indigo-600" onClick={() => handleSetDefault(addr.id)}>
                                            Set as HQ
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* ADD NEW ADDRESS CARD */}
                    <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 rounded-2xl">
                        <CardContent className="p-6 space-y-4">
                            <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest text-center">Registrasi Alamat Cabang Baru</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-500">Label Cabang</Label>
                                    <Input placeholder="E.g. Cabang Bandung" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-9 text-xs bg-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-500">NPWP Unit</Label>
                                    <Input placeholder="00.000.000.0-000.000" value={newNpwp} onChange={e => setNewNpwp(e.target.value)} className="h-9 text-xs bg-white font-mono" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-500">Alamat Lengkap</Label>
                                <textarea 
                                    className="w-full rounded-xl border border-indigo-100 bg-white px-4 py-3 text-xs min-h-[80px] focus:ring-1 focus:ring-indigo-600 outline-none"
                                    placeholder="Jalan, No, Blok, Kelurahan, Kota..."
                                    value={newAddress}
                                    onChange={e => setNewAddress(e.target.value)}
                                />
                            </div>
                            <Button type="button" size="sm" className="w-full h-10 bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-600 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all" onClick={handleAddAddress} disabled={!newLabel || !newAddress}>
                                <Plus className="h-3.5 w-3.5 mr-2" /> Simpan ke Address Book
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 bg-white border-t-2 border-slate-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <Button type="button" onClick={handleSave} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 rounded-2xl">
              Kunci Perubahan Profil
          </Button>
          <p className="text-center text-[8px] font-bold text-slate-400 uppercase mt-4 tracking-widest">Data akan diperbarui secara permanen di seluruh sistem Dakota.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
