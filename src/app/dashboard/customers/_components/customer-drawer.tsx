
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
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
    Phone,
    Clock,
    CreditCard,
    ShieldAlert,
    Database,
    Cpu,
    Loader2,
    RefreshCw,
    Sparkles,
    Search
} from 'lucide-react';
import type { Customer, CustomerAddress, VirtualAccount } from '@/app/lib/data';
import { cn, generateVirtualAccount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

type CustomerDrawerProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customerData?: Customer;
  onSave: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
};

export function CustomerDrawer({ isOpen, onOpenChange, customerData, onSave }: CustomerDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [name, setName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [billingSchedule, setBillingSchedule] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  
  const [vaNumber, setVaNumber] = useState('');
  const [vaSource, setVaSource] = useState<'database' | 'system' | 'searching'>('system');

  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNpwp, setNewNpwp] = useState('');
  const [isEditingMain, setIsEditingMain] = useState(false);

  // LOGIC: Smart Initial Extraction (Reactive)
  // Menghasilkan inisial 3 huruf + 001 dari Nama PT
  const generateInitialCode = useCallback((ptName: string) => {
      if (!ptName) return '';
      // Clean PT, CV, Tbk, UD
      const clean = ptName.replace(/PT\.|PT|CV\.|CV|UD\.|UD|Tbk\.|Tbk/gi, '').trim();
      const words = clean.split(/\s+/).filter(w => w.length > 0);
      
      let initial = "";
      if (words.length >= 2) {
          // ABA logic: First letter of each word
          initial = words.map(w => w[0]).join('').substring(0, 3);
          // If ABA logic results in only 2 chars, add one more from 1st word
          if (initial.length < 3) initial = clean.substring(0, 3);
      } else if (words.length === 1) {
          initial = words[0].substring(0, 3);
      }
      
      return initial.toUpperCase().padEnd(3, 'X') + "001";
  }, []);

  // EFFECT 1: Reactive Code Generation on Name Change
  useEffect(() => {
      if (isOpen && !customerData && name && !isEditingMain) {
          const autoCode = generateInitialCode(name);
          setCustomerCode(autoCode);
      }
  }, [name, isOpen, customerData, isEditingMain, generateInitialCode]);

  useEffect(() => {
    if (customerData && isOpen) {
      setName(customerData.name);
      setCustomerCode(customerData.customerCode || '');
      setEmail(customerData.email || '');
      setContactPerson(customerData.contactPerson || '');
      setPhone(customerData.phone || '');
      setBillingSchedule(customerData.billingSchedule || '');
      setAddresses(customerData.addresses || []);
      setVaNumber(customerData.virtualAccountNumber || '');
      setIsEditingMain(false);
    } else if (isOpen && !customerData) {
      setName('');
      setCustomerCode('');
      setEmail('');
      setContactPerson('');
      setPhone('');
      setBillingSchedule('');
      setAddresses([]);
      setVaNumber('');
      setVaSource('system');
      setIsEditingMain(true);
    }
  }, [customerData, isOpen]);

  // EFFECT 2: REACTIVE VA SYNC (Mapping Database vs Auto-Generate)
  useEffect(() => {
      const fetchOrGenerateVa = async () => {
          const trimmedCode = customerCode.trim().toUpperCase();
          if (!trimmedCode || trimmedCode.length < 4 || !firestore) {
              setVaNumber('');
              setVaSource('system');
              return;
          }

          setVaSource('searching');
          
          try {
              // Priority 1: Exact Case-Sensitive matching with Imported database
              const vaRef = collection(firestore, 'virtualAccounts');
              const q = query(vaRef, where('customerCode', '==', trimmedCode));
              const snapshot = await getDocs(q);

              if (!snapshot.empty) {
                  const existingVa = snapshot.docs[0].data() as VirtualAccount;
                  setVaNumber(existingVa.vaNumber);
                  setVaSource('database');
              } else {
                  // Priority 2: Replicate User's Excel ASCII logic (Fallback)
                  const generated = generateVirtualAccount(trimmedCode);
                  setVaNumber(generated);
                  setVaSource('system');
              }
          } catch (error) {
              console.error("VA Lookup Error:", error);
              setVaSource('system');
          }
      };

      const timer = setTimeout(fetchOrGenerateVa, 350); // Debounce
      return () => clearTimeout(timer);
  }, [customerCode, firestore]);

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
    setNewLabel('');
    setNewAddress('');
    setNewNpwp('');
  };

  const handleSave = () => {
    if (!name || !customerCode) {
        toast({ variant: "destructive", title: "Data Incomplete", description: "Nama PT dan Kode ERP wajib diisi." });
        return;
    }
    
    onSave({ 
        id: customerData?.id, 
        name, 
        customerCode: customerCode.trim().toUpperCase(),
        email, 
        contactPerson, 
        phone, 
        billingSchedule, 
        addresses,
        virtualAccountNumber: vaNumber
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col bg-slate-50 overflow-hidden border-l-0 shadow-2xl">
        <SheetHeader className="p-8 bg-white border-b space-y-4">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Legal Identity Module</p>
                <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">
                    {customerData ? customerData.name : (name || 'Register New PT')}
                </SheetTitle>
             </div>
             {customerCode && (
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-3 py-1">
                    ERP ID: {customerCode}
                </Badge>
             )}
          </div>

          <div className="flex gap-3">
             <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase border-slate-200 gap-2 rounded-xl" onClick={() => setIsEditingMain(!isEditingMain)}>
                <Edit3 className="h-3.5 w-3.5" /> {isEditingMain ? 'Finish Editing' : 'Edit Identity'}
             </Button>
             <Button size="sm" className="h-9 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 gap-2 rounded-xl px-4 shadow-lg shadow-indigo-100" onClick={() => router.push(`/dashboard/invoices/number`)}>
                <FilePlus className="h-3.5 w-3.5" /> Start Billing
             </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-8 pt-6">
          <div className="space-y-10">
            <div className={cn("space-y-6 transition-all", isEditingMain ? "bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm" : "")}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Core Profile</h3>
                    </div>
                </div>

                {isEditingMain ? (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-[10px] font-black uppercase flex items-center gap-2">Official PT Name <Sparkles className="h-2.5 w-2.5 text-indigo-500 animate-pulse" /></Label>
                                <Input value={name} onChange={e => setName(e.target.value)} className="font-black uppercase h-11" placeholder="PT JEMBO CABLE" />
                                <p className="text-[8px] text-slate-400 font-bold uppercase italic">Ketik nama untuk auto-generate Kode & VA secara real-time.</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                                    Unique Code <RefreshCw className={cn("h-2.5 w-2.5", vaSource === 'searching' && "animate-spin")} />
                                </Label>
                                <Input value={customerCode} onChange={e => setCustomerCode(e.target.value.toUpperCase())} className="font-black h-11 border-indigo-300 ring-2 ring-indigo-50" placeholder="ADH004" />
                            </div>
                        </div>

                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
                            <div className="flex justify-between items-center">
                                <Label className="text-[9px] font-black uppercase text-indigo-400 flex items-center gap-1.5">
                                    <CreditCard className="h-3 w-3" /> Mandiri Virtual Account (16 Digit)
                                </Label>
                                {vaSource === 'searching' ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                                ) : vaSource === 'database' ? (
                                    <Badge className="bg-emerald-600 text-[7px] font-black uppercase h-4 px-1.5"><Database className="h-2 w-2 mr-1" /> Linked from ERP</Badge>
                                ) : (
                                    <Badge className="bg-indigo-600 text-[7px] font-black uppercase h-4 px-1.5"><Cpu className="h-2 w-2 mr-1" /> Auto-Generated</Badge>
                                )}
                            </div>
                            <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl">
                                <span className={cn("font-mono font-black text-lg tracking-widest", (vaNumber.length === 16) ? "text-white" : "text-rose-400 opacity-50")}>
                                    {vaNumber || 'AWAITING CODE...'}
                                </span>
                                {vaNumber.length > 0 && vaNumber.length !== 16 && (
                                    <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" />
                                )}
                            </div>
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
                            <Input value={billingSchedule} onChange={e => setBillingSchedule(e.target.value)} placeholder="Contoh: Selasa (10.00 - 16.00)" className="h-11 border-amber-200" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Unique Code</p>
                                <p className="text-sm font-black text-indigo-700">{customerCode || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Virtual Account</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-mono font-black text-emerald-700">{vaNumber || 'NOT SET'}</p>
                                </div>
                            </div>
                            <div className="space-y-1 col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Clock className="h-3 w-3" /> Jadwal Terima Tagihan</p>
                                <p className="text-sm font-black text-amber-800 uppercase mt-1">{billingSchedule || 'BELUM DIATUR'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Separator className="bg-slate-200" />

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
                            "relative group overflow-hidden border-none shadow-sm ring-1 transition-all rounded-2xl",
                            addr.isDefault ? "ring-indigo-600 bg-white" : "ring-slate-200 bg-slate-100/50"
                        )}>
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        {addr.label.toLowerCase().includes('office') ? <Home className="h-4 w-4 text-indigo-600" /> : <Building2 className="h-4 w-4 text-slate-400" />}
                                        <span className="text-[10px] font-black uppercase tracking-wider">{addr.label}</span>
                                        {addr.isDefault && <BadgeCheck className="h-3.5 w-3.5 text-indigo-600" />}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-400" onClick={() => setAddresses(addresses.filter(a => a.id !== addr.id))}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                <p className="text-[11px] font-medium text-slate-600 italic">{addr.address}</p>
                            </CardContent>
                        </Card>
                    ))}

                    <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 rounded-2xl">
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">Label Cabang</Label>
                                    <Input placeholder="Cabang / Site" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-9 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">NPWP</Label>
                                    <Input placeholder="00.000..." value={newNpwp} onChange={e => setNewNpwp(e.target.value)} className="h-9 text-xs" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase">Alamat Lengkap</Label>
                                <textarea 
                                    className="w-full rounded-xl border border-indigo-100 bg-white px-4 py-3 text-xs min-h-[80px]"
                                    placeholder="Jalan, Blok, No..."
                                    value={newAddress}
                                    onChange={e => setNewAddress(e.target.value)}
                                />
                            </div>
                            <Button type="button" size="sm" className="w-full bg-white border-2 border-indigo-600 text-indigo-700 font-black uppercase text-[10px] rounded-xl" onClick={handleAddAddress}>
                                <Plus className="h-3.5 w-3.5 mr-2" /> Add to Address Book
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 bg-white border-t-2 border-slate-100">
          <Button type="button" onClick={handleSave} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-xs tracking-[0.2em] rounded-2xl">
              Simpan Profil Pelanggan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
