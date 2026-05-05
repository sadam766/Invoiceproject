
'use client';

import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';

export type InvoiceTemplateProps = {
  type: 'Original' | 'Copy';
  invoiceData: any;
  items: any[];
  calculations: {
    subTotalItems: number;
    dpValue: number;
    discountValue: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    subTotal?: number;
  };
};

export const InvoiceTemplate = ({ type, invoiceData, items, calculations }: InvoiceTemplateProps) => {
  const displayInvoiceId = invoiceData.id?.replace(/_/g, '/') || 'DRAFT';
  const isProforma = displayInvoiceId.startsWith('KW') || invoiceData.isProforma;
  const maxItems = 12;
  const emptyRows = Math.max(0, maxItems - items.length);

  const customerName = invoiceData.customerName || invoiceData.customer || 'N/A';
  const customerAddress = invoiceData.billingAddress || invoiceData.customerAddress || invoiceData.address || 'N/A';

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-8 pb-10 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      {/* TOP LABEL */}
      <div className="absolute right-12 top-6 text-[8pt] text-black uppercase tracking-widest font-bold">
        {type}
      </div>

      {/* HEADER TITLE */}
      <header className="text-center mt-4 mb-10">
        <h1 className="font-bold text-[11pt] uppercase tracking-wider mb-1">
            {isProforma ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT'}
        </h1>
        <p className="font-bold text-[14pt] leading-tight">{displayInvoiceId}</p>
      </header>

      {/* CUSTOMER & REF INFO */}
      <div className="flex justify-between items-start mb-4">
        <div className="w-[50%] space-y-0.5">
          <p className="font-bold uppercase text-[10pt]">{customerName}</p>
          <p className="text-[9pt] leading-tight italic whitespace-pre-line">
              {customerAddress}
          </p>
        </div>
        <div className="text-[9pt] space-y-1 text-black font-medium" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.orderDate || '-'}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Reference A</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
        </div>
      </div>

      {/* DATE BAR */}
      <div className="flex justify-between border-y border-black py-1.5 mb-2 font-medium text-[9pt]">
         <span>Customer Code : {invoiceData.customerCode || '-'}</span>
         <span>Date: {invoiceData.date || '-'}</span>
      </div>

      {/* TABLE */}
      <main className="relative flex-grow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-[9pt] font-bold">
              <th className="py-2 px-2 text-left border-x border-black w-[5%]">No.</th>
              <th className="py-2 px-2 text-left border-r border-black">Item</th>
              <th className="py-2 px-2 text-center border-r border-black w-[18%]">Quantity Unit</th>
              <th className="py-2 px-2 text-right border-r border-black w-[15%]">Price</th>
              <th className="py-2 px-2 text-right border-r border-black w-[18%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="align-top text-[9pt] h-8">
                <td className="py-1 px-2 text-left border-x border-black">{idx + 1}</td>
                <td className="py-1 px-2 uppercase border-r border-black font-medium">{item.name}</td>
                <td className="py-1 px-2 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                <td className="py-1 px-2 text-right border-r border-black">{formatCurrency(item.price)}</td>
                <td className="py-1 px-2 text-right border-r border-black">{formatCurrency(item.total)}</td>
              </tr>
            ))}
            {/* Filler rows to maintain height */}
            {Array.from({ length: emptyRows }).map((_, i) => (
               <tr key={`empty-${i}`} className="h-8">
                  <td className="border-x border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
               </tr>
            ))}
            <tr className="border-t border-black"></tr>
          </tbody>
        </table>

        {/* DP / DISCOUNT LINE */}
        <div className="flex justify-end mt-2 pr-2">
            <div className="w-[45%] flex justify-between italic font-bold text-[9pt]">
                {invoiceData.dpValue > 0 && (
                    <>
                        <span>{invoiceData.dpDescription || 'Down Payment'}</span>
                        <span>
                            {invoiceData.dpMode === 'kurangi' ? `(${formatCurrency(invoiceData.dpValue)})` : formatCurrency(invoiceData.dpValue)}
                        </span>
                    </>
                )}
            </div>
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="flex justify-between mt-10">
           <div className="text-[9pt] italic font-bold">
              Reference A : {invoiceData.poNumber || '-'}
           </div>
           
           <div className="w-[40%] space-y-1 text-[9pt]">
              <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-black pt-2">
                 <span>Goods:</span>
                 <span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                 <span>DPP VAT</span>
                 <span className="text-right">{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 text-[8pt] italic opacity-70">
                 <span>(11/12):</span>
                 <span className="text-right"></span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                 <span>VAT 12%:</span>
                 <span className="text-right">{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 font-bold border-t-2 border-black pt-1 uppercase text-[10pt]">
                 <span>Total Rp:</span>
                 <span className="text-right">{formatCurrency(calculations.totalRp)}</span>
              </div>
           </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 flex justify-between items-end">
        <div className="w-[60%] space-y-3">
          <div className="space-y-1 font-bold">
            <p>Payment: {invoiceData.paymentTerms || '90 Hari'}</p>
            <p>Please state with your payment: {displayInvoiceId}</p>
          </div>
          
          <div className="space-y-1">
             <p className="font-bold italic">For payment, please transfer to our Virtual account:</p>
             <p className="font-black text-[10pt] uppercase">VIRTUAL ACCOUNT A/N {customerName}</p>
             
             {invoiceData.paymentMethod === 'va' && (
                <div className="mt-2 border-2 border-black p-1.5 w-fit px-4 font-bold text-[8pt] tracking-widest uppercase">
                   {invoiceData.vaStatus === 'approved' ? (invoiceData.vaNumber || 'APPROVED') : 'AWAITING APPROVAL'}
                </div>
             )}
          </div>
        </div>

        <div className="w-[30%] flex flex-col items-center">
          <p className="font-bold text-[9pt] mb-20 uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
          <div className="w-full h-px bg-black"></div>
          <p className="font-bold uppercase pt-1 text-[9pt]">Finance</p>
        </div>
      </footer>
    </div>
  );
};
