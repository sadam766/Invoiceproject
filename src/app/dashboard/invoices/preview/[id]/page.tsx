
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';

/**
 * Fungsi pembantu untuk mengonversi angka ke teks (Terbilang)
 */
function angkaKeTerbilang(n: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];
  let hasil = '';

  if (n < 12) hasil = bilangan[n];
  else if (n < 20) hasil = angkaKeTerbilang(n - 10) + ' Belas';
  else if (n < 100) hasil = angkaKeTerbilang(Math.floor(n / 10)) + ' Puluh ' + angkaKeTerbilang(n % 10);
  else if (n < 200) hasil = ' Seratus ' + angkaKeTerbilang(n - 100);
  else if (n < 1000) hasil = angkaKeTerbilang(Math.floor(n / 100)) + ' Ratus ' + angkaKeTerbilang(n % 100);
  else if (n < 2000) hasil = ' Seribu ' + angkaKeTerbilang(n - 1000);
  else if (n < 1000000) hasil = angkaKeTerbilang(Math.floor(n / 1000)) + ' Ribu ' + angkaKeTerbilang(n % 1000);
  else if (n < 1000000000) hasil = angkaKeTerbilang(Math.floor(n / 1000000)) + ' Juta ' + angkaKeTerbilang(n % 1000000);
  else hasil = "Angka terlalu besar";

  return hasil.trim();
}

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceId = params.id as string;

  const safeId = invoiceId?.replace(/\//g, '_');
  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) {
    return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat Dokumen Penagihan...</div>;
  }

  if (!invoiceData) {
    return (
      <div className="p-20 text-center space-y-4">
        <p className="text-rose-600 font-bold">Dokumen tidak ditemukan.</p>
        <Button onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  // LOGIKA KALKULASI FINANSIAL
  const items = invoiceData.items || [];
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const negotiation = invoiceData.negotiation || 0;
  const totalRp = invoiceData.amount || 0;
  
  // Back-calculation PPN 12% (Tax Inclusive)
  const dppVat = totalRp / 1.12;
  const vat12 = totalRp - dppVat;
  
  const dpValue = invoiceData.dpValue || 0;
  const dpPercent = subTotalItems > 0 ? Math.round((dpValue / subTotalItems) * 100) : 0;
  const pelunasan = totalRp - dpValue;

  const displayInvoiceId = invoiceData.id.replace(/_/g, '/');
  const spdNumber = `PS/${displayInvoiceId.split('/').pop()}-J/KEU/2026/DK`;

  const terbilang = `${angkaKeTerbilang(Math.floor(totalRp))} Rupiah`.toUpperCase();

  const InvoiceTemplate = ({ type }: { type: 'ORIGINAL' | 'COPY' }) => (
    <div 
      className={`relative bg-white shadow-2xl mx-auto p-12 flex flex-col font-sans text-slate-900 border border-slate-200 ${type === 'COPY' ? 'grayscale opacity-70 print:opacity-60' : ''}`}
      style={{ width: '210mm', minHeight: '297mm', color: '#000' }}
    >
      {/* HEADER */}
      <header className="flex justify-between items-start border-b-4 border-indigo-900 pb-6 mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-indigo-900 leading-none">PT. JEMBO CABLE COMPANY Tbk</h1>
          <div className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-tighter">
            <p>Mega Glodok Kemayoran Office Tower B 6th Floor</p>
            <p>Jl. Angkasa Kav. B-6 Kota Baru Bandar Kemayoran</p>
            <p>Jakarta Pusat</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <h2 className="text-4xl font-black text-slate-100 italic leading-none mb-2">{type}</h2>
          <h3 className="text-xl font-bold tracking-[0.2em] underline decoration-2 underline-offset-4">INVOICE</h3>
          <p className="text-xs font-black mt-2 bg-slate-900 text-white px-3 py-1 rounded">No: {displayInvoiceId}</p>
        </div>
      </header>

      {/* CUSTOMER INFO */}
      <div className="grid grid-cols-2 gap-10 mb-10">
        <div className="space-y-2">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ditujukan Kepada / Bill To:</span>
          <div className="border-l-4 border-indigo-900 pl-4 space-y-1">
            <p className="text-lg font-black uppercase leading-tight">{invoiceData.customer}</p>
            <p className="text-[10px] font-medium leading-normal text-slate-600 italic">{invoiceData.billingAddress}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <table className="text-[11px] font-bold">
            <tbody>
              <tr>
                <td className="text-slate-400 pr-4 py-1 text-right">TANGGAL:</td>
                <td className="uppercase">{new Date(invoiceData.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
              </tr>
              <tr>
                <td className="text-slate-400 pr-4 py-1 text-right italic uppercase">PO Number:</td>
                <td className="font-black text-indigo-700">{invoiceData.poNumber}</td>
              </tr>
              <tr>
                <td className="text-slate-400 pr-4 py-1 text-right uppercase">SPD Ref:</td>
                <td className="font-mono text-[9px]">{spdNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ITEM TABLE */}
      <div className="flex-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-indigo-900 text-white text-[9px] font-black uppercase tracking-widest">
              <th className="py-3 px-4 text-left border border-indigo-900 w-[5%]">No</th>
              <th className="py-3 px-4 text-left border border-indigo-900">Deskripsi Pekerjaan / Barang</th>
              <th className="py-3 px-2 text-center border border-indigo-900 w-[15%]">Kuantitas</th>
              <th className="py-3 px-4 text-right border border-indigo-900 w-[20%]">Harga Satuan</th>
              <th className="py-3 px-4 text-right border border-indigo-900 w-[20%]">Total Harga</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                <td className="py-3 px-4 font-black uppercase text-slate-800">{item.name}</td>
                <td className="py-3 px-2 text-center font-bold">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                <td className="py-3 px-4 text-right">Rp {item.price.toLocaleString('id-ID')}</td>
                <td className="py-3 px-4 text-right font-black">Rp {item.total.toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {/* Fill empty rows */}
            {items.length < 8 && Array.from({ length: 8 - items.length }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-slate-50 h-10">
                <td colSpan={5}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-10 border-t-2 border-slate-100 pt-8">
        <div className="grid grid-cols-12 gap-10">
          {/* LEFT: PAYMENT INFO */}
          <div className="col-span-7 space-y-6">
            <div className="space-y-2">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Terbilang / In Words:</p>
              <div className="bg-slate-50 p-4 border-l-4 border-slate-400 rounded-r shadow-inner">
                <p className="text-[10px] font-black italic text-slate-700">*** {terbilang} ***</p>
              </div>
            </div>

            <div className="p-5 border-2 border-dashed border-indigo-100 rounded-2xl bg-indigo-50/20 space-y-3">
              <p className="text-[10px] font-black underline text-indigo-900 uppercase tracking-widest">Informasi Pembayaran:</p>
              <div className="grid grid-cols-3 gap-y-2 text-[10px] font-bold">
                <span className="text-slate-500 italic">Nama Rekening</span>
                <span className="col-span-2">: PT. JEMBO CABLE COMPANY Tbk</span>
                <span className="text-slate-500 italic">Bank Penerima</span>
                <span className="col-span-2">: BANK CENTRAL ASIA (BCA)</span>
                <span className="text-slate-500 italic uppercase tracking-tighter">Virtual Account</span>
                <span className="col-span-2 font-black text-indigo-700 text-sm tracking-[0.2em]">: {invoiceData.vaNumber || "KODE CUSTOMER"}</span>
              </div>
              <p className="text-[8px] text-slate-400 italic font-medium pt-2">* Mohon cantumkan Nomor Invoice pada berita transfer.</p>
            </div>
          </div>

          {/* RIGHT: CALCULATION SUMMARY */}
          <div className="col-span-5">
            <div className="space-y-2 text-[11px] font-bold">
              <div className="flex justify-between items-center text-slate-500">
                <span>Sub-Total Bruto</span>
                <span>Rp {subTotalItems.toLocaleString('id-ID')}</span>
              </div>
              {negotiation > 0 && (
                <div className="flex justify-between items-center text-rose-600 italic">
                  <span>Potongan Negosiasi</span>
                  <span>- Rp {negotiation.toLocaleString('id-ID')}</span>
                </div>
              )}
              {dpValue > 0 && (
                <div className="flex justify-between items-center text-indigo-600">
                  <span>Uang Muka (DP) {dpPercent}%</span>
                  <span>(Rp {dpValue.toLocaleString('id-ID')})</span>
                </div>
              )}
              
              <div className="border-t border-slate-200 pt-2 space-y-1">
                <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase">
                  <span>Dasar Pengenaan Pajak (DPP)</span>
                  <span>Rp {Math.floor(dppVat).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase">
                  <span>PPN / VAT 12% (Coretax Standard)</span>
                  <span>Rp {Math.ceil(vat12).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex justify-between items-center font-black text-xl border-t-4 border-indigo-900 pt-3 mt-4 text-indigo-950">
                <span className="tracking-tighter uppercase">Total Akhir</span>
                <span className="tracking-tight">Rp {totalRp.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex justify-between items-center italic text-[10px] text-slate-400 border-t border-dotted border-slate-300 pt-2">
                <span>Sisa Saldo Kontrak</span>
                <span>Rp {pelunasan.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SIGNATURE SECTION */}
        <div className="flex justify-end mt-16">
          <div className="text-center w-64 space-y-20">
            <p className="text-[10px] font-bold text-slate-500">Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <div className="space-y-1">
              <div className="border-b-2 border-slate-900 w-full"></div>
              <p className="font-black text-xs uppercase tracking-widest text-slate-900">Finance Department</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">PT. JEMBO CABLE COMPANY Tbk</p>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM WATERMARK */}
      <div className="absolute bottom-6 left-12 text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">
        Verified by Dakota Hub Intelligence
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center gap-12 print:p-0 print:bg-white animate-in fade-in duration-700">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="bg-white/80 backdrop-blur-md shadow-xl rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest border-none">
          <ArrowLeft className="mr-2 h-4 w-4" /> Batal & Kembali
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 rounded-2xl h-12 px-10 font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 active:scale-95">
          <Printer className="mr-2 h-4 w-4" /> Cetak Dokumen Hub
        </Button>
      </div>

      <div className="space-y-20 print:space-y-0">
        <InvoiceTemplate type="ORIGINAL" />
        <div className="print:page-break-after-always" style={{ pageBreakBefore: 'always' }}></div>
        <InvoiceTemplate type="COPY" />
      </div>

      <div className="print:hidden text-center opacity-30 pb-20">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Dakota Digital Print Engine — Professional Render</p>
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
