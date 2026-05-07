
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
        paddingTop: '45mm', // Space for physical letterhead (approx 4.5cm)
        fontSize: '10pt', 
        color: '#000000', 
        boxSizing: 'border-box' 
      }}
    >
      {/* Visual Indicator for UI only - Hidden in Print */}
      <div className="absolute right-12 top-6 text-[10pt] text-slate-300 uppercase font-black tracking-[0.2em] print:hidden">
        {type}
      </div>

      <header className="text-center mb-6">
        <h1 className="font-bold text-[16pt] uppercase text-black">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-bold text-[12pt] leading-tight mt-1 text-black">{displayInvoiceId}</p>
      </header>

      <div className="flex justify-between items-start mt-4 mb-2 border-t border-black/10 pt-4">
        <div className="w-[55%] space-y-0.5">
          <p className="font-bold uppercase text-[10pt] text-black">{customerName}</p>
          <p className="text-[9pt] leading-tight italic whitespace-pre-line text-[#333333]">
              {customerAddress}
          </p>
        </div>
        <div className="text-[9pt] space-y-1 text-black" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Sales Order</span><span>:</span><span className="font-medium">{invoiceData.soNumber || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Order Date</span><span>:</span><span className="font-medium">{invoiceData.orderDate || invoiceData.date || '-'}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr]">
            <span className="text-[#333333]">Date</span><span>:</span><span className="font-medium">{invoiceData.date || '-'}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between py-1 mb-2 font-medium text-[9pt]">
          <span className="text-[#333333]">Customer Code : <span className="text-black font-bold">{invoiceData.customerCode || '-'}</span></span>
      </div>

      <main className="relative flex-grow flex flex-col overflow-hidden">
        <div className="min-h-[240px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border border-black bg-[#F2F2F2] text-[9pt]">
                <th className="py-2 px-2 text-center border-r border-black w-[5%] font-bold">No.</th>
                <th className="py-2 px-2 text-center border-r border-black font-bold">Item</th>
                <th className="py-2 px-2 text-center border-r border-black w-[18%] font-bold">Quantity Unit</th>
                <th className="py-2 px-2 text-center border-r border-black w-[15%] font-bold">Price</th>
                <th className="py-2 px-2 text-center font-bold w-[18%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="align-top text-[10pt] border-x border-black h-7">
                  <td className="py-1 px-2 text-center border-r border-black">{idx + 1}</td>
                  <td className="py-1 px-2 uppercase border-r border-black">{item.name}</td>
                  <td className="py-1 px-2 text-center border-r border-black">
                    {item.quantity.toLocaleString('id-ID')} {item.unit}
                  </td>
                  <td className="py-1 px-2 text-right border-r border-black">{formatCurrency(item.price)}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Padding rows to keep table structure consistent */}
              {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-x border-black h-7">
                  <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                </tr>
              ))}
              <tr className="border-t border-black"></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 mb-4 flex justify-end">
          <div className="w-[300px] flex flex-col items-end"> 
            <div className="flex justify-between w-full text-[10pt] font-normal text-black">
              <span>Sub-Total</span>
              <span>{formatCurrency(calculations.subTotalItems)}</span>
            </div>
            {calculations.discountValue > 0 && (
              <div className="flex justify-between w-full text-[10pt] mt-0.5 text-black">
                <span className="pl-4">Discount</span>
                <span>({formatCurrency(calculations.discountValue)})</span>
              </div>
            )}
            {calculations.dpValue > 0 && (
              <div className="flex justify-between w-full text-[10pt] mt-0.5 text-black">
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
            <p className="text-[9pt] font-medium text-black">No PO : <span className="font-bold">{invoiceData.poNumber || '-'}</span></p>
          </div>
          <div className="border-t border-black w-full mb-1"></div>
          <div className="flex justify-end mt-1">
            <div className="w-[35%] text-[10pt] space-y-0.5 pt-1 text-black">
              <div className="flex justify-between">
                <span>Goods:</span>
                <span>{formatCurrency(netGoods)}</span>
              </div>
              <div className="flex justify-between">
                <span>DPP VAT (11/12):</span>
                <span>{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT 12%:</span>
                <span>{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="flex justify-between font-bold mt-1 border-t border-black pt-1">
                <span>Total Rp:</span>
                <span>{formatCurrency(calculations.totalRp)}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-black w-full my-3"></div>
          
          <div className="flex justify-between items-start">
            <div className="w-[68%] text-[9pt] leading-tight space-y-2 text-black">
              <div className="flex mb-1">
                <span className="w-[80px] font-bold">Payment:</span>
                <span>{invoiceData.paymentTerms || '90 Hari setelah invoice diterima'}</span>
              </div>
              <div className="flex flex-col space-y-0.5">
                <p className="font-bold">Please state with your payment: <span className="font-black underline">{displayInvoiceId}</span></p>
                <p className="font-medium italic">For payment, please transfer to our account:</p>
                <p className="font-bold uppercase pt-1">PT. Jembo Cable Company Tbk</p>
              </div>
              
              <div className="mt-1">
                {invoiceData.paymentMode === 'virtual_account' ? (
                  <div className="w-[300px] bg-[#F2F2F2] p-3 rounded border border-black/10">
                    <p className="font-bold text-[8pt] mb-1 underline uppercase">VIRTUAL ACCOUNT (MANDIRI)</p>
                    <div className="space-y-0.5 text-[9pt]">
                      <div className="grid grid-cols-[80px_5px_1fr]">
                        <span>VA No.</span><span>:</span><span className="font-bold text-[11pt] tracking-widest">{invoiceData.vaNumber || '-'}</span>
                      </div>
                      <div className="grid grid-cols-[80px_5px_1fr]">
                        <span>Name</span><span>:</span><span className="uppercase font-medium">{customerName}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-[8.5pt]">
                    <div className="space-y-0.5">
                      <div className="flex"><span className="w-[120px] font-bold">Bank Mandiri -</span><span>A/C No. : <span className="font-bold">102-0100206827 (Rp)</span></span></div>
                      <div className="flex"><span className="w-[120px] font-bold">Jakarta Cabang</span><span>A/C No. : <span className="font-bold">102-0005000218 (Rp)</span></span></div>
                    </div>
                    <div className="w-[280px] text-center font-bold text-slate-300 italic tracking-[0.3em] py-0 text-[7pt]">--- OR ---</div>
                    <div className="flex items-start">
                      <div className="w-[120px] font-bold leading-tight">
                        Bank BCA - Jakarta<br/>
                        <span className="font-normal text-[8pt]">Cabang KEM TOWER</span>
                      </div>
                      <div className="ml-0">
                        A/C No. : <span className="font-bold text-[10pt]">684-0198977 (Rp)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-[30%] flex flex-col items-center">
              <p className="font-bold text-[9pt] uppercase text-center leading-tight">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-24 border-t border-black w-full"></div>
              <p className="font-bold uppercase pt-1 text-[10pt] underline">Finance</p>
            </div>
          </div>
        </footer>
      </main>

      <div className="absolute bottom-4 left-0 right-0 text-center text-[7pt] text-slate-400 print:hidden">
          Halaman 1 dari 1
      </div>
    </div>
  );
};
