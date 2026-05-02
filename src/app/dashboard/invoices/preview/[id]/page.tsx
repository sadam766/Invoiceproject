'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
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
  const dppVat = invoiceData.dppVat || (subTotalItems * (11 / 12));
  const vat12 = invoiceData.vat12 || (dppVat * 0.12);
  const totalRp = invoiceData.amount || (dppVat + vat12);

  const calcs = {
    subTotalItems,
    dppVat,
    vat12,
    totalRp
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white">
      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold bg-white">
          <ArrowLeft size={16} className="mr-2"/> Kembali
        </Button>
        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl rounded-xl px-8 font-black uppercase text-[10px] tracking-widest">
          <Printer size={16} className="mr-2"/> Cetak Sekarang
        </Button>
      </div>

      <div ref={invoiceContainerRef}>
        <InvoiceTemplate 
          type="Original" 
          invoiceData={invoiceData} 
          items={items} 
          calculations={calcs} 
        />

        {/* Garis pembatas hanya muncul di layar, hilang saat dicetak */}
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
