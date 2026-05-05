
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
  
  // Logic: isDeduction check (Jika statusnya adalah deduksi/pelunasan)
  const isDeduction = invoiceData.dpMode === 'kurangi';
  
  // Extract percentage from description (e.g. "DP 35%")
  const dpPercentMatch = invoiceData.dpDescription?.match(/(\d+)%/);
  const dpPercent = dpPercentMatch ? dpPercentMatch[1] : '';

  // Calculate Net Goods for the financial summary block
  // Jika tagih DP -> Goods adalah nominal DP
  // Jika kurangi DP -> Goods adalah Subtotal - DP - Discount
  let netGoods = calculations.subTotalItems;
  if (invoiceData.dpMode === 'tagih') {
      netGoods = calculations.dpValue;
  } else {
      netGoods = Math.max(0, calculations.subTotalItems - calculations.dpValue - calculations.discountValue);
  }

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      {/* LABEL POJOK KANAN */}
      <div className="absolute right-12 top-12 text-[10pt] text-slate-400 uppercase font-medium">
        {type}
      </div>

      {/* HEADER TITLE */}
      <header className="text-center mb-4">
        <h1 className="font-bold text-[11pt] uppercase">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-bold text-[14pt] leading-tight mt-1">{displayInvoiceId}</p>
      </header>

      {/* CUSTOMER & REF INFO */}
      <div className="flex justify-between items-start mt-4 mb-2">
        <div className="w-[50%] space-y-0.5">
          <p className="font-bold uppercase text-[10pt]">{customerName}</p>
          <p className="text-[9pt] leading-tight italic whitespace-pre-line">
              {customerAddress}
          </p>
        </div>
        <div className="text-[9pt] space-y-0.5 text-black" style={{ minWidth: '220px' }}>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.orderDate || invoiceData.date || '-'}</span></div>
          <div className="grid grid-cols-[100px_10px_1fr]"><span>Reference A</span><span>:</span><span>-</span></div>
        </div>
      </div>

      {/* DATE BAR */}
      <div className="flex justify-between py-1 mb-1 font-medium text-[9pt] border-t border-slate-100 pt-1">
         <span>Customer Code : {invoiceData.customerCode || '-'}</span>
         <span>Date: {invoiceData.date || '-'}</span>
      </div>

      {/* TABLE SECTION */}
      <main className="relative flex-grow flex flex-col">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border border-black text-[9pt]">
              <th className="py-1 px-2 text-left border-r border-black w-[5%] font-normal">No.</th>
              <th className="py-1 px-2 text-left border-r border-black font-normal">Item</th>
              <th className="py-1 px-2 text-center border-r border-black w-[18%] font-normal">Quantity Unit</th>
              <th className="py-1 px-2 text-right border-r border-black w-[15%] font-normal">Price</th>
              <th className="py-1 px-2 text-right font-normal w-[18%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="align-top text-[9pt] h-7">
                <td className="py-1 px-2 text-left">{idx + 1}</td>
                <td className="py-1 px-2 uppercase">{item.name}</td>
                <td className="py-1 px-2 text-center">
                  {item.quantity.toLocaleString('id-ID')} {item.unit}
                </td>
                <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* SECTION SUBTOTAL, DISCOUNT, DP */}
        <div className="flex justify-end mt-4">
          <div className="w-[35%] pr-1"> 
            
            {/* Baris Sub-Total Item */}
            <div className="flex justify-end border-t border-black pt-1 mb-1">
              <span className="font-normal text-[9pt]">{formatCurrency(calculations.subTotalItems)}</span>
            </div>

            {/* Baris Discount */}
            {calculations.discountValue > 0 && (
              <div className="grid grid-cols-[1fr_auto] gap-x-10 text-[9pt] mb-1">
                <span className="text-right">Discount</span>
                <span className="w-[120px] text-right">({formatCurrency(calculations.discountValue)})</span>
              </div>
            )}

            {/* Baris DP */}
            {calculations.dpValue > 0 && (
              <div className="grid grid-cols-[1fr_1.5fr_auto] gap-x-4 text-[9pt]">
                <span className="text-right">DP</span>
                <span className="text-center">{dpPercent}{dpPercent ? '%' : ''}</span>
                <span className="w-[120px] text-right">
                  {isDeduction ? `(${formatCurrency(calculations.dpValue)})` : formatCurrency(calculations.dpValue)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PENDORONG (SPACER) - Mendorong Footer ke bawah halaman */}
        <div className="flex-grow min-h-[40px]"></div>

        {/* FOOTER SECTION */}
        <div className="mt-auto">
          <div className="w-full flex justify-start mb-0.5">
            <p className="text-[10px] font-medium">No PO : {invoiceData.poNumber || '-'}</p>
          </div>
          <div className="border-t border-black w-full mb-0.5"></div>

          {/* FINANCIAL SUMMARY */}
          <div className="flex justify-end mt-1">
            <div className="w-1/4 text-[10px] leading-tight space-y-0.5">
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>Goods:</span>
                <span className="text-right">{formatCurrency(netGoods)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>DPP VAT (11/12):</span>
                <span className="text-right">{formatCurrency(calculations.dppVat)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                <span>VAT 12%:</span>
                <span className="text-right">{formatCurrency(calculations.vat12)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 font-bold border-t border-black pt-1">
                <span>Total Rp:</span>
                <span className="text-right">{formatCurrency(calculations.totalRp)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-black w-full my-2"></div>

          <div className="flex justify-between items-start">
            {/* INFORMASI PEMBAYARAN */}
            <div className="w-[68%] text-[10px] leading-tight space-y-2">
              <div className="flex">
                <span className="w-[60px] font-bold">Payment:</span>
                <span>{invoiceData.paymentTerms || '90 Hari setelah invoice diterima'}</span>
              </div>
              
              <div className="flex flex-col space-y-0.5">
                <p className="font-bold">Please state with your payment: <span className="font-black">{displayInvoiceId}</span></p>
                <p className="font-bold">For payment, please transfer to our account:</p>
                <p className="font-bold pt-1 uppercase">PT. Jembo Cable Company Tbk</p>
              </div>

              <div className="space-y-1">
                <div className="flex"><span className="w-[100px]">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
                <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
                <div className="flex"><span className="w-[100px]">Sudirman</span><span>A/C No. : 102-0005000226 (USD)</span></div>
              </div>

              <div className="w-[280px] text-center font-bold text-slate-300 italic tracking-widest py-1">OR</div>

              <div className="flex items-start">
                <div className="w-[100px] leading-tight">
                  Bank BCA - Jakarta<br/>
                  Cabang KEM TOWER
                </div>
                <div>
                  A/C No. : 684-0198977 (Rp)
                </div>
              </div>

              {invoiceData.paymentMethod === 'va' && (
                <div className="mt-4 p-3 border-2 border-indigo-600 bg-indigo-50 rounded-lg inline-block">
                  <p className="text-[8px] font-black uppercase text-indigo-400 mb-1">Mandiri Virtual Account</p>
                  <p className="text-sm font-mono font-black text-indigo-900 tracking-widest">
                    {invoiceData.vaNumber}
                  </p>
                  {invoiceData.vaStatus === 'pending' && (
                    <p className="text-[7px] font-black text-amber-600 uppercase mt-1">AWAITING LEAD APPROVAL</p>
                  )}
                </div>
              )}
            </div>

            {/* TANDA TANGAN */}
            <div className="w-[32%] flex flex-col items-center">
              <p className="font-bold text-[10px] uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-28 border-t border-black w-full"></div>
              <p className="font-bold uppercase pt-1 text-[10px]">Finance</p>
            </div>
          </div>
        </div>
      </main>

      {/* PAGE NUMBER */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-[7pt] text-slate-400">
          Halaman 1 dari 1
      </div>
    </div>
  );
};
