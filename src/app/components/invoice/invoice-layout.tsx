'use client';

import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';

// Konfigurasi baris per halaman sesuai standar operasional Dakota Hub
const ITEMS_PER_PAGE = 8; 

export type InvoiceTemplateProps = {
  type: 'Original' | 'Copy';
  invoiceData: any;
  items: any[];
  calculations: {
    subTotalItems: number;
    negotiation: number;
    dpValue: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    subTotal?: number;
  };
};

export const InvoiceTemplate = ({ type, invoiceData, items, calculations }: InvoiceTemplateProps) => {
  // Logika Paging: Memecah item menjadi beberapa bagian halaman
  const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) || 1 }, (_, i) =>
    items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
  );
  const totalPages = itemChunks.length;
  const displayInvoiceId = invoiceData.id?.replace(/_/g, '/') || 'DRAFT';

  const PageTemplate = ({ chunk, pageIndex }: { chunk: any[], pageIndex: number }) => {
    const isLastPage = pageIndex === totalPages - 1;
    const isCopy = type === 'Copy';

    return (
      <div 
        className={cn(
          "relative bg-white mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0",
          isCopy && "bg-slate-50 opacity-90 print:bg-white print:opacity-100",
          pageIndex === 0 && isCopy && "print:page-break-before-always"
        )}
        style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt' }}
      >
        {/* LABEL: ORIGINAL / COPY */}
        <div className="absolute right-12 top-8 text-[11pt] font-black text-slate-300 uppercase tracking-widest print:text-black">
          {type}
        </div>

        {/* HEADER: Judul & No Invoice di Tengah */}
        <header className="relative mb-8 text-center w-full flex flex-col items-center">
          <h1 className="font-bold text-[11pt] uppercase tracking-wider leading-tight">
            INVOICE/OFFICIAL RECEIPT
          </h1>
          <p className="text-[10pt] font-bold">No: {displayInvoiceId}</p>
        </header>

        {/* INFO BAR: Customer & Date Info */}
        <div className="flex justify-between items-start mb-6 text-[9pt]">
          <div className="w-[60%] space-y-1">
            <p className="font-bold uppercase text-[10pt]">{invoiceData.customerName || 'N/A'}</p>
            <p className="text-[8.5pt] leading-tight italic max-w-[350px]">
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
                <tr key={idx} className="align-top border-x border-black h-8">
                  <td className="p-1 text-center border-r border-black">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="p-1 border-r border-black uppercase text-[8.5pt] leading-tight">{item.name}</td>
                  <td className="p-1 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                  <td className="p-1 text-right border-r border-black">{formatCurrency(item.price)}</td>
                  <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Baris Kosong untuk menjaga border vertikal tetap lurus sampai bawah */}
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

          {/* SUB TOTAL ITEM - Tetap menempel di kanan bawah kolom Amount */}
          <div className="flex justify-end">
            <div className="w-[18%] text-right pr-1 border-x border-b border-black py-1 bg-slate-50/10">
              <p className="font-bold text-[9pt]">{formatCurrency(calculations.subTotalItems)}</p>
            </div>
          </div>
        </main>

        {/* FOOTER: Signature & Payment Info */}
        {isLastPage && (
          <footer className="pt-4 text-black text-[9pt]">
            <div className="w-full flex justify-end mb-4">
              <div className="w-1/3 text-[10px] space-y-1">
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <span>Subtotal Item:</span><span className="text-right">{formatCurrency(calculations.subTotalItems)}</span>
                  
                  {calculations.dpValue > 0 && (
                    <><span>DP / Retensi:</span><span className="text-right">({formatCurrency(calculations.dpValue)})</span></>
                  )}
                  {calculations.negotiation > 0 && (
                    <><span>Diskon:</span><span className="text-right">({formatCurrency(calculations.negotiation)})</span></>
                  )}
                  
                  {/* Garis pemisah sebelum Goods */}
                  <div className="col-span-2 border-t border-slate-200 my-0.5"></div>

                  <span>Goods:</span><span className="text-right">{formatCurrency(calculations.subTotal || (calculations.subTotalItems - calculations.dpValue - calculations.negotiation))}</span>
                  <span>DPP VAT (11/12):</span><span className="text-right">{formatCurrency(calculations.dppVat)}</span>
                  <span>VAT 12%:</span><span className="text-right">{formatCurrency(calculations.vat12)}</span>
                  <div className="col-span-2 border-t border-black mt-1 pt-1 flex justify-between font-bold">
                    <span>Total Rp:</span><span>{formatCurrency(calculations.totalRp)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="w-[60%] space-y-1 text-[8.5pt]">
                <p>Please state with your payment: <strong>{displayInvoiceId}</strong></p>
                <p>For payment, please transfer to our account:</p>
                
                <p className="font-bold uppercase pt-2">PT. JEMBO CABLE COMPANY Tbk</p>
                
                {invoiceData.paymentMethod === 'va' ? (
                  <div className="p-2 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 mt-1">
                    <p className="font-bold text-[8pt] text-indigo-600">MANDIRI VIRTUAL ACCOUNT:</p>
                    <p className="text-[14pt] font-black tracking-[0.2em] font-mono">{invoiceData.vaNumber || '-'}</p>
                  </div>
                ) : (
                  <div className="text-[8.5pt] space-y-0.5 mt-1">
                    <div className="flex"><span className="w-[100px]">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Bank BCA -</span><span>A/C No. : 684-0198977 (Rp)</span></div>
                  </div>
                )}
              </div>
              
              <div className="w-[35%] text-center">
                <p className="font-bold uppercase text-[9pt] mb-20">PT. JEMBO CABLE COMPANY Tbk</p>
                <div className="border-t border-black w-44 mx-auto"></div>
                <p className="font-bold uppercase pt-1 text-[9pt]">Finance Department</p>
              </div>
            </div>
          </footer>
        )}
      </div>
    );
  };

  return (
    <>
      {itemChunks.map((chunk, i) => (
        <PageTemplate key={`${type}-${i}`} chunk={chunk} pageIndex={i} />
      ))}
    </>
  );
};
