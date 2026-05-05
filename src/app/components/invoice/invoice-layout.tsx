
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
  const customerAddress = invoiceData.billingAddress || invoiceData.customerAddress || invoiceData.address || '';

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-8 pb-10 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      {/* TOP LABEL */}
      <div className="absolute right-12 top-8 text-[9pt] text-black font-medium">
        {type}
      </div>

      {/* HEADER TITLE */}
      <header className="text-center mt-10 mb-8">
        <h1 className="font-bold text-[10pt] uppercase tracking-wider mb-1">
            {isProforma ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT'}
        </h1>
        <p className="font-bold text-[14pt] leading-tight">{displayInvoiceId}</p>
      </header>

      {/* CUSTOMER & REF INFO */}
      <div className="flex justify-between items-start mb-6">
        <div className="w-[50%] space-y-0.5">
          <p className="font-bold uppercase text-[10pt]">{customerName}</p>
          <p className="text-[9pt] leading-tight italic whitespace-pre-line">
              {customerAddress}
          </p>
        </div>
        <div className="text-[9pt] space-y-1 text-black font-medium" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || ''}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.orderDate || ''}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Reference A</span><span>:</span><span>{invoiceData.poNumber || ''}</span></div>
        </div>
      </div>

      {/* DATE BAR */}
      <div className="flex justify-between py-1 mb-2 font-medium text-[9pt]">
         <span>Customer Code : {invoiceData.customerCode || ''}</span>
         <span>Date: {invoiceData.date || ''}</span>
      </div>

      {/* TABLE SECTION */}
      <main className="relative flex-grow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-black text-[9pt] font-bold">
              <th className="py-2 px-1 text-left w-[5%]">No.</th>
              <th className="py-2 px-1 text-left">Item</th>
              <th className="py-2 px-1 text-center w-[18%]">Quantity Unit</th>
              <th className="py-2 px-1 text-right w-[15%]">Price</th>
              <th className="py-2 px-1 text-right w-[18%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="align-top text-[9pt] h-8">
                <td className="py-1 px-1 text-left">{idx + 1}</td>
                <td className="py-1 px-1 uppercase font-medium">{item.name}</td>
                <td className="py-1 px-1 text-center">
                  {item.quantity.toLocaleString('id-ID')} {item.unit}
                </td>
                <td className="py-1 px-1 text-right">{formatCurrency(item.price)}</td>
                <td className="py-1 px-1 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}

            {/* Filler rows */}
            {Array.from({ length: Math.max(0, emptyRows) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-8">
                <td colSpan={5}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Short line under Amount column only */}
        <div className="flex justify-end">
            <div className="w-[18%] border-t border-black mt-2"></div>
        </div>
        
        {/* Sub-total Items display right under the short line */}
        <div className="flex justify-end mb-4">
            <div className="w-[18%] text-right font-bold text-[9pt]">
                {formatCurrency(calculations.subTotalItems)}
            </div>
        </div>

        {/* PO Reference Line - Top border removed as requested */}
        <div className="border-b-2 border-black py-2 mb-8 font-bold">
            No PO : {invoiceData.poNumber || ''}
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="flex justify-end border-t border-black pt-4">
           <div className="w-[40%] space-y-1 text-[9pt]">
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                 <span>Goods:</span>
                 <span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                 <span>DPP VAT (11/12):</span>
                 <span className="text-right">{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                 <span>VAT 12%:</span>
                 <span className="text-right">{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 font-bold border-t border-black pt-1 uppercase text-[10pt]">
                 <span>Total Rp:</span>
                 <span className="text-right">{formatCurrency(calculations.totalRp)}</span>
              </div>
           </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 flex justify-between items-end border-t-2 border-black pt-6">
        <div className="w-[65%] space-y-4 text-[8.5pt]">
          <div className="space-y-1">
            <p>Payment: {invoiceData.paymentTerms || '90 Hari setelah invoice diterima'}</p>
            <p>Please state with your payment: <span className="font-bold">{displayInvoiceId}</span></p>
            <p>For payment, please transfer to our account:</p>
            <p className="font-bold">PT. Jembo Cable Company Tbk</p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4">
             <div className="space-y-0.5">
                <p>Bank Mandiri -</p>
                <p>Jakarta Cabang</p>
                <p>Sudirman</p>
             </div>
             <div className="space-y-0.5">
                <p>A/C No. : 102-0100206827 (Rp)</p>
                <p>A/C No. : 102-0005000218 (Rp)</p>
                <p>A/C No. : 102-0005000226 (USD)</p>
             </div>
          </div>

          {/* Centered OR text between Mandiri and BCA blocks */}
          <div className="text-center font-bold italic py-2 w-[80%] uppercase tracking-widest text-[8pt] text-slate-400">
             - OR -
          </div>

          <div className="grid grid-cols-2 gap-x-4">
             <div className="space-y-0.5">
                <p>Bank BCA - Jakarta</p>
                <p>Cabang KEM TOWER</p>
             </div>
             <div className="space-y-0.5 pt-2">
                <p>A/C No. : 684-0198977 (Rp)</p>
             </div>
          </div>
        </div>

        <div className="w-[30%] flex flex-col items-center">
          <p className="font-bold text-[9pt] mb-20 uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
          <div className="w-full h-px bg-black"></div>
          <p className="font-bold uppercase pt-1 text-[9pt]">Finance</p>
        </div>
      </footer>

      {/* PAGE NUMBER */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-[7pt] text-slate-400">
          Halaman 1 dari 1
      </div>
    </div>
  );
};
