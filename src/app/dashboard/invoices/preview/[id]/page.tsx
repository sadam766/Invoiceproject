
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import type { Customer } from '@/app/lib/data';
import { formatNumberWithCommas } from '@/lib/utils';
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
            const negotiationValue = parsedData.negotiation || 0;
            const dpValue = parsedData.dpValue || 0;
            const pelunasanValue = parsedData.pelunasan || 0;

            const negotiatedSubtotal = subtotalBeforeDeductions - negotiationValue;
            const goods = negotiatedSubtotal - dpValue - pelunasanValue;
            const dppVat = Math.round(goods / 1.12);
            const vat12 = Math.round(dppVat * 0.12);
            const totalRp = goods + vat12;

            setInvoiceData({
                ...parsedData,
                subtotal: subtotalBeforeDeductions,
                grandTotal: goods, 
                dppVat: dppVat,
                vat12: vat12,
                totalRp: totalRp
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
        filename: `Invoice-${invoiceData?.id?.replace('/', '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      (window as any).html2pdf().from(element).set(opt).save();
    }
  };

  const handleExportExcel = () => {
    if (!invoiceData || !invoiceData.items) return;
    
    const { id, customer, date, soNumber, poNumber, items, subtotal, grandTotal, dppVat, vat12, totalRp } = invoiceData;

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
      ["No.", "Item", "Quantity", "Unit", "Price", "Amount"],
      ...items.map((item, index) => [
        index + 1,
        item.name,
        item.quantity,
        item.unit,
        formatNum(item.price),
        formatNum(item.total)
      ]),
      [],
      ["", "", "", "", "Subtotal:", formatNum(subtotal)],
      ["", "", "", "", `A/Negotiation:`, `(${formatNum(Math.abs(invoiceData.negotiation || 0))})`],
      ["", "", "", "", "Goods:", formatNum(grandTotal)],
      ["", "", "", "", "DPP VAT (11/12):", formatNum(dppVat)],
      ["", "", "", "", "VAT 12%:", formatNum(vat12)],
      ["", "", "", "", "Total Rp :", formatNum(totalRp || 0)],
    ].filter(row => Array.isArray(row) && row.length > 0);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [ { wch: 5 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 } ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Invoice-${id.replace('/', '-')}.xlsx`);
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
      poNumber,
      printType,
      subtotal,
      negotiation = 0,
      dpValue = 0,
      pelunasan = 0,
      grandTotal,
      dppVat,
      vat12,
      paymentTerms,
      totalRp
  } = invoiceData;
  
  const ITEMS_PER_PAGE = 15;
  const itemPages = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    itemPages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }

  const invoiceTitle = invoiceId?.startsWith('KW/') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

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
    <>
      <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
         <Head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js" integrity="sha512-pdizPidlry3pMMda2S1sI1up/gY2SKproofDdgZaGzDyr+p/b2knKen/gv0yD5g4b/b/i0/24i/c4sD6xBu/g==" crossOrigin="anonymous" referrerPolicy="no-referrer"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.16.9/xlsx.full.min.js"></script>
        </Head>
        <style>{`
          .invoice-page { page-break-after: always; }
          .invoice-page:last-child { page-break-after: auto; }
          @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
              body * { visibility: hidden; color: black !important; }
              .action-bar { display: none; }
              #invoice-paper, #invoice-paper * { visibility: visible; }
              #invoice-paper { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none; border: none; }
              .invoice-page { padding: 0.5in !important; box-shadow: none !important; border: none !important; height: auto; min-height: 0; }
              @page { size: A4; margin: 0; }
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
          {itemPages.map((pageItems, pageIndex) => {
            const isLastPage = pageIndex === itemPages.length - 1;
            const pageNumber = pageIndex + 1;
            const totalPages = itemPages.length;
            const emptyRowsCount = isLastPage && pageItems.length < ITEMS_PER_PAGE ? ITEMS_PER_PAGE - pageItems.length : 0;

            return (
              <div key={pageIndex} className="invoice-page relative flex flex-col p-8 text-[11px] leading-tight" style={{minHeight: '29.7cm' }}>
                <header>
                    <div className="h-[70px] w-full"></div>
                    <div className="text-center mb-10">
                        <p className="font-bold uppercase text-[15px] mb-1 tracking-tighter">{invoiceTitle}</p>
                        <p className="font-bold uppercase text-[15px]">{invoiceId || 'INV/2024/05/001'}</p>
                    </div>

                    <div className="flex justify-between items-start text-[10px] mt-8">
                        <div className="w-1/2 text-left pr-4">
                            <p className="font-bold text-[12px] mb-1">{customer?.name}</p>
                        </div>
                        <div className="w-5/12 text-right pl-16">
                            <div className="inline-block text-left">
                                <div className="flex gap-x-2">
                                    <span className="font-bold text-left">Sales Order :</span><span className="text-left">{soNumber || ''}</span>
                                </div>
                                <div className="flex gap-x-2">
                                    <span className="font-bold text-left">Order Date :</span><span className="text-left"></span>
                                </div>
                                <div className="flex gap-x-2">
                                    <span className="font-bold text-left">Reference A :</span><span className="text-left"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end text-[10px] mt-4 mb-4">
                        <div className="w-1/2">
                            <p className='mt-12'>Customer Code :</p>
                        </div>
                        <div className="w-1/2 text-right">
                            <p>Date: {formatDate(date)}</p>
                        </div>
                    </div>
                </header>

                <main className='mt-4 flex-grow'>
                   <table className="w-full border-collapse text-[10px] border border-black">
                      <thead className="font-bold">
                          <tr>
                              <th className="p-1 text-left border-r border-black w-[5%]">No.</th>
                              <th className="p-1 text-left border-r border-black w-[45%]">Item</th>
                              <th className="p-1 text-center border-r border-black w-[15%]">Quantity Unit</th>
                              <th className="p-1 text-right border-r border-black w-[15%]">Price</th>
                              <th className="p-1 text-right w-[20%]">Amount</th>
                          </tr>
                      </thead>
                      <tbody>
                          {pageItems.map((item, itemIdx) => (
                              <tr key={item.id}>
                                  <td className="p-1 text-left align-top border-r border-black">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                  <td className="p-1 align-top text-left border-r border-black">{item.name}</td>
                                  <td className="p-1 text-center align-top border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                  <td className="p-1 text-right align-top border-r border-black">{formatCurrency(item.price)}</td>
                                  <td className="p-1 text-right align-top">{formatCurrency(item.total)}</td>
                              </tr>
                          ))}
                           {Array.from({ length: emptyRowsCount }).map((_, index) => (
                              <tr key={`empty-${index}`} className="h-[24px]">
                                  <td className='p-1 border-r border-black'>&nbsp;</td>
                                  <td className='p-1 border-r border-black'>&nbsp;</td>
                                  <td className='p-1 border-r border-black'>&nbsp;</td>
                                  <td className='p-1 border-r border-black'>&nbsp;</td>
                                  <td className='p-1'>&nbsp;</td>
                              </tr>
                          ))}
                      </tbody>
                   </table>
                   <div className="border-b-2 border-black w-full"></div>
                </main>
                
                {isLastPage && (
                   <footer className="pt-2 text-black mt-auto text-[10px]">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-left">No PO: {poNumber || ''}</p>
                            <div className="flex items-center space-x-4">
                                <span>Subtotal</span>
                                <div className="text-right w-32 relative">
                                    <div className="absolute -top-1 right-0 border-t border-black w-full"></div>
                                    <p>{formatCurrency(subtotal)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-black w-full mt-2 pt-2 mb-2"></div>
                        
                        <div className="grid grid-cols-2">
                            <div></div>
                            <div className="text-right text-[10px] space-y-1">
                                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                    <span>Goods:</span><span className="text-right">{formatCurrency(grandTotal)}</span>
                                    <span>DPP VAT (11/12):</span><span className="text-right">{formatCurrency(dppVat)}</span>
                                    <span>VAT 12%:</span><span className="text-right">{formatCurrency(vat12)}</span>
                                </div>
                                <div className="col-span-2 w-full flex justify-end">
                                    <div className="border-t border-black w-[150px] my-1"></div>
                                </div>
                                <div className="grid grid-cols-[1fr_auto] gap-x-4 font-bold">
                                    <span>Total Rp:</span><span className="text-right">{formatCurrency(totalRp)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-black w-full mt-2 mb-2"></div>

                      <div className="flex justify-between items-start text-[9px] mt-2">
                         <div className='w-1/2 pr-4'>
                            <div className="flex items-start mb-1">
                                <p className='w-20 shrink-0'>Payment:</p>
                                <p className='flex-1'>{paymentTerms || '90 Hari setelah invoice diterima'}</p>
                            </div>
                            <div className="flex items-start mb-2">
                                <p className='w-20 shrink-0'>Please state with your payment:</p>
                                <p className='flex-1'>{invoiceId || 'INV/2024/05/001'}</p>
                            </div>
                            <p className="mb-2">For payment, please transfer to our account:</p>
                            <div className="font-normal">
                                <p className="mb-1 font-semibold">PT.Jembo Cable Company Tbk</p>
                                <div className="flex mb-1">
                                    <div className="w-2/5">
                                        <p className="mb-0">Bank Mandiri -</p>
                                        <p className="mb-0">Jakarta Cabang</p>
                                        <p className="mb-0">Sudirman</p>
                                    </div>
                                    <div className="w-3/5 text-right whitespace-nowrap">
                                        <p className="mb-0">A/C No. : 102-0100206827 (Rp)</p>
                                        <p className="mb-0">A/C No. : 102-0005000218 (Rp)</p>
                                        <p className="mb-0">A/C No. : 102-0005000226 (USD)</p>
                                    </div>
                                </div>
                                <div className="text-center my-2">OR</div>
                                <div className="flex">
                                    <div className="w-2/5">
                                        <p className="mb-0">Bank BCA - Jakarta</p>
                                        <p className="mb-0">Cabang KEM TOWER</p>
                                    </div>
                                    <div className="w-3/5 text-right whitespace-nowrap">
                                        <p className="mb-0">A/C No. : 684-0198977 (Rp)</p>
                                    </div>
                                </div>
                            </div>
                          </div>
                          <div className="w-1/2 pl-4 text-center">
                              <p className="font-semibold mb-16">PT. JEMBO CABLE COMPANY Tbk</p>
                              <p className="font-semibold">Finance</p>
                          </div>
                      </div>
                  </footer>
                )}
                 {/* Page number */}
                <div className="absolute bottom-4 right-8 text-xs text-gray-500">
                  Page {pageNumber} of {totalPages}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  );
}

export default InvoicePreviewPage;
