
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, MapPin, Phone, UserCheck, Layers, FileText, Globe, Truck, Info } from 'lucide-react';
import { type SpdData, type Invoice } from '@/app/lib/data';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

export default function SpdPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const firestore = useFirestore();
    const { user } = useUser();
    const [spdItem, setSpdItem] = useState<SpdData | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Global SPDs lookup
    const spdCollectionQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data: allSpds } = useCollection<SpdData>(spdCollectionQuery);

    // Related Invoices lookup for PO Numbers and full data
    const allInvoicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'invoices'));
    }, [firestore]);
    const { data: allInvoices } = useCollection<Invoice>(allInvoicesQuery);

    useEffect(() => {
        if (allSpds) {
            const found = allSpds.find(s => s.id === decodeURIComponent(id as string));
            if (found) setSpdItem(found);
        }
    }, [allSpds, id]);

    // Grouping invoices by Address
    const groupedByAddress = useMemo(() => {
        if (!spdItem) return {};
        return spdItem.invoices.reduce((acc, inv) => {
            const addr = inv.address || 'Alamat tidak terdefinisi';
            if (!acc[addr]) acc[addr] = [];
            acc[addr].push(inv);
            return acc;
        }, {} as Record<string, typeof spdItem.invoices>);
    }, [spdItem]);

    const handleDownloadPdf = () => {
        const element = printRef.current;
        if (!element || !spdItem) return;
        const opt = {
          margin: [5, 5, 5, 5],
          filename: `SPD-Dispatch-${spdItem.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!spdItem) return <div className="p-20 text-center animate-pulse font-bold text-muted-foreground">Mempersiapkan Summary SPD...</div>;

    return (
        <main className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border">
                    <Button onClick={() => router.back()} variant="ghost" className="font-bold hover:bg-slate-50">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dispatch
                    </Button>
                    <div className="flex gap-3">
                        <Button onClick={handleDownloadPdf} variant="outline" className="font-bold border-indigo-200 text-indigo-700">
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg">
                            <Printer className="mr-2 h-4 w-4" /> Print Summary (A4)
                        </Button>
                    </div>
                </div>

                <div ref={printRef} className="bg-white shadow-2xl p-10 border border-slate-200 text-black overflow-hidden" style={{ minHeight: '297mm' }}>
                    {/* Header: Identity */}
                    <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-6 w-6 text-indigo-600" />
                                <h1 className="font-black text-2xl tracking-tighter uppercase italic">PT. JEMBO CABLE COMPANY Tbk</h1>
                            </div>
                            <p className="text-[10px] max-w-sm leading-snug font-medium text-slate-600">
                                Head Office: Mega Glodok Kemayoran Tower B Lt. 6, Jakarta Pusat. <br />
                                Factory: Tangerang, Banten. Telp: (021) 65701488 <br />
                                <span className="font-bold">www.jembo.com | Digital Dispatch System</span>
                            </p>
                        </div>
                        <div className="text-right space-y-1">
                            <h2 className="font-black text-xl uppercase tracking-tighter text-indigo-700">Surat Pengantar Dokumen</h2>
                            <p className="font-mono text-sm font-black border-2 border-black inline-block px-3 py-1 mt-1">{spdItem.id}</p>
                            <p className="text-[11px] font-bold text-slate-500 uppercase mt-2">
                                {format(new Date(spdItem.date), 'EEEE, dd MMMM yyyy', { locale: indonesiaLocale })}
                            </p>
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="grid grid-cols-3 gap-6 mb-10">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest text-center">Kurir / Expedition</p>
                            <div className="flex items-center justify-center gap-2 text-indigo-700">
                                <Truck className="h-5 w-5" />
                                <span className="font-black text-sm uppercase">{spdItem.courier}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest text-center">Total Load</p>
                            <div className="flex items-center justify-center gap-2 text-indigo-700">
                                <Layers className="h-5 w-5" />
                                <span className="font-black text-sm uppercase">{spdItem.invoices.length} Invoice</span>
                            </div>
                        </div>
                        <div className="bg-indigo-600 p-4 rounded-lg text-white shadow-md flex flex-col items-center justify-center">
                            <p className="text-[9px] font-black uppercase opacity-70 mb-1 tracking-widest">Verification ID</p>
                            <span className="font-mono text-[10px] font-bold">DIS-{Math.random().toString(36).substring(7).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="space-y-10">
                        <p className="text-[10px] font-black uppercase text-slate-400 border-b pb-2 tracking-widest mb-4 flex items-center gap-2">
                           <FileText className="h-3 w-3" /> Batch Dispatch Detail (Invoice & Multi Surat Jalan)
                        </p>
                        
                        {Object.entries(groupedByAddress).map(([address, invoices], groupIdx) => (
                            <div key={groupIdx} className="space-y-4">
                                <div className="flex items-start gap-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 ring-1 ring-indigo-50">
                                    <MapPin className="h-5 w-5 mt-0.5 text-indigo-600" />
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black uppercase text-indigo-600/70 tracking-widest">Lokasi Penagihan:</p>
                                        <p className="text-sm font-black leading-tight text-slate-800">{address}</p>
                                    </div>
                                </div>

                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600">
                                            <th className="p-3 text-center border w-[5%] font-black uppercase text-[9px]">No</th>
                                            <th className="p-3 text-left border w-[22%] font-black uppercase text-[9px]">No. Invoice</th>
                                            <th className="p-3 text-left border w-[25%] font-black uppercase text-[9px]">No. Surat Jalan (SJ)</th>
                                            <th className="p-3 text-left border font-black uppercase text-[9px]">Customer Name</th>
                                            <th className="p-3 text-center border w-[18%] font-black uppercase text-[9px]">Signature / Stamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((inv, invIdx) => {
                                            const fullData = allInvoices?.find(fi => fi.id === inv.invoiceId);
                                            return (
                                                <tr key={invIdx} className="hover:bg-slate-50 transition-colors h-16">
                                                    <td className="p-3 text-center border font-bold text-slate-500">{invIdx + 1}</td>
                                                    <td className="p-3 font-mono font-black border text-indigo-700 bg-indigo-50/20">{inv.invoiceId}</td>
                                                    <td className="p-3 font-mono border text-slate-600 bg-slate-50/20">
                                                        {inv.sjNumbers && inv.sjNumbers.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {inv.sjNumbers.map((sj, i) => (
                                                                    <span key={i} className="bg-white border px-1.5 py-0.5 rounded text-[10px]">{sj}</span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] italic text-rose-500 font-bold">Tanpa SJ</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-black uppercase border text-slate-800">{inv.customer}</td>
                                                    <td className="p-3 border relative overflow-hidden group">
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                                            <UserCheck className="h-10 w-10" />
                                                        </div>
                                                        <div className="w-full h-full border-b border-dotted border-slate-300" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    {/* Signatures */}
                    <div className="mt-auto pt-20">
                        <div className="grid grid-cols-3 text-center text-[11px] font-bold">
                            <div className="space-y-20">
                                <p className="uppercase text-slate-400 tracking-widest text-[9px] mb-2">Dispatcher / Admin</p>
                                <div className="border-b-2 border-slate-800 w-40 mx-auto" />
                                <p className="font-black uppercase text-slate-800">( {user?.displayName || 'Finance Staff'} )</p>
                            </div>
                            <div className="space-y-20">
                                <p className="uppercase text-slate-400 tracking-widest text-[9px] mb-2">Courier / Carrier</p>
                                <div className="border-b-2 border-slate-800 w-40 mx-auto" />
                                <p className="font-black uppercase text-slate-800">( {spdItem.courier} )</p>
                            </div>
                            <div className="space-y-20">
                                <p className="uppercase text-slate-400 tracking-widest text-[9px] mb-2">Customer Recipient</p>
                                <div className="border-b-2 border-slate-800 w-40 mx-auto" />
                                <p className="font-black uppercase text-slate-800">( Name & Stamp )</p>
                            </div>
                        </div>
                        
                        <div className="mt-16 bg-indigo-50/50 border-2 border-indigo-100 p-5 rounded-xl text-[10px] text-indigo-900/80 leading-relaxed shadow-inner">
                            <p className="font-black uppercase mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4" /> Syarat & Ketentuan Penyerahan Dokumen:
                            </p>
                            <p>1. Penerima wajib memastikan nomor invoice dan nomor surat jalan fisik sesuai dengan daftar di atas sebelum menandatangani SPD ini.</p>
                            <p>2. SPD Summary ini adalah bukti digital yang sah dalam sistem ERP Dakota. Salinan fisik hanya berlaku dengan stempel basah asli.</p>
                        </div>

                        <div className="mt-8 text-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                            Generated by Dakota Digital Dispatch - {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @media print {
                    body { background: white !important; margin: 0; }
                    .bg-slate-100 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .shadow-2xl, .shadow-md, .shadow-sm { box-shadow: none !important; border: 1px solid #eee !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    .p-4, .p-10 { padding: 5mm !important; }
                }
            `}</style>
        </main>
    );
}
