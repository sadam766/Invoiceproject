'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Calendar as CalendarIcon, Check, ChevronsUpDown, Database, Hash, FilePlus, Info, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { InvoiceNumber, Customer, SalesOrder, Invoice } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';


type AddInvoiceNumberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (invoice: Omit<InvoiceNumber, 'id'> & {id: string}, action: 'save' | 'create') => Promise<void>;
  invoiceData?: InvoiceNumber;
  onAddClick: () => void;
  allInvoiceNumbers: InvoiceNumber[] | null;
};


export function AddInvoiceNumberDialog({ isOpen, onOpenChange, onSave, invoiceData, onAddClick, allInvoiceNumbers }: AddInvoiceNumberDialogProps) {
  const firestore = useFirestore();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [invoiceType, setInvoiceType] = useState<'sar' | 'kw'>('sar');
  const [numberSource, setNumberSource] = useState<'manual' | 'erp'>('manual');
  const [erpNumberInput, setErpNumberInput] = useState('');
  
  const [isAutoNumber, setIsAutoNumber] = useState(true);
  
  const [prefix, setPrefix] = useState('');
  const [mainNumber, setMainNumber] = useState('');
  const [suffix, setSuffix] = useState('');
  
  const [fullInvoiceNumber, setFullInvoiceNumber] = useState('');
  
  const [salesOrder, setSalesOrder] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customer, setCustomer] = useState('');

  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [soPopoverOpen, setSoPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const customersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customers'));
  }, [firestore]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);

  const salesOrdersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salesOrders'));
  }, [firestore]);
  const { data: salesOrderListData } = useCollection<SalesOrder>(salesOrdersCollection);

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: existingInvoices } = useCollection<Invoice>(invoicesCollection);

  const uniqueSalesOrders = useMemo(() => {
    if (!salesOrderListData) return [];
    return Array.from(new Set(salesOrderListData.map(item => item.soNumber)))
  },[salesOrderListData]);

  const generateNextNumber = (type: 'sar' | 'kw') => {
    let currentMax = 0;
    const now = new Date();
    const currentYearShort = format(now, 'yy');
    const currentYearLong = format(now, 'yyyy');
    
    const allIds = [
        ...(allInvoiceNumbers?.map(inv => inv.id) || []),
        ...(existingInvoices?.map(inv => inv.id) || [])
    ];

    allIds.forEach(id => {
        let match;
        const cleanId = id.replace(/_/g, '/');
        if (type === 'sar') {
            const pattern = new RegExp(`SAR/${currentYearShort}01(\\d+)A`, 'i');
            match = cleanId.match(pattern);
        } else {
            const pattern = new RegExp(`KW/(\\d+)/KEU/${currentYearLong}`, 'i');
            match = cleanId.match(pattern);
        }

        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > currentMax) currentMax = num;
        }
    });

    const nextNum = currentMax + 1;
    return nextNum.toString().padStart(4, '0');
  };
  
  const setupForAddMode = (type: 'sar' | 'kw') => {
    const nextNumStr = generateNextNumber(type);
    const now = new Date();
    const currentYearShort = format(now, 'yy');
    const currentYearLong = format(now, 'yyyy');

    if (type === 'sar') {
      setPrefix(`SAR/${currentYearShort}01`);
      setSuffix('A');
      setMainNumber(nextNumStr);
    } else {
      setPrefix('KW/');
      setSuffix(`/KEU/${currentYearLong}`);
      setMainNumber(nextNumStr);
    }
  };

  const handleManualSetup = (invoice: InvoiceNumber) => {
    const id = invoice.id.replace(/_/g, '/');
    const sarMatch = id.match(/^(SAR\/\d{2}01)(\d+)(A)$/i);
    const kwMatch = id.match(/^(KW\/)(\d+)(\/KEU\/\d{4})$/i);

    if (sarMatch) {
        setNumberSource('manual');
        setInvoiceType('sar');
        setPrefix(sarMatch[1]);
        setMainNumber(sarMatch[2]);
        setSuffix(sarMatch[3]);
    } else if (kwMatch) {
        setNumberSource('manual');
        setInvoiceType('kw');
        setPrefix(kwMatch[1]);
        setMainNumber(kwMatch[2]);
        setSuffix(kwMatch[3]);
    } else {
        setNumberSource('erp');
        setErpNumberInput(id);
    }
    
    setIsAutoNumber(false); 
    setCustomer(invoice.customer);
    setSalesOrder(invoice.salesOrder);
    setPoNumber(invoice.poNumber || '');
    if (invoice.date) {
      const dateParts = invoice.date.split('/');
      if (dateParts.length === 3) {
        const [day, month, year] = dateParts;
        setDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
      } else {
        setDate(new Date());
      }
    } else {
      setDate(new Date());
    }
  }

  useEffect(() => {
      if (!isOpen) return;

      if (invoiceData) {
          handleManualSetup(invoiceData);
      } else {
          setNumberSource('manual');
          setInvoiceType('sar');
          setIsAutoNumber(true);
          setupForAddMode('sar');
          
          setCustomer('');
          setSalesOrder('');
          setPoNumber('');
          setDate(new Date());
          setErpNumberInput('');
      }
  }, [isOpen, invoiceData]);

  useEffect(() => {
      if (isAutoNumber && !invoiceData && isOpen && numberSource === 'manual') {
          setupForAddMode(invoiceType);
      }
  }, [invoiceType, isAutoNumber, isOpen, numberSource, existingInvoices, allInvoiceNumbers]);

  useEffect(() => {
    if (numberSource === 'manual') {
        setFullInvoiceNumber(`${prefix}${mainNumber}${suffix}`);
    } else {
        setFullInvoiceNumber(erpNumberInput);
    }
  }, [prefix, mainNumber, suffix, numberSource, erpNumberInput]);

  const handleSalesOrderSelect = (currentValue: string) => {
    const [cleanSo] = currentValue.split('|');
    const newSalesOrder = cleanSo === salesOrder ? '' : cleanSo;
    setSalesOrder(newSalesOrder);

    if (newSalesOrder && salesOrderListData) {
      const soDetails = salesOrderListData.find(item => item.soNumber === newSalesOrder);
      if (soDetails) {
        setCustomer(soDetails.customer);
        setPoNumber(soDetails.poNumber || '');
        toast({ title: "Data Tarik Otomatis", description: `Customer & PO berhasil disinkronkan dari SO ${newSalesOrder}` });
      }
    }
    setSoPopoverOpen(false);
  };
  
  const handleSave = async (action: 'save' | 'create') => {
    if (numberSource === 'manual' && !mainNumber) {
        toast({ variant: "destructive", title: "Validation Error", description: "Nomor urut tidak boleh kosong." });
        return;
    }
    if (numberSource === 'erp' && !erpNumberInput) {
        toast({ variant: "destructive", title: "Validation Error", description: "Nomor ERP wajib diisi." });
        return;
    }

    const finalInvoiceNumber = fullInvoiceNumber;
    
    const isTaken = [
        ...(allInvoiceNumbers?.map(inv => inv.id.replace(/\//g, '_')) || []),
        ...(existingInvoices?.map(inv => inv.id.replace(/\//g, '_')) || [])
    ].includes(finalInvoiceNumber.replace(/\//g, '_'));

    if (!invoiceData && isTaken) {
      toast({
        variant: "destructive",
        title: "Nomor Faktur Terpakai",
        description: `Nomor "${finalInvoiceNumber}" baru saja dipesan oleh admin lain.`,
      });
      setupForAddMode(invoiceType);
      return; 
    }

    setIsSaving(true);
    try {
        const formattedDate = date ? format(date, 'dd/MM/yyyy') : '';
        await onSave({
            id: finalInvoiceNumber,
            customer,
            salesOrder,
            poNumber,
            date: formattedDate,
            amount: 0 
        }, action);
        onOpenChange(false);
    } catch (err) {
        console.error("Save error:", err);
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" /> Registrasi Nomor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase font-black tracking-tight">{invoiceData ? "Edit Identitas" : "Registrasi Identitas Baru"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          
          <div className="p-4 bg-muted/20 rounded-xl border border-dashed">
              <div className="flex items-center justify-between mb-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sumber Nomor</Label>
                  <div className="flex bg-white rounded-md p-0.5 border shadow-sm">
                      <Button 
                        variant={numberSource === 'manual' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase"
                        onClick={() => setNumberSource('manual')}
                      >
                          <Hash className="h-3 w-3 mr-1" /> SAR/KW Manual
                      </Button>
                      <Button 
                        variant={numberSource === 'erp' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase"
                        onClick={() => setNumberSource('erp')}
                      >
                          <Database className="h-3 w-3 mr-1" /> ERP Pusat
                      </Button>
                  </div>
              </div>

              {numberSource === 'manual' ? (
                  <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Tipe Dokumen</Label>
                         <div className="flex w-full rounded-md border border-input bg-white p-1">
                            <Button
                                variant={invoiceType === 'sar' ? 'default' : 'ghost'}
                                onClick={() => setInvoiceType('sar')}
                                className="flex-1 h-8 text-[10px] font-bold uppercase"
                                disabled={!!invoiceData}
                            >
                                SAR (Tagihan)
                            </Button>
                            <Button
                                variant={invoiceType === 'kw' ? 'default' : 'ghost'}
                                onClick={() => setInvoiceType('kw')}
                                className="flex-1 h-8 text-[10px] font-bold uppercase"
                                disabled={!!invoiceData}
                            >
                                KW (DP)
                            </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Input Nomor (Unlimited Digit)</Label>
                        <div className="flex items-center space-x-2 mb-2">
                            <Checkbox id="auto-number" checked={isAutoNumber} onCheckedChange={(checked) => setIsAutoNumber(!!checked)} />
                            <Label htmlFor="auto-number" className="text-xs font-bold uppercase">Lanjutkan Otomatis</Label>
                        </div>
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                          <div className="bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100 text-xs font-black text-indigo-700 font-mono">{prefix}</div>
                          <Input 
                            placeholder="0001"
                            className="h-10 font-black text-center text-lg tracking-widest bg-white border-indigo-200"
                            value={mainNumber}
                            onChange={(e) => {
                                setMainNumber(e.target.value.replace(/[^0-9]/g, ''));
                                setIsAutoNumber(false);
                            }}
                          />
                          <div className="bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100 text-xs font-black text-indigo-700 font-mono">{suffix}</div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 mt-2">
                             <p className="text-[9px] font-black text-blue-700 uppercase">Preview: <span className="underline font-mono">{fullInvoiceNumber}</span></p>
                        </div>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Nomor ERP (Pusat)</Label>
                      <Input 
                        value={erpNumberInput} 
                        onChange={e => setErpNumberInput(e.target.value)} 
                        placeholder="Contoh: ERPSAR/2600000" 
                        className="h-12 font-black text-indigo-700 bg-white text-lg border-2 border-indigo-200"
                      />
                  </div>
              )}
          </div>

           <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Opsi A: Tarik Data dari Sales Order</Label>
                <Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 font-black border-blue-100">Recommended</Badge>
            </div>
            <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 font-bold border-indigo-100 bg-indigo-50/10">
                    {salesOrder || "Cari Nomor SO untuk Auto-fill..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0 shadow-2xl" align="start">
                    <Command>
                    <CommandInput placeholder="Cari No. SO..." className="h-11" />
                    <CommandList>
                      <CommandEmpty />
                      <CommandGroup>
                          {salesOrderListData?.map((so, idx) => (
                          <CommandItem
                              key={`${so.soNumber}-${idx}`}
                              value={`${so.soNumber}|${so.customer}`}
                              onSelect={handleSalesOrderSelect}
                              className="p-3 border-b"
                          >
                              <div className="flex flex-col">
                                <span className="font-black text-indigo-700">{so.soNumber}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{so.customer} • PO: {so.poNumber}</span>
                              </div>
                          </CommandItem>
                          ))}
                      </CommandGroup>
                      </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <p className="text-[9px] text-muted-foreground italic">Menarik data Customer & PO secara otomatis untuk meminimalisir kesalahan ketik.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">PO Customer (Opsi B: Manual)</Label>
                <Input 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    placeholder="PO-ABC-2024" 
                    className="font-bold bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Tgl Registrasi</Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={'outline'} className="w-full justify-start text-left font-bold h-10">
                      <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                      {date ? format(date, 'dd/MM/yyyy') : <span>Pilih Tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Pelanggan (Opsi B: Manual)</Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 font-black uppercase border-indigo-100">
                    {customer || "Pilih/Ketik Nama Pelanggan..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0 shadow-2xl" align="start">
                    <Command>
                    <CommandInput placeholder="Cari atau ketik nama pelanggan..." className="h-11" />
                     <CommandList>
                        <CommandEmpty>
                            <Button variant="ghost" className="w-full text-xs" onClick={() => setCustomerPopoverOpen(false)}>Gunakan input manual di kolom utama</Button>
                        </CommandEmpty>
                        <CommandGroup>
                            {customerListData?.map((c) => (
                            <CommandItem
                                key={c.id}
                                value={`${c.name}|${c.id}`}
                                onSelect={(v) => {
                                    const [name] = v.split('|');
                                    setCustomer(name);
                                    setCustomerPopoverOpen(false);
                                }}
                                className="p-3 border-b"
                            >
                                <span className="font-bold text-slate-800 uppercase">{c.name}</span>
                            </CommandItem>
                            ))}
                        </CommandGroup>
                     </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="pt-6 border-t flex justify-end gap-3 bg-muted/10 -mx-6 -mb-6 p-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Batal</Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => handleSave('save')} className="border-indigo-200 text-indigo-700" disabled={isSaving || !fullInvoiceNumber}>
                  {isSaving ? "Syncing..." : "Simpan Identitas"}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                Mengunci data nomor invoice dan pelanggan ke database.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" onClick={() => handleSave('create')} className="bg-indigo-600 hover:bg-indigo-700 font-black" disabled={isSaving || !fullInvoiceNumber}>
                  <FilePlus className="mr-2 h-4 w-4" /> {isSaving ? "Locking..." : "Buka Constructor"}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                Masuk ke halaman input detail barang dan kalkulasi nilai invoice.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
