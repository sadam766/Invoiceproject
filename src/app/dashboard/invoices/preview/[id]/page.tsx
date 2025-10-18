
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { invoiceListData, salesOrderListData, type Customer } from '@/app/lib/data';
import { ArrowLeft, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';

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
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            setInvoiceData(parsedData);
        } else if (id) {
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
                const grandTotal = subtotal; // Simplified for existing data
                const dppVat = grandTotal / 1.12;
                const vat12 = dppVat * 0.12;

                setInvoiceData({
                    ...foundInvoice,
                    items: invoiceItems,
                    subtotal: subtotal,
                    negotiation: 0,
                    dpValue: 0,
                    pelunasan: 0,
                    grandTotal: grandTotal,
                    dppVat: dppVat,
                    vat12: vat12,
                });
            }
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
        if (typeof value !== 'number') return '0,00';
        return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        try {
            return format(new Date(dateString), 'dd-MM-yyyy');
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
                <table className="w-full border-collapse mb-0 text-[10px]">
                    <thead>
                        <tr>
                            <th className="text-center p-1 w-[4%] border-l border-t border-b border-black">No.</th>
                            <th className="text-left p-1 w-[40%] border-t border-b border-r border-black">Item</th>
                            <th className="text-center p-1 w-[18%] border-t border-b border-r border-black">Quantity Unit</th>
                            <th className="text-right p-1 w-[19%] border-t border-b border-r border-black">Price</th>
                            <th className="text-right p-1 w-[19%] border-t border-b border-r border-black">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index}>
                                <td className="p-1 text-center">{item.no}</td>
                                <td className="p-1">{item.name}</td>
                                <td className="p-1 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                <td className="p-1 text-right">{formatCurrency(item.price)}</td>
                                <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 15 - items.length) }).map((_, i) => (
                           <tr key={`empty-${i}`} style={{height: '24px'}}>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                           </tr>
                        ))}
                    </tbody>
                </table>
              </main>

              <footer>
                <div className="flex justify-between items-center text-[10px] border-black border-b">
                    <p>No PO : {poNumber || ''}</p>
                    <div className="text-right">
                        <div className="inline-block border-t border-black px-4">{formatCurrency(subtotal)}</div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <div className="w-1/2 pl-4 text-[10px]">
                        {negotiation !== 0 && (<div className="flex justify-between"><p>A/Negotiation :</p> <p>({formatCurrency(Math.abs(negotiation))})</p></div>)}
                        {dpValue !== 0 && (<div className="flex justify-between"><p>DP :</p> <p>{formatCurrency(dpValue)}</p></div>)}
                        {pelunasan !== 0 && (<div className="flex justify-between"><p>Pelunasan :</p> <p>({formatCurrency(pelunasan)})</p></div>)}
                    </div>
                </div>
                
                <div className="border-b-2 border-black w-full mt-1 mb-1"></div>

                 <div className="flex justify-between mt-1">
                     <div className='w-2/3 pr-4'>
                        <div className="text-[9px]">
                            <div className='grid grid-cols-[auto_1fr] gap-x-2'>
                                <p>Payment :</p><p>90 Hari setelah invoice diterima</p>
                            </div>
                            <p>Please state with your payment: {invoiceId}</p>
                            <p>For payment, please transfer to our account:</p>
                            <p className="font-bold mt-2">PT. Jembo Cable Company Tbk</p>
                            <div className="grid grid-cols-[auto_1fr] gap-x-4 mt-1">
                                <div>
                                    <p>Bank Mandiri - Jakarta</p>
                                    <p>Cabang Sudirman</p>
                                </div>
                                <div className="text-right">
                                    <p>A/C No.: 102-0100206827 (Rp)</p>
                                    <p>A/C No.: 102-0005000218 (Rp)</p>
                                    <p>A/C No.: 102-0005000226 (USD)</p>
                                </div>
                            </div>
                            <div className="text-center my-1 font-bold">OR</div>
                             <div className="grid grid-cols-[auto_1fr] gap-x-4">
                                <div>
                                    <p>Bank BCA - Jakarta</p>
                                    <p>Cabang KEM TOWER</p>
                                 </div>
                                 <div className="text-right">
                                    <p>A/C No.: 684-0198977 (Rp)</p>
                                 </div>
                            </div>
                        </div>
                     </div>
                     <div className="w-1/3">
                         <div className="grid grid-cols-2 gap-y-1 text-[10px]">
                             <p>Goods:</p>
                             <p className='text-right'>{formatCurrency(grandTotal)}</p>
                             
                             <p>DPP VAT (11/12):</p>
                             <p className='text-right'>{formatCurrency(dppVat)}</p>
                             
                             <p>VAT 12%:</p>
                             <p className='text-right'>{formatCurrency(vat12)}</p>
                         </div>
                         <div className="border-t border-black pt-1 mt-1 grid grid-cols-2">
                             <p className="font-bold">Total Rp:</p>
                             <p className="text-right font-bold">{formatCurrency(totalAmount)}</p>
                         </div>

                        <div className="mt-4 text-center">
                            <p>PT. JEMBO CABLE COMPANY Tbk</p>
                            <div className="h-16"></div>
                            <p className="border-t border-black pt-1 mx-8">Finance</p>
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
