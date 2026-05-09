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

const InvoiceTemplate = ({ invoiceData, type }: { invoiceData: InvoiceData, type: 'Original' | 'Copy' }) => {
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
        customerCode,
        dpValue = 0,
        dpPercent = 0
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const subTotalItems = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <div 
            className="relative bg-white mx-auto flex flex-col font-sans text-black"
            style={{ 
                width: '210mm', 
                minHeight: '296.5mm', // Presisi A4 agar tidak spill ke hal berikutnya
                padding: '12mm 15mm',
                fontSize: '9pt',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            {/* HEADER */}
            <header className="relative mb-4">
                <div className="text-center w-full mb-1">
                    <h1 className="font-bold text-[11pt] uppercase">{invoiceTitle}</h1>
                    <p className="font-bold text-[11pt]">{displayInvoiceId}</p>
                </div>
                <div className="absolute right-0 top-0 text-[10pt] text-slate-400 uppercase italic">{type}</div>
                
                <div className="flex justify-between items-start mt-6 mb-2">
                    <div className="w-[60%]">
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

                <div className='flex justify-between text-[8.5pt] py-1 uppercase border-t border-black'>
                    <p className='m-0'>Customer Code : {customerCode || '-'}</p>
                    <p className='m-0'>Date: {formatDate(date)}</p>
                </div>
            </header>

            {/* TABLE */}
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
                        {items.map((item, idx) => (
                            <tr key={idx} className='align-top'>
                                <td className="py-1 px-2">{idx + 1}</td>
                                <td className="py-1 px-2 uppercase font-medium">{item.name}</td>
                                <td className="py-1 px-2 text-center">{item.quantity?.toLocaleString('id-ID')} {item.unit}</td>
                                <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                                <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                        
                        {/* PENGATUR JARAK DINAMIS AGAR FOOTER DI BAWAH */}
                        <tr>
                            <td colSpan={5} style={{ height: '7cm' }}></td>
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
                    </tbody>
                </table>
                
                <div className="mt-16 mb-1 px-2">
                    <p className="font-bold text-[9pt]">NO PO : {poNumber}</p>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="mt-auto">
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
                            <p className="font-bold m-0 leading-tight">Please state with your payment: {displayInvoiceId}</p>
                            <p className="font-bold m-0 leading-tight">For payment, please transfer to our account:</p>
                            <p className="font-bold uppercase m-0 leading-tight">PT. Jembo Cable Company Tbk</p>
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
                            <div className="mt-28 border-t-[1.5pt] border-black w-[160px]"></div>
                            <p className="font-bold uppercase pt-1 text-[9pt]">Finance</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default function InvoicePreviewPage() {
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
            pagebreak: { mode: ['css', 'avoid-all'], before: '.page-wrapper' }
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
                        margin-bottom: 40px;
                    }
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .page-wrapper { page-break-after: always !important; }
                    .page-wrapper:last-child { page-break-after: avoid !important; }
                }
                .invoice-print-wrapper { background: white; }
            `}</style>
            
            <div className="fixed top-6 right-6 z-50 flex gap-3 no-print">
                <button onClick={() => router.back()} className="px-6 py-2 bg-white border rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all">Kembali</button>
                <button onClick={handleDownloadPdf} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all">SIMPAN PDF</button>
            </div>
            
            <div ref={invoiceContainerRef} className="mx-auto invoice-print-wrapper" style={{ width: '210mm' }}>
                {/* LEMBAR ORIGINAL */}
                <div className="page-wrapper invoice-page">
                    <InvoiceTemplate invoiceData={invoiceData} type="Original" />
                </div>
                
                {/* LEMBAR COPY (Identik, naik ke atas karena pemisah dihapus) */}
                <div className="page-wrapper invoice-page">
                    <InvoiceTemplate invoiceData={invoiceData} type="Copy" />
                </div>
            </div>
        </div>
    );
}
