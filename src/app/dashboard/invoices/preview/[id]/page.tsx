'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { cn } from '@/lib/utils';

/**
 * Format angka ke standar akuntansi Indonesia dengan 2 desimal
 */
const formatAccounting = (value: number) => {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ITEMS_PER_PAGE = 8;

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceContainerRef = useRef<HTMLDivElement>(null);
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Synchronizing Document...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan di repository.</div>;

  const items = invoiceData.items || [];
  const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
    items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
  );

  // LOGIKA FINANSIAL
  const totalAmount = invoiceData.amount || 0;
  const dppVat = totalAmount / 1.12;
  const vat12 = totalAmount - dppVat;
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const negotiation = invoiceData.negotiation || 0;
  const dpValue = invoiceData.dpValue || 0;
  const retensi = invoiceData.retention || 0;
  const isVA = invoiceData.paymentMethod === 'va';

  const InvoiceTemplate = ({ type, chunk, pageIndex, totalPages }: { 
    type: 'ORIGINAL' | 'COPY', 
    chunk: any[], 
    pageIndex: number, 
    totalPages: number 
  }) => {
    const isCopy = type === 'COPY';
    const isLastPage = pageIndex === totalPages - 1;

    return (
      <div 
        className={cn(
          "relative bg-white mx-auto pt-12 pb-8 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0 print:bg-white",
          isCopy && "bg-slate-200 brightness-90 print:brightness-100 print:bg-white"
        )}
        style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
      >
        {/* HEADER PERUSAHAAN (Kiri Atas - Sesuai Contoh User) */}
        <header className="relative mb-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="font-bold text-[11pt] uppercase text-blue-900">PT. JEMBO CABLE COMPANY Tbk</h1>
              <div className="text-[8pt] leading-tight text-slate-600 uppercase">
                <p>Mega Glodok Kemayoran Office Tower B 6th Floor</p>
                <p>Jl. Angkasa Kav. B-6 Kota Baru Bandar Kemayoran</p>
                <p>Jakarta Pusat</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black text-slate-100 tracking-tighter italic print:text-slate-100/50">{type}</h2>
            </div>
          </div>
          
          {/* JUDUL TENGAH (MANDAT) */}
          <div className="text-center mt-4 mb-2">
            <h1 className="font-bold text-[11pt] uppercase underline underline-offset-4">INVOICE/OFFICIAL RECEIPT</h1>
            <p className="text-[10pt] font-bold mt-1">No: {invoiceId.replace(/_/g, '/')}</p>
          </div>
        </header>

        {/* CUSTOMER DETAIL */}
        <div className="flex justify-between mb-6 text-[9pt]">
          <div className="w-[60%]">
            <p className="font-bold text-slate-400 text-[8pt] mb-1">BILL TO:</p>
            <p className="font-bold text-[11pt] uppercase border-l-4 border-blue-900 pl-3">{invoiceData.customer}</p>
            <p className="mt-1 leading-relaxed text-slate-700 italic pr-8">{invoiceData.billingAddress || 'Alamat Pelanggan'}</p>
            <p className="mt-1 font-bold">Cust. Code: {invoiceData.customerCode || '-'}</p>
          </div>
          <div className="w-[35%] space-y-1">
            <div className="grid grid-cols-[100px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
            <div className="grid grid-cols-[100px_5px_1fr]"><span>PO Number</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
            <div className="grid grid-cols-[100px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.date}</span></div>
            <div className="grid grid-cols-[100px_5px_1fr] font-bold"><span>Date</span><span>:</span><span>{invoiceData.date}</span></div>
          </div>
        </div>

        {/* TABLE SECTION - GARIS TIPIS (MANDAT) */}
        <div className="flex-grow">
          <table className="w-full border-collapse text-[9pt]">
            <thead>
              <tr className="bg-white border border-black">
                <th className="py-2 px-2 text-left border-r border-black w-[5%] font-bold">No.</th>
                <th className="py-2 px-3 text-left border-r border-black font-bold">Deskripsi Pekerjaan / Barang</th>
                <th className="py-2 px-2 text-center border-r border-black w-[18%] font-bold">Qty Unit</th>
                <th className="py-2 px-3 text-right border-r border-black w-[15%] font-bold">Harga Satuan</th>
                <th className="py-2 px-3 text-right font-bold w-[18%]">Total</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((item, idx) => (
                <tr key={idx} className="align-top border-x border-black">
                  <td className="py-2 px-2 text-center border-r border-black">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="py-2 px-3 uppercase font-medium border-r border-black">{item.name}</td>
                  <td className="py-2 px-2 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                  <td className="py-2 px-3 text-right border-r border-black">{formatAccounting(item.price)}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAccounting(item.total)}</td>
                </tr>
              ))}
              {/* Fill empty rows for consistent layout */}
              {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-9 border-x border-black">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              ))}
              {/* Bottom Border Table */}
              <tr className="border-t border-black"><td colSpan={5}></td></tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER & CALCULATIONS (Only on last page) */}
        {isLastPage && (
          <div className="mt-4">
            {/* FINANCIAL MATRIX (MANDAT: SEJAJAR KANAN SEBELUM PPN) */}
            <div className="flex flex-col items-end mb-6">
              <div className="w-[45%] space-y-1">
                
                <div className="grid grid-cols-[1fr_80px_120px] items-center text-right leading-tight">
                  <span className="pr-2 font-medium">Sub Total Item</span>
                  <span></span>
                  <span className="font-bold">{formatAccounting(subTotalItems)}</span>
                </div>

                {dpValue > 0 && (
                  <div className="grid grid-cols-[1fr_80px_120px] items-center text-right leading-tight">
                    <span className="pr-2">Down Payment / DP</span>
                    <span className="text-center italic opacity-60"></span>
                    <span className="text-rose-600">({formatAccounting(dpValue)})</span>
                  </div>
                )}

                {retensi > 0 && (
                  <div className="grid grid-cols-[1fr_80px_120px] items-center text-right leading-tight">
                    <span className="pr-2">Retention</span>
                    <span></span>
                    <span className="text-rose-600">({formatAccounting(retensi)})</span>
                  </div>
                )}

                {negotiation > 0 && (
                  <div className="grid grid-cols-[1fr_80px_120px] items-center text-right leading-tight text-amber-600">
                    <span className="pr-2">Discount / Negotiation</span>
                    <span></span>
                    <span>({formatAccounting(negotiation)})</span>
                  </div>
                )}

                <div className="grid grid-cols-[1fr_80px_120px] items-center text-right leading-tight text-slate-500">
                  <span className="pr-2 uppercase font-bold text-[8pt]">VAT / PPN</span>
                  <span className="text-center font-bold">12%</span>
                  <span className="font-bold">{formatAccounting(vat12)}</span>
                </div>

                <div className="border-t-2 border-black w-full my-1"></div>
                
                <div className="grid grid-cols-[1fr_200px] items-center text-right">
                  <span className="uppercase pr-4 font-black text-blue-900">Grand Total</span>
                  <span className="text-lg font-black text-blue-900 leading-none">Rp {formatAccounting(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* PAYMENT & SIGNATURE */}
            <div className="flex justify-between items-end">
              {/* Payment Instruction */}
              <div className="w-[55%] text-[8.5pt] space-y-1 border-t border-dashed pt-4">
                <p>Please state with your payment: <span className="font-bold">{invoiceId.replace(/_/g, '/')}</span></p>
                
                <div className="pt-2">
                  <p className="font-bold underline uppercase text-blue-900 mb-1">
                    {isVA ? 'Payment via Virtual Account:' : 'For payment, please transfer to:'}
                  </p>
                  
                  {isVA ? (
                    <div className="bg-slate-50 p-3 border-2 border-indigo-100 rounded-xl w-[90%]">
                       <p className="text-[7pt] font-black uppercase text-indigo-400 tracking-widest mb-1">Mandiri Virtual Account (IDR)</p>
                       <p className="text-lg font-black tracking-[0.2em] text-indigo-700">{invoiceData.vaNumber || 'AWAITING CODE'}</p>
                       <p className="text-[7pt] italic text-slate-400 mt-1">*Pembayaran divalidasi otomatis oleh sistem.</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="font-bold">PT. JEMBO CABLE COMPANY Tbk</p>
                      <div className="grid grid-cols-[80px_auto] gap-x-1 leading-tight">
                        <span className="italic">Bank Mandiri</span><span>: 102-0100206827 (IDR)</span>
                        <span className="italic">Bank BCA</span><span>: 684-0198977 (IDR)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature */}
              <div className="w-[40%] flex flex-col items-center">
                <p className="font-bold text-[9pt] uppercase mb-20">PT. JEMBO CABLE COMPANY Tbk</p>
                <div className="border-b-2 border-black w-48 mb-1"></div>
                <p className="font-black uppercase text-[9pt] tracking-widest">Finance Department</p>
              </div>
            </div>
          </div>
        )}

        {/* PAGE NUMBER */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-[7pt] text-slate-400 uppercase tracking-widest print:hidden">
          Page {pageIndex + 1} of {totalPages} | Printed by Dakota Hub
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white animate-in fade-in duration-700">
      {/* ACTION BAR (MANDAT: KANAN ATAS BERJAJAR) */}
      <div className="fixed top-6 right-6 z-50 flex gap-3 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl shadow-md border-slate-200 bg-white">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <Button variant="secondary" onClick={() => window.print()} className="rounded-xl shadow-md font-bold">
          <Download size={16} className="mr-2"/> Download PDF
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl rounded-xl font-bold px-8">
          <Printer size={16} className="mr-2"/> Cetak Sekarang
        </Button>
      </div>

      <div ref={invoiceContainerRef} className="print:w-full">
        {/* ORIGINAL SET (All Pages) */}
        {itemChunks.map((chunk, i) => (
          <InvoiceTemplate key={`orig-${i}`} type="ORIGINAL" chunk={chunk} pageIndex={i} totalPages={itemChunks.length} />
        ))}

        {/* VISUAL DIVIDER */}
        <div className="my-12 border-b-4 border-dashed border-slate-300 print:hidden text-center relative">
          <span className="bg-slate-100 px-6 py-2 text-slate-500 text-xs font-black uppercase tracking-[0.4em] rounded-full ring-4 ring-slate-100 absolute left-1/2 -translate-x-1/2 -top-5">
            Halaman Berikutnya (Copy)
          </span>
        </div>

        {/* COPY SET (All Pages) */}
        {itemChunks.map((chunk, i) => (
          <InvoiceTemplate key={`copy-${i}`} type="COPY" chunk={chunk} pageIndex={i} totalPages={itemChunks.length} />
        ))}
      </div>
    </main>
  );
};

export default InvoicePreviewPage;