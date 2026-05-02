
'use client';

import React from 'react';
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
  const invoiceId = params.id as string;
  const safeId = invoiceId?.replace(/\//g, '_');

  const invoiceRef = useMemoFirebase(() => (firestore && safeId ? doc(firestore, 'invoices', safeId) : null), [firestore, safeId]);
  const { data: invoiceData, isLoading } = useDoc<Invoice>(invoiceRef);

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Synchronizing Document...</div>;
  if (!invoiceData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

  const items = invoiceData.items || [];
  
  // Directly use pre-calculated values from Billing Constructor
  const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  
  // Back-calculation fallback logic if fields are missing from database
  const dppVat = invoiceData.dppVat || (subTotalItems - (invoiceData.negotiation || 0) - (invoiceData.dpValue || 0)) * (11/12);
  const vat12 = invoiceData.vat12 || (dppVat * 0.12);

  const calcs = {
      subTotalItems: subTotalItems,
      negotiation: invoiceData.negotiation || 0,
      dpValue: invoiceData.dpValue || 0,
      dpPercent: 0, // Visual only
      retensiValue: invoiceData.retention || 0,
      dppVat: dppVat,
      vat12: vat12,
      totalRp: invoiceData.amount || (dppVat + vat12)
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center">
      
      {/* NAVIGATION & CONTROLS: DYNAMIC TOPBAR */}
      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold border-slate-200 bg-white">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <Button variant="secondary" onClick={() => window.print()} className="rounded-xl font-bold shadow-md bg-white">
          <Download size={16} className="mr-2"/> Download PDF
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl rounded-xl px-8 font-black uppercase text-[10px] tracking-widest">
          <Printer size={16} className="mr-2"/> Cetak Sekarang
        </Button>
      </div>

      <div className="shadow-2xl">
        <InvoiceTemplate 
          type="Original" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />

        {/* PAGE DIVIDER FOR PREVIEW */}
        <div className="my-10 border-b-2 border-dashed border-slate-300 print:hidden text-center">
          <span className="bg-slate-100 px-4 py-1 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-slate-200 shadow-sm">
            Halaman Berikutnya (Copy)
          </span>
        </div>

        <InvoiceTemplate 
          type="Copy" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />
      </div>

      <div className="mt-12 text-center text-slate-400 print:hidden mb-20">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Dakota Hub — Professional Render Engine</p>
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
