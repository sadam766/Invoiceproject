'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { InvoiceTemplate } from '@/app/components/invoice/invoice-layout';

const InvoicePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const invoiceContainerRef = useRef<HTMLDivElement>(null);
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

  const items = invoiceData.items || [];
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  
  const negotiation = invoiceData.negotiation || 0;
  const dpValue = invoiceData.dpValue || 0;
  const retensiValue = invoiceData.retention || 0;
  
  // PPN 12% calculation based on total amount or back-calculated
  const totalRp = invoiceData.amount || 0;
  const dppVat = totalRp / 1.12;
  const vat12 = totalRp - dppVat;

  const dpPercent = subTotalItems > 0 ? Math.round((dpValue / subTotalItems) * 100) : 0;

  const calculations = {
      subTotalItems,
      negotiation,
      dpValue,
      dpPercent,
      retensiValue,
      dppVat,
      vat12,
      totalRp
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white">
      {/* Action Buttons - Relative to content */}
      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-6 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold h-11 px-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Button variant="secondary" onClick={() => window.print()} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-8">
            <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-10">
            <Printer className="mr-2 h-4 w-4" /> Cetak Sekarang
        </Button>
      </div>

      <div ref={invoiceContainerRef} className="print-container">
          <InvoiceTemplate 
            type="Original" 
            invoiceData={invoiceData} 
            items={items} 
            calculations={calculations} 
          />

          <div className="my-10 border-b-2 border-dashed border-slate-300 print:hidden text-center relative">
              <span className="bg-slate-100 px-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">Halaman Berikutnya (Copy)</span>
          </div>

          <InvoiceTemplate 
            type="Copy" 
            invoiceData={invoiceData} 
            items={items} 
            calculations={calculations} 
          />
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
