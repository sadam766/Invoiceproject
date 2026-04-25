'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';
import type { VirtualAccount } from '@/app/lib/data';

interface Item {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
}

interface InvoiceData {
    id: string;
    items: Item[];
    customer: {
        name: string;
        address: string;
    };
    date: string;
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
    printType: 'original' | 'copy';
    negotiation: number;
    dpValue: number;
    pelunasan: number;
    virtualAccounts?: VirtualAccount[];
}

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 10;

const InvoicePreviewPage = () => {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsed = JSON.parse(dataFromSession);
            setInvoiceData({
                ...parsed,
                customer: { name: parsed.customer?.name || 'N/A', address: parsed.customer?.address || 'N/A' },
                totalRp: (parsed.grandTotal || 0) + (parsed.vat12 || 0),
                paymentTerms: parsed.paymentTerms || '90 Hari setelah invoice diterima',
                printType: parsed.printType || 'original',
            });
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!invoiceData) return <div className="p-8">Loading...</div>;

    const { id: invoiceId, items, customer, date, soNumber, poNumber, grandTotal, dppVat, vat12, paymentTerms, totalRp, printType, negotiation, dpValue, pelunasan, virtualAccounts } = invoiceData;
    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) => items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE));
    const totalPages = itemChunks.length;
    const subTotalItems = items.reduce((acc, item) => acc + item.total, 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    const hasVa = virtualAccounts && virtualAccounts.length > 0;

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 sm:p-6 font-sans text-black">
            <style>{`@media print { .page-break { page-break-before: always; } .print-hidden { display: none !important; } }`}</style>
            <div className="flex justify-center gap-4 mb-4 print-hidden">
                <Button onClick={() => router.back()} variant="outline"><ArrowLeft size={16} /> Back</Button>
                <Button onClick={handleDownloadPdf} className="bg-blue-600"><Download size={16} /> PDF</Button>
            </div>
            
            <div ref={invoiceContainerRef}>
                {itemChunks.map((chunk, pageIndex) => (
                    <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-6 my-8 text-[10px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ height: '220mm' }}>
                        <header className="relative">
                            <p className="absolute right-0 top-0 capitalize">{printType}</p>
                            <div className="text-center mb-4">
                                <p className="font-bold text-xs">{invoiceTitle}</p>
                                <p className="font-bold text-xs">{displayInvoiceId}</p>
                            </div>
                            <div className='flex justify-between items-start mt-2'>
                                <div className='w-[45%] font-bold'>{customer.name}</div>
                                <div className="w-[30%] space-y-0">
                                    <p>Sales Order: {soNumber}</p> 
                                    <p>Order Date: </p>
                                </div>
                            </div>
                            <div className='flex justify-between mt-2 border-b border-black pb-1'>
                                <p>Customer Code:</p>
                                <p>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        <main className='flex-grow mt-2'>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className='border border-black font-normal'>
                                        <th className="p-1 text-left w-[8%] border-r border-black">No.</th>
                                        <th className="p-1 text-left w-[40%] border-r border-black">Item</th>
                                        <th className="p-1 text-center w-[15%] border-r border-black">Quantity Unit</th>
                                        <th className="p-1 text-right w-[17%] border-r border-black">Price</th>
                                        <th className="p-1 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, idx) => (
                                        <tr key={item.id} className='align-top'>
                                            <td className="p-1 h-[18px]">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td className="p-1">{item.name}</td>
                                            <td className="p-1 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="p-1 text-right">{formatCurrency(item.price)}</td>
                                            <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        
                        {pageIndex === totalPages - 1 && (
                            <footer className="mt-auto">
                                <div className="flex justify-end border-t border-black pt-1">
                                    <p className="text-right">{formatCurrency(subTotalItems)}</p>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <div className='w-1/2 space-y-0.5'>
                                        {negotiation > 0 && <p>A/Negotiation: ({formatCurrency(negotiation)})</p>}
                                        {dpValue > 0 && <p>DP: {formatCurrency(dpValue)}</p>}
                                        <p>No PO: {poNumber}</p>
                                    </div>
                                    <div className="w-1/2 text-right">
                                        {pelunasan > 0 && <p className='font-bold'>Pelunasan: {formatCurrency(pelunasan)}</p>}
                                    </div>
                                </div>
                                <div className="flex justify-end mt-2 pt-1 border-t border-black">
                                    <div className="w-1/2 grid grid-cols-2 gap-x-2">
                                        <span className="text-right">Goods:</span><span className="text-right">{formatCurrency(grandTotal)}</span>
                                        <span className="text-right">DPP VAT (11/12):</span><span className="text-right">{formatCurrency(dppVat)}</span>
                                        <span className="text-right">VAT 12%:</span><span className="text-right">{formatCurrency(vat12)}</span>
                                        <span className="text-right font-bold">Total Rp:</span><span className="text-right font-bold">{formatCurrency(totalRp)}</span>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-black pt-2 flex">
                                    <div className="w-[60%] text-[9px] space-y-1">
                                        <p>Payment: {paymentTerms}</p>
                                        <p>Please state with your payment: <strong>{displayInvoiceId}</strong></p>
                                        <p className="mt-1">For payment, please transfer to our account:</p>
                                        <p className="font-bold">PT. Jembo Cable Company Tbk</p>
                                        {hasVa ? (
                                            <div className="space-y-0.5">
                                                {virtualAccounts.map((va, i) => (
                                                    <p key={i}>Bank {va.bankName} - VA No. : {va.vaNumber}</p>
                                                ))}
                                                <div className="h-[30px]" /> {/* Keep height consistent if few VAs */}
                                            </div>
                                        ) : (
                                            <div className="space-y-0.5">
                                                <p>Bank Mandiri - A/C No. : 102-0100206827 (Rp)</p>
                                                <p>Jakarta Cabang - A/C No. : 102-0005000218 (Rp)</p>
                                                <p>Sudirman - A/C No. : 102-0005000226 (USD)</p>
                                                <p>Bank BCA - Jakarta KEM TOWER A/C No. : 684-0198977 (Rp)</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-[40%] flex flex-col justify-between text-center pt-8">
                                        <p className="font-bold">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className='border-b border-black w-32 mx-auto mt-12'></div>
                                        <p className="font-bold">Finance</p>
                                    </div>
                                </div>
                            </footer>
                        )}
                        <div className="text-center text-gray-400 text-[8px] mt-2">Halaman {pageIndex + 1} dari {totalPages}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;
