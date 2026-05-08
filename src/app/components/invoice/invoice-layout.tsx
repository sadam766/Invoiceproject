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
    date: string; // YYYY-MM-DD
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
}

// --- UTILITY FUNCTIONS ---
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
    if (!dateString || isNaN(new Date(dateString).getTime())) {
        return '';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 10;

// --- REUSABLE TEMPLATE COMPONENT ---
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
        dpPercent = 0,
        pelunasan = 0
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
                            height: '297mm', 
                            paddingTop: '50mm', // Margin for physical letterhead
                            paddingBottom: '15mm',
                            paddingLeft: '15mm',
                            paddingRight: '15mm',
                            color: '#000000', 
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            boxSizing: 'border-box',
                            fontSize: '10pt'
                        }}
                    >
                        {/* TYPE INDICATOR */}
                        <p className="absolute right-12 top-10 text-[10pt] uppercase text-slate-300 font-normal">{printType}</p>

                        {/* CENTERED HEADER */}
                        <header className="relative mb-6">
                            <div className="w-full text-center mb-8">
                                <h1 className="font-bold uppercase text-[14pt] leading-tight mb-1">{invoiceTitle}</h1>
                                <p className="font-bold text-[12pt]">{displayInvoiceId}</p>
                            </div>
                            
                            <div className='flex justify-between items-start'>
                                <div className='w-[55%]'>
                                    <h2 className="font-bold text-[11pt] uppercase mb-1">{customer.name}</h2>
                                    <p className="text-[9pt] leading-tight opacity-90 max-w-sm">{customer.address}</p>
                                </div>
                                <div className="w-[35%] text-[9pt] text-left leading-normal space-y-0.5">
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{soNumber}</span></div>
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Order Date</span><span>:</span><span>{formatDate(date)}</span></div>
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Reference A</span><span>:</span><span>-</span></div>
                                </div>
                            </div>

                            <div className='flex justify-between text-[9pt] mt-6 py-2 border-t border-slate-200 uppercase'>
                                <p className='mb-0'>Customer Code : {customerCode}</p>
                                <p className='mb-0'>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        {/* CLEAN TABLE (NO VERTICAL BORDERS) */}
                        <main className='flex-grow'>
                            <table className="w-full border-collapse text-[9pt]">
                                <thead>
                                    <tr className='border-y-2 border-black bg-gray-100'>
                                        <th className="py-2 px-3 text-left w-[6%] font-bold uppercase">No.</th>
                                        <th className="py-2 px-3 text-left w-[45%] font-bold uppercase">Item Description</th>
                                        <th className="py-2 px-3 text-center w-[18%] font-bold uppercase">Quantity Unit</th>
                                        <th className="py-2 px-3 text-right w-[15%] font-bold uppercase">Unit Price</th>
                                        <th className="py-2 px-3 text-right w-[16%] font-bold uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={item.id} className='align-top'>
                                            <td className="py-2 px-3">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="py-2 px-3 uppercase">{item.name}</td>
                                            <td className="py-2 px-3 text-center">{item.quantity?.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="py-2 px-3 text-right">{formatCurrency(item.price)}</td>
                                            <td className="py-2 px-3 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {isLastPage && (
                                <div className="flex justify-end mt-2">
                                    <div className="text-right w-[16%] pr-3 border-t border-black pt-1">
                                        <p className="font-normal text-[9pt]">{formatCurrency(subTotalItems)}</p>
                                    </div>
                                </div>
                            )}
                        </main>
                        
                        {/* FOOTER - ONLY ON LAST PAGE */}
                        {isLastPage ? (
                            <footer className="mt-auto pt-4">
                                <div className="flex justify-between items-start leading-tight mb-4">
                                    <div className='w-1/2 text-[9pt] space-y-1 pl-2'>
                                        {negotiation > 0 && (
                                            <div className='flex gap-2'>
                                                <p>A/Negotiation :</p>
                                                <p>({formatCurrency(negotiation)})</p> 
                                            </div>
                                        )}
                                        {dpValue > 0 && (
                                            <div className='flex gap-2'>
                                                <p>Down Payment ({dpPercent}%) :</p>
                                                <p>({formatCurrency(dpValue)})</p>
                                            </div>
                                        )}
                                        {pelunasan > 0 && (
                                            <div className='flex gap-2 font-bold mt-2'>
                                                <p>Pelunasan :</p>
                                                <p>{formatCurrency(pelunasan)}</p>
                                            </div>
                                        )}
                                        <div className="pt-2">
                                            <p className="font-bold text-[9pt] uppercase">No PO : {poNumber}</p>
                                        </div>
                                    </div>

                                    {/* CALCULATIONS SECTION */}
                                    <div className="w-[38%] space-y-0.5 text-[9pt] border-t-2 border-black pt-2">
                                        <div className="flex justify-between"><span>Goods:</span><span>{formatCurrency(grandTotal)}</span></div>
                                        <div className="flex justify-between"><span>DPP VAT (11/12):</span><span>{formatCurrency(dppVat)}</span></div>
                                        <div className="flex justify-between"><span>VAT 12%:</span><span>{formatCurrency(vat12)}</span></div>
                                        <div className="flex justify-between pt-1 font-bold text-[11pt] uppercase mt-1 border-y-2 border-black py-1">
                                            <span>Total Rp:</span><span>{formatCurrency(totalRp)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end pb-2">
                                    {/* BANK INFORMATION */}
                                    <div className="w-[65%] space-y-3 text-[8pt] leading-tight"> 
                                        <div className="space-y-0.5">
                                            <p className="font-bold">Payment Terms: {paymentTerms}</p>
                                            <p className='font-bold uppercase'>Please state with your payment: {displayInvoiceId}</p>
                                            <p className='mt-2'>For payment, please transfer to our account:</p>
                                            <p className="font-bold text-[9pt] uppercase mb-1">PT. JEMBO CABLE COMPANY Tbk</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-1">
                                            <div className="flex items-start"><span className="w-[100px] font-bold">Bank Mandiri -</span><span className="flex-1 text-black font-medium">Jakarta Cabang A/C No.: 102-0100206827 (Rp)</span></div>
                                            <div className="flex items-start"><span className="w-[100px] font-bold">Bank Mandiri -</span><span className="flex-1 text-black font-medium">Jakarta Cabang A/C No.: 102-0005000218 (Rp)</span></div>
                                            <div className="flex items-start"><span className="w-[100px] font-bold">Bank Mandiri -</span><span className="flex-1 text-black font-medium">Jakarta Cabang A/C No.: 102-0005000226 (USD)</span></div>
                                            <div className="flex items-center gap-4 py-0.5"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[7pt] font-black text-slate-300">OR</span><div className="h-px bg-slate-200 flex-1"></div></div>
                                            <div className="flex items-start">
                                                <div className="w-[100px] font-bold">Bank BCA -<br/>Jakarta</div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-black">A/C No.: 684-0198977 (Rp)</p>
                                                    <p className="text-[7pt] italic opacity-70">Cabang KEM TOWER</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* SIGNATURE AREA */}
                                    <div className="w-[30%] text-center flex flex-col justify-between" style={{ minHeight: '140px' }}>
                                        <p className="font-bold text-[9pt] uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="mt-auto">
                                            <p className="font-bold uppercase text-[10pt] underline underline-offset-8 decoration-2">Finance</p>
                                        </div>
                                    </div>
                                </div>
                            </footer>
                        ) : null}
                        
                        <div className="text-center text-slate-300 text-[8px] mt-auto pt-2 print:hidden">
                            Halaman {pageIndex + 1} dari {totalPages}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

// --- PREVIEW PAGE ---
export default function InvoicePreviewPage() {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        try {
            const dataFromSession = sessionStorage.getItem('invoicePreviewData');
            if (dataFromSession) {
                const parsedData = JSON.parse(dataFromSession);
                const items = (parsedData.items || []).map((item: any) => ({
                    id: item.id?.toString() ?? Math.random().toString(36).substr(2,9),
                    name: item.name ?? item.item ?? 'N/A',
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit ?? 'Pcs',
                    price: Number(item.price) || 0,
                    total: Number(item.total ?? (item.quantity * item.price)) || 0,
                }));

                const gTotal = items.reduce((s: number, i: any) => s + i.total, 0);
                const dpp = Math.round(gTotal * (11/12));
                const vat = Math.round(dpp * 0.12);

                setInvoiceData({
                    id: parsedData.id || 'N/A',
                    items: items,
                    customer: {
                        name: parsedData.customer?.name ?? 'N/A',
                        address: parsedData.customer?.address ?? parsedData.billingAddress ?? 'N/A',
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
                    printType: parsedData.printType || 'original',
                    negotiation: Number(parsedData.negotiation) || 0,
                    dpPercent: parsedData.dpPercent || 0,
                    dpValue: Number(parsedData.dpValue) || 0,
                    pelunasan: Number(parsedData.pelunasan) || 0,
                });
            }
        } catch (error) {
            console.error("Failed to load invoice data:", error);
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        const opt = {
          margin: [0, 0, 0, 0],
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!invoiceData) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Loading Precision Engine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans text-black animate-in fade-in duration-500">
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .page-break { page-break-before: always; }
                    .print-container { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
                    .print-hidden { display: none !important; }
                }
            `}</style>
            
            <div className="fixed top-6 right-6 z-50 flex gap-3 print:hidden">
                <button onClick={() => router.back()} className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 shadow-md font-bold text-sm">
                    <ArrowLeft size={18} /> Kembali
                </button>
                <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl font-black uppercase text-[10px] tracking-widest">
                    Simpan PDF
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-10 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black shadow-xl font-black uppercase text-[10px] tracking-widest">
                    Cetak Invoice
                </button>
            </div>
            
            <div ref={invoiceContainerRef} className="print-container">
                <InvoiceTemplate invoiceData={invoiceData} />
                
                {/* Visual Divider Only on screen */}
                <div className="my-10 border-b-2 border-dashed border-slate-300 print:hidden text-center">
                    <span className="bg-slate-100 px-2 text-slate-400 text-xs uppercase tracking-widest italic">Pemisah Lembar (Batas A4)</span>
                </div>

                {/* COPY VERSION */}
                <InvoiceTemplate invoiceData={{...invoiceData, printType: 'copy'}} />
            </div>
        </div>
    );
}
