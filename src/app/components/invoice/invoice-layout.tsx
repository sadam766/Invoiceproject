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
        "relative bg-white mx-auto pt-12 pb-6 px-12 flex flex-col font-sans text-black shadow-lg mb-8 print:shadow-none print:mb-0 print:m-0",
        type === 'Copy' && "print:page-break-before-always"
      )}
      style={{ width: '210mm', minHeight: '297mm', fontSize: '9pt', color: '#000000' }}
    >
      <div className="absolute right-12 top-12 text-[10pt] text-slate-400 uppercase font-medium print:hidden">
        {type}
      </div>

      <header className="text-center mb-4">
        <h1 className="font-bold text-[11pt] uppercase">INVOICE/OFFICIAL RECEIPT</h1>
        <p className="font-bold text-[14pt] leading-tight mt-1">{displayInvoiceId}</p>
      </header>

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

      <div className="flex justify-between py-1 mb-1 font-medium text-[9pt] border-t border-slate-100 pt-1">
          <span>Customer Code : {invoiceData.customerCode || '-'}</span>
          <span>Date: {invoiceData.date || '-'}</span>
      </div>

      <main className="relative flex-grow flex flex-col">
        {/* Container Tabel dengan Min-Height agar Subtotal tidak langsung nempel ke atas saat item sedikit */}
        <div className="min-h-[450px]">
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
        </div>

        {/* SECTION SUBTOTAL, DISCOUNT, DP - Layout Rapat Kanan */}
          <div className="mt-4 mb-4 flex justify-end">
            {/* Kita gunakan w-[300px] agar lebarnya cukup untuk menampung nominal besar */}
            <div className="w-[300px] flex flex-col items-end"> 
              
              {/* Garis Pendek di Atas Subtotal - Lebarnya disesuaikan agar pas di atas angka */}
              <div className="border-t border-black w-[180px] mb-1"></div>
              
              {/* Baris Sub-Total Item: Menggunakan flex justify-end agar angka langsung ke kanan */}
              <div className="flex justify-end w-full text-[9pt] font-normal">
                <span>{formatCurrency(calculations.subTotalItems)}</span>
              </div>

              {/* Baris Discount */}
              {calculations.discountValue > 0 && (
                <div className="flex justify-between w-full text-[9pt] mt-1">
                  <span className="pl-4">Discount</span>
                  <span>({formatCurrency(calculations.discountValue)})</span>
                </div>
              )}

              {/* Baris DP */}
              {calculations.dpValue > 0 && (
                <div className="flex justify-between w-full text-[9pt] mt-1">
                  <div className="flex gap-4 pl-4">
                    <span>DP</span>
                    <span className="text-slate-500">{dpPercent}{dpPercent ? '%' : ''}</span>
                  </div>
                  <span>
                    {isDeduction ? `(${formatCurrency(calculations.dpValue)})` : formatCurrency(calculations.dpValue)}
                  </span>
                </div>
              )}
            </div>
          </div>

        {/* SPACER - Menjamin Footer Terkunci di Bawah */}
        <div className="flex-grow"></div>

        {/* FOOTER SECTION - Terkunci di Dasar Halaman */}
        <footer className="mt-auto print:break-inside-avoid">
        <div className="w-full flex justify-start mb-1">
          <p className="text-[10px] font-medium">No PO : {invoiceData.poNumber || '-'}</p>
        </div>

        {/* Garis panjang yang mendekati bagian Goods */}
        <div className="border-t border-black w-full mb-1"></div>

          {/* FINANCIAL SUMMARY - Tanpa Garis di Total Rp */}
          <div className="flex justify-end mt-1">
            <div className="w-1/3 text-[10px] space-y-0.5 pt-1">
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
              <div className="flex justify-between font-bold mt-0.5">
                <span>Total Rp:</span>
                <span>{formatCurrency(calculations.totalRp)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-black w-full my-2"></div>

          {/* PAYMENT SECTION */}
          <div className="flex justify-between items-start">
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

              {/* CONTAINER HYBRID: MANUAL & VIRTUAL ACCOUNT */}
              <div className="flex gap-4 items-start">
                
                {/* Kolom Kiri: Manual Accounts (Data Asli Tidak Dirubah) */}
                <div className="flex-1 space-y-1">
                  <div className="space-y-1">
                    <div className="flex"><span className="w-[100px]">Bank Mandiri -</span><span>A/C No. : 102-0100206827 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Jakarta Cabang</span><span>A/C No. : 102-0005000218 (Rp)</span></div>
                    <div className="flex"><span className="w-[100px]">Sudirman</span><span>A/C No. : 102-0005000226 (USD)</span></div>
                  </div>

                  <div className="w-full text-center font-bold text-slate-300 italic tracking-widest py-0.5 text-[8px]">OR</div>

                  <div className="flex items-start">
                    <div className="w-[100px] leading-tight">
                      Bank BCA - Jakarta<br/>
                      Cabang KEM TOWER
                    </div>
                    <div>
                      A/C No. : 684-0198977 (Rp)
                    </div>
                  </div>
                </div>

                {/* Garis Pemisah Vertikal */}
                <div className="border-l border-slate-200 h-24 self-center hidden md:block"></div>

                {/* Kolom Kanan: Virtual Account */}
                <div className="flex-1 bg-slate-50 p-2 rounded border border-slate-100">
                  <p className="font-bold text-[9px] mb-1 underline">VIRTUAL ACCOUNT</p>
                  <div className="space-y-0.5 text-[9px]">
                    <div className="grid grid-cols-[80px_5px_1fr]">
                      <span>Bank</span><span>:</span><span className="font-bold">Mandiri</span>
                    </div>
                    <div className="grid grid-cols-[80px_5px_1fr]">
                      <span>VA Number</span><span>:</span><span className="font-black">{invoiceData.vaNumber || '-'}</span>
                    </div>
                    <div className="grid grid-cols-[80px_5px_1fr]">
                      <span>Name</span><span>:</span><span className="uppercase">{customerName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SIGNATURE SECTION */}
            <div className="w-[32%] flex flex-col items-center">
              <p className="font-bold text-[10px] uppercase">PT. JEMBO CABLE COMPANY Tbk</p>
              <div className="mt-28 border-t border-black w-full"></div>
              <p className="font-bold uppercase pt-1 text-[10px]">Finance</p>
            </div>
          </div>
        </footer>
      </main>

      <div className="absolute bottom-4 left-0 right-0 text-center text-[7pt] text-slate-400">
          Halaman 1 dari 1
      </div>
    </div>
  );
};