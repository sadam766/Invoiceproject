
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { invoiceListData, salesOrderListData, type Customer, customerListData, type Invoice } from '@/app/lib/data';
import { exportToExcel } from '@/lib/utils';

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

  useEffect(() => {
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
        if (decodedId === parsedData.id) {
            setInvoiceData(parsedData);
            // Clean up session storage after use
            // sessionStorage.removeItem('invoicePreviewData');
        } else {
             fetchInvoiceFromListData(decodedId);
        }
    } else if (id) {
        fetchInvoiceFromListData(decodedId);
    }

  }, [id]);


  if (!invoiceData) {
    return (
      <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 flex flex-col items-center justify-center">
        <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">Tidak ada data invoice untuk pratinjau.</p>
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
        return new Intl.DateTimeFormat('de-DE').format(cleanDate);
    } catch (e) {
        return dateString;
    }
  };
  
  const totalRp = grandTotal + vat12;


  const handlePrint = () => {
    window.print();
  };
  
  const handleExportPDF = () => {
     alert("Fungsi ekspor PDF sedang dalam pengembangan.");
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
        formatNumber(item.quantity * item.price)
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

  return (
    <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans">
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
        }
        body * {
          visibility: hidden;
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
            <Button onClick={handleExportPDF} variant="outline">
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
            <div key={pageIndex} className="invoice-page p-8 text-[10px] leading-tight relative" style={{ display: 'flex', flexDirection: 'column', minHeight: '27cm' }}>
              <header>
                <div className="h-[70px] w-full"></div>
                <div className="text-center mb-4">
                  <p className="font-bold uppercase text-[14px] mb-1 tracking-tighter">{invoiceTitle}</p>
                  <p className="font-bold uppercase text-[14px]">{invoiceId}</p>
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-1/2 text-left pr-4">
                    <p className="font-bold text-[11px] mb-1">{customer?.name}</p>
                    {customer?.address && <p className="font-bold text-[9px] whitespace-pre-wrap">{customer.address}</p>}
                  </div>
                  <div className="w-1/2 text-right pt-2">
                    <p className="font-bold text-[12px]">{printType || 'Original'}</p>
                  </div>
                </div>
                <div className="flex justify-between items-start text-[10px] mb-2">
                  <div className="w-1/2 text-left pr-4"></div>
                  <div className="w-1/2 text-right pl-4">
                    <div className="flex justify-between py-[0px]"><div className="w-[120px] text-right">Sales Order :</div><div className="flex-1 text-left ml-2">{soNumber || ''}</div></div>
                    <div className="flex justify-between py-[0px]"><div className="w-[120px] text-right">Order Date :</div><div className="flex-1 text-left ml-2"></div></div>
                    <div className="flex justify-between py-[0px]"><div className="w-[120px] text-right">Reference A :</div><div className="flex-1 text-left ml-2"></div></div>
                  </div>
                </div>
                <div className="flex justify-between items-end text-[10px] mb-4">
                  <div className="w-1/2 text-left"><div className="flex"><div className="w-[100px]">Customer Code :</div><div className="flex-1 text-left">{customer?.id || ''}</div></div></div>
                  <div className="w-1/2 text-right"><p>Date: {formatDate(date)}</p></div>
                </div>
              </header>

              <main className="flex-grow">
                 <table className="w-full border-collapse text-[10px]">
                      <thead className='border-t border-b border-black'>
                          <tr>
                              <th className="p-1 text-center w-[4%]">No.</th>
                              <th className="p-1 text-left w-[40%] border-l border-black">Item</th>
                              <th className="p-1 text-center w-[18%] border-l border-black">Quantity Unit</th>
                              <th className="p-1 text-right w-[19%] border-l border-black">Price</th>
                              <th className="p-1 text-right w-[19%] border-l border-black">Amount</th>
                          </tr>
                      </thead>
                      <tbody>
                          {pageItems.map((item) => (
                              <tr key={item.no}>
                                  <td className="p-1 text-center align-top">{item.no}</td>
                                  <td className="p-1 align-top border-l border-black">{item.name}</td>
                                  <td className="p-1 text-center align-top border-l border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                  <td className="p-1 text-right align-top border-l border-black">{formatCurrency(item.price)}</td>
                                  <td className="p-1 text-right align-top border-l border-black">{formatCurrency(item.total)}</td>
                              </tr>
                          ))}
                          {Array.from({ length: Math.max(0, ITEMS_PER_PAGE - pageItems.length) }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{height: '24px'}}>
                                <td className='p-1'>&nbsp;</td>
                                <td className='p-1 border-l border-black'>&nbsp;</td>
                                <td className='p-1 border-l border-black'>&nbsp;</td>
                                <td className='p-1 border-l border-black'>&nbsp;</td>
                                <td className='p-1 border-l border-black'>&nbsp;</td>
                            </tr>
                          ))}
                      </tbody>
                  </table>
              </main>

              {isLastPage && (
                <footer className="pt-2">
                    <div className="flex justify-between items-center text-[10px] pt-1">
                        <p>No PO : {poNumber || ''}</p>
                        <div className="flex items-center">
                            <div className="w-28 text-left">Subtotal</div>
                            <div className="w-28 text-right font-bold">{formatCurrency(subtotal)}</div>
                        </div>
                    </div>

                     {(negotiation > 0 || dpValue > 0 || pelunasan > 0) && (
                        <div className="flex justify-end w-full text-[10px] mt-1">
                            <div className="w-[224px]">
                                {negotiation > 0 && (
                                    <div className="flex justify-between"><p className="text-left">A/Negotiation :</p> <p className='text-right'>({formatCurrency(negotiation)})</p></div>
                                )}
                                {dpValue > 0 && (
                                    <div className="flex justify-between"><p className="text-left">DP :</p> <p className='text-right'>{formatCurrency(dpValue)}</p></div>
                                )}
                                {pelunasan > 0 && (
                                    <div className="flex justify-between"><p className="text-left">Pelunasan :</p> <p className='text-right'>({formatCurrency(pelunasan)})</p></div>
                                )}
                            </div>
                        </div>
                     )}
                    
                    <div className="border-t border-b border-black mt-2">
                        <div className="flex justify-end w-full text-[10px]">
                            <div className="w-[224px] py-1">
                                <div className="grid grid-cols-2 justify-items-end">
                                    <p className="text-left">Goods:</p>
                                    <p className='text-right'>{formatCurrency(grandTotal)}</p>
                                    <p className="text-left">DPP VAT (12%):</p>
                                    <p className='text-right'>{formatCurrency(dppVat)}</p>
                                    <p className="text-left">VAT 12%:</p>
                                    <p className='text-right'>{formatCurrency(vat12)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="border-b border-black">
                         <div className="flex justify-end w-full text-[10px]">
                            <div className="w-[224px] py-1">
                                 <div className="grid grid-cols-2 justify-items-end font-bold">
                                    <p className="text-left">Total Rp:</p>
                                    <p className="text-right">{formatCurrency(totalRp)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    
                    <div className="flex mt-4 text-[10px]">
                        <div className='w-1/2 pr-4 text-[9px]'>
                            <div className="flex items-start">
                                <p className='w-[60px] shrink-0'>Payment :</p><p className='flex-1'>{paymentTerms || '90 Hari setelah invoice diterima'}</p>
                            </div>
                            <p className="mt-2">Please state with your payment: {invoiceId}</p>
                            <p className="font-bold mt-2">For payment, please transfer to our account:</p>
                            <p className="font-bold mt-2">PT. Jembo Cable Company Tbk</p>
                            
                             <div className="flex mt-1">
                                <div className="w-1/2 pr-2">
                                    <p className='font-bold'>Bank Mandiri - Jakarta</p>
                                    <p>Cabang Sudirman</p>
                                    <p>A/C No.: 102-0100206827 (Rp)</p>
                                    <p>A/C No.: 102-0005000218 (Rp)</p>
                                    <p>A/C No.: 102-0005000226 (USD)</p>
                                </div>
                                <div className='relative w-12'>
                                    <p className="font-bold text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">OR</p>
                                </div>
                                 <div className="w-1/2 pl-2">
                                    <p className='font-bold'>Bank BCA - Jakarta</p>
                                    <p>Cabang KEM TOWER</p>
                                    <p>A/C No.: 684-0198977 (Rp)</p>
                                </div>
                            </div>
                        </div>

                        <div className="w-1/2 pl-4 flex flex-col justify-between">
                             <div className='text-center'>
                                 <p>PT. JEMBO CABLE COMPANY Tbk</p>
                             </div>
                             <div className="text-center mt-20">
                                <div className="inline-block">
                                    <div className="h-px w-32 bg-black mb-1"></div>
                                    <p>Finance</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </footer>
              )}
                {itemPages.length > 1 && !isLastPage && (
                    <div className="text-center text-gray-500 text-[10px] py-4 border-t border-dashed mt-4">
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

    