
'use client';
import React from 'react';

// --- DATA TYPES ---
interface Item {
    id: string | number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
}

interface InvoiceData {
    id: string;
    items: Item[];
    customer?: {
        name: string;
        address: string;
        vaNumber?: string;
    };
    customerName?: string;
    customerCode?: string;
    billingAddress?: string;
    date: string; 
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
    paymentMode?: 'manual' | 'virtual_account';
    vaNumber?: string;
    dpValue?: number;
    dpPercent?: number | string;
    discount?: number;
    discountLabel?: string;
    dpDescription?: string;
    dpMode?: 'tagih' | 'kurangi';
}

// --- UTILITIES ---
const formatCurrency = (amount: any): string => {
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

const ITEM_LIMIT = 10; // Maximum items per page for visual integrity

export const InvoiceTemplate = ({ invoiceData, type }: { invoiceData: InvoiceData, type: 'Original' | 'Copy' }) => {
    if (!invoiceData) return null;

    const {
        id: invoiceId = '',
        items = [],
        customer = { name: 'N/A', address: 'N/A', vaNumber: '' },
        date = '',
        soNumber = '-',
        poNumber = '-',
        grandTotal = 0,
        dppVat = 0,
        vat12 = 0,
        paymentTerms = '-',
        totalRp = 0,
        customerCode = '-',
        vaNumber = '',
        dpValue = 0,
        dpPercent = 0,
        discount = 0,
        discountLabel = 'Discount',
        dpMode = 'kurangi'
    } = invoiceData;

    const displayInvoiceId = (invoiceId || '').replace(/_/g, '/');
    const subTotalItems = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const invoiceTitle = (invoiceId || '').startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';
    
    // Virtual Account Logic (Hybrid Mode)
    const activeVa = vaNumber || customer.vaNumber;

    // PAGINATION: Split items into chunks
    const chunks = [];
    for (let i = 0; i < items.length; i += ITEM_LIMIT) {
        chunks.push(items.slice(i, i + ITEM_LIMIT));
    }
    if (chunks.length === 0) chunks.push([]);

    return (
        <div className="invoice-print-wrapper" style={{ color: '#000000' }}>
            {chunks.map((chunk, idx) => {
                const isLastPage = idx === chunks.length - 1;
                
                return (
                    <div 
                        key={idx}
                        className="relative bg-white mx-auto flex flex-col print:shadow-none"
                        style={{ 
                            width: '210mm', 
                            height: '297mm', 
                            padding: '50mm 15mm 15mm 15mm',
                            fontSize: '10pt',
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            boxSizing: 'border-box',
                            pageBreakAfter: (isLastPage && type === 'Copy') ? 'avoid' : 'always',
                            breakInside: 'avoid',
                            pageBreakInside: 'avoid'
                        }}
                    >
                        {/* TYPE INDICATOR */}
                        <div className="absolute right-8 top-8 text-[10pt] text-slate-300 uppercase italic font-normal print:hidden">
                            {type} {chunks.length > 1 ? `(Page ${idx + 1}/${chunks.length})` : ''}
                        </div>

                        {/* HEADER */}
                        <header className="mb-0">
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

                            <div className='flex justify-between text-[8.5pt] py-1 uppercase border-b border-black'>
                                <p className='m-0'>Customer Code : {customerCode}</p>
                                <p className='m-0'>Date: {formatDate(date)}</p>
                            </div>
                        </header>

                        {/* TABLE */}
                        <main className='relative flex-grow overflow-hidden'>
                            <table className="w-full border-collapse text-[8.5pt] mt-0"> 
                            <thead>
                                    <tr className='border-b-[1.5pt] border-black'>
                                        <th className="py-0.5 px-2 text-left w-[5%] font-bold leading-tight">NO.</th>
                                        <th className="py-0.5 px-2 text-left w-[45%] font-bold leading-tight">ITEM DESCRIPTION</th>
                                        <th className="py-0.5 px-2 text-center w-[15%] font-bold leading-tight">QUANTITY UNIT</th>
                                        <th className="py-0.5 px-2 text-right w-[15%] font-bold leading-tight">UNIT PRICE</th>
                                        <th className="py-0.5 px-2 text-right w-[20%] font-bold leading-tight">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={item.id} className='align-top'>
                                            <td className="py-1 px-2">{idx * ITEM_LIMIT + itemIdx + 1}</td>
                                            <td className="py-1 px-2 uppercase font-medium">{item.name}</td>
                                            <td className="py-1 px-2 text-center">{item.quantity?.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                                            <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    
                                    {isLastPage && (
                                        <>
                                            {/* Subtotal Item Slot */}
                                            <tr>
                                                <td colSpan={3}></td>
                                                <td></td>
                                                <td className="py-1 px-2 text-right border-t border-black font-bold">
                                                    {formatCurrency(subTotalItems)}
                                                </td>
                                            </tr>

                                            {Number(dpValue) > 0 && (
                                                <tr>
                                                    <td colSpan={3}></td>
                                                    <td className="py-1 px-2 text-left">
                                                        DP {Number(dpPercent) > 0 ? `${dpPercent}%` : ''}
                                                    </td>
                                                    <td className="py-1 px-2 text-right font-medium">
                                                        {dpMode === 'kurangi' ? `(${formatCurrency(dpValue)})` : formatCurrency(dpValue)}
                                                    </td>
                                                </tr>
                                            )}

                                            {Number(discount) > 0 && (
                                                <tr>
                                                    <td colSpan={3}></td>
                                                    <td className="py-1 px-2 text-left">{discountLabel}</td>
                                                    <td className="py-1 px-2 text-right font-medium">
                                                        ({formatCurrency(discount)})
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </main>

                        {/* FOOTER - ONLY ON LAST PAGE */}
                        {isLastPage ? (
                            <footer className="mt-4 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
                                <div className="mb-4 px-2">
                                    <p className="font-bold text-[9pt]">NO PO : {poNumber}</p>
                                </div>

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
                                    {/* HYBRID BANK INFO */}
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

                                        <div className="mt-2 space-y-2">
                                            {activeVa && (
                                                <div className="border-b border-dashed border-black pb-2 mb-2">
                                                    <div className="font-bold text-[8pt] text-blue-800 mb-1 uppercase tracking-tight">PEMBAYARAN VIA VIRTUAL ACCOUNT:</div>
                                                    <div className="flex items-start">
                                                        <span className="w-[100px] font-bold">Bank Mandiri</span>
                                                        <span className="font-bold">: {activeVa}</span>
                                                    </div>
                                                    <div className="flex items-start">
                                                        <span className="w-[100px]">Nama A/C</span>
                                                        <span className="uppercase">: {customer.name}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-0.5">
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

                                            <div className="flex items-start">
                                                <div className="w-[100px] font-bold leading-[1.2]">
                                                    Bank BCA - Jakarta<br/>
                                                    <span className="font-normal text-[7.5pt]">Cabang KEM TOWER</span>
                                                </div>
                                                <div className="pt-0.5">A/C No. : 684-0198977 (Rp)</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SIGNATURE */}
                                    <div className="w-[35%] flex flex-col items-center self-stretch justify-between py-1">
                                        <p className="font-bold text-[9pt] text-center">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="mt-auto flex flex-col items-center">
                                            <div className="mt-12 border-t-[1.5pt] border-black w-[160px]"></div>
                                            <p className="font-bold uppercase pt-1 text-[9pt] underline">Finance</p>
                                        </div>
                                    </div>
                                </div>
                            </footer>
                        ) : (
                            <footer className="mt-auto text-right text-[8pt] italic text-slate-400">
                                Continued on page {idx + 2}...
                            </footer>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
