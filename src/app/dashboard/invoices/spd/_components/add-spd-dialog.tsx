
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Search, 
  Truck, 
  FileText, 
  MapPin, 
  CheckCircle2, 
  Calendar as CalendarIcon 
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { SpdData, Invoice, UserProfile, SpdInvoiceEntry } from '@/app/lib/data';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type AddSpdDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: SpdData) => void;
  spdData?: SpdData;
  onAddClick: () => void;
};

export function AddSpdDialog({ isOpen, onOpenChange, onSave, spdData, onAddClick }: AddSpdDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [spdId, setSpdId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [courier, setCourier] = useState('');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<SpdInvoiceEntry[]>([]);

  // Fetch Invoices available for SPD (Status 'sent' and no spdNumber)
  const availableInvoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'invoices'), 
        where('status', '==', 'sent')
    );
  }, [firestore]);
  
  const { data: allSentInvoices } = useCollection<Invoice>(availableInvoicesQuery);

  const filteredInvoices = useMemo(() => {
      if (!allSentInvoices) return [];
      // Filter out those already in another SPD (using spdNumber field)
      // and filter by search
      return allSentInvoices.filter(inv => 
        (!inv.spdNumber || inv.spdNumber === spdId) &&
        (inv.id.toLowerCase().includes(searchInvoice.toLowerCase()) || 
         inv.customer.toLowerCase().includes(searchInvoice.toLowerCase()))
      );
  }, [allSentInvoices, searchInvoice, spdId]);

  useEffect(() => {
    if (spdData && isOpen) {
      setSpdId(spdData.id);
      setDate(spdData.date);
      setCourier(spdData.courier);
      setSelectedInvoices(spdData.invoices || []);
    } else if (!isOpen) {
      // Generate new ID format: SPD/YYYY/MM/XXX
      const now = new Date();
      setSpdId(`SPD/${format(now, 'yyyy/MM')}/${Math.floor(100 + Math.random() * 900)}`);
      setDate(format(now, 'yyyy-MM-dd'));
      setCourier('');
      setSelectedInvoices([]);
      setSearchInvoice('');
    }
  }, [spdData, isOpen]);

  const toggleInvoice = (inv: Invoice) => {
    const exists = selectedInvoices.find(si => si.invoiceId === inv.id);
    if (exists) {
        setSelectedInvoices(selectedInvoices.filter(si => si.invoiceId !== inv.id));
    } else {
        setSelectedInvoices([...selectedInvoices, {
            invoiceId: inv.id,
            customer: inv.customer,
            address: inv.billingAddress,
            status: 'pending'
        }]);
    }
  };

  const handleSave = () => {
    if (!courier || selectedInvoices.length === 0) return;
    onSave({
      id: spdId,
      date,
      courier,
      invoices: selectedInvoices,
      status: spdData?.status || 'in_delivery'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" /> BUAT SPD BARU
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> 
              {spdData ? "Edit SPD" : "Register Digital Dispatch (SPD)"}
          </DialogTitle>
          <DialogDescription>
            Pilih invoice yang akan dibawa kurir untuk pengiriman hari ini.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 flex-1 overflow-hidden">
          {/* SPD Header Info */}
          <div className="space-y-4 border-r pr-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nomor SPD (Auto)</Label>
                <Input value={spdId} readOnly className="bg-muted font-mono text-xs" />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tanggal Kirim</Label>
                <div className="relative">
                    <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="pl-8" />
                </div>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Kurir / Ekspedisi</Label>
                <Input 
                    placeholder="Nama Kurir (Internal/Eksternal)" 
                    value={courier} 
                    onChange={e => setCourier(e.target.value)} 
                />
             </div>

             <div className="pt-4 mt-4 border-t">
                <p className="text-[10px] font-black uppercase text-indigo-600 mb-2">Summary</p>
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center">
                        <span className="text-xs">Invoice Terpilih:</span>
                        <span className="text-sm font-bold text-indigo-700">{selectedInvoices.length}</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Smart Pick Invoices */}
          <div className="md:col-span-2 flex flex-col gap-4 overflow-hidden">
             <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Cari Nomor Invoice atau Customer..." 
                    className="pl-8"
                    value={searchInvoice}
                    onChange={e => setSearchInvoice(e.target.value)}
                />
             </div>

             <Label className="text-[10px] font-bold uppercase text-muted-foreground">Daftar Invoice Siap Kirim (Status: Sent)</Label>
             
             <ScrollArea className="flex-1 border rounded-md p-2">
                <div className="space-y-2">
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-10 opacity-40 italic text-xs">Tidak ada invoice siap kirim ditemukan.</div>
                    ) : filteredInvoices.map((inv) => {
                        const isSelected = selectedInvoices.some(si => si.invoiceId === inv.id);
                        return (
                            <div 
                                key={inv.id} 
                                onClick={() => toggleInvoice(inv)}
                                className={cn(
                                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                                    isSelected ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                                )}
                            >
                                <Checkbox checked={isSelected} className="mt-1" />
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold font-mono">{inv.id}</span>
                                        <span className="text-[10px] text-muted-foreground">Rp {inv.amount.toLocaleString('id-ID')}</span>
                                    </div>
                                    <p className="text-[11px] font-black uppercase leading-none">{inv.customer}</p>
                                    <div className="flex items-start gap-1 text-[9px] text-muted-foreground">
                                        <MapPin className="h-2 w-2 shrink-0 mt-0.5" />
                                        <span className="line-clamp-1">{inv.billingAddress}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="button" onClick={handleSave} disabled={!courier || selectedInvoices.length === 0}>
             <CheckCircle2 className="mr-2 h-4 w-4" /> SIMPAN & TERBITKAN SPD
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
