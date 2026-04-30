
'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Download, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, updateDoc } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import type { Invoice, Customer } from '@/app/lib/data';
import { cn, formatCurrency } from '@/lib/utils';

// --- HELPER: TERBILANG (In Words) ---
const toWords = (amount: number): string => {
    // Placeholder function - can be replaced with a real Indonesian spelling library if needed
    if (amount <= 0) return "NOL RUPIAH";
    return "TERBILANG SESUAI NOMINAL TOTAL";
};

const ITEMS_PER_PAGE = 15;

const InvoicePreviewPage = () => {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const firestore = useFirestore();
    const invoiceIdParam = decodeURIComponent(params.id as string).replace(/\//g, '_');

    // --- DATA FETCHING ---
    const invoiceRef = useMemoFirebase(() => (!firestore || !invoiceIdParam) ? null : doc(firestore, 'invoices', invoiceIdParam), [firestore, invoiceIdParam]);
    const { data: dbInvoice, isLoading: isDbLoading } = useDoc<Invoice>(invoiceRef);

    const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersCollection);

    // --- LOGIC: RENDER & PRINT ---
    const markAsPrinted = async () => {
        if (firestore && invoiceIdParam) {
            const ref = doc(firestore, 'invoices', invoiceIdParam);
            await updateDoc(ref, { isOriginalPrinted: true });
        }
    };

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !dbInvoice) return;
        
        const opt = {
          margin: [10, 10, 10, 10], 
          filename: `Invoice-${dbInvoice.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2.5, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save().then(markAsPrinted);
    };

    const handlePrint = () => {
        markAsPrinted();
        window.print();
    };

    if (isDbLoading || !dbInvoice) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="text-center font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse text-xs">Membangun Dual-Layout Dakota Hub...</div>
            </div>
        );
    }

    // --- ENRICH DATA & CALCULATIONS ---
    const customerProfile = allCustomers?.find(c => c.name.toLowerCase() === dbInvoice.customer.toLowerCase());
    
    // Internal Financial Logic (Back-calculation for Coretax Standard)
    const totalRp = dbInvoice.amount || 0;
    const dppVat = totalRp / 1.12;           // Dasar Pengenaan Pajak
    const vat12 = totalRp - dppVat;           // PPN 12%
    
    const items = dbInvoice.items || [];
    const subTotalItems = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const negotiation = dbInvoice.negotiation || 0;
    const dpValue = dbInvoice.dpValue || 0;
    const dpPercent = totalRp > 0 ? Math.round((dpValue / totalRp) * 100) : 0;
    const pelunasan = totalRp - dpValue;
    
    const displayInvoiceId = dbInvoice.id.replace(/_/g, '/');
    const formalNo = `PS/${displayInvoiceId}-J/KEU/2026/DK`;

    const itemChunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, i) =>
        items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    
    const documentTypes = ['ORIGINAL', 'COPY'] as const;

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-6 font-sans text-black animate-in fade-in duration-700">
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .page-break { page-break-before: always; }
                    .print-hidden { display: none !important; }
                    .shadow-lg { box-shadow: none !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; }
                }
            `}</style>
            
            {/* ACTION BAR */}
            <div className="flex justify-center items-center gap-4 mb-8 print-hidden">
                <Button 
                    onClick={() => router.push('/dashboard/invoices')} 
                    variant="outline" 
                    className="font-bold hover:bg-slate-50 rounded-xl px-6 h-10 shadow-sm border-slate-200 bg-white"
                >
                    <ArrowLeft size={16} className="mr-2" /> Kembali ke List
                </Button>

                <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm ring-1 ring-slate-200">
                    <Button onClick={handlePrint} className="bg-indigo-900 hover:bg-blue-900 text-white rounded-xl h-10 px-8 font-black uppercase text-[10px] tracking-widest shadow-lg">
                        <Printer size={16} className="mr-2" /> Cetak Invoice Dakota
                    </Button>
                    <Button onClick={handleDownloadPdf} variant="ghost" className="rounded-xl h-10 px-4">
                        <Download size={16} className="text-slate-400" />
                    </Button>
                </div>
            </div>
            
            <div ref={invoiceContainerRef} className="print-container">
                {documentTypes.map((type) => (
                    <div key={type} className={cn("document-version", type === 'COPY' && "grayscale opacity-75")}>
                        {itemChunks.map((chunk, pageIndex) => {
                            const isLastPage = pageIndex === itemChunks.length - 1;
                            const totalPages = itemChunks.length;

                            return (
                                <div key={`${type}-${pageIndex}`} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-10 mb-12 flex flex-col page-break`} style={{ minHeight: '297mm', color: '#1a1a1a' }}>
                                    
                                    {/* HEADER PERUSAHAAN (FIXED) */}
                                    <div className="flex justify-between items-start border-b-4 border-blue-900 pb-5">
                                        <div>
                                            <h1 className="text-2xl font-black text-blue-900 leading-tight">PT. JEMBO CABLE COMPANY Tbk</h1>
                                            <div className="text-[10px] mt-1 text-gray-700 leading-relaxed uppercase">
                                                <p>Mega Glodok Kemayoran Office Tower B 6th Floor</p>
                                                <p>Jl. Angkasa Kav. B-6 Kota Baru Bandar Kemayoran</p>
                                                <p>Jakarta Pusat</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-4xl font-black text-gray-200 tracking-tighter italic leading-none">{type}</h2>
                                            <h3 className="text-xl font-bold mt-2 tracking-widest text-gray-800 underline">INVOICE</h3>
                                            <p className="text-xs font-bold mt-1">No: {formalNo}</p>
                                        </div>
                                    </div>

                                    {/* DETAIL PELANGGAN */}
                                    <div className="mt-8 flex justify-between text-sm">
                                        <div className="w-1/2">
                                            <span className="text-[9px] font-bold text-gray-400 block mb-1">DITUJUKAN KEPADA / BILL TO:</span>
                                            <p className="font-extrabold text-base border-l-4 border-blue-900 pl-2 uppercase">{dbInvoice.customer}</p>
                                            <p className="text-[11px] mt-1 leading-tight text-gray-600 italic">{dbInvoice.billingAddress || "Alamat Pelanggan"}</p>
                                        </div>
                                        <div className="text-right">
                                            <table className="text-[11px] inline-block">
                                                <tbody>
                                                    <tr>
                                                        <td className="text-gray-400 font-bold px-2 text-right">TANGGAL:</td>
                                                        <td className="font-bold">{new Date(dbInvoice.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-gray-400 font-bold px-2 text-right uppercase italic">PO NUMBER:</td>
                                                        <td className="font-bold">{dbInvoice.poNumber || "-"}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* TABEL ITEM */}
                                    <div className="flex-grow mt-10">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-blue-900 text-white text-[10px] uppercase tracking-wider">
                                                    <th className="py-2 px-3 text-left border border-blue-900">Deskripsi Pekerjaan / Barang</th>
                                                    <th className="py-2 px-1 text-center border border-blue-900 w-24">Kuantitas</th>
                                                    <th className="py-2 px-3 text-right border border-blue-900 w-36">Harga Satuan</th>
                                                    <th className="py-2 px-3 text-right border border-blue-900 w-40">Total Harga</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[12px]">
                                                {chunk.map((item, index) => (
                                                    <tr key={index} className="border-b border-gray-300">
                                                        <td className="py-3 px-3 font-semibold text-gray-800 uppercase">{item.name}</td>
                                                        <td className="py-3 px-1 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                                        <td className="py-3 px-3 text-right">Rp {item.price?.toLocaleString('id-ID')}</td>
                                                        <td className="py-3 px-3 text-right font-bold">Rp {item.total?.toLocaleString('id-ID')}</td>
                                                    </tr>
                                                ))}
                                                {/* Baris kosong penyeimbang layout */}
                                                {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                                    <tr key={`empty-${i}`} className="h-10">
                                                        <td className="border-r border-transparent"></td>
                                                        <td className="border-r border-transparent"></td>
                                                        <td className="border-r border-transparent"></td>
                                                        <td></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* FOOTER & RINCIAN BIAYA (Hanya di halaman terakhir) */}
                                    {isLastPage && (
                                        <div className="mt-8">
                                            <div className="grid grid-cols-12 gap-6">
                                                {/* Sisi Kiri: Pembayaran */}
                                                <div className="col-span-7">
                                                    <p className="text-[9px] font-bold text-gray-400 italic mb-1 uppercase">Terbilang / In Words:</p>
                                                    <div className="bg-gray-100 p-2 border-l-4 border-gray-500 rounded-r shadow-inner mb-4">
                                                        <p className="text-[11px] font-black italic">*** {toWords(totalRp)} ***</p>
                                                    </div>

                                                    <div className="text-[10px] p-3 border-2 border-dotted border-blue-200 rounded-xl bg-blue-50/20">
                                                        <p className="font-bold underline text-blue-900 mb-1 uppercase">Informasi Pembayaran:</p>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            <span className="text-gray-500 font-semibold italic">Nama Rekening</span>
                                                            <span className="col-span-2 font-bold">: PT. JEMBO CABLE COMPANY Tbk</span>
                                                            <span className="text-gray-500 font-semibold italic">Bank</span>
                                                            <span className="col-span-2 font-bold">: BANK CENTRAL ASIA (BCA)</span>
                                                            <span className="text-gray-500 font-semibold italic uppercase">VA Number</span>
                                                            <span className="col-span-2 font-black text-blue-700 text-sm tracking-widest">: {dbInvoice.vaNumber || customerProfile?.virtualAccountNumber || "KODE CUSTOMER"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Sisi Kanan: Summary */}
                                                <div className="col-span-5 text-sm">
                                                    <div className="space-y-1 text-[12px]">
                                                        <div className="flex justify-between items-center text-gray-500">
                                                            <span>Sub Total</span>
                                                            <span>Rp {subTotalItems.toLocaleString('id-ID')}</span>
                                                        </div>
                                                        {negotiation > 0 && (
                                                            <div className="flex justify-between items-center text-red-500 italic">
                                                                <span>Potongan Negosiasi</span>
                                                                <span>- Rp {negotiation.toLocaleString('id-ID')}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center font-bold">
                                                            <span>DP {dpPercent}%</span>
                                                            <span>Rp {dpValue.toLocaleString('id-ID')}</span>
                                                        </div>
                                                        <div className="border-t border-gray-300 pt-1 mt-1">
                                                            <div className="flex justify-between items-center text-[10px] uppercase text-gray-400 font-bold leading-tight">
                                                                <span>DPP (Dasar Pengenaan Pajak)</span>
                                                                <span>Rp {dppVat.toLocaleString('id-ID')}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] uppercase text-gray-400 font-bold leading-tight">
                                                                <span>PPN / VAT 12%</span>
                                                                <span>Rp {vat12.toLocaleString('id-ID')}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center font-black text-lg border-t-2 border-black pt-1 mt-2 text-blue-900">
                                                            <span>TOTAL</span>
                                                            <span>Rp {totalRp.toLocaleString('id-ID')}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center italic text-[10px] text-gray-400 border-t border-dotted border-gray-400 pt-1">
                                                            <span>Sisa Pelunasan</span>
                                                            <span>Rp {pelunasan.toLocaleString('id-ID')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* TANDA TANGAN */}
                                            <div className="flex justify-end mt-12 mr-5">
                                                <div className="text-center w-56">
                                                    <p className="text-[10px] mb-24 text-gray-500">Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                    <div className="border-b-2 border-black w-full mb-1"></div>
                                                    <p className="font-bold text-xs uppercase">Finance Department</p>
                                                    <p className="text-[8px] text-gray-400 font-bold">PT. JEMBO CABLE COMPANY Tbk</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute bottom-4 left-0 right-0 text-center text-[8px] text-gray-400 uppercase tracking-widest">
                                        Halaman {pageIndex + 1} dari {totalPages} | {type} | Printed by Dakota Hub
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;
