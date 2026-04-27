'use client';
import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { type SalesOrder, type UserProfile, type Invoice, type SalesListItem } from '@/app/lib/data';
  import { 
    Search, 
    Plus, 
    MoreHorizontal, 
    Copy, 
    FilePlus, 
    Eye, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    FileText,
    TrendingUp,
    Calendar,
    ArrowRight,
    Trash2,
    Upload,
    AlertTriangle,
    Check
  } from 'lucide-react';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, query, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
  import { cn, formatNumberWithCommas, importFromExcel } from '@/lib/utils';
  import { SalesOrderConstructor } from './_components/sales-order-constructor';
  import { SoDetailDrawer } from './_components/so-detail-drawer';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { format, addDays } from 'date-fns';
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
  import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';

  export default function SalesOrderListPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [isConstructorOpen, setIsConstructorOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>(undefined);
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; orderId?: string }>({ isOpen: false });

    // User Profile
    const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const isAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.role === 'admin';

    // Fetch SO Headers
    const salesOrdersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'salesOrders')) : null, [firestore]);
    const { data: orders, isLoading } = useCollection<SalesOrder>(salesOrdersCollection);

    // Master Sales for Matching
    const masterSalesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sales')) : null, [firestore]);
    const { data: masterSales } = useCollection<SalesListItem>(masterSalesQuery);

    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        let filtered = orders;
        if (searchQuery) {
            filtered = orders.filter(o => 
                o.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.poNumber.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return filtered.sort((a, b) => (b.lastUpdatedAt || '').localeCompare(a.lastUpdatedAt || ''));
    }, [orders, searchQuery]);

    const handleSave = async (order: SalesOrder) => {
        if (!firestore || !user) return;
        
        const docId = order.id || doc(collection(firestore, 'salesOrders')).id;
        const docRef = doc(firestore, 'salesOrders', docId);
        
        const dataToSave = {
            ...order,
            id: docId,
            ownerId: user.uid,
            createdBy: order.createdBy || userProfile?.displayName || user.email || 'System',
            lastUpdatedAt: new Date().toISOString(),
            revisionLogs: [
                ...(order.revisionLogs || []),
                {
                    updatedBy: userProfile?.displayName || user.email || 'Admin',
                    updatedAt: new Date().toISOString(),
                    action: order.id ? "Document UPDATED (Constructor)" : "Document CREATED (Manual)"
                }
            ]
        };

        try {
            await setDoc(docRef, dataToSave, { merge: true });
            toast({ title: order.id ? "Sales Order Updated" : "New Sales Order Registered" });
        } catch (e) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: order.id ? 'update' : 'create',
                requestResourceData: dataToSave
            }));
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user && masterSales) {
            try {
                const data = await importFromExcel(file);
                const batch = writeBatch(firestore);
                let matchedCount = 0;
                let orphanCount = 0;

                data.forEach((row: any) => {
                    const soNum = String(row.soNumber || row['SO Number'] || '');
                    if (!soNum) return;

                    // GOLDEN KEY MATCHING: Look up PO from Master Sales List
                    const matchedSale = masterSales.find(s => s.soNumber?.toLowerCase() === soNum.toLowerCase());
                    
                    const newDocRef = doc(collection(firestore, 'salesOrders'));
                    const soData = {
                        id: newDocRef.id,
                        soNumber: soNum,
                        poNumber: matchedSale ? matchedSale.poNumber : (row.poNumber || ''),
                        customer: matchedSale ? matchedSale.customer : (row.customer || 'Unknown'),
                        orderDate: format(new Date(), 'yyyy-MM-dd'),
                        deliveryDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
                        status: 'confirmed',
                        items: [],
                        totalAmount: 0,
                        grandTotal: 0,
                        ownerId: user.uid,
                        createdBy: userProfile?.displayName || user.email || 'System Importer',
                        lastUpdatedAt: new Date().toISOString()
                    };

                    if (matchedSale) matchedCount++; else orphanCount++;
                    batch.set(newDocRef, soData);
                });

                await batch.commit();
                toast({ 
                    title: "Impor Selesai", 
                    description: `Berhasil memproses ${data.length} SO. (${matchedCount} Terhubung ke PO, ${orphanCount} Menunggu Mapping).` 
                });
            } catch (error) {
                toast({ variant: "destructive", title: "Gagal Impor", description: "Format file tidak didukung atau sistem sibuk." });
            }
        }
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !deleteDialogState.orderId) return;
        const docRef = doc(firestore, 'salesOrders', deleteDialogState.orderId);
        try {
            await deleteDoc(docRef);
            toast({ title: "Sales Order Cleansed from Database" });
            setDeleteDialogState({ isOpen: false });
        } catch (e) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        }
    };

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-amber-100 text-amber-700', icon: Clock },
        confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
        invoiced: { label: 'Invoiced', color: 'bg-emerald-100 text-emerald-700', icon: FileText },
        cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700', icon: XCircle }
    };

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-background animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">Commercial Pipeline</h1>
            <p className="text-muted-foreground font-medium text-sm">Manajemen Sales Order & Sinkronisasi Master Data Produksi.</p>
          </div>
          <div className="flex items-center gap-3">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
             <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest border-slate-200" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Import SO List
             </Button>
             <Button 
                onClick={() => { setEditingOrder(undefined); setIsConstructorOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 h-10 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-100"
             >
                <Plus className="mr-2 h-4 w-4" /> Create New SO
             </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border shadow-sm ring-1 ring-slate-200">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Cari SO, PO, atau Nama Customer..." 
                    className="pl-11 h-12 bg-slate-50 border-none font-medium rounded-2xl focus-visible:ring-indigo-500" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="hidden lg:flex gap-6 items-center px-4 border-l">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-slate-400 leading-none">Total Pipeline</span>
                    <span className="text-sm font-black text-slate-900">{filteredOrders.length} Documents</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-rose-600 leading-none">Missing PO Link</span>
                    <span className="text-sm font-black text-rose-600">{filteredOrders.filter(o => !o.poNumber).length} SO</span>
                </div>
            </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-slate-100 border-none rounded-3xl" />)
            ) : filteredOrders.length === 0 ? (
                <div className="col-span-full py-32 text-center flex flex-col items-center opacity-30">
                    <TrendingUp className="h-16 w-16 mb-4 text-slate-400" />
                    <p className="font-black uppercase text-sm tracking-widest">No Sales Orders in Pipeline.</p>
                </div>
            ) : filteredOrders.map((order) => {
                const conf = statusConfig[order.status || 'draft'];
                const isOrphan = !order.poNumber;
                
                return (
                    <Card key={order.id} className={cn(
                        "group relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 ring-1 rounded-3xl bg-white flex flex-col",
                        isOrphan ? "ring-rose-200 bg-rose-50/10" : "ring-slate-200"
                    )}>
                        <div className={cn("absolute top-0 left-0 w-full h-1.5", 
                            isOrphan ? "bg-rose-500" :
                            order.status === 'confirmed' ? "bg-blue-500" : 
                            order.status === 'invoiced' ? "bg-emerald-500" : "bg-amber-400"
                        )} />
                        
                        <CardHeader className="pb-4 pt-6 bg-slate-50/30 border-b border-slate-100">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base font-black text-slate-900 tracking-tight">{order.soNumber}</CardTitle>
                                        <Badge className={cn("text-[8px] font-black uppercase px-2 py-0 border-none h-4", conf.color)}>
                                            {conf.label}
                                        </Badge>
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate max-w-[180px]">{order.customer}</p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsDetailOpen(true); }} className="text-[10px] font-black uppercase tracking-widest"><Eye className="mr-2 h-4 w-4" /> Quick View</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setEditingOrder(order); setIsConstructorOpen(true); }} className="text-[10px] font-black uppercase tracking-widest"><FilePlus className="mr-2 h-4 w-4" /> Edit Contract</DropdownMenuItem>
                                        {isAdmin && (
                                            <DropdownMenuItem onClick={() => setDeleteDialogState({ isOpen: true, orderId: order.id })} className="text-[10px] font-black uppercase tracking-widest text-rose-600 focus:bg-rose-50 focus:text-rose-600"><Trash2 className="mr-2 h-4 w-4" /> Purge Record</DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6 space-y-6 flex-1">
                            {isOrphan ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="bg-rose-100/50 p-4 rounded-2xl border border-rose-200 space-y-2 cursor-help">
                                                <div className="flex items-center gap-2 text-rose-700">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <span className="text-[10px] font-black uppercase">PO Belum Terhubung</span>
                                                </div>
                                                <p className="text-[9px] text-rose-600 leading-tight">Gunakan Constructor untuk menghubungkan SO ini ke Nomor PO agar penagihan tidak Rp 0.</p>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white text-[11px] font-medium border-none shadow-xl max-w-xs">
                                            {TOOLTIP_CONTENT.missing_po}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Order Date</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" /> {order.orderDate}
                                            </div>
                                        </div>
                                        <div className="space-y-0.5 text-right">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">PO Reference</p>
                                            <p className="text-xs font-mono font-bold text-indigo-600">{order.poNumber}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                            <TrendingUp className="h-3 w-3" /> Net Order Value
                                        </p>
                                        <p className="text-xl font-black text-slate-900">Rp {formatNumberWithCommas(order.grandTotal)}</p>
                                    </div>
                                </>
                            )}
                        </CardContent>

                        <CardFooter className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-2">
                            <Button variant="ghost" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-md transition-all rounded-xl text-slate-500" onClick={() => { setSelectedOrder(order); setIsDetailOpen(true); }}>
                                View Details
                            </Button>
                            
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            className={cn(
                                                "flex-1 h-10 font-black uppercase text-[10px] tracking-widest shadow-lg rounded-xl",
                                                isOrphan ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                                            )}
                                            onClick={() => isOrphan ? (setEditingOrder(order), setIsConstructorOpen(true)) : router.push(`/dashboard/invoices/number?poNumber=${encodeURIComponent(order.poNumber)}&soNumber=${encodeURIComponent(order.soNumber)}`)}
                                        >
                                            {isOrphan ? <><AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Fix Mapping</> : <><FilePlus className="mr-1.5 h-3.5 w-3.5" /> Billing</>}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white text-[11px] font-medium border-none shadow-xl">
                                        {isOrphan ? TOOLTIP_CONTENT.fix_mapping : TOOLTIP_CONTENT.add_invoice}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>

        <SalesOrderConstructor 
            isOpen={isConstructorOpen}
            onOpenChange={setIsConstructorOpen}
            orderData={editingOrder}
            onSave={handleSave}
        />

        <SoDetailDrawer 
            isOpen={isDetailOpen}
            onOpenChange={setIsDetailOpen}
            order={selectedOrder}
        />

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen}
            onOpenChange={(o) => setDeleteDialogState(prev => ({...prev, isOpen: o}))}
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>

      </main>
    );
  }
