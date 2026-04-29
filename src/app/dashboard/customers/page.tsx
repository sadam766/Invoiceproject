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
  import type { Customer, UserProfile } from '@/app/lib/data';
  import { 
    Search, 
    Upload, 
    Download, 
    Trash2, 
    FileSpreadsheet, 
    ArrowRight,
    Plus,
    UserCircle2,
    MapPin,
    PhoneCall
  } from 'lucide-react';
  import { CustomerDrawer } from './_components/customer-drawer';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, generateExcelTemplate, importFromExcel } from '@/lib/utils';
  import { useFirestore, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
  import { cn } from '@/lib/utils';
  import { useDashboardData } from '../layout';

  export default function CustomerListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Consume Cached Data
    const { customers, invoices, isLoading: isGlobalLoading } = useDashboardData();

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

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        let data = customers;
        if (searchQuery) {
            data = data.filter((customer) =>
              customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (customer.customerCode && customer.customerCode.toLowerCase().includes(searchQuery.toLowerCase()))
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
        generateExcelTemplate(['Customer_Code', 'Customer_Name', 'VA_Number', 'Contact_Person', 'Phone', 'Address'], 'template_customer_import');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file);
                const batch = writeBatch(firestore);
                
                // Fetch local code map for auto-merge
                const codeToDocId: Record<string, string> = {};
                customers?.forEach(c => {
                    if (c.customerCode) codeToDocId[c.customerCode.toUpperCase()] = c.id!;
                });

                let createdCount = 0;
                let updatedCount = 0;

                data.forEach(item => {
                    const code = (item.Customer_Code || item.customerCode || '').toString().trim().toUpperCase();
                    const name = item.Customer_Name || item.name;
                    const va = item.VA_Number || item.virtualAccountNumber;
                    const address = item.Address || item.address;
                    const cp = item.Contact_Person || item.contactPerson;
                    const phone = item.Phone || item.phone;

                    if (!code && !name) return;

                    const existingId = code ? codeToDocId[code] : null;

                    if (existingId) {
                        // PHASE 2 / UPDATE LOGIC
                        const docRef = doc(firestore, 'customers', existingId);
                        const existingCustomer = customers?.find(c => c.id === existingId);
                        
                        const updateData: any = {};
                        if (name) updateData.name = name;
                        if (va) updateData.virtualAccountNumber = va;
                        if (cp) updateData.contactPerson = cp;
                        if (phone) updateData.phone = phone;
                        
                        if (address) {
                            const currentAddresses = existingCustomer?.addresses || [];
                            const addrExists = currentAddresses.some(a => a.address === address);
                            if (!addrExists) {
                                updateData.addresses = [
                                    ...currentAddresses,
                                    { 
                                        id: Math.random().toString(36).substr(2, 9), 
                                        label: 'Imported Address', 
                                        address: address, 
                                        isDefault: currentAddresses.length === 0 
                                    }
                                ];
                            }
                        }
                        
                        batch.set(docRef, updateData, { merge: true });
                        updatedCount++;
                    } else {
                        // PHASE 1 / NEW RECORD
                        const newDocRef = doc(collection(firestore, 'customers'));
                        const newCustomer: any = {
                            id: newDocRef.id,
                            name: name || 'Unnamed PT',
                            customerCode: code,
                            virtualAccountNumber: va || '',
                            contactPerson: cp || '',
                            phone: phone || '',
                            ownerId: user.uid,
                            addresses: address ? [
                                { id: Math.random().toString(36).substr(2, 9), label: 'Main Office', address, isDefault: true }
                            ] : [],
                            createdBy: userProfile?.displayName || user.email || 'Smart Importer'
                        };
                        batch.set(newDocRef, newCustomer);
                        createdCount++;
                        if (code) codeToDocId[code] = newDocRef.id;
                    }
                });

                await batch.commit();
                toast({ 
                    title: "Import Selesai", 
                    description: `${createdCount} data baru dibuat, ${updatedCount} data diperbarui melalui auto-mapping.` 
                });
                event.target.value = '';
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
                <p className="text-slate-400 font-medium text-sm">Database profil perusahaan dan integrasi Virtual Account otomatis.</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                <Button variant="outline" className="h-10 font-bold text-[10px] uppercase tracking-widest" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                <Button onClick={handleAddClick} className="bg-indigo-600 hover:bg-indigo-700 h-10 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-100">
                    <Plus className="mr-2 h-4 w-4" /> Add Legal PT
                </Button>
            </div>
        </div>
        
        <Card className="shadow-xl border-none ring-1 ring-slate-200 rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Cari PT Pusat atau Kode ERP..." 
                            className="pl-11 h-12 bg-slate-50 border-none font-medium rounded-2xl focus-visible:ring-indigo-500" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
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
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Legal Entity & Contact</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Unique Code</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Mandiri VA</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Outstanding AR</TableHead>
                                <TableHead className="text-right px-8"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(isGlobalLoading && !customers) ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 font-black uppercase text-slate-400 animate-pulse tracking-widest">Synchronizing Accounts...</TableCell></TableRow>
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold italic">No customers found.</TableCell></TableRow>
                            ) : filteredCustomers?.map((customer) => {
                                const outstanding = getCustomerOutstanding(customer.name);
                                const defaultAddr = customer.addresses?.find(a => a.isDefault) || customer.addresses?.[0];
                                
                                return (
                                    <TableRow key={customer.id} className={cn("hover:bg-indigo-50/10 transition-colors border-b-slate-50 last:border-0", selectedIds.has(customer.id!) ? "bg-indigo-50/30" : "")}>
                                        <TableCell className="px-6 py-4">
                                            <Checkbox 
                                                checked={selectedIds.has(customer.id!)} 
                                                onCheckedChange={() => handleSelectRow(customer.id!)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-black text-slate-900 uppercase tracking-tight text-sm">{customer.name}</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                        <UserCircle2 className="h-3 w-3 text-indigo-400" /> {customer.contactPerson || 'No Contact Person'}
                                                        <span className="opacity-30">|</span>
                                                        <PhoneCall className="h-3 w-3 text-indigo-400" /> {customer.phone || '-'}
                                                    </div>
                                                    {defaultAddr && (
                                                        <div className="flex items-start gap-1.5 text-[9px] font-medium text-slate-400 italic">
                                                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-rose-400" />
                                                            <span className="line-clamp-1">{defaultAddr.address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-black text-[10px] bg-slate-50 text-indigo-600 border-indigo-100">{customer.customerCode || '-'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[10px] font-mono font-black text-emerald-700">{customer.virtualAccountNumber || 'Not Set'}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={cn("font-black text-sm", outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                Rp {outstanding.toLocaleString('id-ID')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <Button 
                                                variant="ghost" 
                                                className="h-10 px-4 gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl"
                                                onClick={() => handleViewDetail(customer)}
                                            >
                                                Edit Profile <ArrowRight className="h-3.5 w-3.5" />
                                            </Button>
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
            onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open}))}
            onConfirm={handleDeleteConfirm}
        >
            <div className="hidden" />
        </DeleteConfirmationDialog>
      </main>
    );
  }