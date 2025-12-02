'use client';
import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  import { type SpdData } from '@/app/lib/data';
  import { Search, Plus } from 'lucide-react';
  import { AddSpdDialog } from './_components/add-spd-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
  
  export default function SpdPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const [editingSpd, setEditingSpd] = useState<SpdData | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogState, setDeleteDialogState] = useState<{ isOpen: boolean; spdId?: string }>({ isOpen: false });


    const spdsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data, isLoading } = useCollection<SpdData>(spdsCollection);


    const filteredData = useMemo(() => {
        if (!data) return [];
        if (!searchQuery) {
          return data;
        }
        return data.filter((item) =>
          Object.values(item).some((value) =>
            String(value).toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      }, [data, searchQuery]);


    const handleAdd = () => {
      setEditingSpd(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (spdItem: SpdData) => {
        setEditingSpd(spdItem);
        setIsDialogOpen(true);
    }
    
    const handleDeleteConfirm = () => {
        if (!firestore || !deleteDialogState.spdId) return;
        const docRef = doc(firestore, 'spds', deleteDialogState.spdId);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: "SPD Deleted", description: `SPD ${deleteDialogState.spdId} has been removed.` });
                setDeleteDialogState({ isOpen: false, spdId: undefined });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                setDeleteDialogState({ isOpen: false, spdId: undefined });
            });
    };

    const openDeleteDialog = (spdId: string) => {
        setDeleteDialogState({ isOpen: true, spdId: spdId });
    };

    const handlePreview = (spdItem: SpdData) => {
      sessionStorage.setItem('spdPreviewData', JSON.stringify(spdItem));
      router.push(`/dashboard/invoices/spd/preview/${encodeURIComponent(spdItem.spd)}`);
    };


    const handleSave = (newItem: SpdData) => {
        if (!firestore || !user) return;
        
        const isNew = !editingSpd;
        const docRef = doc(firestore, 'spds', newItem.spd);
        const dataToSave = { ...newItem, ownerId: user.uid };

        setDoc(docRef, dataToSave, { merge: !isNew })
            .then(() => {
                toast({ title: isNew ? "SPD Added" : "SPD Updated" });
                setIsDialogOpen(false);
                setEditingSpd(undefined);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: isNew ? 'create' : 'update',
                    requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleDialogClose = (open: boolean) => {
      if (!open) {
        setIsDialogOpen(false);
        setEditingSpd(undefined);
      } else {
        setIsDialogOpen(true);
      }
    }
  
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar SPD</h1>
          <p className="text-muted-foreground">
            Kelola semua Tanda Terima Anda untuk rekapitulasi.
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Cari SPD..." 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                     <AddSpdDialog
                        isOpen={isDialogOpen}
                        onOpenChange={handleDialogClose}
                        onSave={handleSave}
                        spdData={editingSpd}
                        onAddClick={handleAdd}
                    />
                </div>

                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Sales</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>SPD</TableHead>
                                <TableHead>No Invoice</TableHead>
                                <TableHead>Tanggal Invoice</TableHead>
                                <TableHead>Tgl Terima Customer</TableHead>
                                <TableHead>Tgl Jatuh Tempo</TableHead>
                                <TableHead>Total Piutang</TableHead>
                                <TableHead>Keterangan</TableHead>
                                <TableHead>No. Kuitansi</TableHead>
                                <TableHead>No. Faktur Pajak</TableHead>
                                <TableHead>Surat Jalan</TableHead>
                                <TableHead>Tindakan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={14} className="text-center">Loading SPDs...</TableCell></TableRow>}
                            {filteredData?.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.tanggal}</TableCell>
                                    <TableCell>{item.sales}</TableCell>
                                    <TableCell>{item.customer}</TableCell>
                                    <TableCell className="font-medium">{item.spd}</TableCell>
                                    <TableCell>{item.noInvoice}</TableCell>
                                    <TableCell>{item.tanggalInvoice}</TableCell>
                                    <TableCell>{item.tglTerimaCustomer}</TableCell>
                                    <TableCell>{item.tglJatuhTempo}</TableCell>
                                    <TableCell>Rp {item.totalPiutang.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>{item.keterangan}</TableCell>
                                    <TableCell>{item.noKuitansi}</TableCell>
                                    <TableCell>{item.noFakturPajak}</TableCell>
                                    <TableCell>{item.suratJalan}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => handlePreview(item)}>Pratinjau</Button>
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(item)}>Edit</Button>
                                            <DeleteConfirmationDialog 
                                                open={deleteDialogState.isOpen && deleteDialogState.spdId === item.spd}
                                                onOpenChange={(open) => setDeleteDialogState({isOpen: open, spdId: open ? item.spd : undefined})}
                                                onConfirm={handleDeleteConfirm}
                                            >
                                                <Button variant="link" className="p-0 h-auto text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.spd); }}>
                                                    Hapus
                                                </Button>
                                            </DeleteConfirmationDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredData?.length || 0} of {data?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
    