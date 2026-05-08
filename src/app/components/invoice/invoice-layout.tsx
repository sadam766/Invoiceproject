'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, ArrowLeft } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
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
    date: string; // YYYY-MM-DD
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
    printType: 'original' | 'copy';
    negotiation: number;
    dpPercent: number | string;
    dpValue: number;
    dpPelunasanPercent: number | string;
    pelunasan: number;
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
export const InvoiceTemplate = ({ invoiceData }: { invoiceData: any }) => {
    if (!invoiceData) return null;

    const {
        id: invoiceId = 'N/A',
        items = [],
        customer = { name: 'N/A', address: 'N/A' },
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
    const subTotalItems = items.reduce((acc: number, item: any) => acc + (Number(item.total) || 0), 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <>
            {itemChunks.length === 0 ? (
                <div className="w-full max-w-4xl mx-auto bg-white p-12 text-center text-slate-400 uppercase font-black text-[10px]">No Items to Display</div>
            ) : itemChunks.map((chunk, pageIndex) => {
                const isLastPage = pageIndex === totalPages - 1;
                return (
                    <div 
                        key={pageIndex} 
                        className={`w-full max-w-4xl mx-auto bg-white p-12 flex flex-col shadow-none ${pageIndex > 0 ? 'page-break' : ''}`} 
                        style={{ 
                            width: '210mm',
                            height: '297mm', 
                            paddingTop: '50mm', // FOR KOP SURAT FISIK
                            color: '#000', 
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* TYPE INDICATOR */}
                        <p className="text-right text-[10pt] uppercase text-slate-400 font-normal mb-2">{printType}</p>

                        {/* HEADER */}
                        <header className="relative mb-6">
                            <div className="w-full text-center mb-6">
                                <p className="font-bold uppercase text-[16pt] tracking-tight mb-1">{invoiceTitle}</p>
                                <p className="font-bold text-[13pt]">{displayInvoiceId}</p>
                            </div>
                            
                            <div className='flex justify-between items-start'>
                                <div className='w-[50%]'>
                                    <p className="font-bold text-[11pt] uppercase mb-1">{customer.name}</p>
                                    <p className="text-[10pt] leading-tight opacity-80">{customer.address}</p>
                                </div>
                                <div className="w-[38%] text-[10pt] text-left leading-normal space-y-0.5">
                                    <div className="grid grid-cols-[100px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{soNumber}</span></div>
                                    <div className="grid grid-cols-[100px_5px_1fr]"><span>Order Date</span><span>:</span><span>{formatDate(date)}</span></div>
                                    <div className="grid grid-cols-[100px_5px_1fr]"><span>Reference A</span><span>:</span><span>-</span></div>
                                </div>
                            </div>

                            <div className='flex justify-between text-[10pt] mt-6 py-2 border-t-2 border-black uppercase'>
                                <p className='mb-0'>Customer Code : {customer.name?.substring(0,3).toUpperCase() || '-'}</p>
                                <p className='mb-0'>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        {/* TABLE */}
                        <main className='flex-grow'>
                            <table className="w-full border-collapse text-[10pt]">
                                <thead>
                                    <tr className='border-y-2 border-black'>
                                        <th className="py-2 px-1 text-left w-[8%] font-bold uppercase">No.</th>
                                        <th className="py-2 px-1 text-left w-[40%] font-bold uppercase">Item Description</th>
                                        <th className="py-2 px-1 text-center w-[18%] font-bold uppercase">Quantity Unit</th>
                                        <th className="py-2 px-1 text-right w-[17%] font-bold uppercase">Unit Price</th>
                                        <th className="py-2 px-1 text-right flex-1 font-bold uppercase">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item: any, itemIdx: number) => (
                                        <tr key={item.id} className='align-top'>
                                            <td className="py-2 px-1">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="py-2 px-1 uppercase">{item.name}</td>
                                            <td className="py-2 px-1 text-center">{item.quantity?.toLocaleString('id-ID') || '0'} {item.unit}</td>
                                            <td className="py-2 px-1 text-right">{formatCurrency(item.price)}</td>
                                            <td className="py-2 px-1 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    {/* FILL EMPTY ROWS TO KEEP HEIGHT CONSISTENT */}
                                    {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-8"><td colSpan={5}>&nbsp;</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        
                        {/* FOOTER - ONLY ON LAST PAGE */}
                        {isLastPage ? (
                            <footer className="mt-auto">
                                <div className="flex justify-end mb-4">
                                    <div className="text-right w-[18%] pr-1 border-t-2 border-black pt-1">
                                        <p className="font-normal text-[10pt]">{formatCurrency(subTotalItems)}</p>
                                    </div>
                                </div>
                            
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
                                                <p>Down Payment ({dpValue > 0 ? dpPercent : 0}%) :</p>
                                                <p>({formatCurrency(dpValue)})</p>
                                            </div>
                                        )}
                                        {pelunasan > 0 && (
                                            <div className='flex gap-2 font-bold'>
                                                <p>Pelunasan :</p>
                                                <p>{formatCurrency(pelunasan)}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-[35%] space-y-0.5 text-[10pt]">
                                        <div className="flex justify-between"><span>Goods Value:</span><span>{formatCurrency(grandTotal)}</span></div>
                                        <div className="flex justify-between"><span>DPP VAT (11/12):</span><span>{formatCurrency(dppVat)}</span></div>
                                        <div className="flex justify-between border-b border-black pb-1"><span>VAT 12%:</span><span>{formatCurrency(vat12)}</span></div>
                                        <div className="flex justify-between pt-1 font-bold text-[11pt] uppercase"><span>Total Rp:</span><span>{formatCurrency(totalRp)}</span></div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="font-bold text-[10pt] uppercase">No PO : {poNumber}</p>
                                </div>
                                <div className="border-t-2 border-black w-full mb-6"></div>

                                <div className="flex justify-between items-end pb-8">
                                    <div className="w-[65%] space-y-4 text-[9pt]"> 
                                        <div className="space-y-1">
                                            <p className="font-bold">Payment Terms: {paymentTerms}</p>
                                            <p className='font-bold uppercase tracking-tight'>Please state with your payment: {displayInvoiceId}</p>
                                            <p className='mt-4'>For payment, please transfer to our account:</p>
                                            <p className="font-bold text-[10pt] mt-1 uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-0.5">
                                                <p className="font-bold">Bank Mandiri - Jakarta Cabang</p>
                                                <p className="font-bold underline underline-offset-2">102-0100206827 (Rp)</p>
                                                <p className="font-bold">102-0005000218 (Rp)</p>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-bold">Bank BCA - Jakarta</p>
                                                <p className="font-bold underline underline-offset-2">684-0198977 (Rp)</p>
                                                <p className="text-slate-500 italic">Cabang KEM TOWER</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="w-[30%] text-center flex flex-col justify-between" style={{ minHeight: '140px' }}>
                                        <p className="font-bold text-[10pt] uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="mt-auto">
                                            <p className="font-bold uppercase text-[11pt] underline underline-offset-4 decoration-2">Finance</p>
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

// --- PREVIEW PAGE (SESSION STORAGE DRIVEN) ---
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
                const formattedItems = (parsedData.items || []).map((item: any) => ({
                    id: item.id?.toString() ?? Math.random().toString(36).substr(2,9),
                    name: item.name ?? item.item ?? 'N/A',
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit ?? 'Pcs',
                    price: Number(item.price) || 0,
                    total: Number(item.total ?? (item.quantity * item.price)) || 0,
                }));

                setInvoiceData({
                    id: parsedData.id || 'N/A',
                    items: formattedItems,
                    customer: {
                        name: parsedData.customer?.name ?? 'N/A',
                        address: parsedData.customer?.address ?? parsedData.billingAddress ?? 'N/A',
                    },
                    date: parsedData.date || new Date().toISOString(),
                    soNumber: parsedData.soNumber || '-',
                    poNumber: parsedData.poNumber || '-',
                    grandTotal: Number(parsedData.grandTotal) || formattedItems.reduce((s:number, i:any) => s + i.total, 0),
                    dppVat: Number(parsedData.dppVat) || 0,
                    vat12: Number(parsedData.vat12) || 0,
                    totalRp: Number(parsedData.totalRp) || (Number(parsedData.grandTotal) + Number(parsedData.vat12)),
                    paymentTerms: parsedData.paymentTerms || '90 Hari setelah invoice diterima',
                    printType: parsedData.printType || 'original',
                    negotiation: Number(parsedData.negotiation) || 0,
                    dpPercent: parsedData.dpPercent || 0,
                    dpValue: Number(parsedData.dpValue) || 0,
                    dpPelunasanPercent: parsedData.dpPelunasanPercent || 0,
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
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Loading Preview Engine...</p>
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
                    <Download size={18} /> Simpan PDF
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
