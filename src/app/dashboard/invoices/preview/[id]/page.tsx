'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, ArrowLeft, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel, parseFormattedNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';

// --- DEFINISI TIPE DATA ---
interface Item {
    id: string;
    no: number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
}

interface InvoiceData {
    id: string;
    erpInvoiceId?: string;
    items: Item[];
    customer: {
        name: string;
        address: string;
        npwp?: string;
    };
    date: string; // YYYY-MM-DD
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    subtotal: number;
    dppVat: number;
    vat12: number;
    paymentTerms: string;
    printType: 'original' | 'copy';
    negotiation: number;
    dpValue: number;
    pelunasan: number;
    virtualAccount?: {
        bankName: string;
        vaNumber: string;
    };
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
    const router = useRouter();

    useEffect(() => {
        try {
            const dataFromSession = sessionStorage.getItem('invoicePreviewData');
            if (dataFromSession) {
                const parsedData = JSON.parse(dataFromSession);
                setInvoiceData(parsedData);
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
          margin:       [10, 10, 10, 10], 
          filename:     `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    const handleExportExcel = () => {
        if (!invoiceData) return;
        const displayInvoiceId = invoiceData.id.replace(/_/g, '/');
        const dataToExport = invoiceData.items.map(item => ({
            'Invoice ID': displayInvoiceId,
            'ERP Reference': invoiceData.erpInvoiceId || '-',
            'Customer': invoiceData.customer.name,
            'Branch Address': invoiceData.customer.address,
            'SO Number': invoiceData.soNumber,
            'Date': formatDate(invoiceData.date),
            'Item Name': item.name,
            'Quantity': item.quantity,
            'Unit': item.unit,
            'Price': item.price,
            'Total': item.total,
        }));
        exportToExcel(dataToExport, `Invoice-${invoiceData.id.replace(/\//g, '_')}`);
        toast({ title: "Export Successful" });
    };
    
    if (!invoiceData) {
        return <div className="p-8 text-center font-bold animate-pulse">Loading invoice preview...</div>;
    }

    const {
        id: invoiceId,
        erpInvoiceId,
        items,
        customer,
        date,
        soNumber,
        poNumber,
        grandTotal,
        subtotal,
        dppVat,
        vat12,
        paymentTerms,
        printType,
        negotiation,
        dpValue,
        pelunasan,
        virtualAccount
    } = invoiceData;

    const displayInvoiceId = invoiceId.replace(/_/g, '/');
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    const totalPages = itemChunks.length;
    
    const totalRp = grandTotal; // Use the passed grandTotal for accuracy
    const invoiceTitle = invoiceId.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 sm:p-6 font-sans text-black">
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .page-break { page-break-before: always; }
                    .print-container { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
                    .print-hidden { display: none !important; }
                }
            `}</style>
            
            <div className="flex justify-center space-x-4 mb-4 print-hidden">
                <Button onClick={() => router.back()} variant="outline"><ArrowLeft size={16} /> Back</Button>
                <Button onClick={handleDownloadPdf} className="bg-blue-600"><Download size={16} /> PDF</Button>
                <Button onClick={handleExportExcel} variant="outline"><Upload size={16} /> Excel</Button>
            </div>
            
            <div ref={invoiceContainerRef} className="print-container">
                {itemChunks.map((chunk, pageIndex) => {
                    const isLastPage = pageIndex === totalPages - 1;
                    return (
                        <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-4 my-8 text-[10px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ height: '220mm' }}>
                            <header className="relative pt-0 pb-0 text-[10px] leading-snug">
                                <p className="absolute right-0 top-0 font-normal text-sm capitalize">{printType}</p>
                                <div className="w-full text-center mb-1 leading-none">
                                    <p className="font-bold uppercase text-xs tracking-tighter mb-0.5">{invoiceTitle}</p>
                                    <p className="font-bold uppercase text-xs">{displayInvoiceId}</p>
                                    {erpInvoiceId && (
                                        <p className="text-[8px] font-mono font-bold text-gray-500 uppercase mt-1">ERP REF: {erpInvoiceId}</p>
                                    )}
                                </div>
                                <div className='flex justify-between items-start mt-4'>
                                    <div className='w-[45%]'>
                                        <p className="font-bold text-[10px] mb-0">{customer.name}</p>
                                        <p className="text-[9px] mt-1 leading-tight whitespace-pre-line">{customer.address}</p>
                                        {customer.npwp && <p className="text-[9px] mt-1 font-bold">NPWP: {customer.npwp}</p>}
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
                                <table className="w-full border-collapse text-[10px] mt-0 table-fixed">
                                    <thead>
                                        <tr className='bg-white border border-black'>
                                            <th className="p-1 text-left w-[8%] border-r border-black border-b border-black font-normal">No.</th>
                                            <th className="p-1 text-left w-[42%] border-r border-black border-b border-black font-normal">Item</th>
                                            <th className="p-1 text-center w-[15%] border-r border-black border-b border-black font-normal">Quantity Unit</th>
                                            <th className="p-1 text-right w-[17%] border-r border-black border-b border-black font-normal">Price</th>
                                            <th className="p-1 text-right w-[18%] border-b border-black font-normal">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((item, itemIdx) => (
                                            <tr key={item.id} className='align-top'>
                                                <td className="p-1 h-[18px] border-l border-r border-transparent">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                                <td className="p-1 border-r border-transparent">{item.name}</td>
                                                <td className="p-1 text-center border-r border-transparent">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                                <td className="p-1 text-right border-r border-transparent">{formatCurrency(item.price)}</td>
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
                                    {/* Consolidated Calculation Grid */}
                                    <div className="w-full flex justify-end mt-1">
                                        <div className="w-1/2 text-[10px] leading-snug">
                                            <div className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-black pt-1">
                                                <span>Subtotal:</span>
                                                <span className="text-right">{formatCurrency(subtotal)}</span>
                                                
                                                {negotiation > 0 && (
                                                    <>
                                                        <span>Negotiation:</span>
                                                        <span className="text-right">({formatCurrency(negotiation)})</span>
                                                    </>
                                                )}
                                                
                                                {dpValue > 0 && (
                                                    <>
                                                        <span>DP / Retensi:</span>
                                                        <span className="text-right">{formatCurrency(dpValue)}</span>
                                                    </>
                                                )}

                                                <span className="text-right">DPP VAT (11/12):</span>
                                                <span className="text-right">{formatCurrency(dppVat)}</span>
                                                <span className="text-right">VAT 12%:</span>
                                                <span className="text-right">{formatCurrency(vat12)}</span>
                                                
                                                <span className="font-bold border-t border-black mt-1">TOTAL Rp:</span>
                                                <span className="font-bold border-t border-black mt-1 text-right">{formatCurrency(totalRp)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full flex justify-start items-end leading-normal mt-0">
                                        <p>No PO : {poNumber}</p>
                                    </div>
                                    
                                    <div className="mt-2 pt-1 border-t border-black">
                                        <div className="flex">
                                            <div className="w-[55%] pr-4 text-[10px] space-y-0.5 leading-normal"> 
                                                <div className="flex">
                                                    <p className='shrink-0 w-[50px] mb-0'>Payment:</p> 
                                                    <p className='w-full ml-1 font-normal mb-0'>{paymentTerms}</p>
                                                </div>
                                                <div className="flex">
                                                    <p className='shrink-0 w-[150px] mb-0'>Please state with your payment:</p>
                                                    <p className='w-full ml-1 font-bold mb-0'>{displayInvoiceId}</p>
                                                </div>
                                                <p className='mt-2 mb-1'>For payment, please transfer to our account:</p>

                                                {virtualAccount ? (
                                                    <div className="space-y-0 leading-tight border border-dashed border-gray-300 p-2 min-h-[85px] bg-slate-50/50">
                                                        <div className="flex font-bold text-blue-800">
                                                            <span className="w-1/3 pr-2 mb-0">{virtualAccount.bankName} -</span>
                                                            <span className="flex-1 mb-0 uppercase">VIRTUAL ACCOUNT</span>
                                                        </div>
                                                        <div className="flex text-lg tracking-wider font-mono mt-1 text-blue-900">
                                                            <span className="w-full mb-0 font-bold">{virtualAccount.vaNumber}</span>
                                                        </div>
                                                        <p className="font-semibold text-[9px] mt-1">A/N: PT JEMBO CABLE COMPANY Tbk</p>
                                                        <p className="text-[8px] italic mt-2 text-gray-500">*Konfirmasi otomatis, tidak perlu kirim bukti transfer</p>
                                                    </div>
                                                ) : (
                                                    <div className="min-h-[85px]">
                                                        <p className="font-semibold text-[10px] mb-1">PT. JEMBO CABLE COMPANY Tbk</p>
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
                                                        <div className="text-center my-0.5 text-[8px] italic">OR</div>
                                                        <div className="space-y-0 leading-tight">
                                                            <div className="flex">
                                                                <div className="w-1/3 pr-2 leading-tight space-y-0">
                                                                    <p className='mb-0'>Bank BCA - Jakarta</p>
                                                                    <p className='mt-0 text-[8px]'>Cabang KEM TOWER</p>
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <p className='mb-0'>A/C No. : 684-0198977 (Rp)</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="w-[45%] pl-0 flex flex-col justify-between text-[10px] text-center" style={{ minHeight: '130px' }}>
                                                <p className="font-semibold text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
                                                <div className="flex-grow"></div>
                                                <div className='border-b border-black w-24 mx-auto mb-1 mt-20'></div>
                                                <p className="font-semibold">Finance</p>
                                                {erpInvoiceId && (
                                                    <p className="text-[7px] text-gray-400 mt-2 font-mono uppercase">System Ref: {erpInvoiceId}</p>
                                                )}
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
