'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Edit3, Truck } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { SpdData } from '@/app/lib/data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_CONTENT } from '@/app/lib/tooltip-content';

export default function SpdEnvelopePreview() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { id } = params;
    const firestore = useFirestore();

    const [manualAddress, setManualAddress] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Eager loading: Fetch only specific SPD
    const safeSpdId = decodeURIComponent(id as string).replace(/\//g, '_');
    const spdRef = useMemoFirebase(() => firestore ? doc(firestore, 'spds', safeSpdId) : null, [firestore, safeSpdId]);
    const { data: spd, isLoading: isLoadingSpd } = useDoc<SpdData>(spdRef);

    // Fallback: If we don't have the full customer object yet, use the data from SPD
    useEffect(() => {
        if (spd && !manualAddress) {
            // Priority: Address from specific selection, then SPD default
            const initialAddr = spd.invoices[0]?.address || '';
            setManualAddress(initialAddr);
        }
    }, [spd, manualAddress]);

    const handlePrint = async () => {
        if (firestore && spd) {
            await updateDoc(doc(firestore, 'spds', safeSpdId), { envelopePrinted: true });
        }
        window.print();
    };

    if (isLoadingSpd || !spd) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="text-center space-y-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Generating Formal Layout...</p>
                </div>
            </div>
        );
    }

    const firstInv = spd.invoices[0];

    return (
        <main className="bg-slate-50 min-h-screen p-4 sm:p-10 font-sans text-black animate-in fade-in duration-300">
            <style>{`
                @page { size: landscape; margin: 0; }
                @media print {
                    body { background: white !important; }
                    .print-hidden { display: none !important; }
                    .envelope-container { 
                        box-shadow: none !important; 
                        border: none !important; 
                        margin: 0 !important;
                        padding: 15mm !important;
                        width: 100% !important;
                        height: 100vh !important;
                        background: white !important;
                    }
                    * { color: #000000 !important; border-color: #000000 !important; }
                }
                .formal-font { font-family: 'Inter', Arial, Helvetica, sans-serif; }
            `}</style>

            <div className="max-w-5xl mx-auto space-y-6 print-hidden">
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-200">
                    <Button onClick={() => router.back()} variant="ghost" className="font-bold hover:bg-slate-50 rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="outline" className="font-black uppercase text-[10px] border-slate-200 rounded-xl px-6 text-black" onClick={() => setIsEditing(!isEditing)}>
                            <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Selesai Edit" : "Edit Manual Alamat"}
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handlePrint} className="bg-black hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest px-10 rounded-xl shadow-xl">
                                        <Printer className="mr-2 h-4 w-4" /> CETAK SEKARANG (LANDSCAPE)
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-black text-white border-none text-[10px] p-2">
                                    {TOOLTIP_CONTENT.envelope_print_landscape}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">High-Performance Print Engine — Verified Render</p>
                </div>
            </div>

            {/* ENVELOPE LAYOUT - FORMAL BLACK & WHITE */}
            <div className="envelope-container formal-font bg-white shadow-2xl relative overflow-hidden rounded-xl border border-slate-200 aspect-[14/8.5] flex flex-col p-16 mx-auto mt-6" style={{ color: '#000000' }}>
                
                {/* SENDER: TOP LEFT (PT JEMBO) */}
                <div className="absolute top-12 left-16 max-w-[420px]">
                    <div className="border-[1.5px] border-black p-6 bg-white">
                        <h1 className="font-black text-sm uppercase tracking-tight text-black leading-none">PT. JEMBO CABLE COMPANY Tbk</h1>
                        <div className="h-[1px] bg-black my-2" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Hal : DOKUMEN TAGIHAN</p>
                        <p className="text-[8px] font-bold text-black uppercase mt-1 opacity-70 italic">Ref SPD: {spd.id}</p>
                    </div>
                </div>

                {/* RECIPIENT: BOTTOM RIGHT (CUSTOMER) */}
                <div className="mt-auto ml-auto mb-16 mr-10 w-[550px]">
                    <div className="border-[3px] border-black p-10 bg-white space-y-5">
                        <p className="text-sm font-black text-black tracking-widest italic mb-2">Kepada Yth :</p>
                        
                        <h2 className="text-2xl font-black uppercase leading-tight text-black border-b border-black pb-2">
                            {firstInv?.customer || 'Nama Pelanggan'}
                        </h2>
                        
                        {isEditing ? (
                            <textarea 
                                className="w-full text-lg font-bold text-black italic bg-slate-50 p-4 border border-black outline-none"
                                value={manualAddress}
                                onChange={(e) => setManualAddress(e.target.value)}
                                rows={4}
                            />
                        ) : (
                            <p className="text-lg font-bold text-black leading-tight italic whitespace-pre-line min-h-[80px]">
                                {manualAddress || 'Alamat tujuan belum ditentukan.'}
                            </p>
                        )}

                        <div className="pt-2">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-black tracking-widest opacity-60">Attention To / Kontak:</p>
                                <p className="text-[13px] font-black text-black uppercase">
                                    Up. Bagian Finance / Purchasing
                                    <span className="block text-[11px] font-mono mt-0.5 opacity-80">Ref: {spd.id.split('/').pop()}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LOGISTICS WATERMARK */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-12deg]">
                    <Truck size={500} strokeWidth={1} color="#000000" />
                </div>
            </div>

            <div className="print-hidden text-center mt-12 mb-20">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">
                    Formal Corporate Standard — Landscape Orientation Required
                </p>
            </div>
        </main>
    );
}
