
'use client';
import { useState, useMemo, useRef } from 'react';
import {
    Card,
    CardContent,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Badge } from '@/components/ui/badge';
  import { Avatar, AvatarFallback } from '@/components/ui/avatar';
  import type { Customer, UserProfile, Invoice } from '@/app/lib/data';
  import { 
    Search, 
    Upload, 
    Download, 
    Trash2, 
    Edit, 
    FileSpreadsheet, 
    MapPin, 
    UserCheck, 
    Building2, 
    Home, 
    Eye, 
    Wallet,
    Layers,
    ArrowRight
  } from 'lucide-react';
  import { CustomerDrawer } from './_components/customer-drawer';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, generateExcelTemplate, importFromExcel } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
  import { cn } from '@/lib/utils';

  export default function CustomerListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; customerId?: string; isBulk?: boolean }>({ isOpen: false });

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const customersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'customers'));
    }, [firestore]);
    const { data: customers, isLoading } = useCollection<Customer>(customersCollection);

    const invoicesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: invoices } = useCollection<Invoice>(invoicesCollection);

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        let data = customers;
        if (searchQuery) {
            data = data.filter((customer) =>
              customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              customer.addresses.some(a => a.address.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        return data.sort((a, b) => a.name.localeCompare(b.name));
      }, [customers, searchQuery]);

    const getCustomerOutstanding = (customerName: string) => {
        if (!invoices) return 0;
        return invoices
            .filter(inv => inv.customer.toLowerCase() === customerName.toLowerCase() && inv.status !== 'paid' && inv.status !== 'cancelled')
            .reduce((sum, inv) => {
                const totalPaid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                return sum + (inv.amount - totalPaid);
            }, 0);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const getIdentityColor = (name: string) => {
        const colors = [
            'bg-indigo-100 text-indigo-700 border-indigo-200',
            'bg-emerald-100 text-emerald-700 border-emerald-200',
            'bg-rose-100 text-rose-700 border-rose-200',
            'bg-amber-100 text-amber-700 border-amber-200',
            'bg-blue-100 text-blue-700 border-blue-200',
            'bg-purple-100 text-purple-700 border-purple-200'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredCustomers.map(c => c.id!)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleAddClick = () => {
      setSelectedCustomer(undefined);
      setIsDrawerOpen(true);
    };

    const handleViewDetail = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsDrawerOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !isAdmin) return;

        if (deleteDialogState.isBulk) {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                batch.delete(doc(firestore, 'customers', id));
            });
            await batch.commit();
            toast({ title: `${selectedIds.size} pelanggan dihapus` });
            setSelectedIds(new Set());
        } else if (deleteDialogState.customerId) {
            const docRef = doc(firestore, 'customers', deleteDialogState.customerId);
            await deleteDoc(docRef);
            toast({ title: 'Pelanggan dihapus' });
        }
        setDeleteDialogState({ isOpen: false });
    };

    const openDeleteDialog = (customerId: string) => {
        if (!isAdmin) {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya Admin yang boleh menghapus data." });
            return;
        }
        setDeleteDialogState({ isOpen: true, customerId, isBulk: false });
    };

    const handleSave = (customer: Omit<Customer, 'id'> & { id?: string }) => {
        if (!firestore || !user) return;
        
        const customerId = customer.id || doc(collection(firestore, 'customers')).id;
        const docRef = doc(firestore, 'customers', customerId);
        const dataToSave = { 
            ...customer, 
            id: customerId, 
            ownerId: user.uid,
            createdBy: userProfile?.displayName || user.email || 'System'
        };
        
        setDoc(docRef, dataToSave, { merge: true })
            .then(() => {
                toast({ title: customer.id ? 'Data Pelanggan Diperbarui' : 'Pelanggan Baru Terdaftar' });
                setIsDrawerOpen(false);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: customer.id ? 'update' : 'create', requestResourceData: dataToSave,
                }));
            });
      };

    const handleExport = () => {
        const dataToExport = selectedIds.size > 0 
            ? filteredCustomers.filter(c => selectedIds.has(c.id!))
            : filteredCustomers;
        
        exportToExcel(dataToExport, 'customers');
        toast({ title: "Export Berhasil", description: `${dataToExport.length} pelanggan diekspor.` });
    };

    const handleDownloadTemplate = () => {
        generateExcelTemplate(['name', 'email'], 'customer_template');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as Omit<Customer, 'id' | 'ownerId'>[];
                const batch = writeBatch(firestore);
                data.forEach(item => {
                    const newDocRef = doc(collection(firestore, 'customers'));
                    batch.set(newDocRef, { 
                        ...item, 
                        id: newDocRef.id, 
                        ownerId: user.uid, 
                        addresses: [],
                        createdBy: userProfile?.displayName || user.email || 'System'
                    });
                });
                await batch.commit();
                toast({ title: "Import Berhasil", description: `${data.length} pelanggan ditambahkan.` });
            } catch (error) {
                toast({ variant: "destructive", title: "Gagal Import" });
            }
        }
    };
    
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-background animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">Legal Customer Hub</h1>
                <p className="text-slate-400 font-medium text-sm">Database profil perusahaan pusat dan jaringan kantor cabang Dakota.</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                <Button onClick={handleAddClick} className="bg-indigo-600 hover:bg-indigo-700 h-10 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-100">
                    <UserCheck className="mr-2 h-4 w-4" /> Add Legal PT
                </Button>
            </div>
        </div>
        
        <Card className="shadow-xl border-none ring-1 ring-slate-200 rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Cari PT Pusat atau alamat cabang..." 
                            className="pl-11 h-12 bg-slate-50 border-none font-medium rounded-2xl focus-visible:ring-indigo-500" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        {selectedIds.size > 0 && isAdmin && (
                            <Button variant="destructive" size="sm" className="h-9 rounded-xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                            </Button>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                           <div className="w-2 h-2 rounded-full bg-indigo-500" /> Aktif
                           <div className="w-2 h-2 rounded-full bg-slate-300 ml-2" /> Inaktif
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-b-slate-100">
                                <TableHead className="w-[40px] px-6">
                                    <Checkbox 
                                        checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Legal Entity (HQ)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Network Scale</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Outstanding AR</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Added By</TableHead>
                                <TableHead className="text-right px-8"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 font-black uppercase text-slate-400 animate-pulse tracking-widest">Reconciling Legal Database...</TableCell></TableRow>
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold italic">Belum ada customer terdaftar.</TableCell></TableRow>
                            ) : filteredCustomers?.map((customer) => {
                                const hqAddr = customer.addresses?.find(a => a.isDefault) || customer.addresses?.[0];
                                const branches = customer.addresses?.length || 0;
                                const outstanding = getCustomerOutstanding(customer.name);
                                const idColor = getIdentityColor(customer.name);

                                return (
                                    <TableRow key={customer.id} className={cn("hover:bg-indigo-50/10 transition-colors border-b-slate-50 last:border-0", selectedIds.has(customer.id!) ? "bg-indigo-50/30" : "")}>
                                        <TableCell className="px-6 py-4">
                                            <Checkbox 
                                                checked={selectedIds.has(customer.id!)} 
                                                onCheckedChange={() => handleSelectRow(customer.id!)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <Avatar className={cn("h-12 w-12 border-2", idColor)}>
                                                    <AvatarFallback className="bg-transparent font-black text-sm">{getInitials(customer.name)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-black text-slate-900 uppercase tracking-tight text-sm">{customer.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 lowercase">{customer.email || 'no-email@customer.com'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                                                    <Home className="h-3 w-3 text-indigo-600" />
                                                    <span className="text-[10px] font-black">1 HQ</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg">
                                                    <Building2 className="h-3 w-3 text-blue-600" />
                                                    <span className="text-[10px] font-black text-blue-700">{branches > 1 ? branches - 1 : 0} Branches</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn("font-black text-sm", outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                    Rp {outstanding.toLocaleString('id-ID')}
                                                </span>
                                                {outstanding > 0 && <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">Unpaid Balance</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{customer.createdBy || 'System'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    className="h-10 px-4 gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl"
                                                    onClick={() => handleViewDetail(customer)}
                                                >
                                                    View Details <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
                                                {isAdmin && (
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full" onClick={() => openDeleteDialog(customer.id!)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <CustomerDrawer 
            isOpen={isDrawerOpen} 
            onOpenChange={setIsDrawerOpen} 
            customerData={selectedCustomer} 
            onSave={handleSave} 
        />

        <DeleteConfirmationDialog 
            open={deleteDialogState.isOpen}
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open, customerId: open ? deleteDialogState.customerId : undefined, isBulk: false}))}
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }
