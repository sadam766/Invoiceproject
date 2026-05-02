'use client';

import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';

export type InvoiceTemplateProps = {
  type: 'Original' | 'Copy';
  invoiceData: any;
  items: any[];
  calculations: {
    subTotalItems: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    subTotal?: number;
  };
};

export const InvoiceTemplate = ({ type, invoiceData, items, calculations }: InvoiceTemplateProps) => {
  const displayInvoiceId = invoiceData.id?.replace(/_/g, '/') || 'DRAFT';

  return (
    <div 
      className={cn(
        "relative bg-white mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
    >
      {/* LABEL ORIGINAL/COPY */}
      <div className="absolute right-12 top-8 text-[10pt] text-slate-400 uppercase tracking-widest print:text-black">
        {type}
      </div>

      {/* HEADER */}
      <header className="relative mb-4">
        <div className="text-center w-full mb-1">
          <h1 className="font-bold text-[11pt] uppercase tracking-wider">INVOICE/OFFICIAL RECEIPT</h1>
        </div>
        <div className="flex justify-between items-start mt-4">
          <p className="font-bold text-[10pt] uppercase">{invoiceData.customerName || 'N/A'}</p>
          <div className="text-[9pt] space-y-0.5" style={{ minWidth: '160px' }}>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Sales Order</span><span>:</span><span>{invoiceData.soNumber || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>Order Date</span><span>:</span><span>{invoiceData.date || '-'}</span></div>
            <div className="grid grid-cols-[85px_5px_1fr]"><span>PO Number</span><span>:</span><span>{invoiceData.poNumber || '-'}</span></div>
          </div>
        </div>
      </header>

      <div className="flex justify-between mb-1 px-0.5 text-[9pt] border-t border-slate-100 pt-1">
        <span>Customer Code : {invoiceData.customerCode || '-'}</span>
        <span>Date: {invoiceData.date || '-'}</span>
      </div>

      {/* TABLE */}
      <main className="relative flex-grow">
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
              <tr key={idx} className="align-top text-[9pt]">
                <td className="py-1 px-2 text-left">{idx + 1}</td>
                <td className="py-1 px-2 uppercase">{item.name}</td>
                <td className="py-1 px-2 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                <td className="py-1 px-2 text-right">{formatCurrency(item.price)}</td>
                <td className="py-1 px-2 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* SUB TOTAL ITEM - Menempel di bawah tabel sesuai tanda merah */}
        <div className="flex justify-end mt-56">
          <div className="w-[18%] text-right pr-2">
            <div className="border-t border-black w-full mb-0.5"></div>
            <p className="font-normal text-[9pt]">{formatCurrency(calculations.subTotalItems)}</p>
          </div>
        </div>
      </main>

      {/* FOOTER SECTION */}
      <footer className="mt-[100px] transition-all"> 
        <div className="w-full flex justify-start mb-0.5">
          <p className="text-[10px] font-medium">No PO : {invoiceData.poNumber || '-'}</p>
        </div>
        <div className="border-t border-black w-full mb-0.5"></div>

        <div className="flex justify-end mt-1">
          <div className="w-1/4 text-[10px] leading-tight">
            <div className="grid grid-cols-[1fr_auto] gap-x-4">
              <span>Goods:</span><span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
              <span>DPP VAT (11/12):</span><span className="text-right">{formatCurrency(calculations.dppVat)}</span>
              <span>VAT 12%:</span><span className="text-right">{formatCurrency(calculations.vat12)}</span>
              <span className="font-bold">Total Rp:</span><span className="text-right font-bold">{formatCurrency(calculations.totalRp)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-black w-full my-1"></div>

        <div className="flex justify-between items-start">
          {/* INFORMASI PEMBAYARAN */}
          <div className="w-[68%] text-[10px] leading-tight space-y-1">
            <div className="flex">
              <span className="w-[50px] font-bold">Payment:</span>
              <span>{invoiceData.paymentTerms || '90 Hari'}</span>
            </div>
            
            <div className="flex flex-col text-[10px]">
              <p className="font-bold">Please state with your payment:</p>
              <div className="w-max">
                <p className="font-bold">For payment, please transfer to our account:</p>
              </div>
              <p className="font-bold pt-1">PT. Jembo Cable Company Tbk</p>
            </div>

            <div className="text-[10px]">
              <div className="flex"><span className="w-[100px]">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
              <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
              <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000226 (USD)</span></div>
            </div>

            <div className="w-[280px] text-center font-bold text-slate-300 py-1">OR</div>

            <div className="flex text-[10px] items-start">
              <div className="w-[100px] leading-tight">
                Bank BCA - Jakarta<br/>
                Cabang KEM TOWER
              </div>
              <div>
                A/C No. : 684-0198977 (Rp)
              </div>
            </div>
          </div>

          {/* TANDA TANGAN */}
          <div className="w-[32%] flex flex-col items-center">
            <p className="font-bold text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
            <div className="mt-28 border-t border-black w-full"></div>
            <p className="font-bold uppercase pt-1 text-[10px]">Finance</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
