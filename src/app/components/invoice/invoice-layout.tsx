
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
        "relative bg-white mx-auto pb-20 px-12 flex flex-col font-sans shadow-lg print:shadow-none print:m-0 print:border-none overflow-hidden print:page-break-inside-avoid",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ 
        width: '210mm', 
        minHeight: '285mm', 
        paddingTop: '50mm', // Specific for physical letterhead (5cm)
        fontSize: '10pt', 
        color: '#000000', 
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Arial', 'Helvetica', sans-serif"
      }}
    >
      {/* Visual Indicator for UI only - Hidden in Print */}
      <div className="absolute right-12 top-10 text-[10pt] text-slate-200 uppercase font-black tracking-[0.2em] print:hidden">
        {type}
      </div>

      <header className="text-center mb-6">
        <h1 className="font-bold text-[16pt] uppercase text-black tracking-tight">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-bold text-[13pt] leading-tight mt-1 text-black">{displayInvoiceId}</p>
      </header>

      <div className="flex justify-between items-start mt-4 mb-2 border-t-2 border-black/10 pt-4">
        <div className="w-[55%] space-y-0.5">
          <p className="font-bold uppercase text-[10pt] text-black">{customerName}</p>
          <p className="text-[9pt] leading-tight italic whitespace-pre-line text-[#333333]">
              {customerAddress}
          </p>
        </div>
        <div className="text-[9pt] space-y-1 text-black" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Sales Order</span><span>:</span><span className="font-bold">{invoiceData.soNumber || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Order Date</span><span>:</span><span className="font-bold">{invoiceData.orderDate || invoiceData.date || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Date</span><span>:</span><span className="font-bold">{invoiceData.date || '-'}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between py-1 mb-2 font-bold text-[9pt]">
          <span className="text-[#333333]">Customer Code : <span className="text-black font-black">{invoiceData.customerCode || '-'}</span></span>
      </div>

      <main className="relative flex-grow flex flex-col overflow-hidden">
        <div className="min-h-[220px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-2 border-black bg-[#F2F2F2] text-[9pt]">
                <th className="py-2 px-2 text-center border-r-2 border-black w-[5%] font-black">No.</th>
                <th className="py-2 px-2 text-center border-r-2 border-black font-black">Item Description</th>
                <th className="py-2 px-2 text-center border-r-2 border-black w-[18%] font-black">Quantity Unit</th>
                <th className="py-2 px-2 text-center border-r-2 border-black w-[15%] font-black">Price</th>
                <th className="py-2 px-2 text-center font-black w-[18%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="align-top text-[10pt] border-x-2 border-black h-8">
                  <td className="py-1 px-2 text-center border-r-2 border-black">{idx + 1}</td>
                  <td className="py-1 px-2 uppercase border-r-2 border-black font-medium">{item.name}</td>
                  <td className="py-1 px-2 text-center border-r-2 border-black font-bold">
                    {item.quantity.toLocaleString('id-ID')} {item.unit}
                  </td>
                  <td className="py-1 px-2 text-right border-r-2 border-black">{formatCurrency(item.price)}</td>
                  <td className="py-1 px-2 text-right font-bold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Padding rows to keep table structure consistent */}
              {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-x-2 border-black h-8">
                  <td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td></td>
                </tr>
              ))}
              <tr className="border-t-2 border-black"></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 mb-4 flex justify-end">
          <div className="w-[320px] flex flex-col items-end"> 
            <div className="flex justify-between w-full text-[10pt] font-medium text-black">
              <span>Sub-Total</span>
              <span>{formatCurrency(calculations.subTotalItems)}</span>
            </div>
            {calculations.discountValue > 0 && (
              <div className="flex justify-between w-full text-[10pt] mt-0.5 text-black font-bold">
                <span className="pl-4">Discount</span>
                <span>({formatCurrency(calculations.discountValue)})</span>
              </div>
            )}
            {calculations.dpValue > 0 && (
              <div className="flex justify-between w-full text-[10pt] mt-0.5 text-black font-bold">
                <div className="flex gap-4 pl-4">
                  <span>DP</span>
                  <span className="text-slate-500">{dpPercent}%</span>
                </div>
                <span>
                  {isDeduction ? `(${formatCurrency(calculations.dpValue)})` : formatCurrency(calculations.dpValue)}
                </span>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-auto print:page-break-inside-avoid">
          <div className="w-full flex justify-start mb-1">
            <p className="text-[9pt] font-bold text-black uppercase">No PO : <span className="font-black underline">{invoiceData.poNumber || '-'}</span></p>
          </div>
          <div className="border-t-2 border-black w-full mb-1"></div>
          <div className="flex justify-end mt-1">
            <div className="w-[40%] text-[10pt] space-y-0.5 pt-1 text-black">
              <div className="flex justify-between font-medium">
                <span>Goods:</span>
                <span>{formatCurrency(netGoods)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>DPP VAT (11/12):</span>
                <span>{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>VAT 12%:</span>
                <span>{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="flex justify-between font-black mt-1 border-t-2 border-black pt-1 text-[11pt]">
                <span>Total Rp:</span>
                <span>{formatCurrency(calculations.totalRp)}</span>
              </div>
            </div>
          </div>
          <div className="border-t-2 border-black w-full my-4"></div>
          
          <div className="flex justify-between items-start">
            <div className="w-[68%] text-[9pt] leading-tight space-y-2 text-black">
              <div className="flex mb-1">
                <span className="w-[80px] font-black uppercase">Payment:</span>
                <span className="font-bold">{invoiceData.paymentTerms || '90 Hari setelah invoice diterima'}</span>
              </div>
              <div className="flex flex-col space-y-0.5">
                <p className="font-black">Please state with your payment: <span className="font-black underline decoration-2">{displayInvoiceId}</span></p>
                <p className="font-bold italic text-[#444444]">For payment, please transfer to our account:</p>
                <p className="font-black uppercase pt-1 text-[10pt]">PT. Jembo Cable Company Tbk</p>
              </div>
              
              <div className="mt-1">
                {invoiceData.paymentMode === 'virtual_account' ? (
                  <div className="w-[320px] bg-[#F2F2F2] p-4 rounded-lg border-2 border-black/10">
                    <p className="font-black text-[8.5pt] mb-1 underline uppercase">VIRTUAL ACCOUNT (MANDIRI)</p>
                    <div className="space-y-0.5 text-[9.5pt]">
                      <div className="grid grid-cols-[80px_5px_1fr] items-center">
                        <span>VA No.</span><span>:</span><span className="font-black text-[12pt] tracking-widest">{invoiceData.vaNumber || '-'}</span>
                      </div>
                      <div className="grid grid-cols-[80px_5px_1fr]">
                        <span>Name</span><span>:</span><span className="uppercase font-bold">{customerName}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-[9pt]">
                    <div className="space-y-1">
                      <div className="flex"><span className="w-[130px] font-bold">Bank Mandiri -</span><span>A/C No. : <span className="font-black">102-0100206827 (Rp)</span></span></div>
                      <div className="flex"><span className="w-[130px] font-bold">Jakarta Cabang</span><span>A/C No. : <span className="font-black">102-0005000218 (Rp)</span></span></div>
                    </div>
                    <div className="w-[300px] text-center font-black text-slate-300 italic tracking-[0.4em] py-0 text-[7pt]">--- OR ---</div>
                    <div className="flex items-start">
                      <div className="w-[130px] font-bold leading-tight">
                        Bank BCA - Jakarta<br/>
                        <span className="font-medium text-[8pt]">Cabang KEM TOWER</span>
                      </div>
                      <div className="ml-0">
                        A/C No. : <span className="font-black text-[11pt]">684-0198977 (Rp)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-[30%] flex flex-col items-center">
              <p className="font-black text-[9pt] uppercase text-center leading-tight">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-24 border-t-2 border-black w-full"></div>
              <p className="font-black uppercase pt-1 text-[11pt] underline decoration-2">Finance</p>
            </div>
          </div>
        </footer>
      </main>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[7pt] text-slate-400 font-bold uppercase tracking-widest print:hidden">
          Halaman 1 dari 1 — Dakota Hub Cloud Verified
      </div>
    </div>
  );
};
