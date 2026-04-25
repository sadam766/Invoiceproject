'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 22; // Adjusted for professional spacing

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
                customer: { 
                    name: parsed.customer?.name || 'N/A', 
                    address: parsed.customer?.address || 'N/A' 
                },
                // Ensure calculations follow standard
                totalRp: parsed.amount || (parsed.grandTotal || 0) + (parsed.vat12 || 0),
                paymentTerms: parsed.paymentTerms || '90 Hari setelah invoice diterima',
                printType: parsed.printType || 'original',
            });
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        const opt = {
          margin: [5, 5, 5, 5],
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!invoiceData) return <div className="p-8">Loading...</div>;

    const { 
        id: invoiceId, items, customer, date, soNumber, poNumber, 
        grandTotal, dppVat, vat12, paymentTerms, totalRp, printType, 
        negotiation, dpValue, pelunasan, virtualAccounts 
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) => items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE));
    const totalPages = itemChunks.length;
    const subTotalItems = items.reduce((acc, item) => acc + item.total, 0);
    const invoiceTitle = invoiceId.toUpperCase().startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    const hasVa = virtualAccounts && virtualAccounts.length > 0;

    return (
        <div className="bg-gray-200 dark:bg-slate-900 min-h-screen p-4 sm:p-8 font-sans text-black overflow-y-auto">
            <style>{`
                @media print { 
                    .page-break { page-break-before: always; } 
                    .print-hidden { display: none !important; } 
                    body { background: white; }
                }
                .invoice-page {
                    width: 210mm;
                    height: 297mm;
                    margin: 0 auto;
                    background: white;
                    padding: 15mm;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                }
            `}</style>
            
            <div className="flex justify-center gap-4 mb-6 print-hidden">
                <Button onClick={() => router.back()} variant="outline"><ArrowLeft size={16} className="mr-2" /> Back</Button>
                <Button onClick={handleDownloadPdf} className="bg-blue-600 hover:bg-blue-700 text-white"><Download size={16} className="mr-2" /> Download PDF</Button>
            </div>
            
            <div ref={invoiceContainerRef} className="space-y-8">
                {itemChunks.map((chunk, pageIndex) => (
                    <div key={pageIndex} className={`invoice-page ${pageIndex > 0 ? 'page-break' : ''}`}>
                        {/* Header Section */}
                        <header className="relative mb-6">
                            <p className="absolute right-0 top-0 capitalize font-medium text-xs">{printType}</p>
                            <div className="text-center mb-8">
                                <h1 className="font-bold text-sm underline underline-offset-4">{invoiceTitle}</h1>
                                <p className="font-bold text-sm mt-1">{displayInvoiceId}</p>
                            </div>

                            <div className="flex justify-between items-start text-[10px]">
                                <div className="w-[45%]">
                                    <p className="font-bold text-sm mb-1">{customer.name}</p>
                                    <p className="leading-tight text-gray-700">{customer.address}</p>
                                </div>
                                <div className="w-[35%] space-y-1">
                                    <div className="flex justify-between"><span>Sales Order:</span> <span className="font-medium">{soNumber}</span></div>
                                    <div className="flex justify-between"><span>Order Date:</span> <span className="font-medium"></span></div>
                                    <div className="flex justify-between"><span>Reference:</span> <span className="font-medium"></span></div>
                                </div>
                            </div>

                            <div className="flex justify-between mt-4 border-b border-black pb-1 text-[10px]">
                                <p>Customer Code: </p>
                                <p>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        {/* Table Section */}
                        <main className="flex-grow">
                            <table className="w-full border-collapse text-[10px]">
                                <thead>
                                    <tr className="border border-black font-semibold text-center">
                                        <th className="p-1 w-[8%] border-r border-black">No.</th>
                                        <th className="p-1 w-[42%] border-r border-black">Item</th>
                                        <th className="p-1 w-[15%] border-r border-black">Quantity Unit</th>
                                        <th className="p-1 w-[17%] border-r border-black">Price</th>
                                        <th className="p-1 w-[18%]">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, idx) => (
                                        <tr key={item.id} className="align-top border-x border-black">
                                            <td className="p-1 text-center border-r border-black h-[22px]">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td className="p-1 border-r border-black">{item.name}</td>
                                            <td className="p-1 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="p-1 text-right border-r border-black">{formatCurrency(item.price)}</td>
                                            <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    {/* Fill empty rows to maintain table height */}
                                    {[...Array(Math.max(0, ITEMS_PER_PAGE - chunk.length))].map((_, i) => (
                                        <tr key={`empty-${i}`} className="border-x border-black">
                                            <td className="p-1 border-r border-black h-[22px]"></td>
                                            <td className="p-1 border-r border-black"></td>
                                            <td className="p-1 border-r border-black"></td>
                                            <td className="p-1 border-r border-black"></td>
                                            <td className="p-1"></td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-black"><td colSpan={5}></td></tr>
                                </tbody>
                            </table>
                        </main>
                        
                        {/* Footer Section - Only on Last Page */}
                        {pageIndex === totalPages - 1 && (
                            <footer className="mt-4 text-[10px]">
                                <div className="flex justify-end border-t border-black pt-1 mb-2">
                                    <p className="font-medium">{formatCurrency(subTotalItems)}</p>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div className="w-[45%] space-y-0.5">
                                        {negotiation > 0 && <p className="italic text-gray-600">A/Negotiation: ({formatCurrency(negotiation)})</p>}
                                        {dpValue > 0 && <p className="italic text-gray-600">DP: {formatCurrency(dpValue)}</p>}
                                        <p className="mt-2 font-medium">No PO: {poNumber}</p>
                                    </div>
                                    <div className="w-[40%] text-right space-y-1">
                                        {pelunasan > 0 && <p className="font-bold border-b border-black inline-block ml-auto">Pelunasan: {formatCurrency(pelunasan)}</p>}
                                        <div className="grid grid-cols-2 gap-x-2">
                                            <span className="text-right">Goods:</span><span className="text-right">{formatCurrency(grandTotal)}</span>
                                            <span className="text-right">DPP VAT (11/12):</span><span className="text-right">{formatCurrency(dppVat)}</span>
                                            <span className="text-right">VAT 12%:</span><span className="text-right">{formatCurrency(vat12)}</span>
                                            <span className="text-right font-bold text-xs">Total Rp:</span><span className="text-right font-bold text-xs">{formatCurrency(totalRp)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-black pt-3 flex items-start">
                                    <div className="w-[60%] text-[9px] space-y-1 leading-relaxed">
                                        <p>Payment: {paymentTerms}</p>
                                        <p>Please state with your payment: <strong>{displayInvoiceId}</strong></p>
                                        <p className="mt-1">For payment, please transfer to our account:</p>
                                        <p className="font-bold">PT. Jembo Cable Company Tbk</p>
                                        
                                        <div className="mt-1 min-h-[50px]">
                                            {hasVa ? (
                                                <div className="space-y-0.5 text-blue-700 font-bold">
                                                    {virtualAccounts.map((va, i) => (
                                                        <p key={i}>Bank {va.bankName} - VA No. : {va.vaNumber}</p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5 opacity-80">
                                                    <div className="flex gap-4">
                                                        <span>Bank Mandiri - A/C No. : 102-0100206827 (Rp)</span>
                                                        <span>Jakarta Cabang - A/C No. : 102-0005000218 (Rp)</span>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <span>Sudirman - A/C No. : 102-0005000226 (USD)</span>
                                                        <span>Bank BCA - Jakarta KEM TOWER A/C No. : 684-0198977 (Rp)</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="w-[40%] flex flex-col items-center justify-between text-center pt-2">
                                        <p className="font-bold text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="h-16"></div>
                                        <div className="border-b border-black w-32 mb-1"></div>
                                        <p className="font-bold">Finance</p>
                                    </div>
                                </div>
                            </footer>
                        )}
                        <div className="mt-auto pt-4 text-center text-gray-400 text-[8px]">
                            Halaman {pageIndex + 1} dari {totalPages}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;
