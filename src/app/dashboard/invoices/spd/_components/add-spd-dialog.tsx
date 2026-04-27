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
  AlertTriangle,
  FileDown
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { SpdData, Invoice, SpdInvoiceEntry } from '@/app/lib/data';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';

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
        where('status', 'in', ['sent', 'partial', 'unpaid', 'draft'])
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
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 h-10 font-black uppercase text-[10px] tracking-widest px-6 rounded-2xl group active:scale-95 transition-all">
          <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" /> BUAT SPD BARU
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 pb-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-2xl"><Layers className="h-6 w-6 text-indigo-600" /></div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                    SPD Multi-Document Dispatch
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase text-slate-400 tracking-tighter mt-1">
                    Konsolidasi surat jalan & invoice ke dalam satu batch pengiriman digital.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 flex-1 overflow-hidden border-t mt-4">
          <div className="bg-slate-50 p-8 space-y-8 border-r md:col-span-2">
             <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nomor SPD Digital</Label>
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 font-mono text-xs font-black text-indigo-700 shadow-sm">{spdId}</div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tanggal Pengiriman</Label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="pl-10 h-11 bg-white border-slate-200 rounded-xl font-bold shadow-sm" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Kurir / Carrier Identity</Label>
                    <Input 
                        placeholder="Nama Kurir atau Nama Ekspedisi..." 
                        value={courier} 
                        onChange={e => setCourier(e.target.value)} 
                        className="h-11 bg-white border-slate-200 rounded-xl font-bold shadow-sm placeholder:italic"
                    />
                </div>
             </div>

             <div className="pt-8 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5">
                        <FileDown className="h-3.5 w-3.5" /> Selected Batch ({selectedInvoices.length})
                    </p>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white text-[10px]">{TOOLTIP_CONTENT.spd_auto_pull}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-3">
                        {selectedInvoices.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center opacity-30">
                                <Search className="h-8 w-8 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Antrian Kosong</p>
                            </div>
                        ) : selectedInvoices.map((inv) => (
                            <div key={inv.invoiceId} className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-3 animate-in fade-in slide-in-from-left-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-indigo-700 font-mono">{inv.invoiceId}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full" onClick={() => setSelectedInvoices(selectedInvoices.filter(si => si.invoiceId !== inv.invoiceId))}>
                                        <Plus className="h-4 w-4 rotate-45" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Verified Surat Jalan (SJ) Nos:</Label>
                                    <Input 
                                        className="h-9 text-[11px] font-bold bg-slate-50 border-dashed rounded-lg" 
                                        placeholder="E.g. SJ-001, SJ-992..." 
                                        value={localSjAdditions[inv.invoiceId] || ''}
                                        onChange={(e) => handleSjChange(inv.invoiceId, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
             </div>
          </div>

          <div className="md:col-span-3 flex flex-col bg-white overflow-hidden">
             <div className="p-6 border-b bg-slate-50/50">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Scan atau Cari Customer / No. Invoice..." 
                        className="pl-12 h-14 bg-white border-none shadow-premium text-sm font-bold rounded-2xl focus-visible:ring-indigo-500"
                        value={searchInvoice}
                        onChange={e => setSearchInvoice(e.target.value)}
                    />
                </div>
             </div>

             <ScrollArea className="flex-1 p-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Clock className="h-3 w-3" /> Invoices Ready to Dispatch
                        </Label>
                        <Badge variant="secondary" className="text-[9px] h-5 px-3 font-black bg-indigo-50 text-indigo-600">{filteredAvailableInvoices.length} Tersedia</Badge>
                    </div>

                    {isLoadingInvoices ? (
                        <div className="text-center py-20 animate-pulse text-xs font-black uppercase text-slate-300 tracking-widest">Analisa Antrian Gudang...</div>
                    ) : filteredAvailableInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20 text-center space-y-4 grayscale">
                            <Layers className="h-16 w-16" />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Semua dokumen telah terproses.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredAvailableInvoices.map((inv) => {
                                const isSelected = selectedInvoices.some(si => si.invoiceId === inv.id);
                                return (
                                    <div 
                                        key={inv.id} 
                                        onClick={() => toggleInvoice(inv)}
                                        className={cn(
                                            "group relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer",
                                            isSelected 
                                                ? "bg-indigo-50/30 border-indigo-600 shadow-lg shadow-indigo-100 -translate-y-1" 
                                                : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50"
                                        )}
                                    >
                                        <div className="mt-1">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                                                isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 bg-white"
                                            )}>
                                                {isSelected && <CheckCircle2 className="h-4 w-4" />}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black font-mono tracking-tight text-indigo-700">{inv.id}</span>
                                                <Badge variant="outline" className="text-[8px] h-4 uppercase font-black bg-white">{inv.status}</Badge>
                                            </div>
                                            <p className="text-sm font-black uppercase text-slate-800 truncate leading-none">{inv.customer}</p>
                                            <div className="flex items-start gap-1.5 text-[10px] text-slate-400">
                                                <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-rose-400" />
                                                <span className="line-clamp-1 italic font-medium">{inv.billingAddress}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
             </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-12 font-bold px-8">Batal</Button>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={!courier || selectedInvoices.length === 0}
                        className="h-14 flex-1 bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-200 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                        <CheckCircle2 className="mr-2 h-5 w-5" /> TERBITKAN SPD (SIAP JALAN)
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white text-[10px] p-2">{TOOLTIP_CONTENT.create_spd}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
