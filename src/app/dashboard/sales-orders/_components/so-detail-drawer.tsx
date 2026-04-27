'use client';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
    FileText, 
    Truck, 
    Calendar, 
    User, 
    Clock, 
    MapPin, 
    ExternalLink,
    Copy,
    Printer,
    CheckCircle2,
    XCircle,
    Package,
    ArrowRight
} from 'lucide-react';
import { type SalesOrder } from '@/app/lib/data';
import { cn, formatNumberWithCommas } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

type SoDetailDrawerProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    order: SalesOrder | null;
};

export function SoDetailDrawer({ isOpen, onOpenChange, order }: SoDetailDrawerProps) {
    const router = useRouter();
    const { toast } = useToast();

    if (!order) return null;

    const handleCreateInvoice = () => {
        const safeSo = encodeURIComponent(order.soNumber);
        router.push(`/dashboard/invoices/number?poNumber=${encodeURIComponent(order.poNumber)}&soNumber=${safeSo}`);
    };

    const copySoNumber = () => {
        navigator.clipboard.writeText(order.soNumber);
        toast({ title: "SO Number Copied" });
    };

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
        confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
        invoiced: { label: 'Invoiced', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: FileText },
        cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle }
    };

    const conf = statusConfig[order.status || 'draft'];

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col bg-slate-50 border-l-0 shadow-2xl overflow-hidden">
                <SheetHeader className="p-8 bg-white border-b space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Document Master Detail</p>
                            <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">
                                {order.soNumber}
                            </SheetTitle>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase px-3 py-1 border-2", conf.color)}>
                            <conf.icon className="h-3 w-3 mr-1" /> {conf.label}
                        </Badge>
                    </div>

                    <div className="flex gap-3">
                        <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase border-slate-200 gap-2 rounded-xl" onClick={copySoNumber}>
                            <Copy className="h-3.5 w-3.5" /> Copy SO ID
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase border-slate-200 gap-2 rounded-xl">
                            <Printer className="h-3.5 w-3.5" /> Print Internal
                        </Button>
                        <Button size="sm" className="h-9 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 gap-2 rounded-xl px-4 shadow-lg shadow-indigo-100" onClick={handleCreateInvoice}>
                            <ExternalLink className="h-3.5 w-3.5" /> Start Billing <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-8 pt-6">
                    <div className="space-y-10">
                        {/* HEADER METRICS */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Kontrak</p>
                                <p className="text-lg font-black text-slate-900">Rp {formatNumberWithCommas(order.grandTotal)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Item Count</p>
                                <p className="text-lg font-black text-slate-900">{order.items?.length || 0} Products</p>
                            </div>
                        </div>

                        {/* TRANSACTION INFO */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" /> Legal & Contract Info
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Legal Customer</p>
                                        <p className="text-sm font-black text-slate-700 uppercase">{order.customer}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Purchase Order Ref</p>
                                        <p className="text-xs font-mono font-bold text-indigo-600">{order.poNumber}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Timeline</p>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" /> {order.orderDate}
                                            <span className="text-slate-300">→</span>
                                            <Truck className="h-3.5 w-3.5 text-amber-500" /> {order.deliveryDate}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Created By</p>
                                        <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                            <User className="h-3.5 w-3.5 text-slate-400" /> {order.createdBy || 'System'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200">
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-4 w-4 text-rose-500 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Billing/Delivery Point</p>
                                        <p className="text-[11px] leading-relaxed font-medium text-slate-600 italic">{order.customerAddress || 'No specific address specified.'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-slate-200" />

                        {/* ITEM MATRIX */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <Package className="h-3.5 w-3.5" /> Material Matrix
                            </h3>
                            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="text-[8px] font-black uppercase py-3">Product Name</TableHead>
                                            <TableHead className="text-[8px] font-black uppercase text-center py-3">Qty</TableHead>
                                            <TableHead className="text-right text-[8px] font-black uppercase py-3">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.items?.map((item, idx) => (
                                            <TableRow key={idx} className="border-b last:border-0">
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-slate-800">{item.productName}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{item.category}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-[10px] font-black">{item.quantity} <span className="text-slate-400">{item.unit}</span></span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="text-[10px] font-black text-indigo-700">Rp {formatNumberWithCommas(item.total)}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* AUDIT LOGS */}
                        {order.revisionLogs && order.revisionLogs.length > 0 && (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" /> Audit Trail
                                </h3>
                                <div className="space-y-4">
                                    {order.revisionLogs.map((log, idx) => (
                                        <div key={idx} className="flex gap-4 items-start bg-white p-4 rounded-xl border border-slate-100">
                                            <div className="h-2 w-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-[10px] font-bold text-slate-700 leading-tight">{log.action}</p>
                                                <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                                    <span>By: {log.updatedBy}</span>
                                                    <span>{log.updatedAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                
                <div className="p-6 bg-blue-600 text-white flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 opacity-50 shrink-0" />
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">System Note:</p>
                        <p className="text-[10px] font-medium leading-tight">Sales Order ini telah divalidasi oleh sistem dan siap untuk ditarik ke bagian penagihan.</p>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
