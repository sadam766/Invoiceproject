'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, Save, Edit3, CheckCircle2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, updateDoc } from 'firebase/firestore';
import type { SpdData, Customer, CustomerAddress } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';

export default function SpdEnvelopePreview() {
    const router = useRouter();
    const { toast } = useToast();
    const params = useParams();
    const searchParams = useSearchParams();
    const { id } = params;
    const addressId = searchParams.get('addressId');
    const firestore = useFirestore();

    const [spd, setSpd] = useState<SpdData | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [manualAddress, setManualAddress] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Data Lookups
    const spdCollectionQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'spds')) : null, [firestore]);
    const { data: allSpds } = useCollection<SpdData>(spdCollectionQuery);

    const customersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersQuery);

    useEffect(() => {
        if (allSpds && id) {
            const foundSpd = allSpds.find(s => s.id === decodeURIComponent(id as string));
            if (foundSpd) {
                setSpd(foundSpd);
                if (allCustomers) {
                    const foundCust = allCustomers.find(c => c.name === foundSpd.invoices[0]?.customer);
                    if (foundCust) {
                        setCustomer(foundCust);
                        const addr = foundCust.addresses.find(a => a.id === addressId) || foundCust.addresses.find(a => a.isDefault) || foundCust.addresses[0];
                        if (addr) setManualAddress(addr.address);
                    }
                }
            }
        }
    }, [allSpds, allCustomers, id, addressId]);

    const handlePrint = async () => {
        if (firestore && spd) {
            const safeId = spd.id.replace(/\//g, '_');
            await updateDoc(doc(firestore, 'spds', safeId), { envelopePrinted: true });
        }
        window.print();
    };

    if (!spd || !customer) return <div className="p-40 text-center animate-pulse font-black uppercase text-slate-400 tracking-widest">Membangun Layout Amplop...</div>;

    return (
        <main className="bg-slate-100 min-h-screen p-4 sm:p-10 font-sans text-black">
            <style>{`
                @page { size: landscape; margin: 0; }
                @media print {
                    body { background: white !important; }
                    .bg-slate-100 { background: white !important; }
                    .print-hidden { display: none !important; }
                    .envelope-container { 
                        box-shadow: none !important; 
                        border: none !important; 
                        margin: 0 !important;
                        padding: 20mm !important;
                        width: 100% !important;
                        height: 100vh !important;
                    }
                }
            `}</style>

            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex justify-between items-center print:hidden bg-white p-6 rounded-3xl shadow-soft ring-1 ring-slate-200">
                    <Button onClick={() => router.back()} variant="ghost" className="font-bold hover:bg-slate-50 rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="outline" className="font-black uppercase text-[10px] border-slate-200 rounded-xl px-6" onClick={() => setIsEditing(!isEditing)}>
                            <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Selesai Edit" : "Edit Manual Alamat"}
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-10 rounded-xl shadow-xl shadow-indigo-100">
                                        <Printer className="mr-2 h-4 w-4" /> CETAK AMPLOP (LANDSCAPE)
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-none text-[10px] p-2">
                                    {TOOLTIP_CONTENT.envelope_print_landscape}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* ENVELOPE LAYOUT */}
                <div className="envelope-container bg-white shadow-2xl relative overflow-hidden rounded-xl border border-slate-200 aspect-[14/8.5] flex flex-col p-16">
                    {/* SENDER: TOP LEFT */}
                    <div className="absolute top-12 left-16 max-w-[400px]">
                        <div className="border-2 border-slate-900 rounded-2xl p-6 bg-slate-50/50">
                            <h1 className="font-black text-sm uppercase tracking-tighter text-slate-900">PT. JEMBO CABLE COMPANY Tbk</h1>
                            <div className="h-px bg-slate-900 my-2 opacity-20" />
                            <p className="text-[11px] font-black uppercase text-indigo-600 tracking-[0.3em]">Hal : Dokumen Tagihan</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref SPD: {spd.id}</p>
                        </div>
                    </div>

                    {/* RECIPIENT: BOTTOM RIGHT */}
                    <div className="mt-auto ml-auto mb-12 mr-8 w-[500px]">
                        <div className="space-y-4">
                            <p className="text-sm font-black italic text-slate-900 tracking-widest underline decoration-2 underline-offset-4">Kepada Yth :</p>
                            <div className="border-4 border-slate-900 rounded-[2.5rem] p-10 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)] space-y-4">
                                <h2 className="text-2xl font-black uppercase leading-none text-slate-900">{customer.name}</h2>
                                
                                {isEditing ? (
                                    <textarea 
                                        className="w-full text-lg font-bold text-slate-600 italic bg-slate-50 p-4 rounded-xl border-2 border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={manualAddress}
                                        onChange={(e) => setManualAddress(e.target.value)}
                                        rows={4}
                                    />
                                ) : (
                                    <p className="text-lg font-bold text-slate-600 leading-tight italic whitespace-pre-line">
                                        {manualAddress || 'Alamat tidak ditemukan. Silakan edit manual.'}
                                    </p>
                                )}

                                <div className="pt-4 border-t-2 border-slate-100 flex justify-between items-end">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Attention To / Kontak:</p>
                                        <p className="text-sm font-black text-slate-800 uppercase">
                                            {customer.contactPerson ? `Up. ${customer.contactPerson}` : 'Up. Bagian Finance'}
                                            {customer.phone && <span className="block text-[11px] font-mono mt-1 opacity-70">Telp: {customer.phone}</span>}
                                        </p>
                                    </div>
                                    <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full font-mono text-[10px] font-black tracking-tighter">
                                        ENVELOPE-ID: {spd.id.split('/').pop()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* WATERMARK BACKGROUND */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none rotate-[-15deg]">
                        <CheckCircle2 size={600} />
                    </div>
                </div>

                <div className="print-hidden text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">
                        Digital Envelope Engine — Powered by Dakota Hub Intelligence
                    </p>
                </div>
            </div>
        </main>
    );
}
