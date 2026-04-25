
'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SalesListItem, Invoice } from '@/app/lib/data';
import { cn } from '@/lib/utils';
import { History, CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';

type PaymentDetailDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SalesListItem | null;
  invoices: Invoice[];
};

export function PaymentDetailDialog({ isOpen, onOpenChange, sale, invoices }: PaymentDetailDialogProps) {
  if (!sale) return null;

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const outstanding = sale.amount - totalPaid;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Buku Pembayaran PO: {sale.poNumber}
          </DialogTitle>
          <div className="grid grid-cols-3 gap-4 mt-4">
             <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Nilai PO</p>
                <p className="text-sm font-bold">Rp {sale.amount.toLocaleString('id-ID')}</p>
             </div>
             <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-[10px] uppercase font-bold text-green-600">Total Terbayar</p>
                <p className="text-sm font-bold text-green-700">Rp {totalPaid.toLocaleString('id-ID')}</p>
             </div>
             <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-[10px] uppercase font-bold text-red-600">Sisa Tagihan</p>
                <p className="text-sm font-bold text-red-700">Rp {outstanding.toLocaleString('id-ID')}</p>
             </div>
          </div>
        </DialogHeader>

        <div className="py-6">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Daftar Transaksi Invoice</h3>
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>No. Invoice</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead>Jumlah</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">Belum ada invoice penagihan untuk PO ini.</TableCell></TableRow>
                        ) : (
                            invoices.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-medium">{inv.id}</TableCell>
                                    <TableCell>{inv.date}</TableCell>
                                    <TableCell className="text-xs">{inv.paymentMethod || 'Manual'}</TableCell>
                                    <TableCell>Rp {inv.amount.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>
                                        <Badge variant={inv.status === 'paid' ? 'outline' : 'destructive'} 
                                        className={cn(inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800')}>
                                            {inv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link href={`/dashboard/invoices`}><ExternalLink className="h-4 w-4" /></Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        <div className="border-t pt-4 text-xs text-muted-foreground">
            <p><strong>Catatan:</strong> Sinkronisasi ini berbasis Nomor PO. Invoice akan muncul otomatis di sini jika nomor PO pada invoice sama dengan nomor PO di buku ini.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
