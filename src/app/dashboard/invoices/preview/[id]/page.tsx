'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { formatCurrency, cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 8;

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Membangun Dokumen...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

  const items = invoiceData.items || [];
  const displayInvoiceId = invoiceData.id.replace(/_/g, '/');

  // Kalkulasi Finansial
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const negotiation = invoiceData.negotiation || 0;
  const dpValue = invoiceData.dpValue || 0;
  const dpp = subTotalItems - negotiation - dpValue;
  const vat12 = dpp * 0.12;
  const totalRp = dpp + vat12;
  const dpPercent = subTotalItems > 0 ? Math.round((dpValue / subTotalItems) * 100) : 0;

  // Split items into chunks of 8 for paging
  const itemChunks = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    itemChunks.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (itemChunks.length === 0) itemChunks.push([]);

  const totalPages = itemChunks.length;

  const InvoiceTemplate = ({ type, chunk, pageIndex }: { type: 'Original' | 'Copy', chunk: any[], pageIndex: number }) => {
    const isCopy = type === 'Copy';
    const isLastPage = pageIndex === totalPages - 1;

    return (
      <div 
        className={cn(
          "relative mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8",
          isCopy ? "bg-slate-200 brightness-95 print:bg-white print:brightness-100" : "bg-white"
        )}
        style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
      >
        {/* HEADER */}
        <header className="relative mb-4">
          <div className="text-center w-full mb-1">
            <h1 className="font-bold text-[11pt] uppercase">INVOICE/OFFICIAL RECEIPT</h1>
            <p className="font-bold text-[10pt]">No: {displayInvoiceId}</p>
          </div>
          <div className="absolute right-0 top-0 text-[10pt] text-slate-400 uppercase font-black tracking-widest">{type}</div>
          
          <div className="flex justify-between items-start mt-6">
            <div className="max-w-[60%]">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Bill To:</p>
                <p className="font-bold text-[10pt] uppercase leading-tight">{invoiceData.customer || 'N/A'}</p>
                <p className="text-[9pt] leading-tight italic mt-1">{invoiceData.billingAddress || '-'}</p>
            </div>
            <div className="text-[9pt] space-y-0.5" style={{ minWidth: '160px' }}>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.date || '-'}</span></div>
              <div className="grid grid-cols-[85px_5px_1fr]"><span>Ref PO</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
            </div>
          </div>
        </header>

        <div className="flex justify-between mb-2 px-0.5 text-[8px] border-t border-slate-100 pt-1 text-slate-400 font-bold">
          <span>Customer Code : {invoiceData.customerCode || '-'}</span>
          <span>Date: {invoiceData.date}</span>
        </div>

        {/* TABLE */}
        <div className="flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border border-black text-[9pt]">
                <th className="py-1 px-2 text-left border-r border-black w-[8%] font-normal">No.</th>
                <th className="py-1 px-2 text-left border-r border-black w-[40%] font-normal">Item</th>
                <th className="py-1 px-2 text-center border-r border-black w-[15%] font-normal">Quantity Unit</th>
                <th className="py-1 px-2 text-right border-r border-black w-[17%] font-normal">Price</th>
                <th className="py-1 px-2 text-right font-normal flex-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((item: any, idx: number) => (
                <tr key={idx} className="align-top text-[9pt] h-[24px]">
                  <td className="py-1 px-2 text-left border-r border-black">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="py-1 px-2 uppercase border-r border-black truncate max-w-[200px]">{item.name}</td>
                  <td className="py-1 px-2 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                  <td className="py-1 px-2 text-right border-r border-black">{formatCurrency(item.price)}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Fill empty rows to maintain layout height */}
              {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-[24px]">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER SECTION (Only on last page of each type) */}
        {isLastPage ? (
          <footer className="pt-2 text-black mt-auto text-[10px]">
            {/* AREA KALKULASI TOTAL */}
            <div className="w-full flex flex-col items-end leading-normal">
                <div className="w-[45%]">
                    <div className="border-t border-black w-full mb-1"></div>
                    <div className="space-y-0.5">
                        {/* Subtotal Items */}
                        <div className="grid grid-cols-[1fr_80px_120px] items-center text-right">
                            <span>Subtotal Items</span><span></span><span className="font-normal">{formatCurrency(subTotalItems)}</span>
                        </div>

                        {/* Discount */}
                        {negotiation > 0 && (
                            <div className="grid grid-cols-[1fr_80px_120px] items-center text-right text-rose-600">
                                <span className="pr-2">Discount</span><span></span><span className="font-normal">({formatCurrency(negotiation)})</span>
                            </div>
                        )}

                        {/* DP */}
                        {dpValue > 0 && (
                            <div className="grid grid-cols-[1fr_80px_120px] items-center text-right">
                                <span className="pr-2">Down Payment</span><span className="text-center">{dpPercent}%</span><span className="font-normal">({formatCurrency(dpValue)})</span>
                            </div>
                        )}

                        {/* VAT 12% */}
                        <div className="grid grid-cols-[1fr_80px_120px] items-center text-right">
                            <span className="pr-2 uppercase font-bold text-[8px]">VAT</span><span className="text-center font-bold">12%</span><span className="font-normal">{formatCurrency(vat12)}</span>
                        </div>

                        {/* Grand Total */}
                        <div className="border-t border-black w-full my-1"></div>
                        <div className="grid grid-cols-[1fr_150px] items-center text-right font-bold text-[11px]">
                            <span className="uppercase pr-2">Grand Total</span>
                            <span className="text-indigo-700">Rp {formatCurrency(totalRp)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AREA TANDA TANGAN & PAYMENT INFO */}
            <div className="mt-8 flex justify-between items-end">
                {/* Bagian Kiri: Info Pembayaran */}
                <div className="w-[55%] space-y-1.5 leading-tight">
                    <p className="text-[8px] font-bold text-slate-400">Please state with your payment: <span className="text-black">{displayInvoiceId}</span></p>
                    
                    <div className="space-y-1">
                        <p className="font-bold underline uppercase text-[9px]">
                            {invoiceData.paymentMethod === 'va' ? 'Payment via Virtual Account:' : 'For payment, please transfer to:'}
                        </p>
                        
                        {invoiceData.paymentMethod === 'va' ? (
                            <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg w-[90%]">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mandiri Virtual Account (IDR)</p>
                                <p className="text-sm font-black text-indigo-700 tracking-[0.2em]">{invoiceData.vaNumber || '-'}</p>
                                <p className="text-[7px] italic text-slate-400 mt-1">*Automated reconciliation active.</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                <p className="font-bold text-[9px]">PT. JEMBO CABLE COMPANY Tbk</p>
                                <div className="grid grid-cols-[100px_auto] gap-x-1 text-[9px]">
                                    <span className="italic">Bank Mandiri</span><span>: 102-0100206827 (IDR)</span>
                                    <span className="italic">Bank BCA</span><span>: 684-0198977 (IDR)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bagian Kanan: Tanda Tangan */}
                <div className="w-[40%] text-center">
                    <p className="font-bold uppercase mb-16 text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
                    <div className="w-40 mx-auto border-b border-black"></div>
                    <p className="font-bold mt-1 text-[9px] uppercase tracking-widest">Finance Department</p>
                </div>
            </div>
          </footer>
        ) : (
          <div className="mt-auto pt-4 text-center border-t border-dashed border-slate-100">
            <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.3em]">Halaman {pageIndex + 1} dari {totalPages} — Bersambung</p>
          </div>
        )}

        <div className="absolute bottom-4 left-0 right-0 text-center text-[7px] text-slate-300 uppercase tracking-[0.5em] print:hidden">
          {type} Document — Page {pageIndex + 1} of {totalPages}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white animate-in fade-in duration-500">
      {/* NAVIGATION BUTTONS - CENTERED ABOVE CONTENT */}
      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl h-11 px-8 font-bold border-slate-300 hover:bg-white transition-all">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <Button variant="secondary" onClick={() => window.print()} className="rounded-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest shadow-md">
          <Download size={16} className="mr-2"/> Download PDF
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95">
          <Printer size={16} className="mr-2"/> Cetak Sekarang
        </Button>
      </div>

      <div className="print-container">
        {/* ORIGINAL VERSION */}
        {itemChunks.map((chunk, idx) => (
          <InvoiceTemplate key={`original-${idx}`} type="Original" chunk={chunk} pageIndex={idx} />
        ))}

        {/* VISUAL DIVIDER */}
        <div className="my-12 border-b-2 border-dashed border-slate-300 w-full max-w-[210mm] relative print:hidden text-center">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.5em]">Halaman Berikutnya (Copy)</span>
        </div>

        {/* COPY VERSION */}
        {itemChunks.map((chunk, idx) => (
          <InvoiceTemplate key={`copy-${idx}`} type="Copy" chunk={chunk} pageIndex={idx} />
        ))}
      </div>

      <footer className="mt-12 text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] print:hidden">
        Dakota Hub High-Performance Render Engine
      </footer>
    </main>
  );
};

export default InvoicePreviewPage;