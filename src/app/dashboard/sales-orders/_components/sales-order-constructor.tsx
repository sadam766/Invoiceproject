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
    History,
    AlertTriangle,
    Link as LinkIcon
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

    const [soNumber, setSoNumber] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
    const [items, setItems] = useState<SalesOrderItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    // Local input buffers to handle decimals without losing separators while typing
    const [inputBuffers, setInputBuffers] = useState<Record<string, string>>({});

    const [productPopoverOpen, setProductPopoverOpen] = useState(false);
    const [poPopoverOpen, setPoPopoverOpen] = useState(false);

    const customersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersQuery);

    const productsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
    const { data: allProducts } = useCollection<ProductListItem>(productsQuery);

    const salesListQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sales')) : null, [firestore]);
    const { data: masterSalesList } = useCollection<SalesListItem>(salesListQuery);

    const currentCustomer = useMemo(() => allCustomers?.find(c => c.name === customerName), [allCustomers, customerName]);

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

    const handleNumericChange = (id: string | number, field: 'quantity' | 'price', rawValue: string) => {
        const key = `${id}-${field}`;
        const cleanValue = rawValue.replace(/[^0-9.,-]/g, '');
        setInputBuffers(prev => ({ ...prev, [key]: cleanValue }));
        updateItem(id, field, parseFormattedNumber(cleanValue));
    };

    const handleNumericBlur = (id: string | number, field: 'quantity' | 'price') => {
        const key = `${id}-${field}`;
        setInputBuffers(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const removeItem = (id: string | number) => setItems(items.filter(i => i.id !== id));

    const handleSave = async () => {
        if (!customerName || items.length === 0) return;
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
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-8 pt-6">
                    <div className="space-y-8">
                        <div className="grid gap-6 md:grid-cols-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Sales Order (SO)</Label>
                                <Input value={soNumber} onChange={e => setSoNumber(e.target.value)} className="font-black uppercase h-11" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black uppercase text-slate-800">Line Items Constructor</h3>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <Table className="table-auto">
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="text-[9px] font-black uppercase py-4 px-6">Description</TableHead>
                                            <TableHead className="w-[140px] text-center text-[9px] font-black uppercase">Qty</TableHead>
                                            <TableHead className="w-[200px] text-right text-[9px] font-black uppercase">Price (IDR)</TableHead>
                                            <TableHead className="w-[140px] text-right text-[9px] font-black uppercase">Total</TableHead>
                                            <TableHead className="w-[60px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="px-6">
                                                    <Input value={item.productName} onChange={e => updateItem(item.id, 'productName', e.target.value)} className="h-9 text-[11px] font-black uppercase border-dashed" />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="text"
                                                        value={inputBuffers[`${item.id}-quantity`] !== undefined ? inputBuffers[`${item.id}-quantity`] : formatNumberWithCommas(item.quantity)} 
                                                        onChange={e => handleNumericChange(item.id, 'quantity', e.target.value)}
                                                        onBlur={() => handleNumericBlur(item.id, 'quantity')}
                                                        className="text-center text-xs h-9 font-black rounded-[6px] px-[15px] min-w-[100px] w-full" 
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="text"
                                                        value={inputBuffers[`${item.id}-price`] !== undefined ? inputBuffers[`${item.id}-price`] : formatNumberWithCommas(item.price)} 
                                                        onChange={e => handleNumericChange(item.id, 'price', e.target.value)}
                                                        onBlur={() => handleNumericBlur(item.id, 'price')}
                                                        className="h-9 text-right text-xs font-black border-dashed rounded-[6px] px-[15px] min-w-[160px] w-full"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-black text-xs px-2">Rp {formatNumberWithCommas(item.total)}</TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-8 bg-white border-t-2 border-slate-100">
                    <Button onClick={handleSave} disabled={isSaving || items.length === 0} className="w-full h-14 font-black uppercase text-xs tracking-[0.2em] bg-indigo-600">
                        {isSaving ? "Locking Records..." : "Kunci Data Sales Order"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}