'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';

// --- DEFINISI TIPE DATA ---
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
    customerCode?: string;
    customerName?: string;
    date: string; 
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
    printType: 'Original' | 'Copy';
    negotiation?: number;
    dpPercent?: number | string;
    dpValue?: number;
    pelunasan?: number;
    discount?: number;
}

// --- FUNGSI UTILITY ---
const formatCurrency = (amount: any): string => {
    if (amount === undefined || amount === null) return '0,00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 15;

export const InvoiceTemplate = ({ invoiceData, type }: { invoiceData: InvoiceData, type: 'Original' | 'Copy' }) => {
    const {
        id: invoiceId,
        items = [],
        customer,
        date,
        soNumber,
        poNumber,
        grandTotal,
        dppVat,
        vat12,
        paymentTerms,
        totalRp,
        customerCode = '-',
        dpValue = 0,
        dpPercent = 0
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const subTotalItems = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    const totalPages = itemChunks.length;

    return (
        <>
            {itemChunks.map((chunk, pageIndex) => {
                const isLastPage = pageIndex === totalPages - 1;
                return (
                    <div 
                        key={pageIndex}
                        className="relative bg-white mx-auto flex flex-col font-sans text-black overflow-hidden"
                        style={{ 
                            width: '210mm', 
                            minHeight: '296mm', 
                            padding: '12mm 15mm',
                            fontSize: '9pt',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div className="absolute right-6 top-6 text-[10pt] text-slate-400 uppercase italic">{type}</div>

                        {/* HEADER SECTION */}
                        <header className="relative mt-8">
                            <div className="w-full text-center mb-6">
                                <h1 className="font-bold uppercase text-[13pt] leading-tight mb-0.5">{invoiceTitle}</h1>
                                <p className="font-bold text-[11pt]">{displayInvoiceId}</p>
                            </div>
                            
                            <div className='flex justify-between items-start mb-2'>
                                <div className='w-[60%]'>
                                    <h2 className="font-bold text-[10pt] uppercase mb-0.5">{invoiceData.customerName || customer.name}</h2>
                                    <p className="text-[9pt] leading-tight max-w-sm whitespace-pre-wrap">{customer.address}</p>
                                </div>
                                <div className="w-[30%] text-[8.5pt] leading-tight">
                                    <div className="grid grid-cols-[80px_5px_1fr] gap-y-0.5">
                                        <span>Sales Order</span><span>:</span><span>{soNumber}</span>
                                        <span>Order Date</span><span>:</span><span>{formatDate(date)}</span>
                                        <span>Reference A</span><span>:</span><span>-</span>
                                    </div>
                                </div>
                            </div>

                            <div className='flex justify-between text-[8.5pt] py-1 uppercase'>
                                <p className='m-0'>Customer Code : {customerCode}</p>
                                <p className='m-0'>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        {/* TABLE SECTION */}
                        <main className='relative flex-1'>
                            <table className="w-full border-collapse text-[8.5pt]">
                                <thead>
                                    <tr className='border-y-[1.5pt] border-black'>
                                        <th className="py-1.5 px-2 text-left w-[5%] font-bold">NO.</th>
                                        <th className="py-1.5 px-2 text-left w-[45%] font-bold">ITEM DESCRIPTION</th>
                                        <th className="py-1.5 px-2 text-center w-[15%] font-bold">QUANTITY UNIT</th>
                                        <th className="py-1.5 px-2 text-right w-[15%] font-bold">UNIT PRICE</th>
                                        <th className="py-1.5 px-2 text-right w-[20%] font-bold">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={itemIdx} className='align-top'>
                                            <td className="py-1 px-2">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="py-1 px-2 uppercase font-medium">{item.name}</td>
                                            <td className="py-1 px-2 text-center">{item.quantity?.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    
                                    {isLastPage && (
                                        <>
                                            <tr>
                                                <td colSpan={5} style={{ height: '8cm' }}></td>
                                            </tr>

                                            {/* SUB-TOTAL ITEM */}
                                            <tr>
                                                <td colSpan={3}></td>
                                                <td className="py-1 px-2 text-left"></td>
                                                <td className="py-1 px-2 text-right border-t border-black">
                                                    {formatCurrency(subTotalItems)}
                                                </td>
                                            </tr>

                                            {/* DP / RETENSI */}
                                            {dpValue > 0 && (
                                                <tr>
                                                    <td colSpan={3}></td>
                                                    <td className="py-1 px-2 text-left flex justify-between">
                                                        <span>DP</span>
                                                        <span>{dpPercent}%</span>
                                                    </td>
                                                    <td className="py-1 px-2 text-right">
                                                        {formatCurrency(dpValue)}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* DISKON */}
                                            {invoiceData.discount && invoiceData.discount > 0 && (
                                                <tr>
                                                    <td colSpan={3}></td>
                                                    <td className="py-1 px-2 text-left">Diskon</td>
                                                    <td className="py-1 px-2 text-right">
                                                        - {formatCurrency(invoiceData.discount)}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                            {isLastPage && (
                                <div className="mt-20 mb-1 px-2">
                                    <p className="font-bold text-[9pt]">NO PO : {poNumber}</p>
                                </div>
                            )}
                        </main>

                        {/* FOOTER SECTION */}
                        {isLastPage && (
                            <footer className="mt-auto pt-2">
                                <div className="flex justify-between items-start border-y-[1.5pt] border-black py-1 mb-1">
                                    <div className="w-[50%]"></div>
                                    <div className="w-[35%] text-[8.5pt] leading-tight">
                                        <div className="flex justify-between">
                                            <span>Goods :</span>
                                            <span>{formatCurrency(grandTotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>DPP VAT (11/12) :</span>
                                            <span>{formatCurrency(dppVat)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>VAT 12 % :</span>
                                            <span>{formatCurrency(vat12)}</span>
                                        </div>
                                        <div className="flex justify-between font-black">
                                            <span>Total Rp :</span>
                                            <span>{formatCurrency(totalRp)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start mt-1">
                                    <div className="w-[65%] text-[8.5pt] leading-normal space-y-1">
                                        <div className="flex mb-1">
                                            <span className="w-[65px] font-bold">Payment:</span>
                                            <span>{paymentTerms}</span>
                                        </div>

                                        <div className="flex flex-col"> 
                                            <p className="font-bold m-0 leading-tight">
                                                Please state with your payment: {displayInvoiceId}
                                            </p>
                                            <p className="font-bold m-0 leading-tight">
                                                For payment, please transfer to our account:
                                            </p>
                                            <p className="font-bold uppercase m-0 leading-tight">
                                                PT. Jembo Cable Company Tbk
                                            </p>
                                        </div>
                                        
                                        <div className="mt-2 space-y-0.5">
                                            <div className="flex items-start">
                                                <span className="w-[100px] font-bold">Bank Mandiri -</span>
                                                <span>A/C No. : 102-0100206827 (Rp)</span>
                                            </div>
                                            <div className="flex items-start">
                                                <span className="w-[100px]">Cabang</span>
                                                <span>A/C No. : 102-0005000218 (Rp)</span>
                                            </div>
                                            <div className="flex items-start">
                                                <span className="w-[100px]">Jakarta</span>
                                                <span>A/C No. : 102-0005000226 (USD)</span>
                                            </div>
                                        </div>

                                        <div className="w-[280px] text-center font-bold text-[8pt] py-1">OR</div>

                                        <div className="flex items-start space-x-0">
                                            <div className="w-[100px] font-bold leading-[1.2]">
                                                Bank BCA - Jakarta<br/>
                                                <span className="font-normal text-[7.5pt]">Cabang KEM TOWER</span>
                                            </div>
                                            <div className="pt-0.5">A/C No. : 684-0198977 (Rp)</div>
                                        </div>
                                    </div>

                                    <div className="w-[35%] flex flex-col items-center self-stretch justify-between py-1">
                                        <p className="font-bold text-[9pt] text-center">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="mt-auto flex flex-col items-center">
                                            <div className="mt-16 border-t-[1.5pt] border-black w-[160px]"></div>
                                            <p className="font-bold uppercase pt-1 text-[9pt]">Finance</p>
                                        </div>
                                    </div>
                                </div>
                            </footer>
                        )}
                        <div className="text-center text-slate-300 text-[7pt] mt-auto pb-2 print:hidden">
                            Halaman {pageIndex + 1} dari {totalPages}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default function InvoicePreviewPage() {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const router = useRouter();

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsed = JSON.parse(dataFromSession);
            setInvoiceData({
                ...parsed,
                items: parsed.items || [],
                customer: parsed.customer || { name: 'N/A', address: 'N/A' },
            });
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        
        const opt = {
            margin: 0,
            filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'avoid-all'] }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!invoiceData) return <div className="p-10 text-center">Loading Data...</div>;

    return (
        <div className="bg-slate-100 min-h-screen py-10 px-4 font-sans text-black">
            <style>{`
                @media screen {
                    .invoice-page {
                        background: white;
                        box-shadow: 0 0 20px rgba(0,0,0,0.1);
                        margin-bottom: 0px;
                    }
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
                .invoice-print-wrapper { background: white; }
            `}</style>
            
            <div className="fixed top-6 right-6 z-50 flex gap-3 no-print">
                <button onClick={() => router.back()} className="px-6 py-2 bg-white border rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all">Kembali</button>
                <button onClick={handleDownloadPdf} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all">SIMPAN PDF</button>
                <button onClick={() => window.print()} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-[10px] tracking-widest shadow-lg hover:bg-slate-900 transition-all">CETAK</button>
            </div>
            
            <div ref={invoiceContainerRef} className="mx-auto invoice-print-wrapper" style={{ width: '210mm' }}>
                <div className="invoice-page">
                    <InvoiceTemplate invoiceData={invoiceData} type="Original" />
                </div>
                <div className="invoice-page">
                    <InvoiceTemplate invoiceData={invoiceData} type="Copy" />
                </div>
            </div>
        </div>
    );
}
