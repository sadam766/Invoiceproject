
'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SpdData } from '@/app/lib/data';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

type AddSpdDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<SpdData, 'totalPiutang'> & { totalPiutang: number | string }) => void;
  spdData?: SpdData;
  onAddClick: () => void;
};

export function AddSpdDialog({ isOpen, onOpenChange, onSave, spdData, onAddClick }: AddSpdDialogProps) {
  const [tanggal, setTanggal] = useState('');
  const [sales, setSales] = useState('');
  const [customer, setCustomer] = useState('');
  const [spd, setSpd] = useState('');
  const [noInvoice, setNoInvoice] = useState('');
  const [tanggalInvoice, setTanggalInvoice] = useState('');
  const [tglTerimaCustomer, setTglTerimaCustomer] = useState('');
  const [tglJatuhTempo, setTglJatuhTempo] = useState('');
  const [totalPiutang, setTotalPiutang] = useState<number | string>('');
  const [keterangan, setKeterangan] = useState('');
  const [noKuitansi, setNoKuitansi] = useState('');
  const [noFakturPajak, setNoFakturPajak] = useState('');
  const [suratJalan, setSuratJalan] = useState('');

  useEffect(() => {
    if (spdData) {
      setTanggal(spdData.tanggal);
      setSales(spdData.sales);
      setCustomer(spdData.customer);
      setSpd(spdData.spd);
      setNoInvoice(spdData.noInvoice);
      setTanggalInvoice(spdData.tanggalInvoice);
      setTglTerimaCustomer(spdData.tglTerimaCustomer);
      setTglJatuhTempo(spdData.tglJatuhTempo);
      setTotalPiutang(formatNumberWithCommas(spdData.totalPiutang));
      setKeterangan(spdData.keterangan);
      setNoKuitansi(spdData.noKuitansi);
      setNoFakturPajak(spdData.noFakturPajak);
      setSuratJalan(spdData.suratJalan);
    } else {
      // Reset form
      setTanggal('');
      setSales('');
      setCustomer('');
      setSpd('');
      setNoInvoice('');
      setTanggalInvoice('');
      setTglTerimaCustomer('');
      setTglJatuhTempo('');
      setTotalPiutang('');
      setKeterangan('');
      setNoKuitansi('');
      setNoFakturPajak('');
      setSuratJalan('');
    }
  }, [spdData, isOpen]);

  const handleTotalPiutangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseFormattedNumber(value);
    if (!isNaN(parsedValue) || value === '') {
        setTotalPiutang(value === '' ? '' : formatNumberWithCommas(parsedValue));
    }
  };

  const handleSave = () => {
    const numericTotalPiutang = typeof totalPiutang === 'string' ? parseFormattedNumber(totalPiutang) : totalPiutang;
    onSave({
      tanggal,
      sales,
      customer,
      spd,
      noInvoice,
      tanggalInvoice,
      tglTerimaCustomer,
      tglJatuhTempo,
      totalPiutang: numericTotalPiutang,
      keterangan,
      noKuitansi,
      noFakturPajak,
      suratJalan,
    });
  };

  const dialogTitle = spdData ? "Edit SPD" : "Add New SPD";
  const dialogDescription = spdData ? "Update the SPD details below." : "Fill in the details below to add a new SPD.";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Add SPD
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal</Label>
            <Input id="tanggal" value={tanggal} onChange={(e) => setTanggal(e.target.value)} placeholder="e.g. 2024-05-20"/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales">Sales</Label>
            <Input id="sales" value={sales} onChange={(e) => setSales(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spd">SPD</Label>
            <Input id="spd" value={spd} onChange={(e) => setSpd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="noInvoice">No Invoice</Label>
            <Input id="noInvoice" value={noInvoice} onChange={(e) => setNoInvoice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tanggalInvoice">Tanggal Invoice</Label>
            <Input id="tanggalInvoice" value={tanggalInvoice} onChange={(e) => setTanggalInvoice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tglTerimaCustomer">Tgl Terima Customer</Label>
            <Input id="tglTerimaCustomer" value={tglTerimaCustomer} onChange={(e) => setTglTerimaCustomer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tglJatuhTempo">Tgl Jatuh Tempo</Label>
            <Input id="tglJatuhTempo" value={tglJatuhTempo} onChange={(e) => setTglJatuhTempo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalPiutang">Total Piutang</Label>
            <Input id="totalPiutang" value={totalPiutang} onChange={handleTotalPiutangChange} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keterangan">Keterangan</Label>
            <Input id="keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="noKuitansi">No. Kuitansi</Label>
            <Input id="noKuitansi" value={noKuitansi} onChange={(e) => setNoKuitansi(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="noFakturPajak">No. Faktur Pajak</Label>
            <Input id="noFakturPajak" value={noFakturPajak} onChange={(e) => setNoFakturPajak(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suratJalan">Surat Jalan</Label>
            <Input id="suratJalan" value={suratJalan} onChange={(e) => setSuratJalan(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>Save SPD</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
