'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Download, Upload, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import type { Invoice } from '@/app/lib/data';

// --- DEFINISI TIPE DATA ---
interface Item {
    id: string;
    no: number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
}

interface InvoiceData {
    id: string;
    erpInvoiceId?: string;
    items: Item[];
    customer: {
        name: string;
        address: string;
        npwp?: string;
    };
    date: string; 
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    subtotal: number;
    dppVat: number;
    vat12: number;
    paymentTerms: string;
    printType: 'original' | 'copy';
    negotiation: number;
    dpValue: number;
    virtualAccount?: {
        bankName: string;
        vaNumber: string;
    };
}

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 10;

const InvoicePreviewPage = () => {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const firestore = useFirestore();
    const invoiceIdParam = decodeURIComponent(params.id as string).replace(/\//g, '_');

    // AUDIT FIX: Mandatory Database Re-fetch for Persistence
    const invoiceRef = useMemoFirebase(() => (!firestore || !invoiceIdParam) ? null : doc(firestore, 'invoices', invoiceIdParam), [firestore, invoiceIdParam]);
    const { data: dbInvoice, isLoading: isDbLoading } = useDoc<Invoice>(invoiceRef);

    useEffect(() => {
        if (dbInvoice && !isDbLoading) {
            const mappedData: InvoiceData = {
                id: dbInvoice.id,
                erpInvoiceId: dbInvoice.erpInvoiceId,
                items: (dbInvoice.items || []).map((it, idx) => ({
                    id: String(it.id),
                    no: idx + 1,
                    name: it.name,
                    quantity: it.quantity,
                    unit: it.unit,
                    price: it.price,
                    total: it.total
                })),
                customer: {
                    name: dbInvoice.customer,
                    address: dbInvoice.billingAddress,
                    npwp: dbInvoice.billingNpwp
                },
                date: dbInvoice.date,
                soNumber: dbInvoice.soNumber,
                poNumber: dbInvoice.poNumber,
                grandTotal: dbInvoice.amount,
                subtotal: (dbInvoice.items || []).reduce((s, i) => s + i.total, 0),
                dppVat: dbInvoice.amount / 1.12, 
                vat12: dbInvoice.amount - (dbInvoice.amount / 1.12),
                paymentTerms: '30 Days',
                printType: 'original',
                negotiation: dbInvoice.negotiation || 0,
                dpValue: dbInvoice.isDpInvoice ? dbInvoice.amount : (dbInvoice.dpDeduction || 0 + (dbInvoice.retention || 0)),
            };
            setInvoiceData(mappedData);
        }
    }, [dbInvoice, isDbLoading]);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        const opt = {
          margin: [10, 10, 10, 10], 
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    const handleExportExcel = () => {
        if (!invoiceData) return;
        const dataToExport = invoiceData.items.map(item => ({
            'Invoice ID': invoiceData.id,
            'ERP Reference': invoiceData.erpInvoiceId || '-',
            'Customer': invoiceData.customer.name,
            'SO Number': invoiceData.soNumber,
            'Date': formatDate(invoiceData.date),
            'Item Name': item.name,
            'Quantity': item.quantity,
            'Price': item.price,
            'Total': item.total,
        }));
        exportToExcel(dataToExport, `Invoice-${invoiceData.id.replace(/\//g, '_')}`);
        toast({ title: "Export Berhasil" });
    };
    
    if (isDbLoading || !invoiceData) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Document Integrity...</div>
            </div>
        );
    }

    const itemChunks = Array.from({ length: Math.ceil(invoiceData.items.length / ITEMS_PER_PAGE) }, (_, i) =>
        invoiceData.items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    
    const invoiceTitle = invoiceData.id.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE/OFFICIAL RECEIPT';

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 font-sans text-black">
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .page-break { page-break-before: always; }
                    .print-hidden { display: none !important; }
                }
            `}</style>
            
            <div className="flex justify-center space-x-4 mb-4 print-hidden">
                <Button onClick={() => router.back()} variant="outline"><ArrowLeft size={16} /> Kembali</Button>
                <Button onClick={handleDownloadPdf} className="bg-indigo-600"><Download size={16} /> PDF</Button>
                <Button onClick={handleExportExcel} variant="outline"><Upload size={16} /> Excel</Button>
            </div>
            
            <div ref={invoiceContainerRef}>
                {itemChunks.map((chunk, pageIndex) => (
                    <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-10 my-8 text-[10px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ height: '297mm' }}>
                        <header className="relative border-b-2 border-black pb-4 mb-4">
                            <div className="w-full text-center">
                                <p className="font-black uppercase text-sm tracking-widest">{invoiceTitle}</p>
                                <p className="font-black text-lg">{invoiceData.id}</p>
                                {invoiceData.erpInvoiceId && <p className="text-[8px] font-mono text-gray-500">ERP REF: {invoiceData.erpInvoiceId}</p>}
                            </div>
                            <div className='flex justify-between items-start mt-6'>
                                <div className='w-[45%]'>
                                    <p className="font-black text-[11px] uppercase">{invoiceData.customer.name}</p>
                                    <p className="text-[9px] mt-1 whitespace-pre-line leading-relaxed">{invoiceData.customer.address}</p>
                                    {invoiceData.customer.npwp && <p className="text-[9px] mt-1 font-bold">NPWP: {invoiceData.customer.npwp}</p>}
                                </div>
                                <div className="w-[35%] text-[10px] space-y-1">
                                    <div className="flex justify-between"><span>Sales Order:</span><span className="font-bold">{invoiceData.soNumber}</span></div>
                                    <div className="flex justify-between"><span>Purchase Order:</span><span className="font-bold">{invoiceData.poNumber}</span></div>
                                    <div className="flex justify-between"><span>Issue Date:</span><span className="font-bold">{formatDate(invoiceData.date)}</span></div>
                                </div>
                            </div>
                        </header>

                        <main className='flex-grow'>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className='bg-slate-50 border-y border-black'>
                                        <th className="p-2 text-left w-[5%] font-black">NO</th>
                                        <th className="p-2 text-left font-black">ITEM DESCRIPTION</th>
                                        <th className="p-2 text-center w-[15%] font-black">QTY</th>
                                        <th className="p-2 text-right w-[15%] font-black">PRICE (IDR)</th>
                                        <th className="p-2 text-right w-[18%] font-black">AMOUNT (IDR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={item.id} className='border-b border-slate-100'>
                                            <td className="p-2 align-top">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="p-2 font-medium">{item.name}</td>
                                            <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        
                        {pageIndex === itemChunks.length - 1 && (
                            <footer className="mt-auto pt-6 border-t-2 border-black">
                                <div className="flex justify-between">
                                    <div className="w-[50%] space-y-4">
                                        <div className="bg-slate-50 p-4 rounded border border-dashed border-slate-300 min-h-[100px]">
                                            <p className="font-black uppercase text-[8px] text-slate-500 mb-2">Instruksi Pembayaran:</p>
                                            <p className="font-bold text-[10px]">PT JEMBO CABLE COMPANY Tbk</p>
                                            <p className="text-[9px]">BANK MANDIRI - Jakarta Sudirman</p>
                                            <p className="font-mono font-bold text-indigo-700 text-sm">A/C: 102-0005000218 (IDR)</p>
                                        </div>
                                    </div>
                                    <div className="w-[40%] space-y-1">
                                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(invoiceData.subtotal)}</span></div>
                                        {invoiceData.negotiation > 0 && <div className="flex justify-between text-rose-600"><span>Negotiation:</span><span>({formatCurrency(invoiceData.negotiation)})</span></div>}
                                        {invoiceData.dpValue > 0 && <div className="flex justify-between text-blue-600"><span>DP / Retention:</span><span>({formatCurrency(invoiceData.dpValue)})</span></div>}
                                        <div className="flex justify-between"><span>DPP PPN:</span><span>{formatCurrency(invoiceData.dppVat)}</span></div>
                                        <div className="flex justify-between"><span>PPN (12%):</span><span>{formatCurrency(invoiceData.vat12)}</span></div>
                                        <div className="flex justify-between pt-2 border-t border-black font-black text-xs">
                                            <span>GRAND TOTAL:</span>
                                            <span>Rp {formatCurrency(invoiceData.grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-12">
                                    <div className="text-center w-48">
                                        <p className="font-bold mb-16 uppercase">PT JEMBO CABLE COMPANY Tbk</p>
                                        <div className="border-b border-black w-full" />
                                        <p className="mt-1 text-[8px] font-bold">Authorized Signature</p>
                                    </div>
                                </div>
                            </footer>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;