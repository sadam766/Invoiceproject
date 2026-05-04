
'use client';

import React, { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Lock } from 'lucide-react';
import { type Invoice } from '@/app/lib/data';
import { InvoiceTemplate } from '@/app/components/invoice/invoice-layout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  
  // LOGIC: Maintain proper calculation even in preview
  const dpVal = invoiceData.dpValue || 0;
  const discVal = invoiceData.discount || 0;
  const dpMode = invoiceData.dpMode || 'kurangi';

  let baseValue = subTotalItems;
  if (dpMode === 'tagih') {
      baseValue = dpVal;
  } else {
      baseValue = Math.max(0, subTotalItems - dpVal - discVal);
  }

  const dppVat = baseValue * (11 / 12);
  const vat12 = dppVat * 0.12;
  const totalRp = dppVat + vat12;

  const calcs = {
    subTotalItems,
    dpValue: dpVal,
    discountValue: discVal,
    dppVat,
    vat12,
    totalRp
  };

  const isVaPending = invoiceData.paymentMethod === 'va' && invoiceData.vaStatus === 'pending';

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:bg-white">
      {isVaPending && (
          <div className="w-full max-w-[210mm] mb-6 bg-amber-100 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                  <div className="bg-amber-600 p-2 rounded-xl"><Lock className="h-4 w-4 text-white" /></div>
                  <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase text-amber-900">Pencetakan Dikunci</p>
                      <p className="text-[10px] font-medium text-amber-800">Menunggu persetujuan Virtual Account dari Leader di Portal Mandiri.</p>
                  </div>
              </div>
              <Badge variant="outline" className="bg-white border-amber-300 text-amber-700 font-black text-[10px] uppercase">Awaiting Approval</Badge>
          </div>
      )}

      <div className="w-full max-w-[210mm] flex justify-center gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold bg-white">
          <ArrowLeft size={16} className="mr-2"/> Kembali
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

      <div ref={invoiceContainerRef}>
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
