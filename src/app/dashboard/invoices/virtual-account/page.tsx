
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Edit, Trash2 } from 'lucide-react';
import { AddVaDialog } from './_components/add-va-dialog';
import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import type { VirtualAccount } from '@/app/lib/data';

export default function VaListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingVa, setEditingVa] = useState<VirtualAccount | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteState, setDeleteState] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });

    const vaCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'virtualAccounts'));
    }, [firestore]);
    const { data: vas, isLoading } = useCollection<VirtualAccount>(vaCollection);

    const filteredVas = useMemo(() => {
        if (!vas) return [];
        return vas.filter(v => 
            v.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.vaNumber.includes(searchQuery)
        );
    }, [vas, searchQuery]);

    const handleSave = (va: VirtualAccount) => {
        if (!firestore || !user) return;
        const id = va.id || doc(collection(firestore, 'virtualAccounts')).id;
        const docRef = doc(firestore, 'virtualAccounts', id);
        const dataToSave = { ...va, id, ownerId: user.uid };

        setDoc(docRef, dataToSave, { merge: true })
            .then(() => toast({ title: "Virtual Account Saved" }))
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: va.id ? 'update' : 'create', requestResourceData: dataToSave
                }));
            });
    };

    const handleDelete = () => {
        if (!firestore || !deleteState.id) return;
        const docRef = doc(firestore, 'virtualAccounts', deleteState.id);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: "VA Deleted" });
                setDeleteState({ isOpen: false });
            });
    };

    return (
        <main className="p-4 md:p-8 space-y-4">
            <h1 className="text-2xl font-bold">Virtual Account List</h1>
            <Card>
                <CardContent className="pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search VA..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <AddVaDialog 
                            isOpen={isDialogOpen} 
                            onOpenChange={setIsDialogOpen} 
                            onSave={handleSave} 
                            vaData={editingVa} 
                            onAddClick={() => { setEditingVa(undefined); setIsDialogOpen(true); }} 
                        />
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer Code</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Bank</TableHead>
                                <TableHead>VA Number</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVas.map(va => (
                                <TableRow key={va.id}>
                                    <TableCell>{va.customerCode || '-'}</TableCell>
                                    <TableCell>{va.customerName}</TableCell>
                                    <TableCell>{va.bankName}</TableCell>
                                    <TableCell className="font-mono font-bold text-blue-600">{va.vaNumber}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingVa(va); setIsDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteState({ isOpen: true, id: va.id })}><Trash2 className="h-4 w-4"/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <DeleteConfirmationDialog 
                open={deleteState.isOpen} 
                onOpenChange={(open) => setDeleteState({ isOpen: open, id: open ? deleteState.id : undefined })} 
                onConfirm={handleDelete}
            >
                <span />
            </DeleteConfirmationDialog>
        </main>
    );
}
