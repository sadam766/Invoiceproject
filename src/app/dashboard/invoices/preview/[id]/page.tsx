
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { invoiceListData, salesOrderListData, type Invoice, type SalesOrder, type Customer } from '@/app/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';

type InvoiceItem = {
    no: number;
    item: string;
    quantity: number;
    unit: string;
    price: number;
    amount: number;
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
            // Optional: Clear session storage after use
            // sessionStorage.removeItem('invoicePreviewData');
        } else if (id) {
            const decodedId = decodeURIComponent(id as string);
            const foundInvoice = invoiceListData.find(inv => inv.id === decodedId);
            
            if (foundInvoice) {
                const relatedSalesOrders = salesOrderListData.filter(so => so.soNumber === foundInvoice.soNumber);
                const invoiceItems: InvoiceItem[] = relatedSalesOrders.map((so, index) => ({
                    no: index + 1,
                    item: so.productName,
                    quantity: so.quantity,
                    unit: so.unit,
                    price: so.price,
                    amount: so.quantity * so.price
                }));
                const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

                setInvoiceData({
                    ...foundInvoice,
                    items: invoiceItems,
                    subtotal: subtotal,
                    negotiation: 0,
                    dpValue: 0,
                    pelunasan: 0,
                    grandTotal: subtotal,
                    dppVat: subtotal / 1.12,
                    vat12: (subtotal / 1.12) * 0.12,
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
                <Button onClick={() => router.back()} variant="outline" className="mb-4 print:hidden">
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


    return (
        <main className="bg-gray-100 p-4 sm:p-8">
             <div className="flex justify-between items-center mb-4 print:hidden">
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print Invoice
                </Button>
            </div>
            <div className="print-container bg-white p-8 max-w-4xl mx-auto border font-sans text-xs">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-sm font-bold">INVOICE/OFFICIAL RECEIPT</h1>
                        <p className="text-sm">{invoiceId}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-sm">Original</p>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-2">
                    <div>
                        <p>Customer Code: </p>
                    </div>
                    <div className="text-right">
                        <div className="grid grid-cols-[auto_auto] gap-x-2">
                            <p className="text-left">Sales Order:</p>
                            <p className="text-left">{soNumber}</p>
                            <p className="text-left">Order Date:</p>
                            <p className="text-left"></p>
                            <p className="text-left">Reference A:</p>
                            <p className="text-left"></p>
                        </div>
                        {date && (
                            <p className="mt-2">Date: {format(new Date(date), 'dd-MM-yyyy')}</p>
                        )}
                    </div>
                </div>

                {/* Items Table */}
                <div className="w-full">
                    <div className="flex bg-white border-t border-b border-black font-bold">
                        <div className="p-1 border-l border-black w-10 text-center">No.</div>
                        <div className="p-1 border-l border-r border-black flex-1">Item</div>
                        <div className="p-1 border-r border-black w-24 text-center">Quantity Unit</div>
                        <div className="p-1 border-r border-black w-32 text-right">Price</div>
                        <div className="p-1 border-r border-black w-32 text-right">Amount</div>
                    </div>
                    {items.map((item, index) => (
                        <div key={index} className="flex border-b border-black">
                            <div className="p-1 border-l border-r border-black w-10 text-center">{item.no}</div>
                            <div className="p-1 border-r border-black flex-1">{item.item}</div>
                            <div className="p-1 border-r border-black w-24 text-center">{item.quantity} {item.unit}</div>
                            <div className="p-1 border-r border-black w-32 text-right">{item.price.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</div>
                            <div className="p-1 border-r border-black w-32 text-right">{item.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</div>
                        </div>
                    ))}
                     <div className="flex border-b border-black h-40">
                        <div className="border-l border-r border-black w-10"></div>
                        <div className="border-r border-black flex-1"></div>
                        <div className="border-r border-black w-24"></div>
                        <div className="border-r border-black w-32"></div>
                        <div className="border-r border-black w-32"></div>
                    </div>
                </div>

                <div className="flex justify-end items-start mt-1">
                    <div className="w-80">
                         <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="font-bold w-32 text-right">{subtotal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</span>
                         </div>
                         {negotiation > 0 && (
                            <div className="flex justify-between">
                                <span>Negotiation</span>
                                <span className="font-bold w-32 text-right">({negotiation.toLocaleString('id-ID', { minimumFractionDigits: 2 })})</span>
                            </div>
                         )}
                         {dpValue > 0 && (
                            <div className="flex justify-between">
                                <span>DP</span>
                                <span className="font-bold w-32 text-right">({dpValue.toLocaleString('id-ID', { minimumFractionDigits: 2 })})</span>
                            </div>
                         )}
                         {pelunasan > 0 && (
                            <div className="flex justify-between">
                                <span>Pelunasan</span>
                                <span className="font-bold w-32 text-right">({pelunasan.toLocaleString('id-ID', { minimumFractionDigits: 2 })})</span>
                            </div>
                         )}
                    </div>
                </div>
                 <div className="border-b-2 border-black mt-1"></div>

                 <div className="flex justify-between mt-4">
                     <div>
                        <p>No PO :</p>
                        <p>Payment: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 50 Hari setelah invoice diterima</p>
                        <p>Please state with your payment: {invoiceId}</p>
                        <p>For payment, please transfer to our account:</p>
                        <p className="font-bold mt-2">PT. Jembo Cable Company Tbk</p>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 mt-1">
                            <p>Bank Mandiri - Jakarta Cabang Sudirman</p>
                            <div>
                                <p>A/C No.: 102-0100206827 (Rp)</p>
                                <p>A/C No.: 102-0005000218 (Rp)</p>
                                <p>A/C No.: 102-0005000226 (USD)</p>
                            </div>
                            <div></div>
                            <p className="font-bold">OR</p>
                             <p>Bank BCA - Jakarta Cabang KEM TOWER</p>
                             <p>A/C No.: 684-0198977 (Rp)</p>
                        </div>
                     </div>
                     <div className="w-1/3 text-right">
                         <div className="grid grid-cols-2 gap-y-1">
                             <p>Goods:</p>
                             <p>{grandTotal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                             <p>DPP VAT:</p>
                             <p>{dppVat.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                             <p>VAT 12%:</p>
                             <p>{vat12.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                             <p className="font-bold col-span-2 border-t border-black pt-1 mt-1">Total Rp:</p>
                             <p className="font-bold col-span-2">{totalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
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
                    }
                    .print-hidden {
                        display: none;
                    }
                }
            `}</style>
        </main>
    );
}
