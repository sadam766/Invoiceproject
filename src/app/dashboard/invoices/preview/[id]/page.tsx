'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// --- DEFINISI TIPE DATA ---
interface Item {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
}

interface Customer {
    name: string;
    address: string;
}

interface InvoiceData {
    id: string;
    items: Item[];
    customer?: Customer;
    date: string; // YYYY-MM-DD
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number; // Ini adalah grandTotal + vat12
    paymentTerms: string;
}

// --- FUNGSI UTILITY ---
const formatCurrency = (amount: number): string => {
    return (amount || 0).toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) {
        return 'Invalid Date';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};


// --- KOMPONEN UTAMA ---
const InvoicePreviewPage = () => {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const router = useRouter();

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            setInvoiceData({
                ...parsedData,
                totalRp: parsedData.grandTotal + parsedData.vat12,
                paymentTerms: '90 Hari setelah invoice diterima', // Placeholder
                poNumber: parsedData.poNumber || '' // Placeholder
            });
        } else {
            // Jika tidak ada data di session, mungkin redirect atau tampilkan pesan
            // Untuk sekarang, kita bisa redirect kembali ke halaman invoices
             router.push('/dashboard/invoices');
        }
    }, [router]);


    // --- FUNGSI EXPORT ---
    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        if (!invoiceData) return;

        const dataForExcel = invoiceData.items.map(item => ({
            'Invoice ID': invoiceData.id,
            'Invoice Date': formatDate(invoiceData.date),
            'SO Number': invoiceData.soNumber,
            'Customer Name': invoiceData.customer?.name || '',
            'Customer Address': invoiceData.customer?.address || '',
            'Item': item.name,
            'Quantity': item.quantity,
            'Unit': item.unit,
            'Price': item.price,
            'Amount': item.total,
        }));

        const invoiceTotals = {
            '': '',
            ' ': '',
            '  ': '',
            '   ': '',
            '    ': '',
            '     ': '',
            '      ': '',
            '       ': 'Subtotal',
            '        ': invoiceData.grandTotal,
        }

        const excelData = [...dataForExcel, {}, invoiceTotals];


        exportToExcel(excelData, `Invoice-${invoiceData.id.replace(/\//g, '_')}`);
    };
    
    if (!invoiceData) {
        return <div className="p-8 text-center">Loading invoice data...</div>;
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

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
            
            <style>{`
                @media print {
                    body > *:not(#invoice-paper-container) { display: none; }
                    #invoice-paper-container {
                        display: block;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }
                    body, html { margin: 0; padding: 0; background: none; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>

            <div className="flex justify-center space-x-4 mb-4 print:hidden">
                <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    <Printer size={16} />
                    <span>Print/Export PDF</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <Download size={16} />
                    <span>Export Excel</span>
                </button>
            </div>

            <div 
                id="invoice-paper-container" 
                className="w-full max-w-4xl mx-auto bg-white shadow-lg p-10 my-8 text-[10px] leading-tight flex flex-col" 
                ref={invoiceRef}
                style={{ minHeight: '27cm' }}
            >
                <header className="relative pt-0 pb-2 text-[10px] leading-snug">
                    <div className="w-full text-center mb-1">
                        <p className="font-bold uppercase text-sm tracking-tighter">INVOICE/OFFICIAL RECEIPT</p>
                        <p className="font-bold uppercase text-sm">{invoiceId}</p>
                    </div>

                    <div className='flex justify-between items-start mt-4'>
                        <div className='w-[45%]'> 
                            <p className="font-bold text-[10px]">{customer?.name}</p>
                        </div>
                        <div className="w-[30%] text-[10px] text-left space-y-0">
                            <p>Sales Order: {soNumber}</p>
                            <p>Order Date: </p>
                            <p>Reference A: </p>
                        </div>
                    </div>

                    <div className='flex justify-between text-[10px] mb-1 mt-2'>
                            <p>Customer Code :</p>
                            <p>Date: {formatDate(date)}</p>
                    </div>
                </header>
                
                <main className='mt-0 flex-grow'> 
                    <table className="w-full border-collapse text-[10px] border-t border-b border-black">
                        <thead>
                            <tr className='bg-white'> 
                                <th className="p-1 text-left w-[8%] font-normal">No.</th>
                                <th className="p-1 text-left w-[40%] font-normal border-l border-black">Item</th>
                                <th className="p-1 text-center w-[15%] font-normal border-l border-black">Quantity Unit</th>
                                <th className="p-1 text-right w-[17%] font-normal border-l border-black">Price</th>
                                <th className="p-1 text-right flex-1 font-normal border-l border-black">Amount</th>
                            </tr>
                        </thead>
                         <tbody>
                            {items.map((item, itemIdx) => (
                                <tr key={item.id} className='align-top'>
                                    <td className="p-1 h-[18px]">{itemIdx + 1}</td>
                                    <td className="p-1 border-l border-black">{item.name}</td>
                                    <td className="p-1 text-center border-l border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                    <td className="p-1 text-right border-l border-black">{formatCurrency(item.price)}</td>
                                    <td className="p-1 text-right border-l border-black">{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                             {/* Fill empty rows */}
                            {Array.from({ length: Math.max(0, 15 - items.length) }).map((_, i) => (
                                 <tr key={`empty-${i}`} className='align-top'>
                                    <td className="p-1 h-[18px]">&nbsp;</td>
                                    <td className="p-1 border-l border-black">&nbsp;</td>
                                    <td className="p-1 text-center border-l border-black">&nbsp;</td>
                                    <td className="p-1 text-right border-l border-black">&nbsp;</td>
                                    <td className="p-1 text-right border-l border-black">&nbsp;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>

                <footer className="pt-0 text-black mt-auto text-[10px]">
                    <div className="flex justify-between items-end leading-normal">
                         <p>No PO : {poNumber}</p>
                         <p className="text-[10px] font-normal">{formatCurrency(grandTotal)}</p>
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
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 font-bold mt-1">
                                <span className="text-right">Total Rp:</span>
                                <span className="text-right">{formatCurrency(totalRp)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-black w-full my-1"></div>

                    <div className="mt-0 pt-1"> 
                        <div className="flex">
                            <div className="w-[55%] pr-4 text-[10px] space-y-1">
                                <div className="flex gap-x-1">
                                    <p className='shrink-0 w-24'>Payment:</p>
                                    <p className='w-full'>{paymentTerms}</p>
                                </div>
                                <div className="flex gap-x-1">
                                    <p className='shrink-0 w-24'>Please state with your payment:</p>
                                    <p className='w-full'>{invoiceId}</p>
                                </div>
                                <p className='mt-2'>For payment, please transfer to our account:</p>
                                <p className="font-semibold text-[10px]">PT. Jembo Cable Company Tbk</p>
                                
                                <div className="flex items-start">
                                    <div className="w-1/3 pr-2"> 
                                        <p>Bank Mandiri -</p>
                                        <p>Jakarta Cabang</p>
                                        <p>Sudirman</p>
                                    </div>
                                    <div className="w-2/3 text-left"> 
                                        <p>A/C No. : 102-0100206827 (Rp)</p>
                                        <p>A/C No. : 102-0005000218 (Rp)</p>
                                        <p>A/C No. : 102-0005000226 (USD)</p>
                                    </div>
                                </div>
                                <div className="text-center my-1">OR</div>
                                <div className="flex items-start">
                                    <div className="w-1/3 pr-2"> 
                                        <p>Bank BCA - Jakarta</p>
                                        <p>Cabang KEM TOWER</p>
                                    </div>
                                    <div className="w-2/3 text-left"> 
                                        <p>A/C No. : 684-0198977 (Rp)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-[45%] pl-0 flex flex-col justify-end text-[10px] text-center">
                                <p className="font-semibold text-[10px] mb-20">PT. JEMBO CABLE COMPANY Tbk</p> 
                                <div className='border-b border-black w-24 mx-auto mb-1'></div>
                                <p className="font-semibold">Finance</p>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default InvoicePreviewPage;
