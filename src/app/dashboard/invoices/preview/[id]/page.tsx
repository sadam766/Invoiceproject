'use client';

import React, { useRef, useEffect, useState } from 'react';
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

  const [formattedData, setFormattedData] = useState<any>(null);

  useEffect(() => {
    if (invoiceData) {
        // Map data from Firestore to match InvoiceTemplate expected props
        setFormattedData({
            ...invoiceData,
            grandTotal: invoiceData.amount, // Placeholder, usually calculated from items in DB
            customer: {
                name: invoiceData.customerName || invoiceData.customer,
                address: invoiceData.billingAddress || 'N/A'
            }
        });
    }
  }, [invoiceData]);

  const handleDownloadPdf = () => {
    const element = invoiceContainerRef.current;
    if (!element || !formattedData) return;

    const opt = {
      margin: 0,
      filename: `Invoice_${formattedData.id.replace(/\//g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: 'css' }
    };

    html2pdf().from(element).set(opt).save();
  };

  if (isLoading) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Memuat Dokumen...</div>;
  if (!formattedData) return <div className="p-20 text-center text-rose-600 font-bold">Dokumen tidak ditemukan.</div>;

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
        <InvoiceTemplate invoiceData={{ ...formattedData, printType: 'Original' }} type="Original" />
        <InvoiceTemplate invoiceData={{ ...formattedData, printType: 'Copy' }} type="Copy" />
      </div>
    </main>
  );
};

export default InvoicePreviewPage;
