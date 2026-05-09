'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';

// --- DATA TYPES ---
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
    date: string; 
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
    printType: 'original' | 'copy';
    negotiation?: number;
    dpValue?: number;
    dpPercent?: number | string;
    pelunasan?: number;
    discount?: number;
}

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

export const InvoiceTemplate = ({ invoiceData }: { invoiceData: InvoiceData }) => {
    if (!invoiceData) return null;

    const {
        id: invoiceId = 'N/A',
        items = [],
        customer = { name: 'N/A', address: 'N/A' },
        customerCode = '-',
        date = '',
        soNumber = '-',
        poNumber = '-',
        grandTotal = 0,
        dppVat = 0,
        vat12 = 0,
        paymentTerms = '-',
        totalRp = 0,
        printType = 'original',
        negotiation = 0,
        dpValue = 0,
        dpPercent = 0
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    const totalPages = itemChunks.length || 1;
    const subTotalItems = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <>
            {itemChunks.map((chunk, pageIndex) => {
                const isLastPage = pageIndex === totalPages - 1;
                return (
                    <div 
                        key={pageIndex} 
                        className={`relative bg-white flex flex-col shadow-none print:shadow-none mx-auto ${pageIndex > 0 ? 'page-break' : ''}`} 
                        style={{ 
                            width: '210mm',
                            height: '296.5mm', // Safety margin to prevent blank page
                            paddingTop: '35mm',
                            paddingBottom: '10mm',
                            paddingLeft: '15mm',
                            paddingRight: '15mm',
                            color: '#000000', 
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            boxSizing: 'border-box',
                            fontSize: '9.5pt',
                            overflow: 'hidden' // Lock content inside
                        }}
                    >
                        {/* TYPE INDICATOR */}
                        <p className="absolute right-12 top-8 text-[9pt] uppercase text-slate-400 font-normal italic">{printType}</p>

                        {/* HEADER SECTION */}
                        <header className="relative">
                            <div className="w-full text-center mb-6">
                                <h1 className="font-bold uppercase text-[13pt] leading-tight mb-0.5">{invoiceTitle}</h1>
                                <p className="font-bold text-[11pt]">{displayInvoiceId}</p>
                            </div>
                            
                            <div className='flex justify-between items-start mb-2'>
                                <div className='w-[60%]'>
                                    <h2 className="font-bold text-[10pt] uppercase mb-0.5">{customer.name}</h2>
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
                        <main className='relative'>
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
                                        <tr key={item.id} className='align-top'>
                                            <td className="py-1 px-2">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="py-1 px-2 uppercase font-medium">{item.name}</td>
                                            <td className="py-1 px-2 text-center">{item.quantity?.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    
                                    {isLastPage && (
                                        <>
                                            {/* BARIS PENGATUR JARAK */}
                                            <tr>
                                                <td colSpan={5} style={{ height: '7.5cm' }}></td>
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
                                <div className="mt-16 mb-1 px-2">
                                    <p className="font-bold text-[9pt]">NO PO : {poNumber}</p>
                                </div>
                            )}
                        </main>

                        {/* FOOTER SECTION */}
                        {isLastPage && (
                            <footer 
                                className="mt-auto pt-2" 
                                style={{ 
                                    pageBreakInside: 'avoid',
                                    breakInside: 'avoid',
                                    display: 'block'
                                }}
                            >
                                {/* SECTION KALKULASI */}
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

                                {/* INFORMASI PEMBAYARAN & TANDA TANGAN */}
                                <div className="flex justify-between items-start mt-1" style={{ breakInside: 'avoid' }}>
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
                                        {/* Detail Bank Mandiri */}
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

                                        {/* Detail Bank BCA */}
                                        <div className="flex items-start space-x-0">
                                            <div className="w-[100px] font-bold leading-[1.2]">
                                                Bank BCA - Jakarta<br/>
                                                <span className="font-normal text-[7.5pt]">Cabang KEM TOWER</span>
                                            </div>
                                            <div className="pt-0.5">A/C No. : 684-0198977 (Rp)</div>
                                        </div>
                                    </div>

                                    {/* Bagian Kanan: Tanda Tangan */}
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
                    </div>
                );
            })}
        </>
    );
};

// --- MAIN PAGE ---
export default function InvoicePreviewPage() {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const router = useRouter();

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            const items = (parsedData.items || []).map((item: any) => ({
                id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
                name: item.name || item.item || 'N/A',
                quantity: Number(item.quantity) || 0,
                unit: item.unit || 'Pcs',
                price: Number(item.price) || 0,
                total: Number(item.total || (item.quantity * item.price)) || 0,
            }));

            const gTotal = items.reduce((s: number, i: any) => s + i.total, 0);
            const dpp = Math.round(gTotal * (11 / 12));
            const vat = Math.round(dpp * 0.12);

            setInvoiceData({
                id: parsedData.id || 'N/A',
                items: items,
                customer: {
                    name: parsedData.customer?.name || 'N/A',
                    address: parsedData.customer?.address || parsedData.billingAddress || 'N/A',
                },
                customerCode: parsedData.customer?.customerCode || parsedData.customerCode || '-',
                date: parsedData.date || new Date().toISOString(),
                soNumber: parsedData.soNumber || '-',
                poNumber: parsedData.poNumber || '-',
                grandTotal: gTotal,
                dppVat: dpp,
                vat12: vat,
                totalRp: dpp + vat,
                paymentTerms: parsedData.paymentTerms || '90 Hari setelah invoice diterima',
                printType: 'original',
                discount: Number(parsedData.discount) || 0,
                dpValue: Number(parsedData.dpValue) || 0,
                dpPercent: parsedData.dpPercent || 0
            });
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        
        const opt = {
            margin: 0,
            filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
            pagebreak: { mode: ['css', 'avoid-all'], before: '.page-wrapper' },
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                letterRendering: true 
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
    
        html2pdf().from(element).set(opt).save();
    };

    if (!invoiceData) return <div className="p-10 text-center">Loading Data...</div>;

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans text-black">
            <style>{`
                @media screen {
                    .pdf-page {
                        background: white;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        margin: 0 auto;
                        width: 210mm;
                        min-height: 297mm;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                    }
                    .page-wrapper { margin-bottom: 0px; }
                }
                
                @media print {
                    .no-print { display: none !important; }
                    .page-wrapper { page-break-before: always !important; }
                    .page-wrapper:first-child { page-break-before: avoid !important; }
                }

                .invoice-print-wrapper {
                    background: white;
                }
            `}</style>
            
            <div className="fixed top-6 right-6 z-50 flex gap-3 no-print">
                <button onClick={() => router.back()} className="px-6 py-2 bg-white border rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all">Kembali</button>
                <button onClick={handleDownloadPdf} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all">SIMPAN PDF</button>
            </div>
            
            {/* CONTAINER UTAMA PDF */}
            <div ref={invoiceContainerRef} className="mx-auto invoice-print-wrapper">
                {/* HALAMAN ORIGINAL */}
                <div className="page-wrapper">
                    <InvoiceTemplate invoiceData={{...invoiceData, printType: 'original'}} />
                </div>
                
                {/* HALAMAN COPY (TIDAK ADA PEMISAH VISUAL) */}
                <div className="page-wrapper">
                    <InvoiceTemplate invoiceData={{...invoiceData, printType: 'copy'}} />
                </div>
            </div>
        </div>
    );
}
