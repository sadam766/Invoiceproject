
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
  const customerName = invoiceData.customerName || invoiceData.customer || 'N/A';
  const customerAddress = invoiceData.billingAddress || invoiceData.customerAddress || invoiceData.address || '';
  
  const isDeduction = invoiceData.dpMode === 'kurangi';
  const dpPercentMatch = invoiceData.dpDescription?.match(/(\d+)%/);
  const dpPercent = dpPercentMatch ? dpPercentMatch[1] : '';

  let netGoods = calculations.subTotalItems;
  if (invoiceData.dpMode === 'tagih') {
      netGoods = calculations.dpValue;
  } else {
      netGoods = Math.max(0, calculations.subTotalItems - calculations.dpValue - calculations.discountValue);
  }

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pb-16 px-12 flex flex-col font-sans shadow-lg print:shadow-none print:m-0 print:border-none overflow-hidden print:page-break-inside-avoid",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ 
        width: '210mm', 
        minHeight: '290mm', 
        paddingTop: '50mm', // Margin for physical letterhead (5cm)
        fontSize: '10pt', 
        color: '#000000', 
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Arial', 'Helvetica', sans-serif"
      }}
    >
      {/* Visual Indicator - Matching screenshot */}
      <div className="absolute right-12 top-[50mm] text-[10pt] text-slate-400 uppercase font-bold tracking-widest">
        {type}
      </div>

      <header className="text-center mb-8">
        <h1 className="font-black text-[16pt] uppercase text-black tracking-tight">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-black text-[13pt] leading-tight mt-1 text-black">{displayInvoiceId}</p>
      </header>

      <div className="flex justify-between items-start mb-6">
        <div className="w-[55%] space-y-1">
          <p className="font-black uppercase text-[11pt] text-black">{customerName}</p>
          <p className="text-[10pt] leading-tight italic whitespace-pre-line text-[#333333]">
              {customerAddress}
          </p>
        </div>
        <div className="text-[10pt] space-y-1 text-black" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Sales Order</span><span>:</span><span className="font-bold">{invoiceData.soNumber || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Order Date</span><span>:</span><span className="font-bold">{invoiceData.orderDate || invoiceData.date || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Reference A</span><span>:</span><span className="font-bold">-</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between py-1 mb-2 font-bold text-[10pt]">
          <span className="text-[#333333]">Customer Code : <span className="text-black font-black">{invoiceData.customerCode || '-'}</span></span>
          <span className="text-black font-black">Date: {invoiceData.date || '-'}</span>
      </div>

      <main className="relative flex-grow flex flex-col overflow-hidden">
        <div className="min-h-[300px]">
          <table className="w-full border-collapse border-y-2 border-black">
            <thead>
              <tr className="bg-[#F2F2F2] text-[9.5pt]">
                <th className="py-2 px-2 text-center border-x-2 border-black w-[5%] font-black">No.</th>
                <th className="py-2 px-2 text-left border-r-2 border-black font-black">Item</th>
                <th className="py-2 px-2 text-center border-r-2 border-black w-[20%] font-black">Quantity Unit</th>
                <th className="py-2 px-2 text-right border-r-2 border-black w-[15%] font-black">Price</th>
                <th className="py-2 px-2 text-right border-r-2 border-black w-[18%] font-black">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="align-top text-[10pt] h-8">
                  <td className="py-1 px-2 text-center border-x-2 border-black">{idx + 1}</td>
                  <td className="py-1 px-2 uppercase border-r-2 border-black font-medium">{item.name}</td>
                  <td className="py-1 px-2 text-center border-r-2 border-black font-bold">
                    {item.quantity.toLocaleString('id-ID')} {item.unit}
                  </td>
                  <td className="py-1 px-2 text-right border-r-2 border-black">{formatCurrency(item.price)}</td>
                  <td className="py-1 px-2 text-right border-r-2 border-black font-bold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Vertical border padding rows */}
              {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-8">
                  <td className="border-x-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 mb-4 flex justify-end">
          <div className="w-[320px] flex flex-col items-end border-t-2 border-black pt-2"> 
            <div className="flex justify-between w-full text-[10pt] font-black text-black">
              <span>Sub-Total</span>
              <span>{formatCurrency(calculations.subTotalItems)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-auto print:page-break-inside-avoid">
          <div className="w-full flex justify-start mb-2">
            <p className="text-[9pt] font-black text-black uppercase">No PO : <span className="underline decoration-2">{invoiceData.poNumber || '-'}</span></p>
          </div>
          <div className="border-t-2 border-black w-full mb-1"></div>
          <div className="flex justify-end mt-1">
            <div className="w-[45%] text-[10pt] space-y-1 pt-1 text-black">
              <div className="flex justify-between font-medium">
                <span>Goods:</span>
                <span className="font-bold">{formatCurrency(netGoods)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>DPP VAT (11/12):</span>
                <span className="font-bold">{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>VAT 12%:</span>
                <span className="font-bold">{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="flex justify-between font-black mt-2 border-t-2 border-black pt-2 text-[11pt]">
                <span>Total Rp:</span>
                <span>{formatCurrency(calculations.totalRp)}</span>
              </div>
            </div>
          </div>
          <div className="border-t-2 border-black w-full my-6"></div>
          
          <div className="flex justify-between items-start">
            <div className="w-[65%] text-[9pt] leading-tight space-y-3 text-black">
              <div className="flex gap-2">
                <span className="font-black uppercase">Payment:</span>
                <span className="font-bold">{invoiceData.paymentTerms || '90 Hari setelah invoice diterima'}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <p className="font-black uppercase tracking-tight">Please state with your payment: <span className="underline decoration-2">{displayInvoiceId}</span></p>
                <p className="font-bold italic text-[#444444] mt-2">For payment, please transfer to our account:</p>
                <p className="font-black uppercase text-[10.5pt]">PT. JEMBO CABLE COMPANY Tbk</p>
              </div>
              
              <div className="space-y-1.5 text-[9pt] mt-2">
                <div className="flex"><span className="w-[140px] font-bold">Bank Mandiri -</span><span>A/C No. : <span className="font-black text-[10pt]">102-0100206827 (Rp)</span></span></div>
                <div className="flex"><span className="w-[140px] font-bold">Jakarta Cabang</span><span>A/C No. : <span className="font-black text-[10pt]">102-0005000218 (Rp)</span></span></div>
                <div className="text-[7pt] font-black text-slate-400 italic tracking-[0.4em] py-0.5 ml-12">OR</div>
                <div className="flex items-start">
                  <span className="w-[140px] font-bold leading-tight">Bank BCA - Jakarta<br/><span className="text-[8pt] font-medium italic opacity-70">Cabang KEM TOWER</span></span>
                  <span>A/C No. : <span className="font-black text-[11pt]">684-0198977 (Rp)</span></span>
                </div>
              </div>
            </div>
            
            <div className="w-[35%] flex flex-col items-center">
              <p className="font-black text-[9.5pt] uppercase text-center leading-tight">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-24 border-t-2 border-black w-[80%]"></div>
              <p className="font-black uppercase pt-1 text-[11pt] underline decoration-2">FINANCE</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
