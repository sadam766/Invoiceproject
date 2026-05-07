'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { InvoiceTemplate } from '@/app/components/invoice/invoice-layout';
import html2pdf from 'html2pdf.js';

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceContainerRef = useRef<HTMLDivElement>(null);
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  const handleDownloadPdf = () => {
    const element = invoiceContainerRef.current;
    if (!element || !invoiceData) return;

    const opt = {
      margin: 0,
      filename: `Invoice_${invoiceData.id.replace(/\//g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save();
  };

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat Dokumen...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

  const items = invoiceData.items || [];
  
  // Perhitungan Data Finansial
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const dpVal = invoiceData.dpValue || 0;
  const discVal = invoiceData.discount || 0;
  const dpMode = invoiceData.dpMode || 'kurangi';

  let baseValue = subTotalItems;
  if (dpMode === 'tagih') {
      baseValue = dpVal;
  } else {
      baseValue = Math.max(0, subTotalItems - dpVal - discVal);
  }

  const dppVat = Math.round(baseValue * (11 / 12));
  const vat12 = Math.round(dppVat * 0.12);
  const totalRp = dppVat + vat12;

  const calcs = {
    subTotalItems,
    dpValue: dpVal,
    discountValue: discVal,
    dppVat,
    vat12,
    totalRp
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white">
      {/* Floating Header Actions */}
      <div className="fixed top-6 right-6 z-50 flex gap-3 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold bg-white shadow-md">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <Button variant="secondary" onClick={handleDownloadPdf} className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-white shadow-md">
          <Download size={16} className="mr-2"/> Simpan PDF
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest px-8 rounded-xl shadow-xl">
          <Printer size={16} className="mr-2"/> Cetak Sekarang
        </Button>
      </div>

      <div ref={invoiceContainerRef} className="print:m-0 print:p-0 flex flex-col items-center">
        <InvoiceTemplate 
          type="Original" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />

        {/* Pemisah visual hanya di layar */}
        <div className="w-[210mm] py-10 print:hidden text-center">
           <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t-2 border-dashed border-slate-300"></span></div>
              <span className="relative bg-slate-100 px-4 text-xs font-black uppercase text-slate-400 tracking-widest">
                HALAMAN BERIKUTNYA (COPY)
              </span>
           </div>
        </div>

        <div className="print:page-break-before-always">
            <InvoiceTemplate 
              type="Copy" 
              invoiceData={invoiceData} 
              items={items} 
              calculations={calcs} 
            />
        </div>
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
