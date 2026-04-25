
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
  import { Search, Upload, Download, Trash2, Edit, FileSpreadsheet, MapPin, UserCheck } from 'lucide-react';
  import { AddCustomerDialog } from './_components/add-customer-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, generateExcelTemplate, importFromExcel } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';

  export default function CustomerListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
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

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        if (!searchQuery) return customers;
        return customers.filter((customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.addresses.some(a => a.address.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }, [customers, searchQuery]);

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
      setEditingCustomer(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
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

    const handleSave = (customer: Omit<Customer, 'id' | 'ownerId'> & { id?: string }) => {
        if (!firestore || !user) return;
        
        const isNewCustomer = !customer.id;
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
                toast({ title: editingCustomer ? 'Customer Updated' : 'Customer Added' });
                setIsDialogOpen(false);
            })
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: isNewCustomer ? 'create' : 'update', requestResourceData: dataToSave,
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
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Customer List</h1>
                <p className="text-muted-foreground">Manage your customer address book in a shared global database.</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                <Button variant="outline" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                <AddCustomerDialog
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSave={handleSave}
                    customerData={editingCustomer}
                    onAddClick={handleAddClick}
                />
            </div>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari pelanggan atau alamat..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    {selectedIds.size > 0 && isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => setDeleteDialogState({ isOpen: true, isBulk: true })}>
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                        </Button>
                    )}
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox 
                                        checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>CUSTOMER</TableHead>
                                <TableHead>DEFAULT ADDRESS</TableHead>
                                <TableHead>ADDED BY</TableHead>
                                <TableHead className="text-right">ACTIONS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell></TableRow>
                            ) : filteredCustomers?.map((customer) => {
                                const defaultAddr = customer.addresses?.find(a => a.isDefault) || customer.addresses?.[0];
                                return (
                                    <TableRow key={customer.id} className={selectedIds.has(customer.id!) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedIds.has(customer.id!)} 
                                                onCheckedChange={() => handleSelectRow(customer.id!)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{customer.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{customer.email || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {defaultAddr ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-black uppercase text-primary">{defaultAddr.label}</span>
                                                    <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[300px]">{defaultAddr.address}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs italic text-muted-foreground">Belum ada alamat</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                                <UserCheck className="h-3 w-3" /> {customer.createdBy || 'Unknown'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}><Edit className="h-4 w-4" /></Button>
                                                {isAdmin && (
                                                    <DeleteConfirmationDialog 
                                                        open={deleteDialogState.isOpen && deleteDialogState.customerId === customer.id}
                                                        onOpenChange={(open) => setDeleteDialogState(prev => ({...prev, isOpen: open, customerId: open ? customer.id : undefined, isBulk: false}))}
                                                        onConfirm={handleDeleteConfirm}
                                                    >
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(customer.id!); }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </DeleteConfirmationDialog>
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
      </main>
    );
  }
