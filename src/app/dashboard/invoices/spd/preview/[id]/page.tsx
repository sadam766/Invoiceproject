
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { type SpdData, type Invoice, type TaxInvoice } from '@/app/lib/data';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

export default function SpdPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const firestore = useFirestore();
    const [spdItem, setSpdItem] = useState<SpdData | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Global SPDs lookup
    const spdCollectionQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'spds')) : null), [firestore]);
    const { data: allSpds } = useCollection<SpdData>(spdCollectionQuery);

    // Full Invoices & Tax Invoices for data enrichment
    const invoicesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'invoices')) : null), [firestore]);
    const { data: allInvoices } = useCollection<Invoice>(invoicesQuery);

    const taxQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'taxInvoices')) : null), [firestore]);
    const { data: allTaxInvoices } = useCollection<TaxInvoice>(taxQuery);

    useEffect(() => {
        if (allSpds) {
            const found = allSpds.find(s => s.id === decodeURIComponent(id as string));
            if (found) setSpdItem(found);
        }
    }, [allSpds, id]);

    const handleDownloadPdf = () => {
        const element = printRef.current;
        if (!element || !spdItem) return;
        const opt = {
          margin: [5, 10, 10, 10],
          filename: `SPD-${spdItem.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!spdItem) return <div className="p-40 text-center animate-pulse font-black uppercase text-slate-400 tracking-widest">Membangun Layout SPD...</div>;

    const firstInvoice = spdItem.invoices[0];

    return (
        <main className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans text-black animate-in fade-in duration-700">
            <style jsx global>{`
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                @media print {
                    body { background: white !important; margin: 0; padding: 0; }
                    .bg-slate-100 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .spd-container { 
                        box-shadow: none !important; 
                        border: none !important; 
                        margin: 0 !important; 
                        padding: 10mm 15mm !important;
                        width: 100% !important;
                        max-height: 148mm !important; /* Setengah halaman A4 */
                    }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    th, td { border: 1px solid black !important; }
                }
                .spd-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .spd-table th, .spd-table td {
                    border: 1px solid black;
                    padding: 4px 6px;
                    font-size: 9px;
                    line-height: 1.2;
                }
            `}</style>

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center print-hidden bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-200">
                    <Button onClick={() => router.back()} variant="ghost" className="font-bold">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                    <div className="flex gap-3">
                        <Button onClick={handleDownloadPdf} variant="outline" className="font-black uppercase text-[10px] border-slate-200">
                            <Download className="mr-2 h-4 w-4" /> Simpan PDF
                        </Button>
                        <Button onClick={() => window.print()} className="bg-black text-white font-black uppercase text-[10px] tracking-widest px-8">
                            <Printer className="mr-2 h-4 w-4" /> Cetak Sekarang
                        </Button>
                    </div>
                </div>

                {/* SPD FORMAL LAYOUT - LEAN VERSION */}
                <div ref={printRef} className="spd-container bg-white shadow-2xl p-10 text-black leading-tight border border-slate-200" style={{ minHeight: '148mm', fontFamily: "'Inter', Arial, sans-serif" }}>
                    
                    {/* Header Section - Compact */}
                    <div className="mb-4">
                        <h1 className="font-bold text-sm uppercase tracking-tight">PT JEMBO CABLE COMPANY Tbk.</h1>
                        <p className="text-[8px] max-w-lg leading-snug opacity-80">
                            Mega Glodok Kemayoran Office Tower B 6th Floor Jl. Angkasa Kav. B-6 <br />
                            Kota Baru Bandar Kemayoran Jakarta Pusat.
                        </p>
                        
                        <div className="text-center mt-2 mb-1">
                            <h2 className="font-bold text-xs uppercase underline decoration-1 underline-offset-2">SURAT PENGANTAR DOKUMEN</h2>
                        </div>

                        <div className="flex justify-center items-center gap-1 mb-4">
                            <span className="text-[10px] font-bold">PS /</span>
                            <div className="border-b border-black w-16 text-center text-[10px] font-black tracking-widest">
                                {spdItem.id.match(/PS\/(\d+)/)?.[1]}
                            </div>
                            <span className="text-[10px] font-bold"> -J/KEU/{format(new Date(spdItem.date), 'yyyy')}/DK</span>
                        </div>
                    </div>

                    {/* Customer Info - Compact */}
                    <div className="flex gap-2 mb-4 text-[10px]">
                        <span className="font-bold whitespace-nowrap uppercase tracking-widest">KEPADA YTH:</span>
                        <div className="space-y-0.5">
                            <p className="font-black uppercase">{firstInvoice?.customer || 'Nama Pelanggan'}</p>
                            <p className="max-w-md italic leading-tight text-[9px]">{firstInvoice?.address || 'Alamat tujuan belum ditentukan.'}</p>
                            <p className="font-bold pt-0.5 text-[9px]">PIC: Up. Bagian Finance / Purchasing</p>
                        </div>
                    </div>

                    {/* Table Section - Fixed 8 Columns */}
                    <table className="spd-table mb-6">
                        <thead>
                            <tr className="bg-slate-50 font-bold uppercase text-center h-7">
                                <th className="w-[8%]">JUMLAH</th>
                                <th className="w-[12%]">TANGGAL</th>
                                <th className="w-[12%]">NO. KUITANSI</th>
                                <th className="w-[15%]">NO. INVOICE</th>
                                <th className="w-[15%]">NILAI</th>
                                <th className="w-[15%]">NO. FAKTUR PAJAK</th>
                                <th className="w-[10%]">NO. SO.</th>
                                <th className="w-[13%]">NO. SURAT JALAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {spdItem.invoices.map((invEntry, idx) => {
                                const fullInvoice = allInvoices?.find(i => i.id === invEntry.invoiceId);
                                const taxInfo = allTaxInvoices?.find(t => t.invoiceNumber === invEntry.invoiceId);
                                return (
                                    <tr key={idx} className="h-8">
                                        <td className="text-center font-bold">1 SET</td>
                                        <td className="text-center">{format(new Date(spdItem.date), 'dd-MM-yyyy')}</td>
                                        <td className="px-2"></td>
                                        <td className="text-center font-black">{invEntry.invoiceId}</td>
                                        <td className="text-right px-2">
                                            Rp. {fullInvoice?.amount.toLocaleString('id-ID') || '0'}
                                        </td>
                                        <td className="text-center font-mono text-[8px]">
                                            {taxInfo?.taxInvoiceNumber || '-'}
                                        </td>
                                        <td className="text-center font-mono text-[8px]">{fullInvoice?.soNumber || '-'}</td>
                                        <td className="px-2 truncate text-[8px]">
                                            {invEntry.sjNumbers?.join(', ') || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Fill empty rows to maintain minimum document structure */}
                            {Array.from({ length: Math.max(0, 5 - spdItem.invoices.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="h-7">
                                    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Signature Section - Compact & Aligned */}
                    <div className="flex justify-between mt-4 text-[10px] font-bold">
                        <div className="w-48 space-y-12">
                            <p>Diterima Oleh :</p>
                            <div className="space-y-0.5">
                                <p className="border-t border-black pt-1 inline-block min-w-[120px]">( Nama Jelas )</p>
                                <p className="font-normal text-[8px]">Catatan :</p>
                            </div>
                        </div>
                        <div className="text-center w-48 space-y-12">
                            <p>Jakarta, {format(new Date(spdItem.date), 'dd MMM yyyy')}</p>
                            <div className="space-y-0.5">
                                <p className="underline decoration-1 underline-offset-2">Sales Support</p>
                                <p className="font-normal text-[8px]">Finance & Accounting</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Note - Small */}
                    <div className="mt-6 text-[8px] italic font-medium opacity-70">
                        <p>Mohon di fax ke (021) 65701488, setelah Tanda Terima Dokumen ini diterima</p>
                    </div>
                </div>
            </div>
            
            <div className="print-hidden text-center mt-8 mb-20 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Dakota Digital Dispatch Engine — Formal Render</p>
            </div>
        </main>
    );
}

