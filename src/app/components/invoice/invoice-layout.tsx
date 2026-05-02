
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { InvoiceItem } from '@/app/lib/data';

interface InvoiceLayoutProps {
    type: 'Original' | 'Copy';
    invoiceData: any; 
    items: InvoiceItem[];
    calculations: {
        subTotalItems: number;
        negotiation: number;
        dpValue: number;
        goodsValue: number;
        dppVat: number;
        vat12: number;
        totalRp: number;
    };
}

const ITEMS_PER_PAGE = 8;

const formatCurrency = (value: number) => {
    return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const InvoiceTemplate = ({ type, invoiceData, items, calculations }: InvoiceLayoutProps) => {
    const isCopy = type === 'Copy';
    
    // Paging logic: Max 8 items per page
    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) || 1 }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );

    const totalPages = itemChunks.length;
    const displayInvoiceId = invoiceData.id?.replace(/_/g, '/') || 'DRAFT';

    return (
        <div className={cn("flex flex-col", isCopy && "print:page-break-before-always")}>
            {itemChunks.map((chunk, pageIndex) => {
                const isLastPage = pageIndex === totalPages - 1;
                return (
                    <div 
                        key={`${type}-${pageIndex}`} 
                        className={cn(
                            "relative mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8",
                            isCopy ? "bg-slate-50 opacity-90 print:bg-white print:opacity-100" : "bg-white",
                            pageIndex > 0 && "mt-12"
                        )}
                        style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
                    >
                        {/* LABEL: ORIGINAL / COPY */}
                        <div className="absolute right-12 top-8 text-[11pt] font-black text-slate-300 uppercase tracking-widest print:text-black">
                            {type}
                        </div>

                        {/* HEADER: TITLE & NO INVOICE (Centered Title) */}
                        <header className="relative mb-8">
                             <div className="text-center w-full">
                                <h1 className="font-bold text-[11pt] uppercase tracking-wider">INVOICE/OFFICIAL RECEIPT</h1>
                             </div>
                        </header>

                        {/* INFO BAR: CUSTOMER & DATES */}
                        <div className="flex justify-between items-start mb-6 text-[9pt]">
                            <div className="w-[60%] space-y-1">
                                <div className="flex flex-col">
                                    <p className="font-bold uppercase text-[10pt]">{invoiceData.customerName || invoiceData.customer || 'N/A'}</p>
                                    <p className="text-[9pt] font-medium">No: {displayInvoiceId}</p>
                                </div>
                                <p className="text-[8.5pt] leading-tight italic max-w-[350px] mt-1">
                                    {invoiceData.billingAddress || invoiceData.customerAddress || '-'}
                                </p>
                                <p className="text-[8pt] font-bold mt-2">Customer Code : {invoiceData.customerCode || '-'}</p>
                            </div>
                            <div className="text-[9pt] space-y-0.5" style={{ minWidth: '180px' }}>
                                <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
                                <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.date || '-'}</span></div>
                                <div className="grid grid-cols-[85px_5px_1fr]"><span>PO Number</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
                            </div>
                        </div>

                        {/* TABLE AREA */}
                        <main className="relative flex-grow">
                            <table className="w-full border-collapse text-[9pt]">
                                <thead>
                                    <tr className="border border-black">
                                        <th className="p-1 text-left w-[5%] border-r border-black font-normal">No.</th>
                                        <th className="p-1 text-left border-r border-black font-normal">Item</th>
                                        <th className="p-1 text-center w-[18%] border-r border-black font-normal">Quantity Unit</th>
                                        <th className="p-1 text-right w-[15%] border-r border-black font-normal">Price</th>
                                        <th className="p-1 text-right w-[18%] font-normal">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, idx) => (
                                        <tr key={item.id} className="align-top border-x border-black h-8">
                                            <td className="p-1 text-center border-r border-black">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td className="p-1 border-r border-black uppercase text-[8.5pt] leading-tight">{item.name || item.productName}</td>
                                            <td className="p-1 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                            <td className="p-1 text-right border-r border-black">{formatCurrency(item.price)}</td>
                                            <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    {/* Empty rows to fill height */}
                                    {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="border-x border-black h-8">
                                            <td className="border-r border-black"></td>
                                            <td className="border-r border-black"></td>
                                            <td className="border-r border-black"></td>
                                            <td className="border-r border-black"></td>
                                            <td></td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-black"></tr>
                                </tbody>
                            </table>

                            {/* SUB TOTAL ITEM - Aligned exactly with Amount Column */}
                            {isLastPage && (
                                <div className="flex justify-end">
                                    <div className="w-[18%] text-right pr-1 border-x border-b border-black py-1 bg-slate-50/30">
                                        <p className="font-bold text-[9pt]">{formatCurrency(calculations.subTotalItems)}</p>
                                    </div>
                                </div>
                            )}
                        </main>

                        {/* FOOTER AREA */}
                        {isLastPage && (
                            <footer className="pt-4 text-black text-[9pt]">
                                {/* CALCULATION MATRIX */}
                                <div className="w-full flex justify-end leading-tight mb-6">
                                    <div className="w-1/3 text-[10px] space-y-1 font-serif">
                                        <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                            <span>Subtotal Item:</span>
                                            <span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
                                            
                                            {calculations.dpValue > 0 && (
                                                <>
                                                    <span>DP / Retensi:</span>
                                                    <span className="text-right">({formatCurrency(calculations.dpValue)})</span>
                                                </>
                                            )}
                                            {calculations.negotiation > 0 && (
                                                <>
                                                    <span>Diskon:</span>
                                                    <span className="text-right">({formatCurrency(calculations.negotiation)})</span>
                                                </>
                                            )}
                                            
                                            <div className="col-span-2 border-t border-slate-200 my-0.5"></div>

                                            <span>Goods:</span>
                                            <span className="text-right">{formatCurrency(calculations.goodsValue)}</span>
                                            <span>DPP VAT (11/12):</span>
                                            <span className="text-right">{formatCurrency(calculations.dppVat)}</span>
                                            <span>VAT 12%:</span>
                                            <span className="text-right">{formatCurrency(calculations.vat12)}</span>
                                            <span className="font-bold border-t border-black mt-1 pt-1">Total Rp:</span>
                                            <span className="text-right font-bold border-t border-black mt-1 pt-1">{formatCurrency(calculations.totalRp)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SIGNATURE & PAYMENT INFO */}
                                <div className="flex justify-between items-end mt-4">
                                    <div className="w-[60%] space-y-1 leading-tight text-[8.5pt]">
                                        <div className="flex mb-1">
                                            <span className="font-bold w-[90px]">Payment:</span>
                                            <span>{invoiceData.paymentTerm || '90 Hari'}</span>
                                        </div>
                                        <p>Please state with your payment: <span className="font-bold">{displayInvoiceId}</span></p>
                                        
                                        <p className="font-bold underline uppercase pt-2">
                                            {invoiceData.paymentMethod === 'va' ? 'PAYMENT VIA VIRTUAL ACCOUNT:' : 'FOR PAYMENT, PLEASE TRANSFER TO:'}
                                        </p>

                                        {invoiceData.paymentMethod === 'va' ? (
                                            <div className="border border-dashed border-slate-300 bg-slate-50 p-3 rounded-lg w-[90%] mt-1">
                                                <p className="text-[8pt] uppercase text-slate-500 font-bold">Mandiri Virtual Account Number:</p>
                                                <p className="text-[12pt] font-black tracking-widest text-indigo-700">
                                                    {invoiceData.vaNumber || invoiceData.virtualAccountNumber || '86625XXXXXXXXXXX'}
                                                </p>
                                                <p className="text-[7pt] italic text-slate-400 mt-1">*Pembayaran ini akan terverifikasi secara otomatis oleh sistem.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-[9pt]">PT. JEMBO CABLE COMPANY Tbk</p>
                                                <div className="grid grid-cols-[100px_auto] gap-x-1">
                                                    <span className="italic">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (IDR)</span>
                                                    <span className="italic">Bank BCA -</span><span>A/C No. : 684-0198977 (IDR)</span>
                                                    <span className="italic">Bank Mandiri -</span><span>A/C No. : 102-0005000218 (IDR)</span>
                                                    <span className="italic">Bank Mandiri -</span><span>A/C No. : 102-0005000226 (USD)</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-[35%] text-center space-y-1">
                                        <p className="font-bold uppercase text-[9pt] mb-20">PT. JEMBO CABLE COMPANY Tbk</p>
                                        <div className="w-44 mx-auto border-b border-black"></div>
                                        <p className="font-bold uppercase text-[9pt]">Finance Department</p>
                                    </div>
                                </div>
                            </footer>
                        )}

                        <div className="absolute bottom-6 left-0 right-0 text-center text-[7pt] text-slate-400 uppercase tracking-widest">
                            Page {pageIndex + 1} of {totalPages} | Generated by Dakota Hub
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
