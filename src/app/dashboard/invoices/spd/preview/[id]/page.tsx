'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, MapPin, UserCheck, Layers, FileText, Globe, Truck, Info, Cpu, Database, Hash, Share2, MessageCircle } from 'lucide-react';
import { type SpdData, type Invoice } from '@/app/lib/data';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';
import { useToast } from '@/hooks/use-toast';

export default function SpdPreviewPage() {
    const router = useRouter();
    const { toast } = useToast();
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

    // Related Invoices lookup for Full Data Check
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

    const handleWhatsAppShare = () => {
        if (!spdItem) return;
        const text = encodeURIComponent(`Halo, ini adalah pelacakan SPD Digital No: ${spdItem.id}. Status: ${spdItem.status.toUpperCase()}. Silakan cek dokumen Anda.`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
        toast({ title: "Membuka WhatsApp..." });
    };

    if (!spdItem) return <div className="p-40 text-center animate-pulse font-black uppercase text-slate-400 tracking-widest">Mempersiapkan Summary SPD...</div>;

    return (
        <main className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans text-black animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center print:hidden bg-white p-6 rounded-3xl shadow-soft ring-1 ring-slate-200">
                    <Button onClick={() => router.back()} variant="ghost" className="font-bold hover:bg-slate-50 rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dispatch
                    </Button>
                    <div className="flex gap-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handleWhatsAppShare} variant="outline" className="font-black uppercase text-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl shadow-sm">
                                        <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white text-[10px] p-2">{TOOLTIP_CONTENT.spd_quick_share}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handleDownloadPdf} variant="outline" className="font-black uppercase text-[10px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl shadow-sm">
                                        <Download className="mr-2 h-4 w-4" /> Save PDF
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white text-[10px] p-2">{TOOLTIP_CONTENT.spd_quick_print}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-8 rounded-xl shadow-xl shadow-indigo-100">
                            <Printer className="mr-2 h-4 w-4" /> Print A4
                        </Button>
                    </div>
                </div>

                <div ref={printRef} className="bg-white shadow-2xl p-12 border border-slate-200 overflow-hidden rounded-[2.5rem]" style={{ minHeight: '297mm' }}>
                    {/* Header: Identity */}
                    <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 mb-2">
                                <Globe className="h-8 w-8 text-indigo-600" />
                                <h1 className="font-black text-2xl tracking-tighter uppercase italic text-slate-900">PT. JEMBO CABLE COMPANY Tbk</h1>
                            </div>
                            <p className="text-[10px] max-w-sm leading-relaxed font-bold text-slate-500 uppercase">
                                Head Office: Mega Glodok Kemayoran Tower B Lt. 6, Jakarta Pusat. <br />
                                Factory: Tangerang, Banten. Telp: (021) 65701488 <br />
                                <span className="text-indigo-600">www.jembo.com | Digital Dispatch Matrix</span>
                            </p>
                        </div>
                        <div className="text-right space-y-2">
                            <h2 className="font-black text-2xl uppercase tracking-tighter text-indigo-700">Surat Pengantar Dokumen</h2>
                            <p className="font-mono text-base font-black border-4 border-black inline-block px-4 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">{spdItem.id}</p>
                            <p className="text-[11px] font-black text-slate-400 uppercase mt-4 tracking-widest">
                                {format(new Date(spdItem.date), 'EEEE, dd MMMM yyyy', { locale: indonesiaLocale })}
                            </p>
                        </div>
                    </div>

                    {/* Meta Info Cards */}
                    <div className="grid grid-cols-3 gap-8 mb-12">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest text-center">Kurir / Expedition</p>
                            <div className="flex items-center justify-center gap-3 text-indigo-700">
                                <Truck className="h-6 w-6" />
                                <span className="font-black text-base uppercase">{spdItem.courier}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest text-center">Batch Density</p>
                            <div className="flex items-center justify-center gap-3 text-indigo-700">
                                <Layers className="h-6 w-6" />
                                <span className="font-black text-base uppercase">{spdItem.invoices.length} Documents</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10"><FileText className="h-10 w-10" /></div>
                            <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest">Blockchain Verify</p>
                            <span className="font-mono text-[11px] font-black tracking-tighter">DIS-{Math.random().toString(36).substring(7).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="space-y-12">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2">
                               <FileText className="h-4 w-4 text-indigo-500" /> Batch Content Verification Matrix
                            </p>
                            <Badge variant="outline" className="text-[9px] font-black uppercase h-5 bg-indigo-50 text-indigo-600 border-indigo-100">Status: {spdItem.status}</Badge>
                        </div>
                        
                        {Object.entries(groupedByAddress).map(([address, invoices], groupIdx) => (
                            <div key={groupIdx} className="space-y-6">
                                <div className="flex items-start gap-4 bg-indigo-50/50 p-6 rounded-[2rem] border-2 border-indigo-100 shadow-inner">
                                    <MapPin className="h-6 w-6 mt-1 text-rose-500" />
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest mb-1">Billing Destination Point:</p>
                                        <p className="text-sm font-black leading-snug text-slate-800 uppercase">{address}</p>
                                    </div>
                                </div>

                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-500 rounded-xl">
                                            <th className="p-4 text-center border-none w-[5%] font-black uppercase text-[9px] first:rounded-l-xl">No</th>
                                            <th className="p-4 text-left border-none w-[35%] font-black uppercase text-[9px]">Identity / Invoice</th>
                                            <th className="p-4 text-left border-none font-black uppercase text-[9px]">Legal Entity & PO</th>
                                            <th className="p-4 text-left border-none w-[20%] font-black uppercase text-[9px]">Surat Jalan (SJ)</th>
                                            <th className="p-4 text-center border-none w-[15%] font-black uppercase text-[9px] last:rounded-r-xl">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {invoices.map((inv, invIdx) => {
                                            const isERP = !(inv.invoiceId.startsWith('SAR') || inv.invoiceId.startsWith('KW'));
                                            const fullData = allInvoices?.find(fi => fi.id === inv.invoiceId);
                                            return (
                                                <tr key={invIdx} className="hover:bg-slate-50 transition-colors h-20">
                                                    <td className="p-4 text-center font-black text-slate-400">{invIdx + 1}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2 font-mono font-black text-indigo-700 text-xs">
                                                            {inv.invoiceId}
                                                            {isERP ? <Database className="h-3 w-3 text-emerald-500" /> : <Hash className="h-3 w-3 text-indigo-300" />}
                                                        </div>
                                                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Source: {isERP ? 'ERP Pusat' : 'Manual SAR'}</p>
                                                    </td>
                                                    <td className="p-4">
                                                        <p className="font-black uppercase text-slate-800 text-[10px] leading-tight mb-1">{inv.customer}</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge variant="outline" className="text-[7px] font-black h-3.5 border-slate-200 text-slate-400">PO: {fullData?.poNumber || '-'}</Badge>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {inv.sjNumbers && inv.sjNumbers.length > 0 ? (
                                                                inv.sjNumbers.map((sj, i) => (
                                                                    <Badge key={i} className="bg-slate-900 text-white text-[8px] font-black h-4 rounded px-1.5">{sj}</Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-[8px] text-rose-500 font-black italic">NO SJ LINKED</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 border-l-2 border-dotted border-slate-200 relative overflow-hidden group">
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-700">
                                                            <UserCheck className="h-16 w-16" />
                                                        </div>
                                                        <div className="w-full h-full border-b border-slate-100 flex items-end justify-center pb-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Sign Here</span>
                                                        </div>
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
                    <div className="mt-auto pt-24">
                        <div className="grid grid-cols-3 text-center text-[10px] font-black uppercase tracking-widest">
                            <div className="space-y-24">
                                <p className="text-slate-400 text-[8px]">Dispatcher System</p>
                                <div className="border-b-4 border-black w-48 mx-auto shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]" />
                                <p className="text-slate-900">( {user?.displayName || 'Finance Lead'} )</p>
                            </div>
                            <div className="space-y-24">
                                <p className="text-slate-400 text-[8px]">Carrier / Courier</p>
                                <div className="border-b-4 border-black w-48 mx-auto shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]" />
                                <p className="text-slate-900">( {spdItem.courier} )</p>
                            </div>
                            <div className="space-y-24">
                                <p className="text-slate-400 text-[8px]">Consignee Recipient</p>
                                <div className="border-b-4 border-black w-48 mx-auto shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]" />
                                <p className="text-slate-900">( Name & Official Stamp )</p>
                            </div>
                        </div>
                        
                        <div className="mt-20 bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700"><Info className="h-40 w-40" /></div>
                            <p className="font-black uppercase text-[10px] mb-4 flex items-center gap-2 text-indigo-400 tracking-[0.3em]">
                                <ShieldCheck className="h-5 w-5" /> Delivery Standard Operating Procedure:
                            </p>
                            <div className="grid md:grid-cols-2 gap-6 text-[10px] font-medium leading-relaxed opacity-80">
                                <p>1. Kurir wajib memastikan segel dokumen dalam keadaan utuh sebelum diserahkan kepada customer.</p>
                                <p>2. Tanda tangan dan stempel basah pada lembar ini adalah syarat mutlak validasi pembayaran di sistem Dakota.</p>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">
                                DAKOTA DIGITAL DISPATCH ECOSYSTEM — GENERATED AT {format(new Date(), 'HH:mm:ss')} — SERVER NODE: {Math.random().toString(36).substring(9).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @media print {
                    body { background: white !important; margin: 0; }
                    .bg-slate-100 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .shadow-2xl, .shadow-md, .shadow-sm { box-shadow: none !important; border: 1px solid #000 !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    .p-4, .p-12 { padding: 5mm !important; }
                    .rounded-[2.5rem], .rounded-3xl { border-radius: 0 !important; }
                }
            `}</style>
        </main>
    );
}

function ShieldCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
