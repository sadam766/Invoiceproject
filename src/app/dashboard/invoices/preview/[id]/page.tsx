'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Download, ArrowLeft, Loader2, Printer, CreditCard, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import type { Invoice, Customer } from '@/app/lib/data';

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
    paymentMethod: 'bank' | 'va';
    negotiation: number;
    dpValue: number;
    virtualAccount?: string;
}

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) return dateString || '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 12;

const InvoicePreviewPage = () => {
    const invoiceContainerRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const firestore = useFirestore();
    const invoiceIdParam = decodeURIComponent(params.id as string).replace(/\//g, '_');

    const invoiceRef = useMemoFirebase(() => (!firestore || !invoiceIdParam) ? null : doc(firestore, 'invoices', invoiceIdParam), [firestore, invoiceIdParam]);
    const { data: dbInvoice, isLoading: isDbLoading } = useDoc<Invoice>(invoiceRef);

    const customersCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]);
    const { data: allCustomers } = useCollection<Customer>(customersCollection);

    useEffect(() => {
        if (dbInvoice && !isDbLoading) {
            let vaFromMaster = '';
            if (allCustomers) {
                const found = allCustomers.find(c => c.name.toLowerCase() === dbInvoice.customer.toLowerCase());
                if (found) vaFromMaster = found.virtualAccountNumber || '';
            }

            const mappedData: InvoiceData = {
                id: dbInvoice.id,
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
                    npwp: dbInvoice.billingNpwp || ''
                },
                date: dbInvoice.date,
                soNumber: dbInvoice.soNumber,
                poNumber: dbInvoice.poNumber,
                grandTotal: dbInvoice.amount,
                subtotal: (dbInvoice.items || []).reduce((s, i) => s + i.total, 0),
                dppVat: dbInvoice.amount / 1.12, 
                vat12: dbInvoice.amount - (dbInvoice.amount / 1.12),
                paymentTerms: '30 Days',
                paymentMethod: (dbInvoice.paymentMethod as any) || 'va',
                negotiation: dbInvoice.negotiation || 0,
                dpValue: dbInvoice.dpValue || 0,
                virtualAccount: dbInvoice.vaNumber || vaFromMaster
            };
            setInvoiceData(mappedData);
        }
    }, [dbInvoice, isDbLoading, allCustomers]);

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        const opt = {
          margin: [10, 10, 10, 10], 
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    if (isDbLoading || !invoiceData) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="text-center font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse text-xs">Membangun Layout Dokumen...</div>
            </div>
        );
    }

    const itemChunks = Array.from({ length: Math.ceil(invoiceData.items.length / ITEMS_PER_PAGE) }, (_, i) =>
        invoiceData.items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    
    const invoiceTitle = invoiceData.id.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE / OFFICIAL RECEIPT';

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 font-sans text-black animate-in fade-in duration-700">
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .page-break { page-break-before: always; }
                    .print-hidden { display: none !important; }
                    .shadow-lg { box-shadow: none !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; }
                }
            `}</style>
            
            <div className="flex justify-center items-center gap-4 mb-8 print-hidden">
                <Button 
                    onClick={() => router.push('/dashboard/invoices')} 
                    variant="outline" 
                    className="font-bold hover:bg-slate-50 rounded-xl px-6 h-10 shadow-sm border-slate-200"
                >
                    <ArrowLeft size={16} className="mr-2" /> Kembali ke List
                </Button>

                <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm ring-1 ring-slate-200">
                    <Button onClick={handleDownloadPdf} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest">
                        <Download size={16} className="mr-2" /> Download PDF
                    </Button>
                    <Button onClick={() => window.print()} variant="ghost" className="rounded-xl h-10 px-4">
                        <Printer size={16} className="text-slate-400" />
                    </Button>
                </div>
            </div>
            
            <div ref={invoiceContainerRef}>
                {itemChunks.map((chunk, pageIndex) => (
                    <div key={pageIndex} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-12 my-8 text-[11px] leading-tight flex flex-col ${pageIndex > 0 ? 'page-break' : ''}`} style={{ minHeight: '297mm' }}>
                        <header className="relative border-b-2 border-black pb-6 mb-6">
                            <div className="flex justify-between items-center mb-8">
                                <div className="space-y-1">
                                    <h1 className="font-black text-xl uppercase italic tracking-tighter">PT. JEMBO CABLE COMPANY Tbk</h1>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Commercial Billing Center — Official Records</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black uppercase text-xs tracking-[0.3em] text-indigo-600 mb-1">{invoiceTitle}</p>
                                    <p className="font-black text-lg">{invoiceData.id}</p>
                                </div>
                            </div>
                            <div className='flex justify-between items-start'>
                                <div className='w-[50%]'>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bill To:</p>
                                    <p className="font-black text-sm uppercase">{invoiceData.customer.name}</p>
                                    <p className="text-[10px] mt-1 whitespace-pre-line leading-relaxed italic">{invoiceData.customer.address}</p>
                                    {invoiceData.customer.npwp && <p className="text-[10px] mt-2 font-black">NPWP: {invoiceData.customer.npwp}</p>}
                                </div>
                                <div className="w-[30%] space-y-2">
                                    <div className="flex justify-between border-b pb-1"><span className="text-slate-400 font-bold uppercase text-[8px]">Sales Order:</span><span className="font-black">{invoiceData.soNumber}</span></div>
                                    <div className="flex justify-between border-b pb-1"><span className="text-slate-400 font-bold uppercase text-[8px]">Purchase Order:</span><span className="font-black">{invoiceData.poNumber}</span></div>
                                    <div className="flex justify-between border-b pb-1"><span className="text-slate-400 font-bold uppercase text-[8px]">Issue Date:</span><span className="font-black">{formatDate(invoiceData.date)}</span></div>
                                </div>
                            </div>
                        </header>

                        <main className='flex-grow'>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className='bg-slate-900 text-white'>
                                        <th className="p-3 text-left w-[5%] font-black text-[9px]">NO</th>
                                        <th className="p-3 text-left font-black text-[9px]">DESCRIPTION OF GOODS</th>
                                        <th className="p-3 text-center w-[15%] font-black text-[9px]">QTY</th>
                                        <th className="p-3 text-right w-[18%] font-black text-[9px]">PRICE (IDR)</th>
                                        <th className="p-3 text-right w-[20%] font-black text-[9px]">TOTAL (IDR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, itemIdx) => (
                                        <tr key={item.id} className='border-b border-slate-200'>
                                            <td className="p-3 align-top font-bold text-slate-400">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                            <td className="p-3 font-black uppercase text-xs">{item.name}</td>
                                            <td className="p-3 text-center font-black">{item.quantity} <span className="text-[9px] text-slate-400">{item.unit}</span></td>
                                            <td className="p-3 text-right font-bold">{formatCurrency(item.price)}</td>
                                            <td className="p-3 text-right font-black">Rp {formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        
                        {pageIndex === itemChunks.length - 1 && (
                            <footer className="mt-12 pt-8 border-t-2 border-black">
                                <div className="flex justify-between gap-12">
                                    <div className="flex-1 space-y-6">
                                        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                                            {invoiceData.paymentMethod === 'va' ? (
                                                <>
                                                    <p className="font-black uppercase text-[8px] text-indigo-600 mb-2 tracking-[0.2em] flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Mandatory Payment Instruction (VA):</p>
                                                    <p className="font-black text-xs">PT JEMBO CABLE COMPANY Tbk</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Bank Mandiri — Virtual Account Center</p>
                                                    <p className="font-mono font-black text-indigo-700 text-lg mt-1 tracking-widest">
                                                        A/C: {invoiceData.virtualAccount || '86625...'} (IDR)
                                                    </p>
                                                    <p className="text-[7px] font-black text-emerald-600 uppercase mt-1">Verified Unique Customer Account</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-black uppercase text-[8px] text-emerald-600 mb-2 tracking-[0.2em] flex items-center gap-1.5"><Banknote className="h-3 w-3" /> Manual Transfer Account:</p>
                                                    <p className="font-black text-xs">PT JEMBO CABLE COMPANY Tbk</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Bank Mandiri — Cabang Kemayoran</p>
                                                    <p className="font-mono font-black text-slate-900 text-lg mt-1 tracking-tighter">
                                                        A/C: 102-0005000218 (IDR)
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed uppercase">
                                            * Validasi pembayaran sah apabila dana telah efektif di rekening kami. <br />
                                            * Jatuh tempo pembayaran adalah 30 hari kalender dari tanggal invoice.
                                        </p>
                                    </div>
                                    <div className="w-[300px] space-y-2">
                                        <div className="flex justify-between text-slate-500 font-bold"><span>GROSS SUB-TOTAL</span><span>{formatCurrency(invoiceData.subtotal)}</span></div>
                                        {invoiceData.negotiation > 0 && <div className="flex justify-between text-rose-600 font-bold"><span>NEGOTIATION</span><span>({formatCurrency(invoiceData.negotiation)})</span></div>}
                                        {invoiceData.dpValue > 0 && <div className="flex justify-between text-blue-600 font-bold"><span>DP / RETENTION</span><span>({formatCurrency(invoiceData.dpValue)})</span></div>}
                                        <div className="flex justify-between font-bold"><span>DPP PPN</span><span>{formatCurrency(invoiceData.dppVat)}</span></div>
                                        <div className="flex justify-between font-bold"><span>PPN (12%)</span><span>{formatCurrency(invoiceData.vat12)}</span></div>
                                        <div className="flex justify-between pt-4 border-t-4 border-black font-black text-sm">
                                            <span>NET TOTAL:</span>
                                            <span className="text-indigo-700">Rp {formatCurrency(invoiceData.grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-20">
                                    <div className="text-center w-64 space-y-20">
                                        <p className="font-black text-[10px] uppercase tracking-[0.2em]">Authorized Signature</p>
                                        <div className="border-b-4 border-black w-full" />
                                        <p className="font-black text-xs uppercase">PT JEMBO CABLE COMPANY Tbk</p>
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
