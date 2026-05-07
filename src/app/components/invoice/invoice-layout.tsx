'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// NAMED EXPORT: Digunakan oleh AddInvoicePage dan PreviewPage
export const InvoiceTemplate = ({ type, invoiceData, items, calculations }: { type: 'Original' | 'Copy', invoiceData: any, items: any[], calculations: any }) => (
  <div 
    className="relative bg-white mx-auto flex flex-col font-sans text-black shadow-lg print:shadow-none print:m-0"
    style={{ 
      width: '210mm', 
      minHeight: '297mm', 
      fontSize: '9pt', 
      boxSizing: 'border-box', 
      padding: '50mm 15mm 30mm 15mm' // 50mm Top Margin untuk Kop Surat
    }}
  >
    {/* HEADER SECTION - Terpusat */}
    <header className="relative mb-6">
      <div className="absolute right-0 top-[-5mm] text-[10pt] font-black uppercase text-slate-300 print:text-black">
        {type}
      </div>

      <div className="text-center w-full mb-6">
        <h1 className="font-black text-[14pt] uppercase underline decoration-2 underline-offset-4 mb-1">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-black text-[12pt] uppercase tracking-wider">{invoiceData.id || '-'}</p>
      </div>

      <div className="flex justify-between items-start">
        {/* Kolom Kiri: Identitas Pelanggan */}
        <div className="w-[58%]">
           <p className="text-[11pt] font-black uppercase mb-1">{invoiceData.customerName || invoiceData.customer || 'N/A'}</p>
           <p className="text-[9pt] font-medium italic text-slate-600 leading-tight max-w-sm">
              {invoiceData.billingAddress || 'Alamat penagihan belum ditentukan.'}
           </p>
        </div>

        {/* Kolom Kanan: Rincian Referensi */}
        <div className="text-[9pt] space-y-0.5" style={{ minWidth: '190px' }}>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-bold text-slate-500 uppercase text-[8pt]">Sales Order</span>
            <span className="font-bold text-center">:</span>
            <span className="font-black uppercase">{invoiceData.soNumber || '-'}</span>
          </div>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-bold text-slate-500 uppercase text-[8pt]">Order Date</span>
            <span className="font-bold text-center">:</span>
            <span className="font-black">{invoiceData.date || '-'}</span>
          </div>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-bold text-slate-500 uppercase text-[8pt]">Reference A</span>
            <span className="font-bold text-center">:</span>
            <span className="font-black uppercase">{invoiceData.poNumber || '-'}</span>
          </div>
        </div>
      </div>
    </header>

    <div className="flex justify-between mb-2 px-0.5 text-[9pt] border-t-2 border-black pt-2 font-black uppercase">
      <span>Customer Code : {invoiceData.customerCode || '-'}</span>
      <span>Date: {invoiceData.date || '-'}</span>
    </div>

    {/* MAIN ITEM TABLE */}
    <div className="flex-1">
      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="bg-slate-100 border-b border-black">
            <th className="py-2 px-2 text-left border-r border-black w-[5%] font-black uppercase text-[8pt]">No.</th>
            <th className="py-2 px-2 text-left border-r border-black font-black uppercase text-[8pt]">Item Description</th>
            <th className="py-2 px-2 text-center border-r border-black w-[18%] font-black uppercase text-[8pt]">Quantity Unit</th>
            <th className="py-2 px-2 text-right border-r border-black w-[15%] font-black uppercase text-[8pt]">Unit Price</th>
            <th className="py-2 px-2 text-right font-black uppercase text-[8pt]">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="align-top border-b border-slate-200 last:border-b-0">
              <td className="py-2 px-2 text-left border-r border-black text-[9pt]">{idx + 1}</td>
              <td className="py-2 px-2 uppercase border-r border-black text-[9pt] font-bold">{item.name}</td>
              <td className="py-2 px-2 text-center border-r border-black text-[9pt] font-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
              <td className="py-2 px-2 text-right border-r border-black text-[9pt]">{formatCurrency(item.price)}</td>
              <td className="py-2 px-2 text-right text-[9pt] font-black">{formatCurrency(item.total)}</td>
            </tr>
          ))}
          {/* Filler rows */}
          {items.length < 8 && Array.from({ length: 8 - items.length }).map((_, i) => (
            <tr key={`filler-${i}`} className="h-7">
              <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Subtotal Item menempel di bawah tabel */}
      <div className="flex justify-end mt-1">
        <div className="w-[18%] text-right pr-2">
          <div className="border-t-2 border-black w-full mb-0.5"></div>
          <p className="font-black text-[9pt]">{formatCurrency(calculations.subTotalItems)}</p>
        </div>
      </div>
    </div>

    {/* FINANCIAL SUMMARY SECTION */}
    <div className="mt-4 border-t-2 border-black pt-2">
       <div className="w-full flex justify-start mb-1">
          <p className="text-[10px] font-black uppercase">No PO : {invoiceData.poNumber || '-'}</p>
       </div>
       
       <div className="flex justify-end">
          <div className="w-1/3 space-y-0.5 text-[9pt]">
             <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[8pt]">Goods Value:</span>
                <span className="font-black">{formatCurrency(calculations.subTotalItems)}</span>
             </div>
             {calculations.dpValue > 0 && (
                <div className="flex justify-between">
                   <span className="text-slate-500 font-bold uppercase text-[8pt]">Down Payment:</span>
                   <span className="font-black text-rose-600">({formatCurrency(calculations.dpValue)})</span>
                </div>
             )}
             {calculations.discountValue > 0 && (
                <div className="flex justify-between">
                   <span className="text-slate-500 font-bold uppercase text-[8pt]">Discount:</span>
                   <span className="font-black">({formatCurrency(calculations.discountValue)})</span>
                </div>
             )}
             <div className="flex justify-between border-t border-slate-200 mt-1 pt-1">
                <span className="text-slate-500 font-bold uppercase text-[8pt]">DPP VAT (11/12):</span>
                <span className="font-black">{formatCurrency(calculations.dppVat)}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[8pt]">VAT (PPN 12%):</span>
                <span className="font-black">{formatCurrency(calculations.vat12)}</span>
             </div>
             <div className="flex justify-between border-t-2 border-black mt-2 pt-1">
                <span className="font-black uppercase text-[10pt]">Total Rp:</span>
                <span className="font-black text-[12pt]">{formatCurrency(calculations.totalRp)}</span>
             </div>
          </div>
       </div>
    </div>

    <div className="border-t-2 border-black w-full my-4"></div>

    {/* BANK DETAILS & SIGNATURE */}
    <div className="flex justify-between items-end pb-8">
       {/* Instruksi Bank */}
       <div className="w-[65%] space-y-4">
          <div className="space-y-1">
             <p className="text-[9pt] font-black uppercase text-indigo-700">Please state with your payment:</p>
             <p className="text-[9pt] font-black uppercase text-slate-500">For payment, please transfer to our account:</p>
             <p className="text-[11pt] font-black uppercase text-slate-900 leading-none">PT. JEMBO CABLE COMPANY Tbk</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 print:bg-white print:border-black">
                <p className="text-[7pt] font-black text-slate-400 uppercase leading-none mb-1">Bank Mandiri</p>
                <p className="text-[10pt] font-black font-mono">102-0100206827</p>
                <p className="text-[7pt] text-slate-500 italic">Jakarta Cabang (IDR)</p>
             </div>
             <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 print:bg-white print:border-black">
                <p className="text-[7pt] font-black text-slate-400 uppercase leading-none mb-1">Bank BCA</p>
                <p className="text-[10pt] font-black font-mono">684-0198977</p>
                <p className="text-[7pt] text-slate-500 italic">Cabang KEM TOWER (IDR)</p>
             </div>
          </div>
       </div>

       {/* Area Tanda Tangan */}
       <div className="w-[30%] text-center">
          <p className="text-[8pt] font-black uppercase text-slate-400 mb-28 tracking-tighter">Verified Finance & Accounting</p>
          <div className="border-b-2 border-black w-full mb-1"></div>
          <p className="text-[11pt] font-black uppercase underline underline-offset-4">FINANCE</p>
       </div>
    </div>
  </div>
);
