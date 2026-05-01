'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';

const formatCurrency = (value: number) => {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceContainerRef = useRef<HTMLDivElement>(null);
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat Dokumen...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan di database.</div>;

  const items = invoiceData.items || [];
  const grandTotal = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  
  // Back-calculation PPN 12% sesuai standar Coretax
  const dppVat = grandTotal / 1.12;
  const vat12 = grandTotal - dppVat;
  const totalRp = grandTotal;
  
  const displayInvoiceId = invoiceId?.replace(/_/g, '/');

  const InvoiceTemplate = ({ type }: { type: 'Original' | 'Copy' }) => {
    const isCopy = type === 'Copy';
    
    return (
      <div 
        className={`relative mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg
          ${isCopy ? 'bg-slate-100 brightness-95 print:bg-white print:brightness-100' : 'bg-white'}`}
        style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
      >
        {/* HEADER */}
        <header className="relative mb-4">
          <div className="text-center w-full mb-1">
            <h1 className="font-bold text-[11pt] uppercase">INVOICE/OFFICIAL RECEIPT</h1>
            <p className="text-[9pt] font-bold">No: {displayInvoiceId}</p>
          </div>
          <div className="absolute right-0 top-0 text-[10pt] text-slate-400 font-black uppercase tracking-widest opacity-40">{type}</div>
          
          <div className="flex justify-between items-start mt-4">
            <p className="font-bold text-[10pt] uppercase">{invoiceData.customer || 'N/A'}</p>
            <div className="text-[9pt] space-y-0.5" style={{ minWidth: '160px' }}>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.date ? new Date(invoiceData.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'}</span></div>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Reference</span><span>:</span><span>-</span></div>
            </div>
          </div>
        </header>

        <div className="flex justify-between mb-1 px-0.5 text-[9pt] border-t border-slate-100 pt-1">
          <span>Customer Code : {invoiceData.customerCode || '-'}</span>
          <span>Date: {invoiceData.date ? new Date(invoiceData.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'}</span>
        </div>

        {/* TABLE */}
        <div className="relative flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border border-black text-[9pt]">
                <th className="py-1 px-2 text-left border-r border-black w-[5%] font-normal">No.</th>
                <th className="py-1 px-2 text-left border-r border-black font-normal">Item</th>
                <th className="py-1 px-2 text-center border-r border-black w-[18%] font-normal">Quantity Unit</th>
                <th className="py-1 px-2 text-right border-r border-black w-[15%] font-normal">Price</th>
                <th className="py-1 px-2 text-right font-normal w-[18%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="align-top text-[9pt]">
                  <td className="py-1 px-2 text-left">{idx + 1}</td>
                  <td className="py-1 px-2 uppercase">{item.name}</td>
                  <td className="py-1 px-2 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Spacer rows to maintain height if items are few */}
              {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (
                <tr key={`spacer-${i}`} className="h-6">
                  <td colSpan={5}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER SECTION */}
        <div className="mt-auto pt-4 transition-all"> 
          <div className="w-full flex justify-start mb-0.5">
            <p className="text-[10px] font-medium italic">No PO : {invoiceData.poNumber || '-'}</p>
          </div>
          <div className="border-t border-black w-full mb-0.5"></div>

          <div className="flex justify-end mt-1">
            <div className="w-1/3 text-[10px] leading-tight">
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>Goods:</span><span className="text-right">{formatCurrency(grandTotal)}</span>
                <span>DPP VAT (11/12):</span><span className="text-right">{formatCurrency(dppVat)}</span>
                <span>VAT 12%:</span><span className="text-right">{formatCurrency(vat12)}</span>
                <span className="font-bold border-t border-black pt-1">Total Rp:</span><span className="text-right font-bold border-t border-black pt-1">{formatCurrency(totalRp)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-black w-full my-1"></div>

          <div className="flex justify-between items-start mt-2">
            {/* INFORMASI PEMBAYARAN */}
            <div className="w-[68%] text-[10px] leading-tight space-y-2">
              <div className="flex">
                <span className="w-[50px] font-bold">Payment:</span>
                <span className="italic">{invoiceData.paymentTerms || '90 Hari'}</span>
              </div>
              
              <div className="flex flex-col text-[10px] space-y-0.5">
                <p className="font-bold">Please state with your payment: <span className="underline">{displayInvoiceId}</span></p>
                <p className="font-bold">For payment, please transfer to our account:</p>
                <p className="font-bold uppercase pt-1">PT. Jembo Cable Company Tbk</p>
              </div>

              {invoiceData.paymentMethod === 'va' ? (
                <div className="bg-slate-50 border border-slate-200 p-2 rounded w-[85%]">
                   <p className="text-[8px] uppercase text-slate-400 font-black mb-1">Mandiri Virtual Account (IDR)</p>
                   <p className="text-sm font-black tracking-widest text-indigo-700">{invoiceData.vaNumber || 'Awaiting Code...'}</p>
                   <p className="text-[8px] italic text-slate-400 mt-1">*Verified automatic settlement active.</p>
                </div>
              ) : (
                <div className="text-[10px] space-y-0.5">
                  <div className="flex"><span className="w-[100px] italic">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
                  <div className="flex"><span className="w-[100px] italic">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
                  <div className="w-[280px] text-center font-bold text-slate-200 text-[8px] py-0.5">--- OR ---</div>
                  <div className="flex items-start">
                    <div className="w-[100px] leading-tight italic">Bank BCA - Jakarta<br/><span className="text-[8px] not-italic">KEM TOWER</span></div>
                    <div>A/C No. : 684-0198977 (Rp)</div>
                  </div>
                </div>
              )}
            </div>

            {/* TANDA TANGAN */}
            <div className="w-[32%] flex flex-col items-center">
              <p className="font-bold text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-24 border-t border-black w-full"></div>
              <p className="font-bold uppercase pt-1 text-[10px] underline">Finance Department</p>
            </div>
          </div>
          
          {isCopy && (
            <div className="mt-4 text-center border-t border-slate-100 pt-1">
               <p className="text-[8px] italic text-slate-400 uppercase tracking-tighter">Arsip Internal - Dokumen ini adalah salinan sah dari dokumen asli</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white animate-in fade-in duration-500">
      {/* FIXED ACTION BUTTONS */}
      <div className="fixed top-6 right-6 z-50 flex gap-3 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl shadow-sm bg-white">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        
        <Button variant="secondary" onClick={() => window.print()} className="rounded-xl shadow-sm bg-white">
          <Download size={16} className="mr-2"/> Download PDF
        </Button>

        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl rounded-xl px-8">
          <Printer size={16} className="mr-2"/> Cetak Dokumen
        </Button>
      </div>

      <div ref={invoiceContainerRef} className="space-y-0">
        {/* LEMBAR ORIGINAL */}
        <InvoiceTemplate type="Original" />

        {/* VISUAL SEPARATOR FOR PREVIEW */}
        <div className="my-10 border-b-2 border-dashed border-slate-300 print:hidden text-center w-full max-w-[210mm] relative">
          <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-50 px-4 py-1 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-slate-200 shadow-sm">
            Halaman Berikutnya (Copy)
          </span>
        </div>

        <div className="print:page-break-before-always"></div>

        {/* LEMBAR COPY */}
        <InvoiceTemplate type="Copy" />
      </div>
      
      <div className="print-hidden text-center mt-12 mb-20 opacity-30">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Printed by Dakota Hub Engine — Verified Professional Layout</p>
      </div>
    </main>
  );
};

export default InvoicePreviewPage;