
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
  const maxItems = 10;
  const emptyRows = Math.max(0, maxItems - items.length);

  // Mapping fallback logic to ensure customer name and address are never missed
  const customerName = invoiceData.customerName || invoiceData.customer || 'N/A';
  const customerAddress = invoiceData.billingAddress || invoiceData.customerAddress || 'N/A';

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      {/* LABEL ORIGINAL/COPY - Solid Black for Print Professionalism */}
      <div className="absolute right-12 top-8 text-[10pt] text-black uppercase tracking-widest">
        {type}
      </div>

      {/* HEADER - CENTERED */}
      <header className="relative mb-6">
        <div className="text-center w-full space-y-1 text-black">
          <h1 className="font-bold text-[11pt] uppercase tracking-wider">INVOICE/OFFICIAL RECEIPT</h1>
          {/* REVISI: Ukuran 18pt, Bold, Tanpa "No:", Center */}
          <p className="font-bold text-[18pt] leading-tight">{displayInvoiceId}</p>
        </div>
        
        <div className="flex justify-between items-start mt-6 text-black">
          <div className="w-[60%] space-y-1">
            {/* REVISI: Mapping data pelanggan yang sinkron dengan Dashboard */}
            <p className="font-bold uppercase text-[10pt]">{customerName}</p>
            <p className="text-[9pt] leading-tight italic max-w-[350px]">
                {customerAddress}
            </p>
          </div>
          <div className="text-[9pt] space-y-0.5 text-black" style={{ minWidth: '180px' }}>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>-</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Reference A</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
          </div>
        </div>
      </header>

      <div className="flex justify-between mb-1 px-0.5 text-[9pt] border-t border-black pt-1 text-black">
        <span>Customer Code : {invoiceData.customerCode || '-'}</span>
        <span>Date: {invoiceData.date || '-'}</span>
      </div>

      {/* TABLE */}
      <main className="relative flex-grow">
        <table className="w-full border-collapse border-black">
          <thead>
            <tr className="border border-black text-[9pt] text-black">
              <th className="py-1 px-2 text-left border-r border-black w-[5%] font-normal">No.</th>
              <th className="py-1 px-2 text-left border-r border-black font-normal">Item</th>
              <th className="py-1 px-2 text-center border-r border-black w-[18%] font-normal">Quantity Unit</th>
              <th className="py-1 px-2 text-right border-r border-black w-[15%] font-normal">Price</th>
              <th className="py-1 px-2 text-right font-normal w-[18%]">Amount</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {items.map((item, idx) => (
              <tr key={idx} className="align-top text-[9pt] border-x border-black h-8">
                <td className="py-1 px-2 text-left border-r border-black">{idx + 1}</td>
                <td className="py-1 px-2 uppercase border-r border-black">{item.name}</td>
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

        {/* FINANCIAL ADJUSTMENTS - UNDER TABLE */}
        <div className="flex justify-end mt-2 text-black">
          <div className="w-[18%] text-right pr-2">
            <div className="border-t border-black w-full mb-0.5"></div>
            <p className="font-bold text-[9pt]">{formatCurrency(calculations.subTotalItems)}</p>
          </div>
        </div>

        {/* DP & DISCOUNT ROWS */}
        <div className="flex justify-end mt-1 text-black">
            <div className="w-[40%] text-[9pt]">
                {calculations.dpValue > 0 && (
                    <div className="grid grid-cols-[1fr_auto] gap-x-4">
                        <span className="font-medium italic">{invoiceData.dpDescription || 'DP'}</span>
                        <span className="text-right">
                            {invoiceData.dpMode === 'kurangi' ? `(${formatCurrency(calculations.dpValue)})` : formatCurrency(calculations.dpValue)}
                        </span>
                    </div>
                )}
                {calculations.discountValue > 0 && (
                    <div className="grid grid-cols-[1fr_auto] gap-x-4">
                        <span className="font-medium italic">Diskon</span>
                        <span className="text-right">({formatCurrency(calculations.discountValue)})</span>
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* FOOTER SECTION */}
      <footer className="mt-8 text-black"> 
        <div className="w-full flex justify-start mb-0.5">
          <p className="text-[9pt] font-medium italic">Reference A : {invoiceData.poNumber || '-'}</p>
        </div>
        <div className="border-t border-black w-full mb-0.5"></div>

        <div className="flex justify-end mt-1">
          <div className="w-1/4 text-[9pt] leading-tight">
            <div className="grid grid-cols-[1fr_auto] gap-x-4">
              <span>Goods:</span><span className="text-right">{formatCurrency(calculations.subTotalItems - (invoiceData.dpMode === 'kurangi' ? calculations.dpValue : 0) - calculations.discountValue)}</span>
              <span>DPP VAT (11/12):</span><span className="text-right">{formatCurrency(calculations.dppVat)}</span>
              <span>VAT 12%:</span><span className="text-right">{formatCurrency(calculations.vat12)}</span>
              <div className="col-span-2 border-t border-black my-0.5 opacity-30"></div>
              <span className="font-bold">Total Rp:</span><span className="text-right font-bold">{formatCurrency(calculations.totalRp)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-black w-full my-1"></div>

        <div className="flex justify-between items-start">
          {/* INFORMASI PEMBAYARAN HYBRID */}
          <div className="w-[68%] text-[9pt] leading-tight space-y-2">
            <div className="flex">
              <span className="w-[60px] font-bold">Payment:</span>
              <span className="font-bold">{invoiceData.paymentTerms || '90 Hari'}</span>
            </div>
            
            <div className="flex flex-col">
              <p className="font-bold">Please state with your payment: {displayInvoiceId}</p>
              
              {invoiceData.paymentMethod === 'va' ? (
                <div className="mt-2 space-y-1">
                   <p className="font-bold italic">For payment, please transfer to our Virtual account:</p>
                   <p className="font-black text-[10pt] uppercase">VIRTUAL ACCOUNT A/N {customerName}</p>
                   <p className="font-mono text-xs tracking-widest border border-black w-fit p-1 bg-black/5">{invoiceData.vaNumber || 'AWAITING APPROVAL'}</p>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="font-bold italic">For payment, please transfer to our account:</p>
                  <p className="font-bold">PT. Jembo Cable Company Tbk</p>
                  <div className="text-[9pt] mt-1 space-y-0.5">
                    <div className="flex"><span className="w-[100px]">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000226 (USD)</span></div>
                  </div>
                  <div className="w-[280px] text-center font-bold text-black opacity-10 py-1">OR</div>
                  <div className="flex items-start">
                    <div className="w-[100px] leading-tight">Bank BCA - Jakarta<br/>(Cabang KEM TOWER)</div>
                    <div>A/C No. : 684-0198977 (Rp)</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TANDA TANGAN */}
          <div className="w-[32%] flex flex-col items-center">
            <p className="font-bold text-[9pt]">PT. JEMBO CABLE COMPANY Tbk</p>
            <div className="mt-24 border-t border-black w-full"></div>
            <p className="font-bold uppercase pt-1 text-[9pt]">Finance</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
