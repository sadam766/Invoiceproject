'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// NAMED EXPORT: Digunakan oleh AddInvoicePage dan PreviewPage
export const InvoiceTemplate = ({ 
  type, 
  invoiceData, 
  items, 
  calculations 
}: { 
  type: 'Original' | 'Copy', 
  invoiceData: any, 
  items: any[], 
  calculations: any 
}) => (
  <div 
    className="relative bg-white mx-auto flex flex-col text-black shadow-lg print:shadow-none print:m-0"
    style={{ 
      width: '210mm', 
      minHeight: '290mm', 
      fontSize: '10pt', 
      fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', 
      padding: '50mm 15mm 30mm 15mm', // 50mm Top Margin untuk Kop Surat Fisik
      color: '#000000'
    }}
  >
    {/* HEADER SECTION - Identitas Dokumen */}
    <header className="relative mb-6">
      <div className="absolute right-0 top-[-5mm] text-[10pt] font-bold uppercase text-slate-400 print:text-black">
        {type}
      </div>

      <div className="text-center w-full mb-8">
        <h1 className="font-bold text-[16pt] uppercase mb-1">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-bold text-[13pt] uppercase tracking-wider">{invoiceData.id || '-'}</p>
      </div>

      <div className="flex justify-between items-start">
        {/* Kolom Kiri: Identitas Pelanggan */}
        <div className="w-[58%]">
           <p className="text-[11pt] font-bold uppercase mb-1">{invoiceData.customerName || invoiceData.customer || 'N/A'}</p>
           <p className="text-[10pt] font-normal leading-tight max-w-sm">
              {invoiceData.billingAddress || 'Alamat penagihan belum ditentukan.'}
           </p>
        </div>

        {/* Kolom Kanan: Rincian Referensi */}
        <div className="text-[10pt] space-y-0.5" style={{ minWidth: '190px' }}>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-normal text-slate-600 uppercase text-[9pt]">Sales Order</span>
            <span className="font-normal text-center">:</span>
            <span className="font-normal uppercase">{invoiceData.soNumber || '-'}</span>
          </div>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-normal text-slate-600 uppercase text-[9pt]">Order Date</span>
            <span className="font-normal text-center">:</span>
            <span className="font-normal">{invoiceData.date || '-'}</span>
          </div>
          <div className="grid grid-cols-[90px_10px_1fr] items-center">
            <span className="font-normal text-slate-600 uppercase text-[9pt]">Reference A</span>
            <span className="font-normal text-center">:</span>
            <span className="font-normal uppercase">{invoiceData.poNumber || '-'}</span>
          </div>
        </div>
      </div>
    </header>

    <div className="flex justify-between mb-2 px-0.5 text-[10pt] border-t border-slate-200 pt-2 uppercase font-normal">
      <span>Customer Code : {invoiceData.customerCode || '-'}</span>
      <span>Date: {invoiceData.date || '-'}</span>
    </div>

    {/* MAIN ITEM TABLE - CLEAN (No Vertical Borders) */}
    <div className="flex-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t-2 border-b-2 border-black">
            <th className="py-2 px-2 text-left font-bold uppercase text-[10pt]">No.</th>
            <th className="py-2 px-2 text-left font-bold uppercase text-[10pt]">Item Description</th>
            <th className="py-2 px-2 text-center font-bold uppercase text-[10pt]">Quantity Unit</th>
            <th className="py-2 px-2 text-right font-bold uppercase text-[10pt]">Unit Price</th>
            <th className="py-2 px-2 text-right font-bold uppercase text-[10pt]">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="align-top border-b border-slate-100 last:border-b-0">
              <td className="py-2 px-2 text-left text-[10pt]">{idx + 1}</td>
              <td className="py-2 px-2 uppercase text-[10pt] font-normal">{item.name}</td>
              <td className="py-2 px-2 text-center text-[10pt] font-normal">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
              <td className="py-2 px-2 text-right text-[10pt]">{formatCurrency(item.price)}</td>
              <td className="py-2 px-2 text-right text-[10pt] font-normal">{formatCurrency(item.total)}</td>
            </tr>
          ))}
          {/* Filler rows */}
          {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
            <tr key={`filler-${i}`} className="h-8">
              <td colSpan={5}></td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Subtotal Item menempel di bawah tabel */}
      <div className="flex justify-end mt-1">
        <div className="w-[18%] text-right pr-2">
          <div className="border-t-2 border-black w-full mb-0.5"></div>
          <p className="font-normal text-[10pt]">{formatCurrency(calculations.subTotalItems)}</p>
        </div>
      </div>
    </div>

    {/* FINANCIAL SUMMARY SECTION - CLEAN & TIGHT */}
    <div className="mt-4 border-t-2 border-black pt-2">
       <div className="w-full flex justify-start mb-1">
          <p className="text-[10pt] font-bold uppercase">No PO : {invoiceData.poNumber || '-'}</p>
       </div>
       
       <div className="flex justify-end">
          <div className="w-1/3 space-y-0.5 text-[9pt]">
             <div className="flex justify-between">
                <span className="font-normal uppercase">Goods Value:</span>
                <span className="font-normal">{formatCurrency(calculations.subTotalItems)}</span>
             </div>
             {calculations.dpValue > 0 && (
                <div className="flex justify-between">
                   <span className="font-normal uppercase">Down Payment:</span>
                   <span className="font-normal text-rose-600">({formatCurrency(calculations.dpValue)})</span>
                </div>
             )}
             {calculations.discountValue > 0 && (
                <div className="flex justify-between">
                   <span className="font-normal uppercase">Discount:</span>
                   <span className="font-normal">({formatCurrency(calculations.discountValue)})</span>
                </div>
             )}
             <div className="flex justify-between">
                <span className="font-normal uppercase">DPP VAT (11/12):</span>
                <span className="font-normal">{formatCurrency(calculations.dppVat)}</span>
             </div>
             <div className="flex justify-between">
                <span className="font-normal uppercase">VAT (PPN 12%):</span>
                <span className="font-normal">{formatCurrency(calculations.vat12)}</span>
             </div>
             <div className="flex justify-between mt-2">
                <span className="font-bold uppercase text-[11pt]">Total Rp:</span>
                <span className="font-bold text-[11pt]">{formatCurrency(calculations.totalRp)}</span>
             </div>
          </div>
       </div>
    </div>

    <div className="border-t-2 border-black w-full my-4"></div>

    {/* BANK DETAILS & SIGNATURE */}
    <div className="flex justify-between items-end pb-8">
       {/* Instruksi Bank - Raised slightly for safety */}
       <div className="w-[65%] space-y-4 mb-2">
          <div className="space-y-1">
             <p className="text-[9pt] font-bold uppercase">Please state with your payment:</p>
             <p className="text-[9pt] font-bold uppercase">For payment, please transfer to our account:</p>
             <p className="text-[10pt] font-bold uppercase leading-none mt-2">PT. JEMBO CABLE COMPANY Tbk</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-0.5 text-[9pt]">
                <p className="font-normal uppercase leading-none">Bank Mandiri</p>
                <p className="font-bold font-mono text-[10pt]">102-0100206827 (Rp)</p>
                <p className="text-[8pt] italic opacity-70">Jakarta Cabang</p>
             </div>
             <div className="space-y-0.5 text-[9pt]">
                <p className="font-normal uppercase leading-none">Bank BCA - Jakarta</p>
                <p className="font-bold font-mono text-[10pt]">684-0198977 (Rp)</p>
                <p className="text-[8pt] italic opacity-70">Cabang KEM TOWER</p>
             </div>
          </div>
       </div>

       {/* Area Tanda Tangan - FINANCE Lowered for Sign Space */}
       <div className="w-[30%] text-center">
          <p className="text-[9pt] font-bold uppercase mb-32">PT. JEMBO CABLE COMPANY Tbk</p>
          <div className="border-b-2 border-black w-full mb-1"></div>
          <p className="text-[11pt] font-bold uppercase underline underline-offset-4">FINANCE</p>
       </div>
    </div>
  </div>
);
