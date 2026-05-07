
'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Lock, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { InvoiceTemplate } from '@/app/components/invoice/invoice-layout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: 'css' } // Rely on our explicit page-break CSS
    };

    html2pdf().from(element).set(opt).save();
  };

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

  const items = invoiceData.items || [];
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

  const isVaPending = invoiceData.paymentMode === 'virtual_account' && invoiceData.vaStatus === 'pending';

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white">
      {isVaPending && (
          <div className="w-full max-w-[210mm] mb-6 bg-amber-100 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between print:hidden text-black">
              <div className="flex items-center gap-3">
                  <div className="bg-amber-600 p-2 rounded-xl"><Lock className="h-4 w-4 text-white" /></div>
                  <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase text-amber-900">Pencetakan Dikunci</p>
                      <p className="text-[10px] font-medium text-amber-800">Menunggu persetujuan Virtual Account dari Leader.</p>
                  </div>
              </div>
              <Badge variant="outline" className="bg-white border-amber-300 text-amber-700 font-black text-[10px] uppercase">Awaiting Approval</Badge>
          </div>
      )}

      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold bg-white text-black">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={isVaPending}
            className="shadow-md rounded-xl px-6 font-black uppercase text-[10px] tracking-widest bg-white border-slate-200 hover:bg-slate-50 text-black"
          >
            <Download size={16} className="mr-2"/> Simpan PDF
          </Button>
          <Button 
              onClick={() => window.print()} 
              disabled={isVaPending}
              className={cn(
                  "shadow-xl rounded-xl px-8 font-black uppercase text-[10px] tracking-widest",
                  isVaPending ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              )}
          >
            <Printer size={16} className="mr-2"/> {isVaPending ? 'Cetak Terkunci' : 'Cetak Sekarang'}
          </Button>
        </div>
      </div>

      <div ref={invoiceContainerRef} className="print:m-0 print:p-0 flex flex-col">
        <InvoiceTemplate 
          type="Original" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />

        <div className="my-10 border-b-2 border-dashed border-slate-300 print:hidden text-center w-[210mm]">
          <span className="bg-slate-100 px-2 text-slate-400 text-xs uppercase tracking-widest">Halaman Berikutnya (Copy)</span>
        </div>

        <InvoiceTemplate 
          type="Copy" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
