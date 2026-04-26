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
import { Plus, Calendar as CalendarIcon, Check, ChevronsUpDown, Database, Hash, FilePlus, AlertCircle } from 'lucide-react';
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
  const [startingNumber, setStartingNumber] = useState<string>('');
  
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

  // LOGIKA GLOBAL AUTO-INCREMENT (Multi-Admin Sync)
  const generateNextNumber = (type: 'sar' | 'kw', startFrom: string = '') => {
    let currentMax = 0;
    const now = new Date();
    const currentYearShort = format(now, 'yy');
    const currentYearLong = format(now, 'yyyy');
    
    // Gabungkan data draf dan data final untuk deteksi global
    const allIds = [
        ...(allInvoiceNumbers?.map(inv => inv.id) || []),
        ...(existingInvoices?.map(inv => inv.id) || [])
    ];

    allIds.forEach(id => {
        let match;
        if (type === 'sar') {
            // Pattern: SAR/[YY]01[Sequence]A
            const pattern = new RegExp(`SAR/${currentYearShort}01(\\d{4})A`);
            match = id.match(pattern);
        } else {
            // KW Pattern: KW/XXXX/KEU/YYYY
            const pattern = new RegExp(`KW/(\\d+)/KEU/${currentYearLong}`);
            match = id.match(pattern);
        }

        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > currentMax) currentMax = num;
        }
    });

    const userStart = parseInt(startFrom, 10);
    // Prioritaskan input manual user jika ada, jika tidak gunakan n + 1 dari database
    const nextNum = !isNaN(userStart) && startFrom !== '' ? userStart : currentMax + 1;

    return nextNum.toString().padStart(4, '0');
  };
  
  const setupForAddMode = (type: 'sar' | 'kw', startVal: string = '') => {
    const nextNumStr = generateNextNumber(type, startVal);
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
    const id = invoice.id;
    const sarMatch = id.match(/^(SAR\/\d{2}01)(\d{4})(A)$/);
    const kwMatch = id.match(/^(KW\/)(\d+)(\/KEU\/\d{4})$/);

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
          setupForAddMode('sar', '');
          
          setCustomer('');
          setSalesOrder('');
          setPoNumber('');
          setDate(new Date());
          setErpNumberInput('');
          setStartingNumber('');
      }
  }, [isOpen, invoiceData]);

  // Sync real-time: Re-calculate if DB changes while dialog is open
  useEffect(() => {
      if (isAutoNumber && !invoiceData && isOpen && numberSource === 'manual') {
          setupForAddMode(invoiceType, startingNumber);
      }
  }, [startingNumber, invoiceType, isAutoNumber, isOpen, numberSource, existingInvoices, allInvoiceNumbers]);

  useEffect(() => {
    if (numberSource === 'manual') {
        setFullInvoiceNumber(`${prefix}${mainNumber}${suffix}`);
    } else {
        setFullInvoiceNumber(erpNumberInput);
    }
  }, [prefix, mainNumber, suffix, numberSource, erpNumberInput]);

  const handleSalesOrderSelect = (currentValue: string) => {
    const cleanSo = currentValue.split('|')[0];
    const newSalesOrder = cleanSo === salesOrder ? '' : cleanSo;
    setSalesOrder(newSalesOrder);

    if (newSalesOrder && salesOrderListData) {
      const soDetails = salesOrderListData.filter(item => item.soNumber === newSalesOrder);
      if (soDetails.length > 0) {
        setCustomer(soDetails[0].customer);
        setPoNumber(soDetails[0].poNumber || '');
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

    if (!salesOrder && !poNumber) {
        toast({ variant: "destructive", title: "Validation Error", description: "Nomor PO wajib diisi jika SO belum tersedia." });
        return;
    }

    const finalInvoiceNumber = fullInvoiceNumber;
    const existsInNumberList = allInvoiceNumbers?.some(inv => inv.id === finalInvoiceNumber);
    const existsInInvoiceList = existingInvoices?.some(inv => inv.id === finalInvoiceNumber);
    const isChangingId = invoiceData && invoiceData.id !== finalInvoiceNumber;
    
    if ((!invoiceData || isChangingId) && (existsInNumberList || existsInInvoiceList)) {
      toast({
        variant: "destructive",
        title: "Nomor Faktur Duplikat",
        description: `Nomor "${finalInvoiceNumber}" sudah terdaftar dalam sistem Dakota.`,
      });
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

  const dialogTitle = invoiceData ? "Edit Identitas Penagihan" : "Registrasi Identitas Penagihan Baru";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" /> Registrasi Nomor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase font-black tracking-tight">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          
          <div className="p-4 bg-muted/20 rounded-xl border border-dashed">
              <div className="flex items-center justify-between mb-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pilih Sumber Nomor (Identitas Tunggal)</Label>
                  <div className="flex bg-white rounded-md p-0.5 border shadow-sm">
                      <Button 
                        variant={numberSource === 'manual' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase"
                        onClick={() => setNumberSource('manual')}
                      >
                          <Hash className="h-3 w-3 mr-1" /> Otomatis Manual (SAR/KW)
                      </Button>
                      <Button 
                        variant={numberSource === 'erp' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase"
                        onClick={() => setNumberSource('erp')}
                      >
                          <Database className="h-3 w-3 mr-1" /> Input ERP Pusat
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
                                SAR (Tagihan Barang)
                            </Button>
                            <Button
                                variant={invoiceType === 'kw' ? 'default' : 'ghost'}
                                onClick={() => setInvoiceType('kw')}
                                className="flex-1 h-8 text-[10px] font-bold uppercase"
                                disabled={!!invoiceData}
                            >
                                KW (DP / Proforma)
                            </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Konfigurasi Penomoran (Global Sync)</Label>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="auto-number" checked={isAutoNumber} onCheckedChange={(checked) => setIsAutoNumber(!!checked)} />
                              <Label htmlFor="auto-number" className="text-xs font-bold uppercase cursor-pointer">Gunakan Nomor Urut Sistem</Label>
                            </div>
                            {!isAutoNumber && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-[9px] font-bold uppercase text-muted-foreground">Edit Manual Ke:</Label>
                                    <Input 
                                        placeholder="0001"
                                        className="h-7 w-20 text-xs font-bold border-indigo-200"
                                        value={mainNumber}
                                        onChange={(e) => setMainNumber(e.target.value.padStart(4, '0').slice(-4))}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                          {prefix && <div className="bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100 text-xs font-black text-indigo-700 font-mono" title="Locked Prefix">{prefix}</div>}
                          <div className="h-10 font-black text-center text-lg tracking-widest bg-white flex items-center justify-center border rounded-md shadow-inner">{mainNumber}</div>
                          {suffix && <div className="bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100 text-xs font-black text-indigo-700 font-mono" title="Locked Suffix">{suffix}</div>}
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 mt-2">
                             <p className="text-[9px] font-black text-blue-700 uppercase tracking-tight">Pratinjau Hasil: <span className="underline">{fullInvoiceNumber}</span></p>
                        </div>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Nomor ERP Resmi (Sistem Pusat)</Label>
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
            <Label htmlFor="sales-order" className="text-[10px] font-black uppercase text-muted-foreground">Sales Order / SO Asal</Label>
            <Popover open={soPopoverOpen} onOpenChange={setSoPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={soPopoverOpen}
                    className="w-full justify-between h-10 font-bold border-indigo-100"
                    >
                    {salesOrder
                        ? uniqueSalesOrders.find((so) => so === salesOrder)
                        : "Cari Nomor SO..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0 shadow-2xl border-indigo-200 overflow-hidden">
                    <Command>
                    <CommandInput placeholder="Cari No. SO atau Customer..." className="h-11" />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty />
                      <CommandGroup>
                          {salesOrderListData?.map((so, idx) => (
                          <CommandItem
                              key={`${so.soNumber}-${idx}`}
                              value={`${so.soNumber}|${so.customer}`}
                              onSelect={handleSalesOrderSelect}
                              className="flex flex-col items-start gap-1 p-3 border-b last:border-0"
                          >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-black text-indigo-700">{so.soNumber}</span>
                                <Check className={cn("h-4 w-4", salesOrder === so.soNumber ? "opacity-100" : "opacity-0")} />
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                                  <span>{so.customer}</span>
                                  <span>•</span>
                                  <span>PO: {so.poNumber}</span>
                              </div>
                          </CommandItem>
                          ))}
                      </CommandGroup>
                      </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="po-number" className="text-[10px] font-black uppercase text-muted-foreground">Nomor PO Customer</Label>
                <Input 
                    id="po-number" 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    placeholder="PO-ABC-2024" 
                    disabled={!!salesOrder}
                    className="font-bold bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-[10px] font-black uppercase text-muted-foreground">Tanggal Registrasi</Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-bold h-10',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                      {date ? format(date, 'dd/MM/yyyy') : <span>Pilih Tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 shadow-xl border-indigo-100">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer" className="text-[10px] font-black uppercase text-muted-foreground">Nama Pelanggan (PT/CV)</Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerPopoverOpen}
                    className="w-full justify-between h-10 font-black uppercase border-indigo-100"
                    disabled={!!salesOrder}
                    >
                    {customer ? customer : "Pilih Pelanggan..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0 shadow-2xl border-indigo-200" align="start">
                    <Command>
                    <CommandInput placeholder="Cari pelanggan..." className="h-11" />
                     <CommandList>
                        <CommandEmpty />
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
                                className="flex flex-col items-start gap-1 p-3 border-b last:border-0"
                            >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-bold text-slate-800 uppercase">{c.name}</span>
                                  <Check className={cn("h-4 w-4", customer === c.name ? "opacity-100" : "opacity-0")} />
                                </div>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold uppercase text-xs" disabled={isSaving}>Batal</Button>
          <Button variant="outline" onClick={() => handleSave('save')} className="font-bold uppercase text-xs border-indigo-200 text-indigo-700" disabled={isSaving || !fullInvoiceNumber}>
            {isSaving ? "Syncing..." : "Simpan Identitas"}
          </Button>
          <Button type="button" onClick={() => handleSave('create')} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-xs px-8 shadow-lg" disabled={isSaving || !fullInvoiceNumber}>
              <FilePlus className="mr-2 h-4 w-4" /> {isSaving ? "Locking Number..." : "Buka Constructor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
