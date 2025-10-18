
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Upload } from 'lucide-react';
import { type SpdData, spdData as initialSpdData, customerListData, invoiceListData } from '@/app/lib/data';
import { format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';

export default function SpdPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [spdItem, setSpdItem] = useState<SpdData | null>(null);

    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('spdPreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            if (decodeURIComponent(id as string) === parsedData.spd) {
                setSpdItem(parsedData);
            }
        } else if (id) {
            const decodedId = decodeURIComponent(id as string);
            const foundSpd = initialSpdData.find(item => item.spd === decodedId);
            setSpdItem(foundSpd || null);
        }
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (!spdItem) {
        return (
            <div className="p-8">
                <Button onClick={() => router.back()} variant="outline" className="mb-4 print:hidden">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <div>Loading or SPD not found...</div>
            </div>
        );
    }
    
    const customerDetails = customerListData.find(c => c.name === spdItem.customer);
    const relatedInvoice = invoiceListData.find(i => i.id === spdItem.noInvoice);

    return (
        <main className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <Button onClick={() => router.back()} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="destructive" className='bg-red-600 hover:bg-red-700'>
                            <Upload className="mr-2 h-4 w-4" /> PDF
                        </Button>
                        <Button onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Cetak
                        </Button>
                    </div>
                </div>

                <div className="print-container bg-white dark:bg-gray-800 p-8 shadow-md text-xs">
                    <header className="text-center mb-6">
                        <h1 className="font-bold text-sm">PT. JEMBO CABLE COMPANY Tbk</h1>
                        <p>Mega Glodok Kemayoran Office Tower B 6th Floor Jl.Angkasa Kav.B-6 Kota Baru Bandar Kemayoran Jakarta Pusat</p>
                    </header>
                    <div className="border-t-2 border-b-2 border-black py-1 text-center mb-6">
                        <h2 className="font-bold text-sm underline">SURAT PENGANTAR DOKUMEN</h2>
                        <p className="font-bold text-sm flex items-center justify-center">
                           <span>PS/</span>
                           <span className="px-2">1</span>
                           <span>-J/KEU/2024/DK</span>
                        </p>
                    </div>
                    
                    <div className="mb-6">
                        <p>KEPADA YTH:</p>
                        <div className="pl-12">
                            <p className="font-bold">{spdItem.customer}</p>
                            <p>{customerDetails?.address}</p>
                            <p>UP: BPK EDI FEBRIANTO (0877-7126-1408)</p>
                        </div>
                    </div>
                    
                    <div className="w-full">
                        <table className="w-full border-collapse border border-black">
                            <thead>
                                <tr className="font-bold bg-white dark:bg-gray-700">
                                    <td className="border border-black p-1 text-center w-16">JUMLAH</td>
                                    <td className="border border-black p-1 text-center w-24">TANGGAL</td>
                                    <td className="border border-black p-1 text-center">NO. KUITANSI</td>
                                    <td className="border border-black p-1 text-center">NO. INVOICE</td>
                                    <td className="border border-black p-1 text-center w-32">NILAI</td>
                                    <td className="border border-black p-1 text-center">NO. FAKTUR PAJAK</td>
                                    <td className="border border-black p-1 text-center">NO. SO.</td>
                                    <td className="border border-black p-1 text-center">NO. SURAT JALAN</td>
                                </tr>
                            </thead>
                            <tbody>
                                {[...Array(14)].map((_, index) => {
                                    const isFirstRow = index === 0;
                                    return (
                                        <tr key={index} style={{ height: '24px' }}>
                                            <td className="border border-black p-1 text-center">{isFirstRow ? '1 SET' : ''}</td>
                                            <td className="border border-black p-1 text-center">{isFirstRow ? format(new Date(spdItem.tanggalInvoice), 'dd-MMM-yy', { locale: indonesiaLocale }) : ''}</td>
                                            <td className="border border-black p-1">{isFirstRow ? spdItem.noKuitansi : ''}</td>
                                            <td className="border border-black p-1">{isFirstRow ? spdItem.noInvoice : ''}</td>
                                            <td className="border border-black p-1 text-right">{isFirstRow ? `Rp. ${spdItem.totalPiutang.toLocaleString('id-ID')}` : ''}</td>
                                            <td className="border border-black p-1">{isFirstRow ? spdItem.noFakturPajak : ''}</td>
                                            <td className="border border-black p-1">{isFirstRow ? relatedInvoice?.soNumber : ''}</td>
                                            <td className="border border-black p-1">{isFirstRow ? spdItem.suratJalan : ''}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between mt-6">
                        <div>
                            <p>Diterima Oleh :</p>
                            <div className="h-20"></div>
                            <p>( Nama Jelas )</p>
                        </div>
                        <div className="text-center">
                            <p>Jakarta, {format(new Date(), 'dd MMMM yyyy', { locale: indonesiaLocale })}</p>
                            <div className="h-20"></div>
                            <p>Sales Support</p>
                        </div>
                    </div>

                     <div className="mt-4">
                        <p className="font-bold">Catatan :</p>
                        <p>Mohon di fax ke (021) 65701488, setelah Tanda Terima Dokumen ini diterima</p>
                    </div>

                </div>
            </div>
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                    }
                    .print-container {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0;
                        padding: 0;
                    }
                    .print-hidden, .print-hidden * {
                        display: none !important;
                    }
                }
            `}</style>
        </main>
    );
}
