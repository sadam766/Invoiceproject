
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
  import { spdData } from '@/app/lib/data';
  import { Search } from 'lucide-react';
  
  export default function SpdPage() {
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
                        <Input type="search" placeholder="Cari SPD..." className="pl-8" />
                    </div>
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
                            {spdData.map((item, index) => (
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
                    Showing 1 to 1 of 1 entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  