
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { invoiceListData, salesOrderListData, type Invoice, type SalesOrder, type Customer } from '@/app/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';

type InvoiceItem = {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
};

type PreviewData = Invoice & {
    items: InvoiceItem[];
    customer?: Customer;
    subtotal: number;
    negotiation: number;
    dpValue: number;
    pelunasan: number;
    grandTotal: number;
    dppVat: number;
    vat12: number;
}

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
                    name: so.productName,
                    quantity: so.quantity,
                    unit: so.unit,
                    price: so.price,
                    total: so.quantity * so.price
                }));
                const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
                const grandTotal = subtotal;
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
        vat12
    } = invoiceData;

    const totalAmount = grandTotal + vat12;

    const formatCurrency = (value: number) => {
        return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return (
        <main className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-8">
             <div className="flex justify-between items-center mb-4 print-hidden">
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print Invoice
                </Button>
            </div>
            <div className="print-container bg-white dark:bg-gray-900 p-8 max-w-4xl mx-auto border font-sans text-[10px]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                
                <div className="text-center mb-4">
                    <h1 className="font-bold text-sm">INVOICE/OFFICIAL RECEIPT</h1>
                    <p className="text-sm">{invoiceId}</p>
                </div>
                
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p>Customer Code: {customer?.id || ''}</p>
                    </div>
                    <div className="text-right">
                        <div className="grid grid-cols-[auto_auto] gap-x-2 text-left">
                            <p>Sales Order:</p><span>{soNumber}</span>
                            <p>Order Date:</p><span></span>
                            <p>Reference A:</p><span></span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end items-baseline mb-4">
                    <div className="text-right mr-4">
                        <p className="font-bold text-sm">Original</p>
                        {date && <p className="mt-2">Date: {format(new Date(date), 'dd-MM-yyyy')}</p>}
                    </div>
                </div>

                {/* Items Table */}
                <div className="w-full mt-2 border-t-2 border-b-2 border-black">
                    <div className="flex font-bold">
                        <div className="p-1 w-10 text-center border-r border-black">No.</div>
                        <div className="p-1 flex-1 border-r border-black">Item</div>
                        <div className="p-1 w-24 text-center border-r border-black">Quantity Unit</div>
                        <div className="p-1 w-32 text-right border-r border-black">Price</div>
                        <div className="p-1 w-32 text-right">Amount</div>
                    </div>
                    <div className="min-h-[300px] border-t border-black">
                        {items.map((item, index) => (
                            <div key={index} className="flex">
                                <div className="p-1 w-10 text-center">{item.no}</div>
                                <div className="p-1 flex-1">{item.name}</div>
                                <div className="p-1 w-24 text-center">{item.quantity} {item.unit}</div>
                                <div className="p-1 w-32 text-right">{formatCurrency(item.price)}</div>
                                <div className="p-1 w-32 text-right">{formatCurrency(item.total)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PO Number and Subtotal */}
                <div className="flex justify-between items-center mt-2 pb-1 border-b-2 border-black">
                    <p>No PO :</p>
                    <p>{formatCurrency(subtotal)}</p>
                </div>

                {/* Footer */}
                 <div className="flex justify-between mt-4">
                     <div className='w-2/3 pr-4'>
                        <div className='grid grid-cols-[auto_1fr] gap-x-2'>
                            <p>Payment :</p><p>90 Hari setelah invoice diterima</p>
                        </div>
                        <p>Please state with your payment: {invoiceId}</p>
                        <p>For payment, please transfer to our account:</p>
                        <p className="font-bold mt-2">PT. Jembo Cable Company Tbk</p>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 mt-1">
                            <div>
                                <p>Bank Mandiri - Jakarta Cabang Sudirman</p>
                            </div>
                            <div>
                                <p>A/C No.: 102-0100206827 (Rp)</p>
                                <p>A/C No.: 102-0005000218 (Rp)</p>
                                <p>A/C No.: 102-0005000226 (USD)</p>
                            </div>
                        </div>
                        <div className="pl-20 my-1 font-bold">OR</div>
                         <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <div>
                                <p>Bank BCA - Jakarta Cabang KEM TOWER</p>
                             </div>
                             <div>
                                <p>A/C No.: 684-0198977 (Rp)</p>
                             </div>
                        </div>
                     </div>
                     <div className="w-1/3">
                         <div className="grid grid-cols-2 gap-y-1">
                             <p>Goods:</p>
                             <p className='text-right'>{formatCurrency(grandTotal)}</p>
                             
                             <p>DPP VAT (11/12):</p>
                             <p className='text-right'>{formatCurrency(dppVat)}</p>
                             
                             <p>VAT 12%:</p>
                             <p className='text-right'>{formatCurrency(vat12)}</p>
                             
                             <p className="font-bold col-span-2 border-t border-black pt-1 mt-1">Total Rp:</p>
                             <p className="col-span-2 text-right font-bold">{formatCurrency(totalAmount)}</p>
                         </div>
                        <div className="mt-12 text-center">
                            <p>PT. JEMBO CABLE COMPANY Tbk</p>
                            <div className="h-20"></div>
                            <p className="border-t border-black pt-1">Finance</p>
                        </div>
                     </div>
                 </div>
            </div>
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-container, .print-container * {
                        visibility: visible;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0.5in;
                        font-size: 10px;
                    }
                    .print-hidden {
                        display: none;
                    }
                }
                @page {
                    size: A4;
                    margin: 0;
                }
            `}</style>
        </main>
    );
}
