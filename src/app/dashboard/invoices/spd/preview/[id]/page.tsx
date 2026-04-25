
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, MapPin, Phone, UserCheck } from 'lucide-react';
import { type SpdData, type Invoice } from '@/app/lib/data';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

export default function SpdPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const firestore = useFirestore();
    const [spdItem, setSpdItem] = useState<SpdData | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Fetch full data for each invoice in the SPD to get PO Numbers & Addresses
    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore || !spdItem) return null;
        const ids = spdItem.invoices.map(i => i.invoiceId);
        return query(collection(firestore, 'invoices'), where('id', 'in', ids.length > 10 ? ids.slice(0, 10) : ids));
    }, [firestore, spdItem]);
    
    const { data: fullInvoices } = useCollection<Invoice>(invoicesQuery);

    useEffect(() => {
        const fetchSpd = async () => {
            if (!firestore || !id) return;
            // SPD IDs contain slashes, so we search by field or safe ID
            // For MVP, we'll try to find from the collection hook instead
        };
        fetchSpd();
    }, [id, firestore]);

    // Use global SPDs collection to find the exact SPD
    const spdCollectionQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spds'));
    }, [firestore]);
    const { data: allSpds } = useCollection<SpdData>(spdCollectionQuery);

    useEffect(() => {
        if (allSpds) {
            const found = allSpds.find(s => s.id === decodeURIComponent(id as string));
            if (found) setSpdItem(found);
        }
    }, [allSpds, id]);

    // Grouping invoices by Address to assist the courier
    const groupedByAddress = useMemo(() => {
        if (!spdItem) return {};
        return spdItem.invoices.reduce((acc, inv) => {
            const addr = inv.address || 'Unknown Address';
            if (!acc[addr]) acc[addr] = [];
            acc[addr].push(inv);
            return acc;
        }, {} as Record<string, typeof spdItem.invoices>);
    }, [spdItem]);

    const handleDownloadPdf = () => {
        const element = printRef.current;
        if (!element || !spdItem) return;
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `SPD-${spdItem.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (!spdItem) return <div className="p-8 text-center">Loading SPD data...</div>;

    return (
        <main className="bg-muted/30 min-h-screen p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <Button onClick={() => router.back()} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadPdf} variant="outline" className="bg-white">
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700">
                            <Printer className="mr-2 h-4 w-4" /> Print SPD
                        </Button>
                    </div>
                </div>

                <div ref={printRef} className="bg-white shadow-2xl p-8 border min-h-[297mm] text-black">
                    {/* Document Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                        <div className="space-y-1">
                            <h1 className="font-black text-xl tracking-tighter">PT. JEMBO CABLE COMPANY Tbk</h1>
                            <p className="text-[9px] max-w-sm leading-tight text-muted-foreground">
                                Mega Glodok Kemayoran Office Tower B 6th Floor, Jakarta Pusat. <br />
                                Telp: (021) 65701488 | Email: sales@jembo.com
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="font-bold text-lg uppercase underline">Surat Pengantar Dokumen</h2>
                            <p className="font-mono text-sm font-bold">{spdItem.id}</p>
                            <p className="text-xs">{format(new Date(spdItem.date), 'EEEE, dd MMMM yyyy', { locale: indonesiaLocale })}</p>
                        </div>
                    </div>

                    {/* Dispatch Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-muted/50 p-4 rounded border">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Kurir Pembawa:</p>
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                <span className="font-bold text-sm">{spdItem.courier}</span>
                            </div>
                        </div>
                        <div className="bg-muted/50 p-4 rounded border">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Dokumen:</p>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="font-bold text-sm">{spdItem.invoices.length} Lembar Invoice</span>
                            </div>
                        </div>
                    </div>

                    {/* Table of Contents */}
                    <div className="space-y-8">
                        {Object.entries(groupedByAddress).map(([address, invoices], groupIdx) => (
                            <div key={groupIdx} className="space-y-3">
                                <div className="flex items-start gap-2 text-indigo-700 bg-indigo-50 p-2 rounded">
                                    <MapPin className="h-4 w-4 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold uppercase">Lokasi Tujuan / Cabang:</p>
                                        <p className="text-xs font-bold leading-tight">{address}</p>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-gray-300 text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            <th className="p-2 text-left border-r border-gray-300 w-[5%]">No</th>
                                            <th className="p-2 text-left border-r border-gray-300 w-[20%]">No. Invoice</th>
                                            <th className="p-2 text-left border-r border-gray-300">Customer (Bill To)</th>
                                            <th className="p-2 text-left border-r border-gray-300 w-[20%]">No. PO</th>
                                            <th className="p-2 text-center w-[15%]">Tanda Terima</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((inv, invIdx) => {
                                            const originalInv = fullInvoices?.find(fi => fi.id === inv.invoiceId);
                                            return (
                                                <tr key={invIdx} className="border-b border-gray-200 h-10">
                                                    <td className="p-2 text-center border-r border-gray-200">{invIdx + 1}</td>
                                                    <td className="p-2 font-mono border-r border-gray-200">{inv.invoiceId}</td>
                                                    <td className="p-2 font-bold border-r border-gray-200">{inv.customer}</td>
                                                    <td className="p-2 border-r border-gray-200">{originalInv?.poNumber || '-'}</td>
                                                    <td className="p-2 relative">
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                            <UserCheck className="h-6 w-6" />
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

                    {/* Legal/Footer */}
                    <div className="mt-auto pt-20">
                        <div className="grid grid-cols-3 text-center text-xs">
                            <div className="space-y-16">
                                <p>Dibuat Oleh,</p>
                                <div className="border-b border-black w-32 mx-auto" />
                                <p className="font-bold">( Staf Administrasi )</p>
                            </div>
                            <div className="space-y-16">
                                <p>Kurir / Pembawa,</p>
                                <div className="border-b border-black w-32 mx-auto" />
                                <p className="font-bold">( {spdItem.courier} )</p>
                            </div>
                            <div className="space-y-16">
                                <p>Diterima Customer,</p>
                                <div className="border-b border-black w-32 mx-auto" />
                                <p className="font-bold">( Stempel & Nama Jelas )</p>
                            </div>
                        </div>
                        
                        <div className="mt-12 bg-yellow-50 border border-yellow-200 p-3 rounded text-[9px] text-yellow-800 leading-tight">
                            <p className="font-bold mb-1">CATATAN PENGIRIMAN:</p>
                            <p>1. Mohon periksa kelengkapan jumlah lembar invoice sebelum menandatangani SPD ini.</p>
                            <p>2. SPD ini merupakan bukti sah penyerahan dokumen fisik untuk keperluan audit dan penagihan.</p>
                            <p>3. Jika terjadi penolakan, kurir wajib mencantumkan alasan pada kolom keterangan atau di balik halaman ini.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @media print {
                    body { background: white !important; }
                    .bg-muted/30 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .shadow-2xl { box-shadow: none !important; border: none !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; }
                    .p-4, .p-8 { padding: 0 !important; }
                }
            `}</style>
        </main>
    );
}
