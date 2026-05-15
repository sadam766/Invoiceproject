'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Wallet, CheckCircle2, AlertTriangle, FileUp } from 'lucide-react';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

type RecordPaymentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  selectedCount: number;
  totalAmount: number;
};

export function RecordPaymentDialog({ isOpen, onOpenChange, onSave, selectedCount, totalAmount }: RecordPaymentDialogProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('Transfer Bank');
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (isOpen) {
        setAmountInput(formatNumberWithCommas(totalAmount));
    }
  }, [isOpen, totalAmount]);

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // HAPUS BATAS DIGIT (NO LENGTH LIMIT)
    const value = e.target.value.replace(/[^0-9.,-]/g, '');
    if (value === '') { setAmountInput(''); return; }
    const num = parseFormattedNumber(value);
    if (!isNaN(num)) {
        let formatted = formatNumberWithCommas(num);
        if (value.endsWith(',') || value.endsWith('.')) {
            const sep = value.includes(',') ? ',' : '.';
            if (!formatted.includes(sep)) formatted += sep;
        }
        setAmountInput(formatted);
    } else {
        setAmountInput(value);
    }
  };

  const handleSave = () => {
    if (!reference || !date) return;
    onSave({
      date,
      reference,
      method,
      amount: parseFormattedNumber(amountInput)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <Wallet className="h-5 w-5" /> KONFIRMASI PEMBAYARAN
          </DialogTitle>
          <DialogDescription>
            Input detail pelunasan untuk <b>{selectedCount} Invoice</b> terpilih.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
             <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Total Dana Verifikasi</p>
                <div className="flex items-center gap-1">
                   <span className="text-sm font-bold text-emerald-600">Rp</span>
                   <Input 
                      type="text"
                      value={amountInput} 
                      onChange={handleNumericChange}
                      className="text-xl font-black text-emerald-800 bg-transparent border-none p-0 h-auto focus-visible:ring-0 shadow-none w-full"
                   />
                </div>
             </div>
             <CheckCircle2 className="h-8 w-8 text-emerald-200" />
          </div>

          <div className="grid gap-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tanggal Bayar (Efektif)</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nomor Referensi / No. Bukti Transfer</Label>
                <Input 
                    placeholder="Contoh: REF-99123-BCA" 
                    value={reference} 
                    onChange={e => setReference(e.target.value)} 
                    className="font-bold border-emerald-200 focus-visible:ring-emerald-500"
                />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Metode Pembayaran</Label>
                <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Transfer Bank">Transfer Bank (BCA/Mandiri)</SelectItem>
                        <SelectItem value="Virtual Account">Virtual Account</SelectItem>
                        <SelectItem value="Tunai">Tunai / Cash</SelectItem>
                        <SelectItem value="Cek / Giro">Cek / Giro</SelectItem>
                    </SelectContent>
                </Select>
             </div>

             <div className="pt-4 border-t border-dashed">
                <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg text-amber-800 text-[10px] font-medium border border-amber-100">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Pastikan nominal bukti transfer sama persis dengan total tagihan untuk status <b>FULL PAID</b>.</span>
                </div>
             </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 px-8 font-black uppercase tracking-widest"
            onClick={handleSave}
            disabled={!reference}
          >
            Selesaikan Pembayaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
