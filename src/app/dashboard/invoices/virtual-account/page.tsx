
'use client';
import { useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Edit, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { AddVaDialog } from './_components/add-va-dialog';
import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, writeBatch } from 'firebase/firestore';
import { exportToExcel, importFromExcel, generateExcelTemplate } from '@/lib/utils';
import type { VirtualAccount, UserProfile } from '@/app/lib/data';

export default function VaListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [editingVa, setEditingVa] = useState<VirtualAccount | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteState, setDeleteState] = useState<{ isOpen: boolean; id?: string; isBulk?: boolean }>({ isOpen: false });

    // Role check
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

    const vaCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'virtualAccounts'));
    }, [firestore]);
    const { data: vas, isLoading } = useCollection<VirtualAccount>(vaCollection);

    const filteredVas = useMemo(() => {
        if (!vas) return [];
        return vas.filter(v => 
            v.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.vaNumber.includes(searchQuery) ||
            (v.customerCode && v.customerCode.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [vas, searchQuery]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredVas.map(v => v.id!)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSave = (va: VirtualAccount) => {
        if (!firestore || !user) return;
        const id = va.id || doc(collection(firestore, 'virtualAccounts')).id;
        const docRef = doc(firestore, 'virtualAccounts', id);
        const dataToSave = { ...va, id, ownerId: user.uid };

        setDoc(docRef, dataToSave, { merge: true })
            .then(() => toast({ title: "Virtual Account Berhasil Disimpan" }))
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: va.id ? 'update' : 'create', requestResourceData: dataToSave
                }));
            });
    };

    const handleDelete = async () => {
        if (!firestore || !isAdmin) return;

        if (deleteState.isBulk) {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                batch.delete(doc(firestore, 'virtualAccounts', id));
            });
            await batch.commit();
            toast({ title: `${selectedIds.size} Virtual Account dihapus` });
            setSelectedIds(new Set());
        } else if (deleteState.id) {
            const docRef = doc(firestore, 'virtualAccounts', deleteState.id);
            await deleteDoc(docRef);
            toast({ title: "VA Berhasil Dihapus" });
        }
        setDeleteState({ isOpen: false });
    };

    const handleExport = () => {
        const dataToExport = selectedIds.size > 0 
            ? filteredVas.filter(v => selectedIds.has(v.id!))
            : filteredVas;
        
        exportToExcel(dataToExport, 'virtual_accounts');
        toast({ title: "Export Berhasil", description: `${dataToExport.length} data diekspor.` });
    };

    const handleDownloadTemplate = () => {
        generateExcelTemplate(['customerCode', 'customerName', 'bankName', 'vaNumber'], 'template_va');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as Omit<VirtualAccount, 'id' | 'ownerId'>[];
                const batch = writeBatch(firestore);
                data.forEach(item => {
                    const newRef = doc(collection(firestore, 'virtualAccounts'));
                    batch.set(newRef, { ...item, id: newRef.id, ownerId: user.uid });
                });
                await batch.commit();
                toast({ title: "Import Berhasil", description: `${data.length} VA ditambahkan.` });
            } catch (e) {
                toast({ variant: "destructive", title: "Gagal Import" });
            }
        }
    };

    return (
        <main className="p-4 md:p-8 space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Virtual Account List</h1>
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                    <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                    <Button variant="outline" onClick={handleDownloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/> Template</Button>
                    <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                    <AddVaDialog 
                        isOpen={isDialogOpen} 
                        onOpenChange={setIsDialogOpen} 
                        onSave={handleSave} 
                        vaData={editingVa} 
                        onAddClick={() => { setEditingVa(undefined); setIsDialogOpen(true); }} 
                    />
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari Nama atau Nomor VA..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        {selectedIds.size > 0 && isAdmin && (
                            <Button variant="destructive" size="sm" onClick={() => setDeleteState({ isOpen: true, isBulk: true })}>
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                    
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox 
                                            checked={filteredVas.length > 0 && selectedIds.size === filteredVas.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Customer Code</TableHead>
                                    <TableHead>Customer Name</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead>VA Number</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat data...</TableCell></TableRow>
                                ) : filteredVas.map(va => (
                                    <TableRow key={va.id} className={selectedIds.has(va.id!) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedIds.has(va.id!)} 
                                                onCheckedChange={() => handleSelectRow(va.id!)}
                                            />
                                        </TableCell>
                                        <TableCell>{va.customerCode || '-'}</TableCell>
                                        <TableCell>{va.customerName}</TableCell>
                                        <TableCell>{va.bankName}</TableCell>
                                        <TableCell className="font-mono font-bold text-blue-600">{va.vaNumber}</TableCell>
                                        <TableCell className="text-right">
                                            {isAdmin && (
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingVa(va); setIsDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteState({ isOpen: true, id: va.id, isBulk: false })}><Trash2 className="h-4 w-4"/></Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!isLoading && filteredVas.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada data ditemukan.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            <DeleteConfirmationDialog 
                open={deleteState.isOpen} 
                onOpenChange={(open) => setDeleteState(prev => ({ ...prev, isOpen: open }))} 
                onConfirm={handleDelete}
            >
                <span />
            </DeleteConfirmationDialog>
        </main>
    );
}
