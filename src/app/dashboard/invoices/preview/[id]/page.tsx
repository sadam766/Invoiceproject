'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { formatCurrency, cn } from '@/lib/utils';

// Logic for conversion of number to words (Indonesian)
function toWords(num: number): string {
  const units = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const convert = (n: number): string => {
    if (n < 12) return units[n];
    if (n < 20) return convert(n - 10) + ' Belas';
    if (n < 100) return convert(Math.floor(n / 10)) + ' Puluh ' + convert(n % 10);
    if (n < 200) return ' Seratus ' + convert(n - 100);
    if (n < 1000) return convert(Math.floor(n / 100)) + ' Ratus ' + convert(n % 100);
    if (n < 2000) return ' Seribu ' + convert(n - 1000);
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Ribu ' + convert(n % 1000);
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Juta ' + convert(n % 1000000);
    if (n < 1000000000000) return convert(Math.floor(n / 1000000000)) + ' Miliar ' + convert(n % 1000000000);
    return '';
  };
  const result = convert(Math.floor(num));
  return result ? (result.trim() + ' Rupiah').toUpperCase() : 'NOL RUPIAH';
}

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceId = params.id as string;

  const safeId = invoiceId?.replace(/\//g, '_');
  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  const stats = useMemo(() => {
    if (!invoiceData) return null;
    const items = invoiceData.items || [];
    const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const amount = invoiceData.amount || 0;
    
    // Back-calculation for PPN 12% (Standard Coretax)
    const dppVat = amount / 1.12;
    const vat12 = amount - dppVat;
    
    const dpValue = invoiceData.dpValue || 0;
    const dpPercent = amount > 0 ? Math.round((dpValue / amount) * 100) : 0;
    const pelunasan = amount - dpValue;
    const negotiation = invoiceData.negotiation || 0;

    return {
      subTotalItems,
      vat12,
      dppVat,
      dpValue,
      dpPercent,
      pelunasan,
      negotiation,
      totalRp: amount,
      items
    };
  }, [invoiceData]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synchronizing Financial Data...</p>
        </div>
      </div>
    );
  }

  if (!invoiceData || !stats) {
    return (
      <div className="p-20 text-center space-y-4 bg-white min-h-screen">
        <p className="text-rose-600 font-bold uppercase tracking-widest">Dokumen Tidak Ditemukan</p>
        <Button onClick={() => router.back()} variant="outline">Kembali ke Dashboard</Button>
      </div>
    );
  }

  const InvoiceTemplate = ({ type }: { type: 'ORIGINAL' | 'COPY' }) => (
    <div 
      className={cn(
        "p-10 bg-white border mb-12 shadow-sm font-sans flex flex-col relative",
        type === 'COPY' && "grayscale opacity-70"
      )}
      style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', color: '#1a1a1a' }}
    >
      {/* WATERMARK FOR COPY */}
      {type === 'COPY' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.05]">
          <h1 className="text-[120px] font-black uppercase tracking-[0.2em]">INTERNAL ARCHIVE</h1>
        </div>
      )}

      {/* HEADER PERUSAHAAN */}
      <div className="flex justify-between items-start border-b-4 border-blue-900 pb-5">
        <div>
          <h1 className="text-2xl font-black text-blue-900 leading-tight">PT. JEMBO CABLE COMPANY Tbk</h1>
          <div className="text-[10px] mt-1 text-gray-700 leading-relaxed uppercase font-bold tracking-tight">
            <p>Mega Glodok Kemayoran Office Tower B 6th Floor</p>
            <p>Jl. Angkasa Kav. B-6 Kota Baru Bandar Kemayoran</p>
            <p>Jakarta Pusat</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="bg-slate-100 px-4 py-1 rounded text-[10px] font-black tracking-widest text-slate-500 mb-2">
            {type} DOCUMENT
          </div>
          <h3 className="text-xl font-black tracking-[0.2em] text-gray-800 underline uppercase italic">Invoice</h3>
          <p className="text-xs font-black mt-1 text-blue-900">No: PS/{invoiceData.id.replace(/_/g, '/')}-J/KEU/2026/DK</p>
        </div>
      </div>

      {/* DETAIL PELANGGAN */}
      <div className="mt-8 flex justify-between text-sm">
        <div className="w-1/2">
          <span className="text-[9px] font-black text-gray-400 block mb-1 uppercase tracking-widest">Bill To:</span>
          <p className="font-extrabold text-base border-l-4 border-blue-900 pl-3 uppercase text-slate-800 leading-none py-1">{invoiceData.customer}</p>
          <p className="text-[11px] mt-2 leading-tight text-gray-600 italic font-medium w-[90%]">{invoiceData.billingAddress || "Alamat Penagihan Pelanggan"}</p>
        </div>
        <div className="text-right">
          <table className="text-[11px] inline-block">
            <tbody>
              <tr>
                <td className="text-gray-400 font-bold px-2 text-right uppercase tracking-tighter">Issue Date:</td>
                <td className="font-bold border-b border-slate-100">{new Date(invoiceData.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
              </tr>
              <tr>
                <td className="text-gray-400 font-bold px-2 text-right uppercase tracking-tighter italic">Ref PO Number:</td>
                <td className="font-bold border-b border-slate-100">{invoiceData.poNumber || "-"}</td>
              </tr>
              <tr>
                <td className="text-gray-400 font-bold px-2 text-right uppercase tracking-tighter italic">Ref SO Number:</td>
                <td className="font-bold border-b border-slate-100">{invoiceData.soNumber || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* TABEL ITEM */}
      <div className="flex-1 mt-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-900 text-white text-[10px] uppercase tracking-wider h-10">
              <th className="py-1 px-3 text-left border border-blue-900 font-black">Deskripsi Pekerjaan / Barang</th>
              <th className="py-1 px-1 text-center border border-blue-900 w-24 font-black">Kuantitas</th>
              <th className="py-1 px-3 text-right border border-blue-900 w-36 font-black">Harga Satuan</th>
              <th className="py-1 px-3 text-right border border-blue-900 w-40 font-black">Total Harga</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {stats.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-300 min-h-[40px]">
                <td className="py-3 px-3 font-bold text-gray-800 uppercase leading-snug">{item.name}</td>
                <td className="py-3 px-1 text-center font-bold">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                <td className="py-3 px-3 text-right font-medium">Rp {item.price?.toLocaleString('id-ID')}</td>
                <td className="py-3 px-3 text-right font-black text-slate-900">Rp {item.total?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {/* Fill space with empty rows for consistent structure if necessary */}
          </tbody>
        </table>
      </div>

      {/* FOOTER & RINCIAN BIAYA */}
      <div className="mt-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sisi Kiri: Pembayaran */}
          <div className="col-span-7 space-y-4">
            <div>
              <p className="text-[9px] font-black text-gray-400 italic mb-1 uppercase tracking-widest">Terbilang / In Words:</p>
              <div className="bg-slate-50 p-3 border-l-4 border-slate-500 rounded-r shadow-inner">
                <p className="text-[11px] font-black italic text-slate-700 leading-tight">*** {toWords(stats.totalRp)} ***</p>
              </div>
            </div>

            <div className="text-[10px] p-4 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/10">
              <p className="font-black underline text-blue-900 mb-3 uppercase tracking-[0.2em]">Informasi Pembayaran:</p>
              <div className="grid grid-cols-[100px_auto] gap-y-1.5 items-start">
                <span className="text-gray-500 font-bold italic text-[9px] uppercase">Nama Rekening</span>
                <span className="font-black text-slate-800 text-[10px]">: PT. JEMBO CABLE COMPANY Tbk</span>
                
                <span className="text-gray-500 font-bold italic text-[9px] uppercase">Nama Bank</span>
                <span className="font-black text-slate-800 text-[10px]">: BANK MANDIRI / BCA</span>

                {invoiceData.paymentMethod === 'va' ? (
                  <>
                    <span className="text-blue-600 font-black italic text-[9px] uppercase">Virtual Account</span>
                    <span className="font-black text-blue-700 text-[13px] tracking-[0.2em]">: {invoiceData.vaNumber || "SYST-PENDING-MAP"}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-500 font-bold italic text-[9px] uppercase">Nomor Rekening</span>
                    <span className="font-black text-slate-800 text-[10px]">: 102-0100206827 (MDR) / 684-0198977 (BCA)</span>
                  </>
                )}
              </div>
              <p className="mt-3 text-[8px] italic text-slate-400 font-medium">*Harap sertakan Nomor Invoice pada berita transfer.</p>
            </div>
          </div>

          {/* Sisi Kanan: Summary */}
          <div className="col-span-5">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-500 font-bold">
                <span className="uppercase text-[9px] tracking-widest">Sub Total</span>
                <span>Rp {stats.subTotalItems.toLocaleString('id-ID')}</span>
              </div>
              
              {stats.negotiation > 0 && (
                <div className="flex justify-between items-center text-rose-500 font-black italic">
                  <span className="uppercase text-[9px]">Discount / Negotiation</span>
                  <span>- Rp {stats.negotiation.toLocaleString('id-ID')}</span>
                </div>
              )}

              {stats.dpValue > 0 && (
                <div className="flex justify-between items-center font-black text-indigo-700">
                  <span className="uppercase text-[9px]">Down Payment ({stats.dpPercent}%)</span>
                  <span>- Rp {stats.dpValue.toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between items-center text-[9px] uppercase text-slate-400 font-black tracking-widest">
                  <span>Dasar Pengenaan Pajak (DPP)</span>
                  <span>Rp {stats.dppVat.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] uppercase text-slate-400 font-black tracking-widest">
                  <span>PPN / VAT 12%</span>
                  <span>Rp {stats.vat12.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex justify-between items-center font-black text-xl border-t-2 border-slate-900 pt-3 mt-3 text-blue-900 tracking-tighter">
                <span className="uppercase text-sm italic">Total Tagihan</span>
                <span>Rp {stats.totalRp.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex justify-between items-center italic text-[9px] text-slate-400 border-t border-dotted border-slate-300 pt-2 mt-2">
                <span className="uppercase font-bold">Sisa Pelunasan Piutang</span>
                <span className="font-black">Rp {stats.pelunasan.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TANDA TANGAN */}
        <div className="flex justify-end mt-16 pr-4">
          <div className="text-center w-64 space-y-24">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <div className="space-y-1">
              <div className="border-b-2 border-slate-900 w-full mb-1"></div>
              <p className="font-black text-[11px] uppercase text-blue-900 tracking-widest">Finance Department</p>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter italic">PT. JEMBO CABLE COMPANY Tbk</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* PAGE FOOTER */}
      <div className="mt-auto pt-12 text-center">
        <div className="h-px bg-slate-100 w-full mb-2" />
        <p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.5em]">
          Dakota Hub — Integrated Billing System v2.0 | Page 1 of 1
        </p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center gap-12 print:p-0 print:bg-white animate-in fade-in duration-700">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 print:hidden bg-white/80 backdrop-blur-md p-2 rounded-3xl shadow-premium ring-1 ring-slate-100">
        <Button variant="ghost" onClick={() => router.back()} className="rounded-2xl font-black uppercase text-[10px] tracking-widest px-8 h-12 text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-900 hover:bg-blue-800 text-white shadow-2xl rounded-2xl font-black uppercase text-[10px] tracking-widest px-10 h-12 transition-all hover:scale-105 active:scale-95">
          <Printer className="mr-2 h-4 w-4" /> CETAK DOKUMEN PENAGIHAN
        </Button>
      </div>

      <div className="space-y-12 print:space-y-0">
        <InvoiceTemplate type="ORIGINAL" />
        <div className="print:hidden h-px w-full border-t border-slate-200 border-dashed" />
        <InvoiceTemplate type="COPY" />
      </div>
    </main>
  );
};

export default InvoicePreviewPage;