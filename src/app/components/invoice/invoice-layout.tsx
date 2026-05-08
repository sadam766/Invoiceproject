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
const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', {
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

// NAMED EXPORT: Digunakan untuk merender struktur invoice
export const InvoiceTemplate = ({ invoiceData }: { invoiceData: InvoiceData }) => {
    if (!invoiceData) return null;

    const {
        id: invoiceId,
        items,
        customer,
        date,
        soNumber,
        poNumber,
        grandTotal,
        dppVat,
        vat12,
        paymentTerms,
        totalRp,
        printType,
        negotiation,
        dpValue,
        dpPercent
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    const totalPages = itemChunks.length;
    const subTotalItems = items.reduce((acc, item) => acc + item.total, 0);
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <>
            {itemChunks.map((chunk, pageIndex) => {
                const isLastPage = pageIndex === totalPages - 1;
                return (
                    <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-8 my-8 text-[10px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ height: '220mm', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                        <header className="relative pt-0 pb-0 text-[10px] leading-snug">
                            <p className="absolute right-0 top-0 font-normal text-sm capitalize text-slate-400">{printType}</p>
                            <div className="w-full text-center mb-1 leading-none">
                                <p className="font-bold uppercase text-xs tracking-tighter mb-0.5">{invoiceTitle}</p>
                                <p className="font-bold uppercase text-xs">{displayInvoiceId}</p>
                            </div>
                            <div className='flex justify-between items-start mt-6'>
                                <div className='w-[45%]'>
                                    <p className="font-bold text-[11pt] mb-0 uppercase">{customer.name}</p>
                                    <p className="text-[10pt] font-normal leading-tight mt-1">{customer.address}</p>
                                </div>
                                <div className="w-[35%] text-[10pt] text-left leading-normal space-y-0.5">
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{soNumber}</span></div>
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Order Date</span><span>:</span><span>{formatDate(date)}</span></div>
                                    <div className="grid grid-cols-[90px_5px_1fr]"><span>Reference A</span><span>:</span><span>-</span></div>
                                </div>
                            </div>
                            <div className='flex justify-between text-[10pt] mt-4 mb-0 w-full py-1 border-t border-slate-200 uppercase'>
                                <p className='mb-0'>Customer Code : {invoiceData.customer?.name?.substring(0,3).toUpperCase() || '-'}</p>
                                <p className='mb-0'>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        <main className='mt-2 flex-grow'>
                            <table className="w-full border-collapse text-[10pt] mt-0">
                                <thead>
                                    <tr className='bg-white border-y-2 border-black'>
                                        <th className="py-2 px-1 text-left w-[8%] font-bold">No.</th>
                                        <th className="py-2 px-1 text-left w-[40%] font-bold">Item Description</th>
                                        <th className="py-2 px-1 text-center w-[15%] font-bold">Quantity Unit</th>
                                        <th className="py-2 px-1 text-right w-[17%] font-bold">Unit Price</th>
                                        <th className="py-2 px-1 text-right flex-1 font-bold">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={item.id} className='align-top border-b border-slate-100'>
                                            <td className="p-1 pt-2">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="p-1 pt-2 uppercase">{item.name}</td>
                                            <td className="p-1 pt-2 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="p-1 pt-2 text-right">{formatCurrency(item.price)}</td>
                                            <td className="p-1 pt-2 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    {!isLastPage && Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                        <tr key={`empty-${i}`}><td className="p-1" colSpan={5}>&nbsp;</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        
                        {isLastPage ? (
                            <footer className="pt-2 text-black mt-auto text-[10pt]">
                                <div className="w-full flex justify-end items-end leading-normal">
                                    <div className="text-right w-[18%] pr-1">
                                        <div className="border-t-2 border-black w-full mb-1"></div>
                                        <p className="font-normal">{formatCurrency(subTotalItems)}</p>
                                    </div>
                                </div>
                            
                                <div className="w-full flex justify-between items-start leading-normal mt-2">
                                    <div className='w-1/2 text-[9pt] space-y-0.5 leading-tight pl-2'>
                                        {negotiation > 0 && (
                                            <div className='flex justify-start space-x-2'>
                                                <p className='mb-0'>A/Negotiation :</p>
                                                <p className='mb-0'>({formatCurrency(negotiation)})</p> 
                                            </div>
                                        )}
                                        {dpValue > 0 && (
                                            <div className='flex justify-start space-x-2'>
                                                <p className='mb-0'>Down Payment ({dpPercent}%) :</p>
                                                <p className='mb-0'>({formatCurrency(dpValue)})</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-1/2 flex flex-col items-end">
                                        <div className="w-[60%] space-y-1">
                                            <div className="flex justify-between"><span className="uppercase">Goods Value:</span><span>{formatCurrency(grandTotal)}</span></div>
                                            <div className="flex justify-between"><span className="uppercase">DPP VAT (11/12):</span><span>{formatCurrency(dppVat)}</span></div>
                                            <div className="flex justify-between border-b border-black pb-1"><span className="uppercase">VAT (PPN 12%):</span><span>{formatCurrency(vat12)}</span></div>
                                            <div className="flex justify-between pt-1 font-bold text-[11pt]"><span className="uppercase">Total Rp:</span><span>{formatCurrency(totalRp)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full flex justify-start items-end mt-4">
                                    <p className="font-bold uppercase">No PO : {poNumber}</p>
                                </div>
                                <div className="border-t-2 border-black w-full my-2"></div>

                                <div className="mt-2">
                                    <div className="flex justify-between items-end pb-4">
                                        <div className="w-[65%] space-y-3"> 
                                            <div className="space-y-1 uppercase font-bold text-[9pt]">
                                                <p className='mb-0'>Please state with your payment:</p>
                                                <p className='mb-0'>For payment, please transfer to our account:</p>
                                                <p className="text-[10pt] mt-2">PT. JEMBO CABLE COMPANY Tbk</p>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 text-[9pt]">
                                                <div className="space-y-0.5">
                                                    <p className="uppercase">Bank Mandiri</p>
                                                    <p className="font-bold">102-0100206827 (Rp)</p>
                                                    <p className="text-slate-500 italic">Jakarta Cabang</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="uppercase">Bank BCA - Jakarta</p>
                                                    <p className="font-bold">684-0198977 (Rp)</p>
                                                    <p className="text-slate-500 italic">Cabang KEM TOWER</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-[30%] text-center">
                                            <p className="font-bold uppercase text-[9pt] mb-24">PT. JEMBO CABLE COMPANY Tbk</p>
                                            <div className='border-b-2 border-black w-full mb-1'></div>
                                            <p className="font-bold uppercase text-[11pt] underline underline-offset-4">Finance</p>
                                        </div>
                                    </div>
                                </div>
                            </footer>
                        ) : null}
                        <div className="text-center text-gray-400 text-[8px] mt-auto pt-2 print:hidden">
                            Halaman {pageIndex + 1} dari {totalPages}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

// COMPONENT UTAMA: Menangani pengambilan data dari sessionStorage untuk pratinjau sebelum simpan
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
                const formattedItems = parsedData.items.map((item: any) => ({
                    id: item.id?.toString() ?? Math.random().toString(36).substr(2,9),
                    name: item.name ?? item.item,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.total ?? (item.quantity * item.price),
                }));

                setInvoiceData({
                    id: parsedData.id,
                    items: formattedItems,
                    customer: {
                        name: parsedData.customer?.name ?? 'N/A',
                        address: parsedData.customer?.address ?? parsedData.billingAddress ?? 'N/A',
                    },
                    date: parsedData.date,
                    soNumber: parsedData.soNumber,
                    poNumber: parsedData.poNumber || '',
                    grandTotal: parsedData.grandTotal || formattedItems.reduce((s:number, i:any) => s + i.total, 0),
                    dppVat: parsedData.dppVat || 0,
                    vat12: parsedData.vat12 || 0,
                    totalRp: parsedData.totalRp || 0,
                    paymentTerms: parsedData.paymentTerms || '90 Hari setelah invoice diterima',
                    printType: parsedData.printType || 'original',
                    negotiation: parsedData.negotiation || 0,
                    dpPercent: parsedData.dpPercent || 0,
                    dpValue: parsedData.dpValue || 0,
                    dpPelunasanPercent: parsedData.dpPelunasanPercent || 0,
                    pelunasan: parsedData.pelunasan || 0,
                });
            }
        } catch (error) {
            console.error("Failed to load invoice data:", error);
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element) return;
        const opt = {
          margin: [0, 0, 0, 0],
          filename: `Invoice-${invoiceData?.id.replace(/\//g, '_')}.pdf`,
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
            </div>
        </div>
    );
}
