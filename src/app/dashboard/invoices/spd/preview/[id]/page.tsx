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
          margin: [10, 10, 10, 10],
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
                @media print {
                    body { background: white !important; margin: 0; }
                    .bg-slate-100 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .spd-container { 
                        box-shadow: none !important; 
                        border: none !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        width: 100% !important;
                    }
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

                {/* SPD FORMAL LAYOUT */}
                <div ref={printRef} className="spd-container bg-white shadow-2xl p-12 text-black leading-tight border border-slate-200" style={{ minHeight: '297mm', fontFamily: "'Inter', Arial, sans-serif" }}>
                    
                    {/* Header Section */}
                    <div className="mb-8">
                        <h1 className="font-bold text-base uppercase tracking-tight">PT JEMBO CABLE COMPANY Tbk.</h1>
                        <p className="text-[9px] max-w-lg leading-snug">
                            Mega Glodok Kemayoran Office Tower B 6th Floor Jl. Angkasa Kav. B-6 <br />
                            Kota Baru Bandar Kemayoran Jakarta Pusat.
                        </p>
                        
                        <div className="text-center mt-4 mb-2">
                            <h2 className="font-bold text-sm uppercase underline decoration-1 underline-offset-4">SURAT PENGANTAR DOKUMEN</h2>
                        </div>

                        <div className="flex justify-center items-center gap-2 mb-8">
                            <span className="text-[11px] font-bold">PS /</span>
                            <div className="border-b border-black w-20 text-center text-[11px] font-black tracking-widest">
                                {spdItem.id.match(/PS\/(\d+)/)?.[1]}
                            </div>
                            <span className="text-[11px] font-bold"> -J/KEU/{format(new Date(spdItem.date), 'yyyy')}/DK</span>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex gap-4 mb-8 text-[11px]">
                        <span className="font-bold whitespace-nowrap uppercase tracking-widest">KEPADA YTH:</span>
                        <div className="space-y-1">
                            <p className="font-black uppercase">{firstInvoice?.customer || 'Nama Pelanggan'}</p>
                            <p className="max-w-md italic leading-relaxed">{firstInvoice?.address || 'Alamat tujuan belum ditentukan.'}</p>
                            <p className="font-bold pt-1">PIC: Up. Bagian Finance / Purchasing</p>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="w-full border-t border-l border-black mb-12">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-[9px] font-bold uppercase text-center h-8">
                                    <th className="border-r border-b border-black w-[8%]">JUMLAH</th>
                                    <th className="border-r border-b border-black w-[12%]">TANGGAL</th>
                                    <th className="border-r border-b border-black w-[15%]">NO. KUITANSI</th>
                                    <th className="border-r border-b border-black w-[15%]">NO. INVOICE</th>
                                    <th className="border-r border-b border-black w-[15%]">NILAI</th>
                                    <th className="border-r border-b border-black w-[15%]">NO. FAKTUR PAJAK</th>
                                    <th className="border-r border-b border-black w-[10%]">NO. SO.</th>
                                    <th className="border-r border-b border-black">NO. SURAT JALAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {spdItem.invoices.map((invEntry, idx) => {
                                    const fullInvoice = allInvoices?.find(i => i.id === invEntry.invoiceId);
                                    const taxInfo = allTaxInvoices?.find(t => t.invoiceNumber === invEntry.invoiceId);
                                    return (
                                        <tr key={idx} className="text-[10px] h-10 border-b border-black">
                                            <td className="border-r border-black text-center font-bold">1 SET</td>
                                            <td className="border-r border-black text-center">{format(new Date(spdItem.date), 'dd-MM-yyyy')}</td>
                                            <td className="border-r border-black px-2"></td>
                                            <td className="border-r border-black text-center font-black">{invEntry.invoiceId}</td>
                                            <td className="border-r border-black text-right px-2">
                                                Rp. {fullInvoice?.amount.toLocaleString('id-ID') || '0'}
                                            </td>
                                            <td className="border-r border-black text-center font-mono">
                                                {taxInfo?.taxInvoiceNumber || '-'}
                                            </td>
                                            <td className="border-r border-black text-center font-mono">{fullInvoice?.soNumber || '-'}</td>
                                            <td className="px-2 truncate">
                                                {invEntry.sjNumbers?.join(', ') || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Fill empty rows to match physical paper depth if needed */}
                                {Array.from({ length: Math.max(0, 10 - spdItem.invoices.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-8 border-b border-black">
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td>
                                        <td></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Signature Section */}
                    <div className="flex justify-between mt-8 text-[11px] font-bold">
                        <div className="w-64 space-y-20">
                            <p>Diterima Oleh :</p>
                            <div className="space-y-1">
                                <p>( Nama Jelas )</p>
                                <p className="font-normal text-[10px]">Catatan :</p>
                            </div>
                        </div>
                        <div className="text-center w-64 space-y-20">
                            <p>Jakarta, {format(new Date(spdItem.date), 'dd MMM yyyy')}</p>
                            <div className="space-y-1">
                                <p className="underline decoration-1">Sales Support</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-12 text-[10px] italic font-medium">
                        <p>Mohon di fax ke (021) 65701488, setelah Tanda Terima Dokumen ini diterima</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
