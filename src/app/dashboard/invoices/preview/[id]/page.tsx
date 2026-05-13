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
        setFormattedData({
            ...invoiceData,
            paymentMode: invoiceData.paymentMode || 'manual',
            vaNumber: invoiceData.vaNumber || '',
            grandTotal: invoiceData.grandTotal ?? (invoiceData.amount - (invoiceData.vat12 || 0)), 
            customer: {
                ...(typeof invoiceData.customer === 'object' ? invoiceData.customer : {}),
                name: invoiceData.customerName || invoiceData.customer,
                address: invoiceData.billingAddress || 'N/A',
                vaNumber: invoiceData.vaNumber || (invoiceData.customer as any)?.vaNumber || ''
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
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    };

    html2pdf().from(element).set(opt).save();
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!formattedData) return <div className="p-8 text-red-500 font-bold">Dokumen tidak ditemukan.</div>;

  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center print:p-0 print:m-0 print:bg-white print:block">
      {/* CSS Reset Khusus Print */}
      <style>{`
        @media print {
            .no-print { display: none !important; }
            body { 
              background: white !important; 
              margin: 0 !important; 
              padding: 0 !important; 
              -webkit-print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 0 !important;
            }
            /* Memastikan tidak ada sisa ruang di bawah container */
            .invoice-print-wrapper {
              margin: 0 !important;
              padding: 0 !important;
            }
        }
      `}</style>

      {/* Button Group - Hilang saat print */}
      <div className="fixed top-6 right-6 z-50 flex gap-3 no-print">
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

      {/* Container Utama Invoice */}
      <div 
        ref={invoiceContainerRef} 
        className="invoice-print-wrapper print:block print:m-0 print:p-0"
      >
        {/* Container di bawah ini HANYA flex saat di layar, saat print jadi block polos */}
        <div className="flex flex-col items-center print:block print:m-0 print:p-0">
            <InvoiceTemplate type="Original" invoiceData={formattedData} />
            
            {/* Jeda ini HANYA untuk tampilan di web agar tidak menempel */}
            <div className="print:hidden h-12" /> 
            
            <InvoiceTemplate type="Copy" invoiceData={formattedData} />
        </div>
      </div>
    </main>
  );
};

export default InvoicePreviewPage;