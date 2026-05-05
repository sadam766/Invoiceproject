
'use client';

import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import Image from 'next/image';

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
  const maxItems = 10;
  const emptyRows = Math.max(0, maxItems - items.length);

  // Mapping fallback logic to ensure customer name and address are never missed
  const customerName = invoiceData.customerName || invoiceData.customer || 'N/A';
  const customerAddress = invoiceData.billingAddress || invoiceData.customerAddress || invoiceData.address || 'N/A';

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-10 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      {/* LABEL ORIGINAL/COPY */}
      <div className="absolute right-12 top-8 text-[8pt] text-black uppercase tracking-widest font-bold">
        {type}
      </div>

      {/* HEADER SECTION - Branding */}
      <header className="relative mb-4">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black flex items-center justify-center text-white font-black text-xl italic rounded-lg">J</div>
                <div>
                   <h2 className="font-black text-lg leading-none uppercase tracking-tighter">JEMBO CABLE</h2>
                   <p className="text-[8pt] font-medium italic opacity-60">Together We Grow</p>
                </div>
             </div>
             <div className="mt-4 space-y-0.5 text-[7pt] leading-tight max-w-[400px]">
                <p className="font-bold">PT JEMBO CABLE COMPANY Tbk.</p>
                <p><span className="font-bold">Head Office:</span> Jl. Industri Raya Blok A No. 1, Jatiuwung, Tangerang 15135, Indonesia.</p>
                <p><span className="font-bold">Marketing Office:</span> Mega Glodok Kemayoran Tower B 6th Floor, Jakarta Pusat.</p>
             </div>
          </div>
          <div className="text-right">
             <h1 className="font-black text-[11pt] uppercase tracking-wider mb-1">
                {isProforma ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT'}
             </h1>
             <p className="font-bold text-[14pt] leading-tight">{displayInvoiceId}</p>
          </div>
        </div>
        
        <div className="flex justify-between items-start mt-6 text-black border-t border-black pt-4">
          <div className="w-[60%] space-y-1">
            <p className="text-[8pt] uppercase font-bold text-slate-400">Customer Identity:</p>
            <p className="font-black uppercase text-[10pt]">{customerName}</p>
            <p className="text-[9pt] leading-tight italic max-w-[350px]">
                {customerAddress}
            </p>
          </div>
          <div className="text-[9pt] space-y-0.5 text-black" style={{ minWidth: '180px' }}>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.orderDate || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Reference A</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Date</span><span>:</span><span>{invoiceData.date || '-'}</span></div>
          </div>
        </div>
      </header>

      {/* TABLE */}
      <main className="relative flex-grow mt-2">
        <table className="w-full border-collapse border-black">
          <thead>
            <tr className="border-y border-black text-[9pt] text-black bg-slate-50">
              <th className="py-2 px-2 text-left border-r border-black w-[5%] font-bold">No.</th>
              <th className="py-2 px-2 text-left border-r border-black font-bold">Item</th>
              <th className="py-2 px-2 text-center border-r border-black w-[18%] font-bold">Quantity Unit</th>
              <th className="py-2 px-2 text-right border-r border-black w-[15%] font-bold">Price</th>
              <th className="py-2 px-2 text-right font-bold w-[18%]">Amount</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {items.map((item, idx) => (
              <tr key={idx} className="align-top text-[9pt] border-x border-black h-8">
                <td className="py-1 px-2 text-left border-r border-black">{idx + 1}</td>
                <td className="py-1 px-2 uppercase border-r border-black font-medium">{item.name}</td>
                <td className="py-1 px-2 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                <td className="py-1 px-2 text-right border-r border-black">{formatCurrency(item.price)}</td>
                <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
            {/* Filler rows */}
            {Array.from({ length: emptyRows }).map((_, i) => (
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

        {/* FINANCIAL CALCULATIONS */}
        <div className="flex justify-end mt-4 text-black">
          <div className="w-[45%] text-[9pt] space-y-1">
             <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span className="font-bold">Goods:</span>
                <span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
             </div>
             
             {/* DP Logic Visualization */}
             {invoiceData.dpValue > 0 && (
                 <div className="grid grid-cols-[1fr_auto] gap-x-4 italic">
                    <span>{invoiceData.dpDescription || 'Down Payment'}</span>
                    <span className="text-right">
                        {invoiceData.dpMode === 'kurangi' ? `(${formatCurrency(invoiceData.dpValue)})` : formatCurrency(invoiceData.dpValue)}
                    </span>
                 </div>
             )}

             {invoiceData.discount > 0 && (
                 <div className="grid grid-cols-[1fr_auto] gap-x-4 italic">
                    <span>Discount</span>
                    <span className="text-right">({formatCurrency(invoiceData.discount)})</span>
                 </div>
             )}

             <div className="border-t border-black my-1"></div>

             <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>DPP VAT (11/12):</span>
                <span className="text-right">{formatCurrency(calculations.dppVat)}</span>
             </div>
             <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>VAT 12%:</span>
                <span className="text-right">{formatCurrency(calculations.vat12)}</span>
             </div>
             
             <div className="border-t-2 border-black my-1"></div>
             
             <div className="grid grid-cols-[1fr_auto] gap-x-4 text-[11pt] font-black uppercase">
                <span>Total Rp:</span>
                <span className="text-right">{formatCurrency(calculations.totalRp)}</span>
             </div>
          </div>
        </div>
      </main>

      {/* FOOTER SECTION */}
      <footer className="mt-8 text-black"> 
        <div className="flex justify-between items-start">
          {/* INFORMASI PEMBAYARAN */}
          <div className="w-[65%] text-[8.5pt] leading-tight space-y-4">
            <div className="flex">
              <span className="w-[100px] font-bold">Payment Terms:</span>
              <span className="font-bold border-b border-black px-2">{invoiceData.paymentTerms || '90 Hari'}</span>
            </div>
            
            <div className="space-y-2">
              <p className="font-bold italic underline">Instructions for payment:</p>
              
              {invoiceData.paymentMethod === 'va' ? (
                <div className="bg-slate-50 p-4 border border-black rounded-lg space-y-2">
                   <p className="font-bold uppercase tracking-tight">VIRTUAL ACCOUNT TRANSFER (MANDIRI)</p>
                   <p className="text-[10pt] font-black">A/N {customerName}</p>
                   <p className="font-mono text-[12pt] font-black tracking-widest bg-white w-fit px-3 py-1 border border-black shadow-sm">
                      {invoiceData.vaNumber || 'AWAITING APPROVAL'}
                   </p>
                   <p className="text-[7pt] italic opacity-70 mt-1">Please include invoice number {displayInvoiceId} in transaction description.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-black rounded-lg">
                  <div className="space-y-1">
                    <p className="font-bold text-[7.5pt] border-b border-black pb-1 mb-1">BANK MANDIRI (RP)</p>
                    <p className="font-bold">A/C: 102-0100206827</p>
                    <p className="text-[7pt]">PT. JEMBO CABLE COMPANY Tbk</p>
                  </div>
                  <div className="space-y-1 border-l border-black pl-4">
                    <p className="font-bold text-[7.5pt] border-b border-black pb-1 mb-1">BANK BCA (RP)</p>
                    <p className="font-bold">A/C: 684-0198977</p>
                    <p className="text-[7pt]">Cabang KEM TOWER Jakarta</p>
                  </div>
                </div>
              )}
            </div>

            {/* ISO Certification Text */}
            <div className="pt-6 grid grid-cols-3 gap-2 opacity-40 grayscale">
               <div className="border border-black p-1 text-center font-bold text-[6pt]">ISO 9001:2015</div>
               <div className="border border-black p-1 text-center font-bold text-[6pt]">ISO 14001:2015</div>
               <div className="border border-black p-1 text-center font-bold text-[6pt]">ISO 45001:2018</div>
            </div>
          </div>

          {/* TANDA TANGAN */}
          <div className="w-[30%] flex flex-col items-center">
            <p className="font-bold text-[9pt] text-center mb-20 uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
            <div className="w-full h-px bg-black"></div>
            <p className="font-bold uppercase pt-1 text-[9pt]">Finance Department</p>
            <p className="text-[7pt] italic opacity-60">Verified Document V2.0</p>
          </div>
        </div>
      </footer>

      {/* Decorative Ornament (Watermark Effect) */}
      <div className="absolute bottom-4 right-4 w-32 h-32 opacity-[0.03] pointer-events-none rotate-45 border-4 border-black rounded-full"></div>
    </div>
  );
};
