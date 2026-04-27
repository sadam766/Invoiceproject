'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
    Plus, 
    Trash2, 
    Check, 
    ChevronsUpDown, 
    ShoppingCart, 
    Save,
    MapPin,
    Building2,
    Home,
    Search,
    FileText,
    History
} from 'lucide-react';
import { type SalesOrder, type SalesOrderItem, type Customer, type ProductListItem, type SalesListItem } from '@/app/lib/data';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { cn, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type SalesOrderConstructorProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    orderData?: SalesOrder;
    onSave: (order: SalesOrder) => Promise<void>;
};

export function SalesOrderConstructor({ isOpen, onOpenChange, orderData, onSave }: SalesOrderConstructorProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    // Form States
    const [soNumber, setSoNumber] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
    const [items, setItems] = useState<SalesOrderItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Dropdown States
    const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);
    const [poPopoverOpen, setPoPopoverOpen] = useState(false);

    // Data Fetching
    const customersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersQuery);

    const productsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
    const { data: allProducts } = useCollection<ProductListItem>(productsQuery);

    const salesListQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sales')) : null, [firestore]);
    const { data: masterSalesList } = useCollection<SalesListItem>(salesListQuery);

    const currentCustomer = useMemo(() => {
        return allCustomers?.find(c => c.name === customerName);
    }, [allCustomers, customerName]);

    useEffect(() => {
        if (orderData && isOpen) {
            setSoNumber(orderData.soNumber);
            setPoNumber(orderData.poNumber);
            setCustomerName(orderData.customer);
            setCustomerAddress(orderData.customerAddress || '');
            setOrderDate(orderData.orderDate);
            setDeliveryDate(orderData.deliveryDate);
            setItems(orderData.items || []);
        } else if (!isOpen) {
            const now = new Date();
            setSoNumber(`SO/${format(now, 'yyyyMMdd')}/${Math.floor(Math.random() * 999)}`);
            setPoNumber('');
            setCustomerName('');
            setCustomerAddress('');
            setOrderDate(format(now, 'yyyy-MM-dd'));
            setDeliveryDate(format(addDays(now, 3), 'yyyy-MM-dd'));
            setItems([]);
        }
    }, [orderData, isOpen]);

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
    const tax = subtotal * 0.12;
    const grandTotal = subtotal + tax;

    const handleAddItem = (product: ProductListItem) => {
        const newItem: SalesOrderItem = {
            id: `item-${Date.now()}`,
            productName: product.name,
            category: product.category,
            quantity: 1,
            unit: product.unit,
            price: product.price,
            total: product.price
        };
        setItems([...items, newItem]);
        setProductPopoverOpen(false);
    };

    const updateItem = (id: string | number, field: keyof SalesOrderItem, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'price') {
                    updated.total = (Number(updated.quantity) || 0) * (Number(updated.price) || 0);
                }
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id: string | number) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handlePoSelect = (po: SalesListItem) => {
        setPoNumber(po.poNumber);
        setCustomerName(po.customer);
        const customer = allCustomers?.find(c => c.name === po.customer);
        if (customer) {
            const defaultAddr = customer.addresses?.find(a => a.isDefault)?.address || customer.addresses?.[0]?.address || '';
            setCustomerAddress(defaultAddr);
        }
        setPoPopoverOpen(false);
        toast({ title: "PO Synced", description: "Data customer ditarik otomatis dari Master Sales." });
    };

    const handleSave = async () => {
        if (!customerName || items.length === 0) {
            toast({ variant: "destructive", title: "Data Tidak Lengkap", description: "Pilih customer dan minimal satu item barang." });
            return;
        }

        setIsSaving(true);
        try {
            const finalData: SalesOrder = {
                id: orderData?.id,
                soNumber,
                poNumber,
                customer: customerName,
                customerAddress,
                orderDate,
                deliveryDate,
                status: orderData?.status || 'confirmed',
                items,
                totalAmount: subtotal,
                taxAmount: tax,
                grandTotal: grandTotal,
                lastUpdatedAt: new Date().toISOString()
            };
            await onSave(finalData);
            onOpenChange(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Gagal Menyimpan" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[850px] w-full p-0 flex flex-col bg-slate-50 border-l-0 shadow-2xl overflow-hidden">
                <SheetHeader className="p-8 bg-white border-b space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Master SO Constructor</p>
                            <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">
                                {orderData ? `Edit Sales Order ${orderData.soNumber}` : 'Register Active Contract'}
                            </SheetTitle>
                        </div>
                        <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-3 py-1">
                            {orderData?.status || 'DRAFT CONTRACT'}
                        </Badge>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-8 pt-6">
                    <div className="space-y-8">
                        {/* IDENTITAS KONTRAK */}
                        <div className="grid gap-6 md:grid-cols-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reference Nomor PO</Label>
                                <Popover open={poPopoverOpen} onOpenChange={setPoPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between h-11 font-black uppercase border-indigo-100 bg-indigo-50/10">
                                            {poNumber || "Pilih PO dari Master..."}
                                            <Search className="ml-2 h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[500px] p-0 shadow-2xl" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari No. PO atau Customer..." className="h-12" />
                                            <CommandList>
                                                <CommandEmpty>PO tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {masterSalesList?.filter(s => s.status !== 'Cancelled').map((s) => (
                                                        <CommandItem
                                                            key={s.poNumber}
                                                            value={`${s.poNumber}|${s.customer}`}
                                                            onSelect={() => handlePoSelect(s)}
                                                            className="p-4 border-b last:border-0"
                                                        >
                                                            <div className="flex flex-col gap-1 w-full">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-black text-indigo-700">{s.poNumber}</span>
                                                                    <span className="text-[10px] font-black text-slate-400">Rp {s.amount.toLocaleString()}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-500">{s.customer}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Sales Order (SO)</Label>
                                <Input value={soNumber} onChange={e => setSoNumber(e.target.value)} className="font-black uppercase h-11 border-indigo-200 text-indigo-700" />
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Customer Intelligence</Label>
                                <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 font-black text-xs uppercase text-slate-700">
                                    {customerName || 'Harap Pilih PO Terlebih Dahulu'}
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> Ship-to Address (HO vs Cabang)
                                </Label>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="md:col-span-1">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full h-11 font-black text-[10px] uppercase rounded-xl" disabled={!currentCustomer}>
                                                    <Building2 className="mr-2 h-3.5 w-3.5" /> Ganti Lokasi
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[350px] p-2 shadow-2xl">
                                                <div className="space-y-1">
                                                    {currentCustomer?.addresses?.map((addr) => (
                                                        <Button 
                                                            key={addr.id} 
                                                            variant="ghost" 
                                                            className="w-full justify-start text-left h-auto py-3 px-3 rounded-lg"
                                                            onClick={() => setCustomerAddress(addr.address)}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                {addr.label.toLowerCase().includes('office') ? <Home className="h-4 w-4 text-indigo-600 mt-1" /> : <Building2 className="h-4 w-4 text-amber-600 mt-1" />}
                                                                <div className="flex flex-col">
                                                                    <span className="font-black uppercase text-[10px] tracking-tight">{addr.label}</span>
                                                                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{addr.address}</p>
                                                                </div>
                                                            </div>
                                                        </Button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="md:col-span-2 bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[11px] leading-tight font-medium text-slate-700 italic">{customerAddress || 'Belum ada alamat pengiriman dipilih.'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Order Date</Label>
                                <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="h-11 font-bold rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Target Completion (H+3)</Label>
                                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-11 font-bold border-indigo-100 bg-indigo-50/10 text-indigo-700 rounded-xl" />
                            </div>
                        </div>

                        {/* LINE ITEMS */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-indigo-600" />
                                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter">Line Items Constructor</h3>
                                </div>
                                <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button className="bg-indigo-600 hover:bg-indigo-700 h-9 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-100 rounded-xl">
                                            <Plus className="mr-2 h-4 w-4" /> Tarik dari Katalog
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[450px] p-0 shadow-2xl border-none ring-1 ring-slate-200" align="end">
                                        <Command>
                                            <CommandInput placeholder="Search catalog items..." className="h-12" />
                                            <CommandList>
                                                <CommandEmpty>Product not found.</CommandEmpty>
                                                <CommandGroup>
                                                    {allProducts?.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.name}
                                                            onSelect={() => handleAddItem(p)}
                                                            className="p-4 border-b last:border-0"
                                                        >
                                                            <div className="flex justify-between w-full items-center">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800 uppercase text-xs">{p.name}</span>
                                                                    <span className="text-[9px] text-muted-foreground uppercase">{p.category} • Rp {p.price.toLocaleString()}</span>
                                                                </div>
                                                                <Plus className="h-4 w-4 text-indigo-400" />
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="text-[9px] font-black uppercase py-4 px-6">Deskripsi Barang (Sesuai Fisik/PO)</TableHead>
                                            <TableHead className="w-[100px] text-center text-[9px] font-black uppercase">Qty</TableHead>
                                            <TableHead className="w-[140px] text-right text-[9px] font-black uppercase">Price (IDR)</TableHead>
                                            <TableHead className="w-[140px] text-right text-[9px] font-black uppercase">Total</TableHead>
                                            <TableHead className="w-[60px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-[11px] uppercase font-black opacity-30 tracking-widest">
                                                    Belum ada item. Gunakan Katalog untuk input cepat.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map(item => (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="px-6">
                                                        <Input 
                                                            value={item.productName} 
                                                            onChange={e => updateItem(item.id, 'productName', e.target.value)}
                                                            className="h-9 text-[11px] font-black uppercase border-dashed bg-transparent focus-visible:ring-1 focus-visible:ring-indigo-400"
                                                        />
                                                        <p className="text-[8px] font-bold text-slate-300 mt-1 uppercase tracking-widest">Flexible Description Mode</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            value={item.quantity} 
                                                            onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} 
                                                            className="text-center text-xs h-9 font-black rounded-lg w-20 border-slate-200" 
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            value={formatNumberWithCommas(item.price)} 
                                                            onChange={e => updateItem(item.id, 'price', parseFormattedNumber(e.target.value))}
                                                            className="h-9 text-right text-xs font-black border-dashed rounded-lg bg-slate-50/20"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-xs px-2">Rp {formatNumberWithCommas(item.total)}</TableCell>
                                                    <TableCell className="px-4 text-center">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full" onClick={() => removeItem(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* ANTI-NOL CALCULATION FOOTER */}
                <div className="p-8 bg-white border-t-2 border-slate-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="grid gap-6 md:grid-cols-2 items-end">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Sub-total Bruto</span>
                                <span>Rp {formatNumberWithCommas(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                <span>Pajak (PPN 12%)</span>
                                <span>Rp {formatNumberWithCommas(tax)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t-2 border-indigo-50">
                                <span className="text-[11px] font-black uppercase text-indigo-600 tracking-[0.2em]">Locked SO Net Value</span>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">Rp {formatNumberWithCommas(grandTotal)}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Button 
                                type="button" 
                                onClick={handleSave} 
                                disabled={isSaving || items.length === 0}
                                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 rounded-2xl"
                            >
                                {isSaving ? "Locking Records..." : <><Save className="mr-2 h-5 w-5" /> Kunci Data Sales Order</>}
                            </Button>
                            <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                <History className="h-3 w-3" /> Data ini akan menjadi Master Data untuk Penagihan (Add Invoice).
                            </p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
