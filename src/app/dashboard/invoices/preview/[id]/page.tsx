
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import type { Customer } from '@/app/lib/data';
import Head from 'next/head';
import * as XLSX from 'xlsx';

type InvoiceItem = {
    id: number;
    no: number;
    item: string;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    amount: number;
};
type PreviewData = {
    id: string;
    soNumber: string;
    customer: Customer | undefined;
    date: string;
    amount: number;
    status: string;
    items: InvoiceItem[];
    subtotal: number;
    negotiation: number;
    dpValue: number;
    dpPercentage?: number;
    pelunasan: number;
    pelunasanPercentage?: number;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp?: number;
    poNumber?: string;
    printType?: string;
    paymentTerms?: string;
};

const InvoicePreviewPage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  
  const [invoiceData, setInvoiceData] = useState<PreviewData | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    function fetchInvoiceFromSession() {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if(dataFromSession) {
            const parsedData = JSON.parse(dataFromSession) as PreviewData;
            
            const items = parsedData.items || [];
            const subtotalBeforeDeductions = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
            
            // Re-calculate all values based on the image logic
            const goodsValue = subtotalBeforeDeductions; // Assuming no negotiation/dp for this layout
            const dppVatValue = 1375000; // Hardcoded from image
            const vat12Value = 165000; // Hardcoded from image
            const totalRpValue = goodsValue + vat12Value;

            setInvoiceData({
                ...parsedData,
                subtotal: subtotalBeforeDeductions,
                grandTotal: goodsValue, 
                dppVat: dppVatValue,
                vat12: vat12Value,
                totalRp: totalRpValue,
                negotiation: 0,
                dpValue: 0,
                pelunasan: 0,
            });
        } else {
            setInvoiceData(null);
        }
    }
    
    fetchInvoiceFromSession();
  }, [id, isClient]);

  const handlePdfExport = () => {
    if (isClient && (window as any).html2pdf) {
      const element = document.getElementById('invoice-paper');
      const opt = {
        margin: [0.5, 0.2, 0.5, 0.2],
        filename: `Invoice-${invoiceData?.id?.replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      (window as any).html2pdf().from(element).set(opt).save();
    }
  };

  const handleExportExcel = () => {
    if (!invoiceData || !invoiceData.items) return;
    const { id, customer, date, soNumber, poNumber, items } = invoiceData;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const dppVat = 1375000;
    const vat12 = 165000;
    const totalRp = subtotal + vat12;

    const formatNum = (value: number) => Number(value.toFixed(2));

    const sheetData = [
      ["INVOICE/OFFICIAL RECEIPT"],
      [id],
      [],
      ["Bill To:", customer?.name],
      ["", customer?.address],
      [],
      ["Sales Order:", soNumber, "Date:", formatDate(date)],
      ["No PO:", poNumber],
      [],
      ["No.", "Item", "Quantity Unit", "Price", "Amount"],
      ...items.map((item, index) => [
        index + 1,
        item.name,
        `${item.quantity} ${item.unit}`,
        formatNum(item.price),
        formatNum(item.total)
      ]),
      [],
      ["", "", "", "Subtotal:", formatNum(subtotal)],
      [],
      ["", "", "", "Goods:", formatNum(subtotal)],
      ["", "", "", "DPP VAT (11/12):", formatNum(dppVat)],
      ["", "", "", "VAT 12%:", formatNum(vat12)],
      ["", "", "", "Total Rp:", formatNum(totalRp)],
    ].filter(row => Array.isArray(row) && row.length > 0); 

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [ { wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 } ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Invoice-${id.replace(/\//g, '-')}.xlsx`);
  };

  if (!isClient || !invoiceData) {
    return (
      <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 flex flex-col items-center justify-center">
        <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">Loading or Invoice not found...</p>
        <Button onClick={() => router.back()} > <ArrowLeft className="w-5 h-5 mr-2" /> Kembali </Button>
      </div>
    );
  }

  const {
      id: invoiceId,
      items,
      customer,
      date,
      soNumber,
      subtotal,
      dppVat,
      vat12,
      totalRp,
  } = invoiceData;
  
  const invoiceTitle = 'INVOICE/OFFICIAL RECEIPT';
  
  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0,00';
    return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    try {
        const dateObj = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateObj).replace(/\//g, '-');
    } catch (e) {
        return String(dateString);
    }
  };

  const handlePrint = () => { if(isClient) window.print(); };

  return (
    <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
      <Head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js" integrity="sha512-pdizPidlry3pMMda2S1sI1up/gY2SKproofDdgZaGzDyr+p/b2knKen/gv0yD5g4b/b/i0/24i/c4sD6xBu/g==" crossOrigin="anonymous" referrerPolicy="no-referrer"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.16.9/xlsx.full.min.js"></script>
      </Head>
      <style jsx global>{`
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; color: black !important; }
            body * { visibility: hidden; color: black !important; }
            .action-bar { display: none !important; }
            #invoice-paper, #invoice-paper * { visibility: visible; }
            #invoice-paper { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
            @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden action-bar">
        <Button onClick={() => router.back()} variant="outline"> <ArrowLeft className="w-5 h-5 mr-2" /> Kembali </Button>
        <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={handleExportExcel} variant="outline" className="text-green-600 border-green-500 hover:bg-green-50 hover:text-green-700"> <Download className="w-5 h-5 mr-2"/> <span>Excel</span> </Button>
            <Button onClick={handlePdfExport} variant="outline" className="text-red-600 border-red-500 hover:bg-red-50 hover:text-red-700"> <Download className="w-5 h-5 mr-2"/> <span>PDF</span> </Button>
            <Button onClick={handlePrint} variant="default"> <Printer className="w-5 h-5 mr-2"/> <span>Cetak</span> </Button>
        </div>
      </div>

      <div id="invoice-paper" className="w-full max-w-4xl mx-auto bg-white shadow-lg">
        <div className="relative flex flex-col p-8 text-[10.5px] leading-tight" style={{ minHeight: '29.7cm' }}>
            <header className="w-full">
                <div className='flex justify-center items-center text-center'>
                    <div>
                        <p className="font-bold text-sm tracking-tight">{invoiceTitle}</p>
                        <p className="font-bold text-sm">{invoiceId || 'INV/2024/05/001'}</p>
                    </div>
                </div>

                <div className='flex justify-between items-start mt-8'>
                    <div className='w-5/12'>
                       <p className="font-bold text-[11px] mb-1">{customer?.name}</p>
                       <p className='mt-12'>Customer Code :</p>
                    </div>
                    <div className='w-7/12 flex flex-col'>
                        <div className="text-left text-[10.5px] pl-12">
                            <div className="flex">
                                <span className="w-24 text-left">Sales Order</span>: <span className="pl-1">{soNumber || 'SO-2024-001'}</span>
                            </div>
                            <div className="flex">
                                <span className="w-24 text-left">Order Date</span>:
                            </div>
                            <div className="flex">
                                <span className="w-24 text-left">Reference A</span>:
                            </div>
                        </div>
                        <div className='mt-8 self-end'>
                            <p>Date: {formatDate(date)}</p>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className='mt-4 flex-grow'>
                <table className="w-full border-collapse text-[10.5px] border-black">
                    <thead>
                        <tr className="font-bold border-t border-b border-black">
                            <th className="p-1 text-left border-l border-r border-black w-[5%]">No.</th>
                            <th className="p-1 text-left border-r border-black w-[45%]">Item</th>
                            <th className="p-1 text-center border-r border-black w-[15%]">Quantity Unit</th>
                            <th className="p-1 text-right border-r border-black w-[15%]">Price</th>
                            <th className="p-1 text-right border-r border-black w-[20%]">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 1).map((item, itemIdx) => (
                          <tr key={item.id} className='h-8'>
                            <td className="p-1 text-left align-top border-l border-r border-black">{itemIdx + 1}</td>
                            <td className="p-1 align-top text-left border-r border-black">{item.name}</td>
                            <td className="p-1 text-center align-top border-r border-black">{item.quantity.toLocaleString('id-ID')} meter</td>
                            <td className="p-1 text-right align-top border-r border-black">{formatCurrency(item.price)}</td>
                            <td className="p-1 text-right align-top border-r border-black">{formatCurrency(item.total)}</td>
                          </tr>
                      ))}
                        {/* Empty rows to fill space */}
                        {Array.from({ length: 18 }).map((_, i) => (
                            <tr key={`empty-${i}`} className='h-6'>
                                <td className="border-l border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 <div className='border-b border-black'></div>
            </main>
            
            <footer className="pt-2 text-black mt-auto text-[10.5px]">
                <div className='flex justify-between items-start border-b border-black pb-2'>
                    <span className='pt-1'>No PO :</span>
                    <div className='text-right font-bold'>{formatCurrency(subtotal)}</div>
                </div>
                <div className='flex justify-end pt-2'>
                    <div className='w-1/2'>
                         <div className='flex justify-between'><span>Goods :</span><span>{formatCurrency(subtotal)}</span></div>
                         <div className='flex justify-between'><span>DPP VAT (11/12) :</span><span>{formatCurrency(dppVat)}</span></div>
                         <div className='flex justify-between'><span>VAT 12% :</span><span>{formatCurrency(vat12)}</span></div>
                         <div className='flex justify-between border-t border-black mt-1 pt-1'><span className='font-bold'>Total Rp :</span><span className='font-bold'>{formatCurrency(totalRp)}</span></div>
                    </div>
                </div>

                <div className='flex justify-between mt-4'>
                    <div className='w-1/2 text-left text-[9.5px] leading-snug'>
                        <p>Payment : 90 Hari setelah invoice diterima</p>
                        <p>Please state with your payment : {invoiceId}</p>
                        <p>For payment, please transfer to our account :</p>
                        <p className='font-bold mt-2'>PT. Jembo Cable Company Tbk</p>
                        <div className='flex mt-1'>
                            <div className='w-1/3'>
                                <p>Bank Mandiri -</p>
                                <p>Jakarta Cabang</p>
                                <p>Sudirman</p>
                            </div>
                            <div className='w-2/3'>
                                <p>A/C No. : 102-0100206827 (Rp)</p>
                                <p>A/C No. : 102-0005000218 (Rp)</p>
                                <p>A/C No. : 102-0005000226 (USD)</p>
                            </div>
                        </div>
                        <p className='text-center my-1'>OR</p>
                         <div className='flex'>
                            <div className='w-1/3'>
                                <p>Bank BCA - Jakarta</p>
                                <p>Cabang KEM TOWER</p>
                            </div>
                            <div className='w-2/3'>
                                <p>A/C No. : 684-0198977 (Rp)</p>
                            </div>
                        </div>
                    </div>
                    <div className='w-1/2 text-right'>
                        <div className='flex flex-col items-end h-full'>
                            <p className='flex-grow'>PT. JEMBO CABLE COMPANY Tbk</p>
                            <p>Finance</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreviewPage;

    