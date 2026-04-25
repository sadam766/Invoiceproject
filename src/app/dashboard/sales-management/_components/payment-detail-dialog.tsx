
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
import type { SalesListItem, Invoice, TaxInvoice } from '@/app/lib/data';
import { cn } from '@/lib/utils';
import { History, CreditCard, ExternalLink, ReceiptText, Calendar } from 'lucide-react';
import Link from 'next/link';

type ExtendedInvoice = Invoice & {
    taxInfo?: TaxInvoice;
};

type PaymentDetailDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SalesListItem | null;
  invoices: ExtendedInvoice[];
};

export function PaymentDetailDialog({ isOpen, onOpenChange, sale, invoices }: PaymentDetailDialogProps) {
  if (!sale) return null;

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const outstanding = sale.amount - totalPaid;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Buku Pembayaran PO: {sale.poNumber}
          </DialogTitle>
          <div className="grid grid-cols-3 gap-4 mt-4">
             <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Nilai PO Total</p>
                <p className="text-sm font-bold">Rp {sale.amount.toLocaleString('id-ID')}</p>
             </div>
             <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-[10px] uppercase font-bold text-green-600">Total Dana Masuk</p>
                <p className="text-sm font-bold text-green-700">Rp {totalPaid.toLocaleString('id-ID')}</p>
             </div>
             <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-[10px] uppercase font-bold text-red-600">Sisa Tagihan</p>
                <p className="text-sm font-bold text-red-700">Rp {outstanding.toLocaleString('id-ID')}</p>
             </div>
          </div>
        </DialogHeader>

        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Riwayat Penagihan & Perpajakan</h3>
                <Badge variant="outline" className="text-[10px]">{invoices.length} Dokumen Terdeteksi</Badge>
            </div>
            
            <div className="rounded-md border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] uppercase font-bold">Tipe / No. Invoice</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-center">Tgl Invoice</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold">No. Faktur Pajak</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-right">Nilai Tagihan</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-center">Status / Bayar</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">Belum ada invoice penagihan untuk PO ini.</TableCell></TableRow>
                        ) : (
                            invoices.map((inv) => {
                                const isProforma = inv.id.startsWith('KW');
                                return (
                                    <TableRow key={inv.id} className={cn(isProforma ? "bg-blue-50/10" : "")}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs">{inv.id}</span>
                                                <span className={cn("text-[9px] font-bold uppercase", isProforma ? "text-blue-500" : "text-emerald-600")}>
                                                    {isProforma ? "Proforma / DP" : "Commercial / SAR"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs">{inv.date}</span>
                                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                                    <Calendar className="h-2 w-2" /> Issued
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {inv.taxInfo ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-medium text-blue-700">{inv.taxInfo.taxInvoiceNumber}</span>
                                                    <span className="text-[9px] text-muted-foreground italic">{inv.taxInfo.taxInvoiceDate}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground italic">- No Tax Serial -</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-xs font-bold">Rp {inv.amount.toLocaleString('id-ID')}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <Badge variant={inv.status === 'paid' ? 'outline' : 'destructive'} 
                                                className={cn("text-[9px] h-4 py-0", inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800')}>
                                                    {inv.status.toUpperCase()}
                                                </Badge>
                                                {inv.status === 'paid' && (
                                                    <span className="text-[8px] text-muted-foreground">Fund Received</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Buka Dokumen">
                                                <Link href={`/dashboard/invoices`}><ExternalLink className="h-3 w-3" /></Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
                <ReceiptText className="h-4 w-4" />
                <p className="text-[10px] font-bold uppercase">Kebijakan Sinkronisasi Dokumen</p>
            </div>
            <ul className="list-disc pl-5 text-[10px] text-muted-foreground space-y-1">
                <li>Nomor Faktur Pajak akan muncul otomatis jika **Nomor Invoice** di modul Pajak sama dengan Nomor Invoice di atas.</li>
                <li>Invoice berawalan **KW/** dikategorikan sebagai Proforma, sedangkan **SAR/** adalah Commercial Invoice.</li>
                <li>Status **Lunas (Paid)** hanya diberikan jika dana sudah terverifikasi masuk ke rekening perusahaan.</li>
            </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
