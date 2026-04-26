
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
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  MapPin, 
  CheckCircle2, 
  Calendar as CalendarIcon,
  Layers,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { SpdData, Invoice, SpdInvoiceEntry } from '@/app/lib/data';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type AddSpdDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: SpdData) => void;
  spdData?: SpdData;
  onAddClick: () => void;
  initialPreselectedInvoices?: SpdInvoiceEntry[];
};

export function AddSpdDialog({ isOpen, onOpenChange, onSave, spdData, onAddClick, initialPreselectedInvoices }: AddSpdDialogProps) {
  const firestore = useFirestore();
  
  const [spdId, setSpdId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [courier, setCourier] = useState('');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<SpdInvoiceEntry[]>([]);

  const [localSjAdditions, setLocalSjAdditions] = useState<Record<string, string>>({});

  const availableInvoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'invoices'), 
        where('status', 'in', ['sent', 'partial', 'unpaid'])
    );
  }, [firestore]);
  
  const { data: allSentInvoices, isLoading: isLoadingInvoices } = useCollection<Invoice>(availableInvoicesQuery);

  const filteredAvailableInvoices = useMemo(() => {
      if (!allSentInvoices) return [];
      
      return allSentInvoices.filter(inv => {
          const isNotAssigned = !inv.spdNumber || (spdData && inv.spdNumber === spdData.id);
          const matchesSearch = inv.id.toLowerCase().includes(searchInvoice.toLowerCase()) || 
                                inv.customer.toLowerCase().includes(searchInvoice.toLowerCase());
          return isNotAssigned && matchesSearch;
      });
  }, [allSentInvoices, searchInvoice, spdData]);

  useEffect(() => {
    if (spdData && isOpen) {
      setSpdId(spdData.id);
      setDate(spdData.date);
      setCourier(spdData.courier);
      setSelectedInvoices(spdData.invoices || []);
      const initialSjs: Record<string, string> = {};
      spdData.invoices.forEach(inv => {
          if (inv.sjNumbers) initialSjs[inv.invoiceId] = inv.sjNumbers.join(', ');
      });
      setLocalSjAdditions(initialSjs);
    } else if (isOpen && initialPreselectedInvoices) {
        const now = new Date();
        setSpdId(`SPD/${format(now, 'yyyy/MM')}/${Math.floor(100 + Math.random() * 900)}`);
        setDate(format(now, 'yyyy-MM-dd'));
        setSelectedInvoices(initialPreselectedInvoices);
        const initialSjs: Record<string, string> = {};
        initialPreselectedInvoices.forEach(inv => {
            if (inv.sjNumbers) initialSjs[inv.invoiceId] = inv.sjNumbers.join(', ');
        });
        setLocalSjAdditions(initialSjs);
    } else if (!isOpen) {
      const now = new Date();
      setSpdId(`SPD/${format(now, 'yyyy/MM')}/${Math.floor(100 + Math.random() * 900)}`);
      setDate(format(now, 'yyyy-MM-dd'));
      setCourier('');
      setSelectedInvoices([]);
      setSearchInvoice('');
      setLocalSjAdditions({});
    }
  }, [spdData, isOpen, initialPreselectedInvoices]);

  const toggleInvoice = (inv: Invoice) => {
    const exists = selectedInvoices.find(si => si.invoiceId === inv.id);
    if (exists) {
        setSelectedInvoices(selectedInvoices.filter(si => si.invoiceId !== inv.id));
    } else {
        setSelectedInvoices([...selectedInvoices, {
            invoiceId: inv.id,
            customer: inv.customer,
            address: inv.billingAddress,
            status: 'pending',
            sjNumbers: inv.sjNumbers || [] 
        }]);
        if (inv.sjNumbers && inv.sjNumbers.length > 0) {
            setLocalSjAdditions(prev => ({ ...prev, [inv.id]: inv.sjNumbers!.join(', ') }));
        }
    }
  };

  const handleSjChange = (invoiceId: string, val: string) => {
    setLocalSjAdditions(prev => ({ ...prev, [invoiceId]: val }));
  };

  const handleSave = async () => {
    if (!courier || selectedInvoices.length === 0 || !firestore) return;
    
    const processedInvoices = selectedInvoices.map(inv => {
        const rawSj = localSjAdditions[inv.invoiceId] || '';
        const sjList = rawSj.split(',').map(s => s.trim()).filter(s => s !== '');
        return { ...inv, sjNumbers: sjList };
    });

    // --- REFINEMENT: AUTO-STATUS "IN TRANSIT" ---
    const batch = writeBatch(firestore);
    processedInvoices.forEach(inv => {
        const invRef = doc(firestore, 'invoices', inv.invoiceId.replace(/\//g, '_'));
        batch.update(invRef, { 
            status: 'in_transit',
            spdNumber: spdId,
            sjNumbers: inv.sjNumbers
        });
    });

    onSave({
      id: spdId,
      date,
      courier,
      invoices: processedInvoices,
      status: spdData?.status || 'in_delivery'
    });
    
    await batch.commit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
          <Plus className="mr-2 h-4 w-4" /> BUAT SPD BARU
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Layers className="h-6 w-6 text-indigo-600" /> 
              SPD Multi-Surat Jalan Dispatch
          </DialogTitle>
          <DialogDescription>
            Pilih invoice dan lengkapi nomor Surat Jalan (SJ). Status invoice akan berubah menjadi 'In Transit'.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 flex-1 overflow-hidden border-t mt-4">
          <div className="bg-muted/30 p-6 space-y-6 border-r md:col-span-2">
             <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nomor SPD Digital</Label>
                    <Input value={spdId} readOnly className="bg-background font-mono text-xs font-bold border-indigo-100" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tanggal Pengiriman</Label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="pl-8 bg-background" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Kurir / Pembawa Dokumen</Label>
                    <Input 
                        placeholder="Nama Kurir atau Ekspedisi..." 
                        value={courier} 
                        onChange={e => setCourier(e.target.value)} 
                        className="bg-background"
                    />
                </div>
             </div>

             <div className="pt-6 border-t">
                <p className="text-[10px] font-black uppercase text-indigo-600 mb-3 tracking-widest">Selected List & SJ Management</p>
                <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-3">
                        {selectedInvoices.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic text-center py-10">Belum ada invoice dipilih.</p>
                        ) : selectedInvoices.map((inv) => (
                            <div key={inv.invoiceId} className="p-3 bg-white rounded-lg border border-indigo-100 shadow-sm space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-indigo-700">{inv.invoiceId}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-rose-500" onClick={() => setSelectedInvoices(selectedInvoices.filter(si => si.invoiceId !== inv.invoiceId))}>
                                        <Plus className="h-3 w-3 rotate-45" />
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Daftar No. Surat Jalan (SJ):</Label>
                                    <Input 
                                        className="h-7 text-[10px] font-mono bg-blue-50/30" 
                                        placeholder="SJ-001, SJ-002..." 
                                        value={localSjAdditions[inv.invoiceId] || ''}
                                        onChange={(e) => handleSjChange(inv.invoiceId, e.target.value)}
                                    />
                                    {(localSjAdditions[inv.invoiceId] || '').length === 0 && (
                                        <div className="flex items-center gap-1 text-[8px] text-amber-600 font-bold">
                                            <AlertTriangle className="h-2 w-2" /> WAJIB ADA SURAT JALAN
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
             </div>
          </div>

          <div className="md:col-span-3 flex flex-col bg-background overflow-hidden">
             <div className="p-4 border-b bg-muted/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari Customer atau No. Invoice..." 
                        className="pl-10 h-11 shadow-none border-none focus-visible:ring-0 text-sm"
                        value={searchInvoice}
                        onChange={e => setSearchInvoice(e.target.value)}
                    />
                </div>
             </div>

             <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Ready to Deliver Invoices</Label>
                        <Badge variant="secondary" className="text-[9px] h-4">{filteredAvailableInvoices.length} Tersedia</Badge>
                    </div>

                    {isLoadingInvoices ? (
                        <div className="text-center py-20 animate-pulse text-xs text-muted-foreground">Analisa antrian gudang...</div>
                    ) : filteredAvailableInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center space-y-2">
                            <Layers className="h-10 w-10 mb-2" />
                            <p className="text-xs font-medium">Data kosong. Pastikan invoice sudah diterbitkan.</p>
                        </div>
                    ) : filteredAvailableInvoices.map((inv) => {
                        const isSelected = selectedInvoices.some(si => si.invoiceId === inv.id);
                        return (
                            <div 
                                key={inv.id} 
                                onClick={() => toggleInvoice(inv)}
                                className={cn(
                                    "group relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                                    isSelected 
                                        ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-300" 
                                        : "bg-background hover:border-indigo-200 hover:bg-muted/10"
                                )}
                            >
                                <div className="mt-1">
                                    <Checkbox checked={isSelected} className="rounded-full h-5 w-5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                                </div>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black font-mono tracking-tight text-indigo-700">{inv.id}</span>
                                        <Badge variant="outline" className="text-[8px] h-4 uppercase">{inv.status}</Badge>
                                    </div>
                                    <p className="text-sm font-black uppercase leading-none truncate pr-4">{inv.customer}</p>
                                    <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                        <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-rose-500" />
                                        <span className="line-clamp-1 italic">{inv.billingAddress}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-10">Batal</Button>
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={!courier || selectedInvoices.length === 0}
            className="h-10 bg-indigo-600 hover:bg-indigo-700 px-8 font-bold"
          >
             <CheckCircle2 className="mr-2 h-4 w-4" /> TERBITKAN SPD (SIAP JALAN)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
