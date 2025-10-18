
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { invoiceListData, salesOrderListData, type Customer, customerListData, type Invoice } from '@/app/lib/data';
import { exportToExcel } from '@/lib/utils';
import Head from 'next/head';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';


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

type PreviewData = Invoice & {
    items: InvoiceItem[];
    subtotal: number;
    negotiation: number;
    dpValue: number;
    pelunasan: number;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    poNumber?: string;
    printType?: string;
    client?: string;
    billToAddress?: string;
    paymentTerms?: string;
    number?: string;
    customer: Customer | undefined;
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

    function fetchInvoiceFromListData(invoiceId: string) {
        const foundInvoice = invoiceListData.find(inv => inv.id === invoiceId);
        
        if (foundInvoice) {
            const relatedSalesOrders = salesOrderListData.filter(so => so.soNumber === foundInvoice.soNumber);
            const invoiceItems: InvoiceItem[] = relatedSalesOrders.map((so, index) => ({
                id: index,
                no: index + 1,
                item: so.productName,
                name: so.productName,
                quantity: so.quantity,
                unit: so.unit,
                price: so.price,
                total: so.quantity * so.price,
                amount: so.quantity * so.price
            }));
            const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
            
            const negotiation = 0;
            const dpValue = 0;
            const pelunasan = 0;

            const grandTotal = subtotal - negotiation - dpValue - pelunasan;
            const dppVat = grandTotal / 1.12;
            const vat12 = dppVat * 0.12;

            const foundCustomer = customerListData.find(c => c.name === foundInvoice.customer);

            setInvoiceData({
                ...foundInvoice,
                customer: foundCustomer,
                items: invoiceItems,
                subtotal: subtotal,
                negotiation: negotiation,
                dpValue: dpValue,
                pelunasan: pelunasan,
                grandTotal: grandTotal,
                dppVat: dppVat,
                vat12: vat12,
            });
        } else {
            setInvoiceData(null);
        }
    }
    
    const dataFromSession = sessionStorage.getItem('invoicePreviewData');
    const decodedId = decodeURIComponent(id as string);

    if (dataFromSession) {
        const parsedData = JSON.parse(dataFromSession);
        if (decodedId === parsedData.id || decodedId === 'new') {
            setInvoiceData(parsedData);
        } else {
             fetchInvoiceFromListData(decodedId);
        }
    } else if (id) {
        fetchInvoiceFromListData(decodedId);
    }

  }, [id, isClient]);

  const handlePdfExport = () => {
    if (isClient) {
      const html2pdf = (window as any).html2pdf;
      if (html2pdf) {
        const element = document.getElementById('invoice-paper');
        const opt = {
          margin: [0.5, 0.2, 0.5, 0.2],
          filename: `Invoice-${invoiceData?.id?.replace('/', '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
      } else {
        alert("PDF generation library is not loaded yet.");
      }
    }
  };


  if (!invoiceData) {
    return (
      <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 flex flex-col items-center justify-center">
        <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">Loading or Invoice not found...</p>
        <Button
          onClick={() => router.back()}
          className="flex items-center"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Kembali
        </Button>
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
      negotiation,
      dpValue,
      pelunasan,
      grandTotal,
      dppVat,
      vat12,
      paymentTerms
  } = invoiceData;
  
  const ITEMS_PER_PAGE = 15;
  const itemPages = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    itemPages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }

  const invoiceTitle = invoiceId?.startsWith('KW/') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0,00';
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
        const cleanDate = dateString.includes('-') ? new Date(dateString) : new Date(dateString.split('/').reverse().join('-'));
        return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(cleanDate);
    } catch (e) {
        return dateString;
    }
  };
  
  const totalRp = grandTotal + vat12;


  const handlePrint = () => {
    window.print();
  };
  
  const handleExportExcel = () => {
    if (!invoiceData) return;

    const formatNumber = (value: number) => Number(value.toFixed(2));

    const sheetData = [
      [invoiceTitle],
      [invoiceId || ''],
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
        formatNumber(item.price),
        formatNumber(item.quantity * item.total)
      ]),
      [],
      ["", "", "", "", "Subtotal:", formatNumber(subtotal)],
      negotiation !== 0 ? ["", "", "", "", `A/Negotiation:`, `(${formatNumber(Math.abs(negotiation))})`] : [],
      dpValue !== 0 ? ["", "", "", "", `DP :`, formatNumber(dpValue)] : [],
      pelunasan !== 0 ? ["", "", "", "", `Pelunasan :`, `(${formatNumber(pelunasan)})`] : [],
      ["", "", "", "", "Goods:", formatNumber(grandTotal)],
      ["", "", "", "", "DPP VAT:", formatNumber(dppVat)],
      ["", "", "", "", "VAT 12 %:", formatNumber(vat12)],
      ["", "", "", "", "Total Rp :", formatNumber(totalRp)],
    ].filter(row => row.length > 0);

    exportToExcel(sheetData, `Invoice-${invoiceId.replace('/', '-')}`);
  };

  const emptyRowsCount = items.length < ITEMS_PER_PAGE ? ITEMS_PER_PAGE - items.length : 0;
  
  return (
    <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
       <Head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js" integrity="sha512-pdizPidlry3pMMda2S1sI1up/gY2SKproofDdgZaGzDyr+p/b2knKen/gv0yD5g4b/b/i0/24i/c4sD6xBu/g==" crossOrigin="anonymous" referrerPolicy="no-referrer"></script>
      </Head>
      <style>{`
      .invoice-page {
        page-break-after: always;
      }
      .invoice-page:last-child {
        page-break-after: auto;
      }
      @media print {
        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background-color: white !important;
        }
        body * {
          visibility: hidden;
          color: black !important;
        }
        .action-bar {
          display: none;
        }
        #invoice-paper, #invoice-paper * {
          visibility: visible;
        }
        #invoice-paper {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          margin: 0;
          padding: 0;
          box-shadow: none;
          border: none;
        }
        .invoice-page {
          padding: 0.5in !important;
          box-shadow: none !important;
          border: none !important;
          height: auto;
          min-height: 0;
        }
         @page {
            size: A4;
            margin: 0;
        }
      }
      `}</style>

      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden action-bar">
        <Button
          onClick={() => router.back()}
          variant="outline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Kembali
        </Button>
        <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={handleExportExcel} variant="outline">
              <Download className="w-5 h-5 mr-2"/>
              <span>Excel</span>
            </Button>
            <Button onClick={handlePdfExport} variant="outline">
              <Download className="w-5 h-5 mr-2"/>
              <span>PDF</span>
            </Button>
            <Button onClick={handlePrint} variant="default">
              <Printer className="w-5 h-5 mr-2"/>
              <span>Cetak</span>
            </Button>
        </div>
      </div>

      <div id="invoice-paper" className="w-full max-w-4xl mx-auto bg-white shadow-lg">
        {itemPages.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === itemPages.length - 1;
          const pageNumber = pageIndex + 1;
          const totalPages = itemPages.length;

          return (
            <div key={pageIndex} className="invoice-page relative flex flex-col p-8 text-[10px] leading-tight" style={{minHeight: isLastPage ? 'auto' : '29.7cm' }}>
             <header>
                <div className="flex flex-col">
                    <div className="flex justify-between items-start">
                        {/* Left part */}
                        <div className="w-1/2">
                           <div className="mb-4">
                                <p className="font-bold text-[11px] mb-1">{customer?.name}</p>
                                <p className='whitespace-pre-line'>{customer?.address}</p>
                           </div>
                           <p>Customer Code: -</p>
                        </div>

                        {/* Center part */}
                        <div className="w-full absolute text-center">
                            <p className="font-bold uppercase text-[14px] mb-1 tracking-tighter">{invoiceTitle}</p>
                            <p className="font-bold uppercase text-[14px]">{invoiceId}</p>
                        </div>
                        
                        {/* Right part */}
                        <div className="w-1/2 flex justify-end text-[10px]">
                            <div className="inline-grid grid-cols-[max-content_max-content] text-left gap-x-2">
                                <span>Sales Order</span><span>: {soNumber || ''}</span>
                                <span>Order Date</span><span>:</span>
                                <span>Reference A</span><span>:</span>
                                <span className="mt-4">Date</span><span className="mt-4">: {formatDate(date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
              </header>

              <main className='mt-2 flex-grow'>
                 <table className="w-full border-collapse text-[10px]">
                    <thead>
                        <tr>
                            <th className="p-1 text-left border border-black">No.</th>
                            <th className="p-1 text-left border border-black">Item</th>
                            <th className="p-1 text-left border border-black">Quantity Unit</th>
                            <th className="p-1 text-right border border-black">Price</th>
                            <th className="p-1 text-right border border-black border-t border-b border-r">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((item) => (
                            <tr key={item.id} className="h-[24px]">
                                <td className="p-1 text-left align-top">{item.no + (pageIndex * ITEMS_PER_PAGE)}</td>
                                <td className="p-1 align-top text-left">{item.name}</td>
                                <td className="p-1 text-center align-top">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                <td className="p-1 text-right align-top">{formatCurrency(item.price)}</td>
                                <td className="p-1 text-right align-top">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                         {isLastPage && Array.from({ length: Math.max(0, emptyRowsCount) }).map((_, index) => (
                            <tr key={`empty-${index}`} className="h-[24px]">
                                <td className='p-1'>&nbsp;</td>
                                <td className='p-1'>&nbsp;</td>
                                <td className='p-1'>&nbsp;</td>
                                <td className='p-1'>&nbsp;</td>
                                <td className='p-1'>&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>

                 {isLastPage && (
                    <div className="flex justify-end text-right mt-4">
                        <div>
                            <div className="inline-block border-t border-black w-[128px]" />
                            <div>{formatCurrency(subtotal)}</div>
                        </div>
                    </div>
                 )}

              </main>
              
              
              {isLastPage && (
                <footer className="pt-2 text-black mt-auto">
                    <div className="border-t border-b border-black py-1">
                        <div className="flex justify-between items-start">
                            <p>No PO : {poNumber || ''}</p>
                            <div className="w-[240px]">
                                <div className="grid grid-cols-[auto_1fr] justify-items-end gap-x-4">
                                    <p className="text-right">Goods:</p>
                                    <p className='text-right'>{formatCurrency(grandTotal)}</p>
                                    <p className="text-right">DPP VAT (11/12):</p>
                                    <p className='text-right'>{formatCurrency(dppVat)}</p>
                                    <p className="text-right">VAT 12%:</p>
                                    <p className='text-right'>{formatCurrency(vat12)}</p>
                                    <p className="text-right font-bold">Total Rp:</p>
                                    <p className="text-right font-bold">{formatCurrency(totalRp)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex mt-4 text-[10px]">
                        <div className='w-1/2 pr-4 text-[9px]'>
                            <div className="flex items-start">
                                <p className='w-16 shrink-0'>Payment:</p>
                                <p className='flex-1 ml-2'>{paymentTerms || '90 Hari setelah invoice diterima'}</p>
                            </div>
                            <p className="mt-2">Please state with your payment: {invoiceId}</p>
                            <p className="font-bold mt-2">For payment, please transfer to our account:</p>
                            <p className="font-bold mt-2">PT. Jembo Cable Company Tbk</p>
                            
                           <div className="grid grid-cols-[max-content_1fr] gap-x-4 mt-1 items-center">
                                <div className="font-bold">
                                    <p>Bank Mandiri - Jakarta</p>
                                    <p>Cabang Sudirman</p>
                                </div>
                                <div className="text-left">
                                  <div className="grid grid-cols-[max-content_1fr] gap-x-2">
                                    <span>A/C No.</span><span>: 102-0100206827 (Rp)</span>
                                    <span>A/C No.</span><span>: 102-0005000218 (Rp)</span>
                                    <span>A/C No.</span><span>: 102-0005000226 (USD)</span>
                                  </div>
                                </div>
                                
                                <div className="col-span-2 my-1 flex items-center">
                                  <div className="w-[100px] text-center">OR</div>
                                </div>

                                <div className="font-bold">
                                    <p>Bank BCA - Jakarta</p>
                                    <p>Cabang KEM TOWER</p>
                                </div>
                                <div className="text-left">
                                   <div className="grid grid-cols-[max-content_1fr] gap-x-2">
                                     <span>A/C No.</span><span>: 684-0198977 (Rp)</span>
                                   </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-1/2 pl-4 flex flex-col justify-between">
                            <div className='text-center'>
                                <p>PT. JEMBO CABLE COMPANY Tbk</p>
                                <br />
                                <p>Finance</p>
                            </div>
                            <div className="text-center mt-auto">
                            </div>
                        </div>
                    </div>
                </footer>
              )}
               {
                !isLastPage && (
                    <div className="text-center text-gray-500 text-[10px] py-4 border-t border-dashed mt-auto">
                        Halaman {pageNumber} dari {totalPages} - Bersambung...
                    </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default InvoicePreviewPage;
