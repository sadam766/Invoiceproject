'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2, Home, Printer, Loader2 } from 'lucide-react';
import type { Customer, CustomerAddress } from '@/app/lib/data';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type AddressSelectorDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customer: Customer | null;
    spdId: string;
};

export function AddressSelectorDialog({ isOpen, onOpenChange, customer, spdId }: AddressSelectorDialogProps) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [isDefault, setIsDefault] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (customer && isOpen) {
            const defaultId = customer.defaultShippingAddressId || 
                              customer.addresses?.find(a => a.isDefault)?.id || 
                              customer.addresses?.[0]?.id || '';
            setSelectedAddressId(defaultId);
        }
    }, [customer, isOpen]);

    const handleContinueToPrint = async () => {
        if (!customer || !selectedAddressId || !spdId) return;

        setIsProcessing(true);
        try {
            if (isDefault && firestore && customer.id) {
                await updateDoc(doc(firestore, 'customers', customer.id), {
                    defaultShippingAddressId: selectedAddressId
                });
            }
            
            // Redirect to envelope print page
            router.push(`/dashboard/invoices/spd/envelope/${encodeURIComponent(spdId)}?addressId=${selectedAddressId}`);
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal memproses alamat" });
        } finally {
            setIsProcessing(false);
            onOpenChange(false);
        }
    };

    if (!customer) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <DialogHeader className="p-8 bg-white border-b">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2.5 rounded-2xl"><MapPin className="h-6 w-6 text-indigo-600" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Smart Address Selector</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase text-slate-400 mt-1">Pilih alamat tujuan untuk pencetakan amplop.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-6 bg-slate-50/50">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Address Book: {customer.name}</Label>
                        <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="grid gap-3">
                            {customer.addresses?.map((addr) => (
                                <div key={addr.id}>
                                    <input 
                                        type="radio" 
                                        id={addr.id} 
                                        name="address" 
                                        value={addr.id} 
                                        className="peer hidden" 
                                        checked={selectedAddressId === addr.id}
                                        onChange={() => setSelectedAddressId(addr.id)}
                                    />
                                    <Label
                                        htmlFor={addr.id}
                                        className={cn(
                                            "flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                                            selectedAddressId === addr.id 
                                                ? "bg-white border-indigo-600 shadow-md ring-4 ring-indigo-50" 
                                                : "bg-white border-slate-100 hover:border-indigo-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                                            selectedAddressId === addr.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                                        )}>
                                            {selectedAddressId === addr.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                {addr.label.toLowerCase().includes('office') ? <Home className="h-3.5 w-3.5 text-indigo-500" /> : <Building2 className="h-3.5 w-3.5 text-amber-500" />}
                                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{addr.label}</span>
                                                {addr.id === customer.defaultShippingAddressId && <Badge variant="secondary" className="text-[7px] h-3.5 bg-indigo-50 text-indigo-600 border-none font-black uppercase">DEFAULT</Badge>}
                                            </div>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed line-clamp-2 italic">
                                                {addr.address}
                                            </p>
                                        </div>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>

                    <div className="flex items-center space-x-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                        <Checkbox id="set-default" checked={isDefault} onCheckedChange={(c) => setIsDefault(!!c)} />
                        <Label htmlFor="set-default" className="text-[10px] font-black uppercase text-indigo-700 cursor-pointer">Simpan sebagai alamat pengiriman utama</Label>
                    </div>
                </div>

                <DialogFooter className="p-8 bg-white border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-12 font-bold px-8">Batal</Button>
                    <Button 
                        onClick={handleContinueToPrint} 
                        disabled={!selectedAddressId || isProcessing}
                        className="h-12 flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-100"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                        BUKA PRATINJAU AMPLOP
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}