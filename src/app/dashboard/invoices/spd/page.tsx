
'use client';
import { useState, useMemo, useEffect } from 'react';
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
  import { spdData as initialSpdData, type SpdData } from '@/app/lib/data';
  import { Search, Plus } from 'lucide-react';
  import { AddSpdDialog } from './_components/add-spd-dialog';
  import { useToast } from '@/hooks/use-toast';
  
  export default function SpdPage() {
    const [data, setData] = useState(initialSpdData);
    const [editingSpd, setEditingSpd] = useState<SpdData | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        // This is a trick to re-fetch data if it was updated on another page.
        // In a real app, this would be handled by a state management library like Redux or Zustand.
        setData(initialSpdData);
    }, []);

    const filteredData = useMemo(() => {
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

    const handleSave = (newItem: Omit<SpdData, 'totalPiutang'> & { totalPiutang: number | string }) => {
        const newItemWithNumber = {
            ...newItem,
            totalPiutang: Number(newItem.totalPiutang)
        };

        if (editingSpd) {
            setData(data.map((item) => (item.spd === editingSpd.spd ? newItemWithNumber : item)));
            toast({ title: "SPD Updated", description: `SPD ${newItem.spd} has been updated.` });
        } else {
            setData([...data, newItemWithNumber]);
            toast({ title: "SPD Added", description: `New SPD ${newItem.spd} has been added.` });
        }
        setIsDialogOpen(false);
        setEditingSpd(undefined);
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((item, index) => (
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredData.length} of {data.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }

    