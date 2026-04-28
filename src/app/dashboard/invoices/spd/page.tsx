
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
  } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { 
    Search, 
    Truck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Eye, 
    Edit, 
    Trash2, 
    MoreVertical, 
    Calendar as CalendarIcon,
    Layers,
    FileCheck,
    AlertTriangle,
    Share2,
    Mail,
    Printer
  } from 'lucide-react';
  import { AddSpdDialog } from './_components/add-spd-dialog';
  import { AddressSelectorDialog } from './_components/address-selector-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '@/components/ui/alert-dialog';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
  import { collection, doc, deleteDoc, writeBatch, query, updateDoc, setDoc } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
  } from '@/components/ui/dropdown-menu';
  import { parseISO, differenceInDays } from 'date-fns';
  import type { SpdData, Invoice, SpdInvoiceEntry, UserProfile, Customer } from '@/app/lib/data';
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
  import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';
  
  export default function SpdPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const [editingSpd, setEditingSpd] = useState<SpdData | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; spdId?: string }>({ isOpen: false });

    // Envelope Flow States
    const [confirmPrintOpen, setConfirmPrintOpen] = useState(false);
    const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
    const [newSpdRef, setNewSpdRef] = useState<SpdData | null>(null);

    // State for pre-selected invoices from shortcut
    const [initialPreselected, setInitialPreselected] = useState<SpdInvoiceEntry[] | undefined>(undefined);

    // Profile lookup for Audit Trail
    const userProfileRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const spdsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data: spds, isLoading } = useCollection<SpdData>(spdsCollection);

    const customersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersQuery);

    // Effect to check for pre-selected invoices from Invoice List shortcut
    useEffect(() => {
        const data = sessionStorage.getItem('preselectedSpdInvoices');
        if (data) {
            try {
                const invoices = JSON.parse(data) as Invoice[];
                const entries: SpdInvoiceEntry[] = invoices.map(inv => ({
                    invoiceId: inv.id,
                    customer: inv.customer,
                    address: inv.billingAddress,
                    status: 'pending',
                    sjNumbers: inv.sjNumbers || []
                }));
                setInitialPreselected(entries);
                setIsDialogOpen(true);
                sessionStorage.removeItem('preselectedSpdInvoices');
            } catch (e) {
                console.error("Failed to parse preselected invoices", e);
            }
        }
    }, []);

    const filteredData = useMemo(() => {
        if (!spds) return [];
        return spds.filter(s => 
            s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.courier.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.invoices.some(inv => inv.customer.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a, b) => b.date.localeCompare(a.date));
    }, [spds, searchQuery]);

    const handleAdd = () => {
      setEditingSpd(undefined);
      setInitialPreselected(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (spdItem: SpdData) => {
        setEditingSpd(spdItem);
        setInitialPreselected(undefined);
        setIsDialogOpen(true);
    }
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !deleteDialogState.spdId) return;
        
        const spdToDelete = spds?.find(s => s.id === deleteDialogState.spdId);
        const batch = writeBatch(firestore);

        spdToDelete?.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: null });
        });

        batch.delete(doc(firestore, 'spds', deleteDialogState.spdId.replace(/\//g, '_')));

        await batch.commit();
        toast({ title: "SPD Dihapus", description: "Seluruh invoice terkait dikembalikan ke daftar Siap Kirim." });
        setDeleteDialogState({ isOpen: false, spdId: undefined });
    };

    const cleanUndefined = (obj: any) => {
        const newObj = { ...obj };
        Object.keys(newObj).forEach(key => {
            if (newObj[key] === undefined) {
                delete newObj[key];
            } else if (Array.isArray(newObj[key])) {
                newObj[key] = newObj[key].map((item: any) => 
                    (typeof item === 'object' && item !== null) ? cleanUndefined(item) : item
                );
            } else if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                newObj[key] = cleanUndefined(newObj[key]);
            }
        });
        return newObj;
    };

    const handleSave = async (newItem: SpdData) => {
        if (!firestore || !user) return;

        const existing = spds?.find(s => s.id.toLowerCase() === newItem.id.toLowerCase());
        if (existing && !editingSpd) {
            toast({ 
                variant: "destructive", 
                title: "Nomor SPD Duplikat", 
                description: `Nomor ini sudah digunakan oleh ${existing.createdBy || 'User lain'}.` 
            });
            return;
        }
        
        const safeId = newItem.id.replace(/\//g, '_');
        const batch = writeBatch(firestore);
        const spdRef = doc(firestore, 'spds', safeId);
        
        const finalSpdData = cleanUndefined({ 
            ...newItem, 
            ownerId: user.uid,
            createdBy: userProfile?.displayName || user.email || 'System'
        });

        newItem.invoices.forEach(inv => {
            const safeInvId = inv.invoiceId.replace(/\//g, '_');
            const invRef = doc(firestore, 'invoices', safeInvId);
            batch.update(invRef, { spdNumber: newItem.id });
        });

        batch.set(spdRef, finalSpdData, { merge: true });

        await batch.commit();
        toast({ 
            title: editingSpd ? "SPD Berhasil Diperbarui" : "SPD Berhasil Diterbitkan",
            description: `${newItem.invoices.length} Invoice telah berhasil ditambahkan ke SPD Nomor ${newItem.id}`
        });
        
        setIsDialogOpen(false);
        
        if (!editingSpd) {
            setNewSpdRef(newItem);
            setTimeout(() => setConfirmPrintOpen(true), 500);
        }

        setEditingSpd(undefined);
        setInitialPreselected(undefined);
    };

    const handleUpdateStatus = async (spd: SpdData, newStatus: SpdData['status']) => {
        if (!firestore) return;
        const safeId = spd.id.replace(/\//g, '_');
        const batch = writeBatch(firestore);
        
        batch.update(doc(firestore, 'spds', safeId), { status: newStatus });
        
        if (newStatus === 'received') {
            spd.invoices.forEach(invEntry => {
                const safeInvId = invEntry.invoiceId.replace(/\//g, '_');
                batch.update(doc(firestore, 'invoices', safeInvId), { status: 'received' });
            });
        } else if (newStatus === 'in_delivery') {
            spd.invoices.forEach(invEntry => {
                const safeInvId = invEntry.invoiceId.replace(/\//g, '_');
                batch.update(doc(firestore, 'invoices', safeInvId), { status: 'sent' });
            });
        }

        await batch.commit();
        toast({ 
            title: `Status SPD: ${newStatus.replace('_', ' ').toUpperCase()}`,
            description: newStatus === 'received' ? "Semua invoice terkait telah ditandai sebagai 'Diterima Customer'." : undefined
        });
    };

    const handlePrepareEnvelope = (spd: SpdData) => {
        setNewSpdRef(spd);
        const customerName = spd.invoices[0]?.customer;
        const customerExists = allCustomers?.find(c => c.name.toLowerCase() === customerName?.toLowerCase());
        
        if (!customerExists) {
            toast({
                variant: "destructive",
                title: "Data Pelanggan Tidak Ditemukan",
                description: `Pusat data tidak menemukan profil untuk '${customerName}'. Pastikan nama di invoice sesuai dengan database Customer.`
            });
            return;
        }

        setAddressSelectorOpen(true);
    };

    const statusConfig = {
        in_delivery: { label: 'In Delivery', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, tooltip: TOOLTIP_CONTENT.spd_status_delivery },
        received: { label: 'Received', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, tooltip: TOOLTIP_CONTENT.spd_status_received },
        rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle, tooltip: TOOLTIP_CONTENT.spd_status_rejected }
    };

    const currentCustomerForEnvelope = useMemo(() => {
        if (!newSpdRef || !allCustomers) return null;
        const targetName = newSpdRef.invoices[0]?.customer.toLowerCase();
        return allCustomers.find(c => c.name.toLowerCase() === targetName) || null;
    }, [newSpdRef, allCustomers]);

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">SPD Digital Dispatch</h1>
            <p className="text-muted-foreground font-medium text-sm">Konsolidasi dokumen pengiriman dalam satu sistem terpadu secara real-time.</p>
          </div>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <AddSpdDialog
                            isOpen={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            onSave={handleSave}
                            spdData={editingSpd}
                            onAddClick={handleAdd}
                            initialPreselectedInvoices={initialPreselected}
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-none text-[10px] p-2">
                    {TOOLTIP_CONTENT.create_spd}
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex items-center gap-4 bg-background p-4 rounded-3xl border shadow-sm ring-1 ring-slate-100">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Cari Nomor SPD, Kurir, atau Nama Customer..." 
                    className="pl-10 h-11 bg-slate-50 border-none shadow-none font-bold rounded-2xl" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-auto">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> In Delivery</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Received</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected</div>
            </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted/30 rounded-3xl" />)
            ) : filteredData.length === 0 ? (
                <div className="col-span-full py-32 text-center space-y-4 opacity-40">
                    <Layers className="h-16 w-16 mx-auto text-slate-300" />
                    <p className="text-sm font-black uppercase tracking-widest">Belum ada daftar pengiriman aktif hari ini.</p>
                </div>
            ) : filteredData.map((spd) => {
                const Conf = statusConfig[spd.status];
                const aging = differenceInDays(new Date(), parseISO(spd.date));
                const isLate = spd.status === 'in_delivery' && aging > 5;

                return (
                    <Card key={spd.id} className={cn(
                        "group relative overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-500 ring-1 ring-slate-200 rounded-3xl bg-white flex flex-col",
                        isLate ? "ring-2 ring-amber-500 bg-amber-50/10" : ""
                    )}>
                        <div className={cn("absolute top-0 left-0 w-full h-1.5", 
                            spd.status === 'in_delivery' ? "bg-yellow-400" : 
                            spd.status === 'received' ? "bg-emerald-500" : "bg-rose-500"
                        )} />

                        <div className={cn("absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10")}>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg bg-white"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-none shadow-xl ring-1 ring-slate-100">
                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spd.id)}`)} className="rounded-lg py-2 cursor-pointer font-bold text-[10px] uppercase">
                                        <FileCheck className="mr-2 h-4 w-4 text-indigo-600" /> Cetak Summary (PDF)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrepareEnvelope(spd)} className="rounded-lg py-2 cursor-pointer font-bold text-[10px] uppercase text-indigo-600">
                                        <Mail className="mr-2 h-4 w-4" /> Cetak Amplop Coklat
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(spd)} className="rounded-lg py-2 cursor-pointer font-bold text-[10px] uppercase">
                                        <Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Batch Dispatch
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-rose-600 font-black uppercase text-[10px] rounded-lg py-2 cursor-pointer" onClick={() => setDeleteDialogState({ isOpen: true, spdId: spd.id })}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Batalkan SPD Total
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                        </div>

                        <CardHeader className="pb-4 pt-6 bg-slate-50/30 border-b border-slate-100">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-black font-mono text-indigo-700 tracking-tighter">{spd.id}</CardTitle>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                        <CalendarIcon className="h-3 w-3" /> {spd.date}
                                        {isLate && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="ml-2 text-amber-600 font-black flex items-center gap-1 cursor-help"><AlertTriangle className="h-3 w-3" /> {aging} HARI</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-amber-600 text-white border-none text-[10px]">{TOOLTIP_CONTENT.spd_aging_alert}</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {spd.envelopePrinted && <Badge variant="secondary" className="ml-2 h-3.5 bg-blue-50 text-blue-600 text-[7px] font-black uppercase border-none px-1.5">ENVELOPE READY</Badge>}
                                    </div>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full border-2 h-5", Conf.color)}>
                                                <Conf.icon className="h-2.5 w-2.5 mr-1" /> {Conf.label}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">{Conf.tooltip}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-6 pt-6 flex-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-50 p-3 rounded-2xl"><Truck className="h-5 w-5 text-indigo-600" /></div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[9px] font-black uppercase text-slate-400 leading-none tracking-widest mb-1">Kurir Pembawa</span>
                                    <span className="text-sm font-black truncate text-slate-800 uppercase">{spd.courier}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                                    <Layers className="h-3 w-3" /> Consolidated Documents ({spd.invoices.length})
                                </p>
                                <div className="space-y-2">
                                    {spd.invoices.slice(0, 3).map((inv, idx) => {
                                        const cust = allCustomers?.find(c => c.name === inv.customer);
                                        return (
                                            <div key={idx} className="flex flex-col gap-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer group/row" onClick={() => router.push(`/dashboard/invoices`)}>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase truncate max-w-[150px] text-slate-700 group-hover/row:text-indigo-700">{inv.customer}</span>
                                                    <span className="text-[9px] font-mono font-bold text-slate-400">{inv.invoiceId.split('/').pop()}</span>
                                                </div>
                                                {cust?.billingSchedule && (
                                                    <div className="flex items-center gap-1 text-[8px] font-black text-amber-600 uppercase tracking-tighter">
                                                        <Clock className="h-2.5 w-2.5" /> Jadwal: {cust.billingSchedule}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-400">
                                                    <Share2 className="h-2.5 w-2.5 text-indigo-400" />
                                                    <span className="text-[8px] text-muted-foreground line-clamp-1 italic">{inv.address}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {spd.invoices.length > 3 && (
                                        <div className="text-center pt-1">
                                            <Button variant="ghost" size="sm" className="text-[9px] font-black text-indigo-600 hover:bg-indigo-50 rounded-xl" onClick={() => router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spd.id)}`)}>
                                                + {spd.invoices.length - 3} Dokumen Lainnya
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                            <div className="flex gap-2 w-full">
                                {spd.status === 'in_delivery' ? (
                                    <>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" className="flex-1 h-10 text-[9px] font-black border-emerald-200 hover:bg-emerald-50 text-emerald-700 shadow-sm rounded-xl uppercase tracking-widest" onClick={() => handleUpdateStatus(spd, 'received')}>
                                                        Mark Received
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-emerald-700 text-white border-none text-[10px]">{TOOLTIP_CONTENT.spd_status_received}</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Button variant="ghost" size="sm" className="h-10 text-[9px] font-black text-rose-600 hover:bg-rose-50 rounded-xl uppercase" onClick={() => handleUpdateStatus(spd, 'rejected')}>
                                            Reject
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" size="sm" className="w-full h-10 text-[9px] font-black tracking-widest rounded-xl bg-white" onClick={() => handleUpdateStatus(spd, 'in_delivery')}>
                                        RESET TO DELIVERY
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">By: {spd.createdBy || 'Unknown'}</span>
                                <div className="flex gap-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-indigo-400" onClick={() => handlePrepareEnvelope(spd)}>
                                                    <Printer className="h-3 w-3" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">{TOOLTIP_CONTENT.spd_quick_print_envelope}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-indigo-400" onClick={() => {
                                                    navigator.clipboard.writeText(`Pelacakan SPD ${spd.id}: [Link Placeholder]`);
                                                    toast({ title: "Tracking Link Copied" });
                                                }}>
                                                    <Share2 className="h-3 w-3" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">{TOOLTIP_CONTENT.spd_quick_share}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>

        {/* Envelope Printing Confirmation */}
        <AlertDialog open={confirmPrintOpen} onOpenChange={setConfirmPrintOpen}>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><Mail className="text-indigo-600 h-6 w-6" /></div>
                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">SPD BERHASIL DIBUAT</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium text-slate-600">
                        Apakah Anda ingin mencetak amplop tagihan coklat sekarang? Sistem akan menyiapkan alamat pengiriman secara otomatis.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel onClick={() => setConfirmPrintOpen(false)} className="h-11 rounded-xl font-bold border-slate-200">Tidak, Nanti Saja</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { setConfirmPrintOpen(false); if(newSpdRef) handlePrepareEnvelope(newSpdRef); }} className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-100">
                        YA, CETAK AMPLOP SEKARANG
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Smart Address Selector Modal */}
        <AddressSelectorDialog 
            isOpen={addressSelectorOpen} 
            onOpenChange={setAddressSelectorOpen} 
            customer={currentCustomerForEnvelope} 
            spdId={newSpdRef?.id || ''}
        />

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen} 
            onOpenChange={(o) => setDeleteDialogState({isOpen: o, spdId: o ? deleteDialogState.spdId : undefined})} 
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
