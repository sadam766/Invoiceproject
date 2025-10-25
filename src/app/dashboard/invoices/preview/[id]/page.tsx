
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
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

// --- KOMPONEN UTAMA ---
const InvoicePreviewPage = () => {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const dataFromSession = sessionStorage.getItem('invoicePreviewData');
            if (dataFromSession) {
                const parsedData = JSON.parse(dataFromSession);
                const formattedItems = parsedData.items.map((item: any) => ({
                    id: item.id?.toString() ?? '',
                    name: item.name ?? item.item,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.total ?? item.amount,
                }));

                setInvoiceData({
                    id: parsedData.id,
                    items: formattedItems,
                    customer: {
                        name: parsedData.customer?.name ?? 'N/A',
                        address: parsedData.customer?.address ?? 'N/A',
                    },
                    date: parsedData.date,
                    soNumber: parsedData.soNumber,
                    poNumber: parsedData.poNumber || '',
                    grandTotal: parsedData.grandTotal,
                    dppVat: parsedData.dppVat,
                    vat12: parsedData.vat12,
                    totalRp: parsedData.grandTotal + parsedData.vat12,
                    paymentTerms: parsedData.paymentTerms || '90 Hari setelah invoice diterima',
                });
            } else {
                setInvoiceData(null);
            }
        } catch (error) {
            console.error("Failed to load or parse invoice data:", error);
            setInvoiceData(null);
        }
    }, []);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Cannot find invoice element to download.",
            });
            return;
        }
        const opt = {
          margin:       [10, 10, 10, 10], // top, left, bottom, right
          filename:     `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    const handleExportExcel = () => {
        if (!invoiceData) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No invoice data to export.",
            });
            return;
        }
        const dataToExport = invoiceData.items.map(item => ({
            'Invoice ID': invoiceData.id,
            'Customer': invoiceData.customer.name,
            'SO Number': invoiceData.soNumber,
            'Date': formatDate(invoiceData.date),
            'Item Name': item.name,
            'Quantity': item.quantity,
            'Unit': item.unit,
            'Price': item.price,
            'Total': item.total,
        }));

        dataToExport.push({
            'Invoice ID': '---', 'Customer': '', 'SO Number': '', 'Date': '', 'Item Name': '---',
            'Quantity': '', 'Unit': '', 'Price': '', 'Total': ''
        });
        dataToExport.push({ 'Invoice ID': 'Subtotal (Goods)', 'Total': invoiceData.grandTotal } as any);
        dataToExport.push({ 'Invoice ID': 'DPP VAT', 'Total': invoiceData.dppVat } as any);
        dataToExport.push({ 'Invoice ID': 'VAT 12%', 'Total': invoiceData.vat12 } as any);
        dataToExport.push({ 'Invoice ID': 'Total', 'Total': invoiceData.totalRp } as any);
        exportToExcel(dataToExport, `Invoice-${invoiceData.id.replace(/\//g, '_')}`);
        toast({
            title: "Export Successful",
            description: `Invoice ${invoiceData.id} has been exported to Excel.`,
        });
    };
    
    if (!invoiceData) {
        return <div className="p-8">Loading invoice preview or no data available. Please create an invoice first.</div>;
    }
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
        totalRp
    } = invoiceData;

    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    const totalPages = itemChunks.length;

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 sm:p-6 font-sans text-black">
            <style>{`
                @media print {
                    body {
                        background-color: #fff !important;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                    .print-container {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-hidden, .print-hidden * {
                        display: none !important;
                    }
                }
            `}</style>
            <div className="flex justify-center space-x-4 mb-4 print-hidden">
                <button
                    onClick={handleDownloadPdf}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    <Download size={16} />
                    <span>Download PDF</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <Upload size={16} />
                    <span>Export Excel</span>
                </button>
            </div>
            
            <div ref={invoiceContainerRef} className="print-container">
                {itemChunks.map((chunk, pageIndex) => {
                    const isLastPage = pageIndex === totalPages - 1;
                    return (
                        <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-10 my-8 text-[10px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ height: '297mm' }}>
                            <header className="relative pt-0 pb-0 text-[10px] leading-snug">
                                <div className="w-full text-center mb-1 leading-none">
                                    <p className="font-bold uppercase text-xs tracking-tighter mb-0.5">INVOICE/OFFICIAL RECEIPT</p>
                                    <p className="font-bold uppercase text-xs">{invoiceId}</p>
                                </div>
                                <div className='flex justify-between items-start mt-4'>
                                    <div className='w-[45%]'>
                                        <p className="font-bold text-[10px] mb-0">{customer.name}</p>
                                    </div>
                                    <div className="w-[30%] text-[10px] text-left leading-normal space-y-0">
                                        <p className="mb-0">Sales Order: {soNumber}</p> 
                                        <p className="mb-0">Order Date: </p>
                                        <p className="mb-0">Reference A: </p>
                                    </div>
                                </div>
                                <div className='flex justify-between text-[10px] mt-2 mb-0 w-full py-1'>
                                    <p className='mb-0'>Customer Code :</p>
                                    <p className='mb-0'>Date: {formatDate(date)}</p>
                                </div>
                            </header>

                            <main className='mt-0 flex-grow'>
                                <table className="w-full border-collapse text-[10px] mt-0">
                                    <thead>
                                        <tr className='bg-white border border-black'>
                                            <th className="p-1 text-left w-[8%] border-r border-black border-b border-black font-normal">No.</th>
                                            <th className="p-1 text-left w-[40%] border-r border-black border-b border-black font-normal">Item</th>
                                            <th className="p-1 text-center w-[15%] border-r border-black border-b border-black font-normal">Quantity Unit</th>
                                            <th className="p-1 text-right w-[17%] border-r border-black border-b border-black font-normal">Price</th>
                                            <th className="p-1 text-right flex-1 border-b border-black font-normal">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((item, itemIdx) => (
                                            <tr key={item.id} className='align-top'>
                                                <td className="p-1 h-[18px]">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                                <td className="p-1">{item.name}</td>
                                                <td className="p-1 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                                <td className="p-1 text-right">{formatCurrency(item.price)}</td>
                                                <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                            </tr>
                                        ))}
                                        {!isLastPage && Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                            <tr key={`empty-${i}`}><td className="p-1 h-[18px]" colSpan={5}>&nbsp;</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </main>
                            
                            {isLastPage ? (
                                <footer className="pt-0 text-black mt-auto text-[10px]">
                                    <div className="w-full flex justify-end items-end leading-normal">
                                        <div className="text-right w-1/2">
                                            {chunk.length < 5 && <div className="h-0.5 border-b border-black w-1/4 ml-auto" style={{marginTop: `-${(10 - chunk.length) * 18}px`}}></div>}
                                            <p className="text-[10px] font-normal">{formatCurrency(grandTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="w-full flex justify-start items-end leading-normal mt-0">
                                        <p>No PO : {poNumber}</p>
                                    </div>
                                    <div className="border-t border-black w-full my-1"></div>
                                    <div className="flex justify-end mt-1">
                                        <div className="w-1/2 text-[10px] leading-snug">
                                            <div className="grid grid-cols-[1fr_auto] gap-x-3">
                                                <span className="text-right">Goods:</span>
                                                <span className="text-right">{formatCurrency(grandTotal)}</span>
                                                <span className="text-right">DPP VAT (11/12):</span>
                                                <span className="text-right">{formatCurrency(dppVat)}</span>
                                                <span className="text-right">VAT 12%:</span>
                                                <span className="text-right">{formatCurrency(vat12)}</span>
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-3 font-normal">
                                                <span className="text-right">Total Rp:</span>
                                                <span className="text-right">{formatCurrency(totalRp)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-black w-full my-1"></div>
                                    <div className="mt-0 pt-1">
                                        <div className="flex">
                                            <div className="w-[55%] pr-4 text-[10px] space-y-0.5 leading-normal"> 
                                                <div className="flex">
                                                    <p className='shrink-0 w-[50px] mb-0'>Payment:</p> 
                                                    <p className='w-full ml-1 font-normal mb-0'>{paymentTerms}</p>
                                                </div>
                                                <div className="flex">
                                                    <p className='shrink-0 w-[150px] mb-0'>Please state with your payment:</p>
                                                    <p className='w-full ml-1 font-bold mb-0'>{invoiceId}</p>
                                                </div>
                                                <p className='mt-2 mb-1'>For payment, please transfer to our account:</p>
                                                <p className="font-semibold text-[10px] mb-1">PT. Jembo Cable Company Tbk</p>
                                                <div className="space-y-0 leading-tight">
                                                    <div className="flex">
                                                        <span className="w-1/3 pr-2 mb-0">Bank Mandiri -</span>
                                                        <span className="flex-1 mb-0">A/C No. : 102-0100206827 (Rp)</span>
                                                    </div>
                                                    <div className="flex">
                                                        <span className="w-1/3 pr-2 mb-0">Jakarta Cabang</span>
                                                        <span className="flex-1 mb-0">A/C No. : 102-0005000218 (Rp)</span>
                                                    </div>
                                                    <div className="flex">
                                                        <span className="w-1/3 pr-2 mb-0">Sudirman</span>
                                                        <span className="flex-1 mb-0">A/C No. : 102-0005000226 (USD)</span>
                                                    </div>
                                                </div>
                                                <div className="text-center my-1">OR</div>
                                                <div className="space-y-0 leading-tight">
                                                    <div className="flex">
                                                        <div className="w-1/3 pr-2 leading-tight space-y-0">
                                                            <p className='mb-0'>Bank BCA - Jakarta</p>
                                                            <p className='mt-0'>Cabang KEM TOWER</p>
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className='mb-0'>A/C No. : 684-0198977 (Rp)</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-[45%] pl-0 flex flex-col justify-between text-[10px] text-center" style={{ minHeight: '130px' }}>
                                                <p className="font-semibold text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
                                                <div className="flex-grow"></div>
                                                <div className='border-b border-black w-24 mx-auto mb-1 mt-20'></div>
                                                <p className="font-semibold">Finance</p>
                                            </div>
                                        </div>
                                    </div>
                                </footer>
                            ) : null}
                            <div className="text-center text-gray-500 text-[8px] mt-auto pt-2">
                                Halaman {pageIndex + 1} dari {totalPages}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;

    