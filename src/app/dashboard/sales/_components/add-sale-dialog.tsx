
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Check, ChevronsUpDown, Info, Layers, Percent } from 'lucide-react';
import type { SalesListItem, Customer, UserProfile, PaymentStage } from '@/app/lib/data';
import { useState, useEffect } from 'react';
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

const SCHEME_PRESETS: Record<string, PaymentStage[]> = {
    'full': [{ label: 'Full Payment', percent: 100, trigger: 'PO' }],
    'split_30_70': [
        { label: 'Down Payment', percent: 30, trigger: 'PO' },
        { label: 'Final Payment', percent: 70, trigger: 'Delivery' }
    ],
    'split_50_50': [
        { label: 'Down Payment', percent: 50, trigger: 'PO' },
        { label: 'Final Payment', percent: 50, trigger: 'Delivery' }
    ],
    'split_20_70_10': [
        { label: 'Down Payment', percent: 20, trigger: 'PO' },
        { label: 'Progress Payment', percent: 70, trigger: 'Delivery' },
        { label: 'Retention', percent: 10, trigger: 'Retention' }
    ]
};

export function AddSaleDialog({ isOpen, onOpenChange, onSave, saleData, onAddClick }: AddSaleDialogProps) {
    const firestore = useFirestore();
    const [poNumber, setPoNumber] = useState('');
    const [customer, setCustomer] = useState('');
    const [sales, setSales] = useState('');
    const [soNumber, setSoNumber] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [paidOffline, setPaidOffline] = useState<string>('');
    const [selectedSchemeKey, setSelectedSchemeKey] = useState<string>('full');
    const [customStages, setCustomStages] = useState<PaymentStage[]>([]);
    
    const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
    const [salesPopoverOpen, setSalesPopoverOpen] = useState(false);

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
            setPaidOffline(formatNumberWithCommas(saleData.paidOffline || 0));
            
            if (saleData.paymentScheme) {
                const matchedKey = Object.keys(SCHEME_PRESETS).find(key => 
                    JSON.stringify(SCHEME_PRESETS[key]) === JSON.stringify(saleData.paymentScheme)
                );
                setSelectedSchemeKey(matchedKey || 'custom');
                if (!matchedKey) setCustomStages(saleData.paymentScheme);
            }
        } else if (!isOpen) {
            setPoNumber('');
            setCustomer('');
            setSales('');
            setSoNumber('');
            setAmount('');
            setPaidOffline('');
            setSelectedSchemeKey('full');
            setCustomStages([]);
        }
    }, [saleData, isOpen]);
    
    const handleNumericChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        // Hapus karakter non-numeric agar user bebas mengetik
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value === '') { setter(''); return; }
        
        // Simpan dalam format bertitik (ribuan) untuk kenyamanan visual
        const num = parseInt(value, 10);
        if (!isNaN(num)) {
            setter(num.toLocaleString('id-ID'));
        }
    };

    const handleSave = () => {
        const scheme = selectedSchemeKey === 'custom' ? customStages : SCHEME_PRESETS[selectedSchemeKey];
        onSave({
            poNumber,
            customer,
            sales,
            soNumber,
            amount: parseFormattedNumber(amount),
            paidOffline: parseFormattedNumber(paidOffline),
            status: saleData?.status || 'Unpaid',
            paymentScheme: scheme
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase">Register Incoming PO</DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400">
            Masukkan data sesuai Purchase Order (PO) dari Customer. Tidak ada batasan jumlah digit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="po-number" className="text-[10px] font-black uppercase text-slate-400">Nomor PO Customer <span className="text-red-500">*</span></Label>
            <Input id="po-number" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Contoh: PO/2024/001" disabled={!!saleData} className="font-bold h-11" />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Customer</Label>
                <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-bold">
                            {customer || "Pilih Customer..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 shadow-xl border border-muted rounded-xl overflow-hidden" align="start">
                        <Command>
                            <CommandInput placeholder="Cari..." />
                            <CommandList>
                                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
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
                <Label className="text-[10px] font-black uppercase text-slate-400">Sales Person</Label>
                <Popover open={salesPopoverOpen} onOpenChange={setSalesPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-bold">
                            {sales || "Pilih Sales..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 shadow-xl border border-muted rounded-xl overflow-hidden" align="start">
                        <Command>
                            <CommandInput placeholder="Cari..." />
                            <CommandList>
                                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
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
          </div>

          <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount" className="text-[10px] font-black uppercase text-slate-400">Total Nilai PO (Netto)</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                    <Input 
                        type="text" 
                        id="amount" 
                        value={amount} 
                        onChange={handleNumericChange(setAmount)} 
                        placeholder="0" 
                        className="pl-10 h-14 text-lg font-black bg-slate-50 border-indigo-100 focus-visible:ring-indigo-500 rounded-2xl"
                    />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="so-number" className="text-[10px] font-black uppercase text-slate-400">No. SO Produksi (Optional)</Label>
                <Input id="so-number" value={soNumber} onChange={e => setSoNumber(e.target.value)} placeholder="E.g. SO/2024/..." className="h-11 font-bold rounded-xl" />
              </div>
          </div>

          <div className="p-5 bg-indigo-50/30 rounded-3xl border-2 border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-indigo-700 tracking-widest flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Payment Term Blueprint
                  </Label>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-[8px] font-black">STANDARD</Badge>
              </div>
              
              <Select value={selectedSchemeKey} onValueChange={setSelectedSchemeKey}>
                  <SelectTrigger className="bg-white h-11 font-bold rounded-xl border-indigo-200">
                      <SelectValue placeholder="Pilih Skema Bayar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                      <SelectItem value="full">Full Payment (100%)</SelectItem>
                      <SelectItem value="split_30_70">Standard Split (30% DP - 70% Final)</SelectItem>
                      <SelectItem value="split_50_50">Standard Split (50% DP - 50% Final)</SelectItem>
                      <SelectItem value="split_20_70_10">Project (20% DP - 70% Prog - 10% Ret)</SelectItem>
                  </SelectContent>
              </Select>

              <div className="grid gap-2 pt-2">
                  {(selectedSchemeKey === 'custom' ? customStages : SCHEME_PRESETS[selectedSchemeKey])?.map((stage, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-indigo-50 text-[11px] font-black">
                          <span className="flex items-center gap-2 uppercase">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              {stage.label}
                          </span>
                          <span className="text-indigo-600">
                              {stage.percent}%
                          </span>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-100 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-800 font-black text-[10px] uppercase tracking-widest">
                  <Info className="h-4 w-4" /> Legacy Migration Adjustment
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paid-offline" className="text-[10px] uppercase font-black text-blue-700">Saldo Terbayar (Sistem Lama)</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-blue-400">Rp</span>
                    <Input 
                        type="text"
                        id="paid-offline" 
                        value={paidOffline} 
                        onChange={handleNumericChange(setPaidOffline)} 
                        placeholder="0" 
                        className="pl-10 h-12 text-md font-black border-blue-200 focus-visible:ring-blue-500 bg-white rounded-2xl"
                    />
                </div>
                <p className="text-[9px] text-blue-600 leading-tight italic font-medium px-1">
                    *Masukkan total dana yang sudah masuk di sistem lama agar piutang tersinkronisasi sempurna.
                </p>
              </div>
          </div>
        </div>
        <DialogFooter className="pt-6 border-t">
          <Button type="button" onClick={handleSave} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100">
            Simpan Data & Kunci Kontrak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    );
}
