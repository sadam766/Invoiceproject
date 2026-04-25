
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
import { History, CreditCard, ExternalLink, ReceiptText, Calendar, CheckCircle2, Wallet, Banknote, AlertCircle } from 'lucide-react';
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
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-muted/10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                    <History className="h-6 w-6 text-primary" />
                    Buku Piutang & Pembayaran
                </DialogTitle>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nomor PO: {sale.poNumber} | Customer: {sale.customer}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
             <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest mb-1">Total Nilai PO</p>
                <p className="text-lg font-black text-slate-800">Rp {sale.amount.toLocaleString('id-ID')}</p>
             </div>
             <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-100 shadow-sm">
                <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-1">Sudah Dibayar</p>
                <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-emerald-700">Rp {totalPaid.toLocaleString('id-ID')}</p>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
             </div>
             <div className="p-4 bg-rose-50 rounded-xl border-2 border-rose-100 shadow-sm">
                <p className="text-[10px] uppercase font-black text-rose-600 tracking-widest mb-1">Sisa Piutang</p>
                <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-rose-700">Rp {outstanding.toLocaleString('id-ID')}</p>
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                </div>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 space-y-8">
            {/* INVOICE SECTION */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500">
                        <ReceiptText className="h-4 w-4" /> Daftar Penagihan Terbit
                    </h3>
                    <Badge variant="outline" className="text-[9px] font-black">{invoices.length} Dokumen</Badge>
                </div>
                
                <div className="rounded-xl border overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-[9px] uppercase font-black py-3">Tipe / No. Invoice</TableHead>
                                <TableHead className="text-[9px] uppercase font-black text-center py-3">Tgl Terbit</TableHead>
                                <TableHead className="text-[9px] uppercase font-black py-3">No. Faktur Pajak</TableHead>
                                <TableHead className="text-right text-[9px] uppercase font-black py-3">Nilai Tagihan</TableHead>
                                <TableHead className="text-center text-[9px] uppercase font-black py-3">Status Bayar</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-medium italic">Belum ada invoice untuk PO ini.</TableCell></TableRow>
                            ) : (
                                invoices.map((inv) => {
                                    const isProforma = inv.id.startsWith('KW');
                                    return (
                                        <TableRow key={inv.id} className={cn("hover:bg-muted/5 transition-colors", isProforma && "bg-blue-50/5")}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs text-indigo-700">{inv.id}</span>
                                                    <span className={cn("text-[9px] font-black uppercase", isProforma ? "text-blue-500" : "text-emerald-600")}>
                                                        {isProforma ? "Proforma / DP" : "Commercial / SAR"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-xs font-bold text-slate-600">{inv.date}</span>
                                            </TableCell>
                                            <TableCell>
                                                {inv.taxInfo ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-blue-700">{inv.taxInfo.taxInvoiceNumber}</span>
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{inv.taxInfo.taxInvoiceDate}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-black text-muted-foreground/40 italic">- BELUM ADA FAKTUR -</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-xs font-black">Rp {inv.amount.toLocaleString('id-ID')}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge 
                                                    variant={inv.status === 'paid' ? 'outline' : 'secondary'} 
                                                    className={cn(
                                                        "text-[8px] h-4 px-2 font-black uppercase", 
                                                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600'
                                                    )}
                                                >
                                                    {inv.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" asChild>
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

            {/* PAYMENT HISTORY SECTION */}
            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500">
                    <Wallet className="h-4 w-4" /> Riwayat Transaksi Kas
                </h3>
                <div className="grid gap-3">
                    {invoices.some(inv => inv.payments && inv.payments.length > 0) ? (
                        invoices.flatMap(inv => (inv.payments || []).map(pay => (
                            <div key={pay.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-colors">
                                <div className="bg-emerald-100 p-2.5 rounded-full"><Banknote className="h-5 w-5 text-emerald-700" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-black text-slate-800">Pelunasan Invoice: {inv.id}</p>
                                        <span className="text-xs font-black text-emerald-700">+ Rp {pay.amount.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex gap-4 mt-1">
                                        <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {pay.date}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">REF: {pay.reference}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground ml-auto uppercase italic">Verif by: {pay.recordedBy}</span>
                                    </div>
                                </div>
                            </div>
                        )))
                    ) : (
                        <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center opacity-30 text-center">
                            <Wallet className="h-10 w-10 mb-2" />
                            <p className="text-xs font-black uppercase tracking-tighter">Belum ada dana masuk terverifikasi.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="p-4 bg-blue-50 border-t-2 border-blue-100 flex items-start gap-3">
            <CreditCard className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-blue-700 tracking-widest">Catatan Finansial Digital:</p>
                <p className="text-[10px] text-blue-900/70 leading-relaxed font-medium">
                    Setiap pembayaran yang dicatat akan secara otomatis mengurangi saldo piutang di Dashboard Utama dan Monitoring Monitoring Global. 
                    Invoice yang sudah lunas sepenuhnya akan dikunci dari pengeditan data barang.
                </p>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
