
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { invoiceListData, salesOrderListData, type Customer, customerListData } from '@/app/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';

type InvoiceItem = {
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
    date: string;
    customer?: Customer;
    items: InvoiceItem[];
    subtotal: number;
    negotiation: number;
    dpValue: number;
    pelunasan: number;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    amount: number;
    poNumber?: string;
    printType?: string;
    client?: string;
    billToAddress?: string;
    paymentTerms?: string;
    number?: string;
};

export default function InvoicePreviewPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [invoiceData, setInvoiceData] = useState<PreviewData | null>(null);

    useEffect(() => {
        function fetchInvoiceFromListData() {
            const decodedId = decodeURIComponent(id as string);
            const foundInvoice = invoiceListData.find(inv => inv.id === decodedId);
            
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
                
                // Placeholder values if not present in invoice list data
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
            }
        }
        
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            if (decodeURIComponent(id as string) === parsedData.id) {
                setInvoiceData(parsedData);
            } else {
                 fetchInvoiceFromListData();
            }
        } else if (id) {
            fetchInvoiceFromListData();
        }

    }, [id]);

    const handlePrint = () => {
        window.print();
    };
    
    if (!invoiceData) {
        return (
            <div className="p-8">
                <Button onClick={() => router.back()} variant="outline" className="mb-4 print-hidden">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div>Loading or Invoice not found...</div>
            </div>
        );
    }
    
    const {
        id: invoiceId,
        soNumber,
        date,
        customer,
        items,
        subtotal,
        negotiation,
        dpValue,
        pelunasan,
        grandTotal,
        dppVat,
        vat12,
        poNumber,
        printType
    } = invoiceData;

    const totalAmount = grandTotal + vat12;
    const invoiceTitle = invoiceId.startsWith('KW/') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return '0,00';
        return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        try {
            const cleanDate = dateString.includes('-') ? new Date(dateString) : new Date(dateString.split('/').reverse().join('-'));
            return format(cleanDate, 'dd-MM-yyyy');
        } catch (e) {
            return dateString;
        }
    };
    
    return (
        <main className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-8 font-sans">
            <div className="flex justify-between items-center max-w-4xl mx-auto mb-4 print-hidden">
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                </div>
            </div>
            <div id="invoice-paper" className="print-container bg-white dark:bg-gray-900 p-8 max-w-4xl mx-auto border shadow-lg text-[10px] leading-tight relative" style={{ fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', minHeight: '27cm' }}>
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

              <main className='flex-grow'>
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
                          {items.map((item) => (
                              <tr key={item.no}>
                                  <td className="p-1 text-center align-top">{item.no}</td>
                                  <td className="p-1 align-top border-l border-black">{item.name}</td>
                                  <td className="p-1 text-center align-top border-l border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                  <td className="p-1 text-right align-top border-l border-black">{formatCurrency(item.price)}</td>
                                  <td className="p-1 text-right align-top border-l border-black">{formatCurrency(item.total)}</td>
                              </tr>
                          ))}
                          {Array.from({ length: Math.max(0, 15 - items.length) }).map((_, i) => (
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

             <footer className="pt-2">
                <div className="flex justify-between items-center text-[10px] border-t border-black pt-1">
                    <p>No PO : {poNumber || ''}</p>
                    <div className="flex items-center">
                        <div className="w-28 text-left">Subtotal</div>
                        <div className="w-28 text-right font-bold">{formatCurrency(subtotal)}</div>
                    </div>
                </div>

                <div className="flex justify-end w-full text-[10px] mt-1">
                    <div className="w-[224px] pl-4">
                        {(negotiation > 0 || dpValue > 0 || pelunasan > 0) && (
                            <>
                                {negotiation > 0 && (
                                    <div className="flex justify-end"><p className="w-28 text-left">A/Negotiation :</p> <p className='w-28 text-right'>({formatCurrency(negotiation)})</p></div>
                                )}
                                {dpValue > 0 && (
                                    <div className="flex justify-end"><p className="w-28 text-left">DP :</p> <p className='w-28 text-right'>{formatCurrency(dpValue)}</p></div>
                                )}
                                {pelunasan > 0 && (
                                    <div className="flex justify-end"><p className="w-28 text-left">Pelunasan :</p> <p className='w-28 text-right'>({formatCurrency(pelunasan)})</p></div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end w-full text-[10px] mt-1">
                    <div className="w-[224px] pl-4 border-t border-black pt-1">
                        <div className="grid grid-cols-2 justify-items-end">
                            <p className="text-left w-28">Goods:</p>
                            <p className='text-right w-28'>{formatCurrency(grandTotal)}</p>
                            <p className="text-left w-28">DPP VAT (11/12):</p>
                            <p className='text-right w-28'>{formatCurrency(dppVat)}</p>
                            <p className="text-left w-28">VAT 12%:</p>
                            <p className='text-right w-28'>{formatCurrency(vat12)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end w-full text-[10px] mt-1">
                    <div className="w-[224px] pl-4">
                         <div className="grid grid-cols-2 justify-items-end font-bold border-t border-b border-black py-1">
                            <p className="text-left w-28">Total Rp:</p>
                            <p className="text-right w-28">{formatCurrency(totalAmount)}</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex mt-4 text-[10px]">
                    <div className='w-1/2 pr-4 text-[9px]'>
                        <div className="grid grid-cols-[max-content,1fr] gap-x-2">
                            <p>Payment :</p><p>{'90 Hari setelah invoice diterima'}</p>
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
                             <div className="w-1/2 pl-2">
                                <p className="font-bold text-center mb-1">OR</p>
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

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-hidden { display: none; }
                    .print-container, .print-container * { visibility: visible; }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0.5in;
                        font-size: 10px;
                        margin: 0;
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
      </main>
    );
}
