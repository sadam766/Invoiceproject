
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Download, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, updateDoc } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import type { Invoice, Customer } from '@/app/lib/data';
import { cn, formatCurrency } from '@/lib/utils';

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
        code?: string;
    };
    date: string; 
    soNumber: string;
    poNumber: string;
    grandTotal: number; // Subtotal items
    subtotal: number;
    vat12: number;
    totalRp: number; // Grand Total Akhir
    paymentTerms: string;
    paymentMethod: 'bank' | 'va';
    negotiation: number;
    dpValue: number;
    retensiValue: number;
    virtualAccount?: string;
    isOriginalPrinted: boolean;
}

const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) return dateString || '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};

const ITEMS_PER_PAGE = 15;

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
            let custCode = '';
            if (allCustomers) {
                const found = allCustomers.find(c => c.name.toLowerCase() === dbInvoice.customer.toLowerCase());
                if (found) {
                    vaFromMaster = found.virtualAccountNumber || '';
                    custCode = found.customerCode || '';
                }
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
                    code: custCode
                },
                date: dbInvoice.date,
                soNumber: dbInvoice.soNumber,
                poNumber: dbInvoice.poNumber,
                grandTotal: (dbInvoice.items || []).reduce((s, i) => s + i.total, 0),
                subtotal: (dbInvoice.items || []).reduce((s, i) => s + i.total, 0),
                vat12: dbInvoice.amount - (dbInvoice.amount / 1.12), // Ini kalkulasi estimasi, idealnya ditarik dari record
                totalRp: dbInvoice.amount,
                paymentTerms: '30 Days',
                paymentMethod: (dbInvoice.paymentMethod as any) || 'va',
                negotiation: dbInvoice.negotiation || 0,
                dpValue: dbInvoice.dpValue || 0,
                retensiValue: dbInvoice.retention || 0,
                virtualAccount: dbInvoice.vaNumber || vaFromMaster,
                isOriginalPrinted: !!dbInvoice.isOriginalPrinted
            };
            setInvoiceData(mappedData);
        }
    }, [dbInvoice, isDbLoading, allCustomers]);

    const markAsPrinted = async () => {
        if (firestore && invoiceIdParam) {
            const ref = doc(firestore, 'invoices', invoiceIdParam);
            await updateDoc(ref, { isOriginalPrinted: true });
        }
    };

    const handleDownloadPdf = () => {
        const element = invoiceContainerRef.current;
        if (!element || !invoiceData) return;
        
        const opt = {
          margin: [10, 10, 10, 10], 
          filename: `Invoice-${invoiceData.id.replace(/\//g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2.5, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save().then(markAsPrinted);
    };

    const handlePrint = () => {
        markAsPrinted();
        window.print();
    };

    if (isDbLoading || !invoiceData) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="text-center font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse text-xs">Membangun Dual-Layout (Original & Copy)...</div>
            </div>
        );
    }

    const itemChunks = Array.from({ length: Math.ceil(invoiceData.items.length / ITEMS_PER_PAGE) }, (_, i) =>
        invoiceData.items.slice(i * ITEMS_PER_PAGE, i * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
    );
    
    const invoiceTitle = invoiceData.id.startsWith('KW') ? 'PROFORMA INVOICE' : 'INVOICE / OFFICIAL RECEIPT';
    const documentTypes = ['ORIGINAL', 'COPY'] as const;
    const displayInvoiceId = invoiceData.id.replace(/_/g, '/');

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-6 font-sans text-black animate-in fade-in duration-700">
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
                    className="font-bold hover:bg-slate-50 rounded-xl px-6 h-10 shadow-sm border-slate-200 bg-white"
                >
                    <ArrowLeft size={16} className="mr-2" /> Kembali ke List
                </Button>

                <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm ring-1 ring-slate-200">
                    <Button onClick={handleDownloadPdf} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">
                        <Download size={16} className="mr-2" /> Download Dual PDF
                    </Button>
                    <Button onClick={handlePrint} variant="ghost" className="rounded-xl h-10 px-4">
                        <Printer size={16} className="text-slate-400" />
                    </Button>
                </div>
            </div>
            
            <div ref={invoiceContainerRef} className="print-container">
                {documentTypes.map((printType) => {
                    const isCopy = printType === 'COPY';
                    const totalPages = itemChunks.length;

                    return (
                        <div key={printType} className={cn("document-version", isCopy && "grayscale opacity-80")}>
                            {itemChunks.map((chunk, pageIndex) => {
                                const isLastPage = pageIndex === totalPages - 1;

                                return (
                                    <div key={`${printType}-${pageIndex}`} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-[12mm] my-8 text-[10px] leading-tight flex flex-col page-break`} style={{ height: '280mm' }}>
                                        {/* Header Section */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="w-2/3">
                                                <h1 className="font-bold text-sm uppercase">{invoiceData.customer.name}</h1>
                                                <p className="text-[10px] w-3/4 leading-tight">{invoiceData.customer.address}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-300">{printType}</p>
                                            </div>
                                        </div>

                                        <div className="text-center my-4">
                                            <h2 className="font-bold text-xs underline tracking-widest uppercase">{invoiceTitle}</h2>
                                            <p className="text-xs font-bold">{displayInvoiceId}</p>
                                        </div>

                                        <div className="flex justify-between text-[10px] mb-4">
                                            <div>
                                                <p>Customer Code: {invoiceData.customer.code || '-'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 font-medium">
                                                <span>Sales Order</span><span>: {invoiceData.soNumber}</span>
                                                <span>Ref PO</span><span>: {invoiceData.poNumber}</span>
                                                <span>Date</span><span>: {formatDate(invoiceData.date)}</span>
                                            </div>
                                        </div>

                                        {/* Table Section */}
                                        <main className='mt-0 flex-grow'>
                                            <table className="w-full border-collapse border border-black text-[10px]">
                                                <thead>
                                                    <tr className='bg-white border-b border-black font-bold'>
                                                        <th className="p-1 text-left w-[5%] border-r border-black">No.</th>
                                                        <th className="p-1 text-left w-[50%] border-r border-black">Item</th>
                                                        <th className="p-1 text-center w-[15%] border-r border-black">Quantity Unit</th>
                                                        <th className="p-1 text-right w-[15%] border-r border-black">Price</th>
                                                        <th className="p-1 w-[15%] text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {chunk.map((item, idx) => (
                                                        <tr key={item.id} className="border-b border-gray-200 align-top">
                                                            <td className="p-1 h-[22px] border-r border-black text-center">{pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                                            <td className="p-1 border-r border-black font-bold uppercase">{item.name}</td>
                                                            <td className="p-1 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                                            <td className="p-1 text-right border-r border-black">{formatCurrency(item.price)}</td>
                                                            <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Baris kosong untuk menjaga tinggi tabel tetap konsisten */}
                                                    {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                                        <tr key={`empty-${i}`} className="h-[22px]">
                                                            <td className="border-r border-black">&nbsp;</td>
                                                            <td className="border-r border-black">&nbsp;</td>
                                                            <td className="border-r border-black">&nbsp;</td>
                                                            <td className="border-r border-black">&nbsp;</td>
                                                            <td>&nbsp;</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </main>
                                        
                                        {isLastPage ? (
                                            <footer className="pt-2 text-black mt-auto text-[10px]">
                                                {/* AREA KALKULASI TOTAL */}
                                                <div className="flex justify-end mb-4">
                                                    <div className="w-1/2 text-[10px] space-y-1">
                                                        <div className="flex justify-between border-t border-black pt-1">
                                                            <span>Subtotal</span><span>{formatCurrency(invoiceData.grandTotal)}</span>
                                                        </div>
                                                        {invoiceData.negotiation > 0 && (
                                                            <div className="flex justify-between text-rose-600">
                                                                <span>Discount/Negotiation</span><span>({formatCurrency(invoiceData.negotiation)})</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span>VAT 12%</span><span>{formatCurrency(invoiceData.vat12)}</span>
                                                        </div>
                                                        {invoiceData.dpValue > 0 && (
                                                            <div className="flex justify-between text-indigo-600">
                                                                <span>Down Payment (DP)</span><span>({formatCurrency(invoiceData.dpValue)})</span>
                                                            </div>
                                                        )}
                                                        {invoiceData.retensiValue > 0 && (
                                                            <div className="flex justify-between text-amber-600">
                                                                <span>Retensi</span><span>({formatCurrency(invoiceData.retensiValue)})</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between font-bold border-t border-black text-[11px] pt-1 mt-1">
                                                            <span className="uppercase">Grand Total</span><span>Rp {formatCurrency(invoiceData.totalRp)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* AREA TANDA TANGAN & PAYMENT INFO */}
                                                <div className="mt-4 flex justify-between items-end">
                                                    {/* Bagian Kiri: Info Pembayaran */}
                                                    <div className="w-[55%] space-y-1 leading-tight">
                                                        <p>Payment Terms: {invoiceData.paymentTerms}</p>
                                                        <p className="font-bold">Please state with your payment: {displayInvoiceId}</p>
                                                        
                                                        <div className="mt-3">
                                                            <p className='font-bold underline uppercase mb-1'>
                                                                {invoiceData.paymentMethod === 'va' ? 'PAYMENT VIA VIRTUAL ACCOUNT:' : 'FOR PAYMENT, PLEASE TRANSFER TO:'}
                                                            </p>

                                                            {invoiceData.paymentMethod === 'va' ? (
                                                                <div className="border border-gray-300 bg-gray-50 p-2 rounded w-[90%] shadow-sm">
                                                                    <div className="flex flex-col">
                                                                        <p className="text-[8px] uppercase text-gray-500 font-bold tracking-wider mb-0.5">Mandiri Virtual Account (IDR)</p>
                                                                        <p className="text-base font-black tracking-widest text-indigo-700">
                                                                            {invoiceData.virtualAccount || '86625XXXXXXXXXXX'}
                                                                        </p>
                                                                        <p className='mt-0.5 text-[7px] italic text-gray-400'>
                                                                            *Pembayaran ini akan terverifikasi secara otomatis oleh sistem Dakota Hub.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-0.5">
                                                                    <p className="font-bold">PT. JEMBO CABLE COMPANY Tbk</p>
                                                                    <div className="grid grid-cols-[80px_auto] gap-x-1">
                                                                        <span>Bank Mandiri</span>
                                                                        <span>: 102-0100206827 (IDR)</span>
                                                                        <span>Bank BCA</span>
                                                                        <span>: 684-0198977 (IDR)</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Bagian Kanan: Tanda Tangan */}
                                                    <div className="w-[40%] text-center flex flex-col items-center">
                                                        <p className="font-bold uppercase text-[10px]">PT. JEMBO CABLE COMPANY Tbk</p>
                                                        <div className="mt-16 text-center w-full">
                                                            <div className="border-b border-black w-40 mx-auto mb-1"></div>
                                                            <p className="font-bold text-[10px]">Finance Department</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {isCopy && <p className="text-center mt-6 text-[8px] font-black uppercase tracking-[0.3em] text-slate-300">Arsip Internal - Dokumen ini adalah salinan sah dari dokumen asli</p>}
                                            </footer>
                                        ) : (
                                            <div className="mt-auto pt-4 text-right text-gray-400 text-[8px] font-bold">
                                                {printType} | Page {pageIndex + 1} of {totalPages}
                                            </div>
                                        )}

                                        <div className="absolute bottom-4 left-0 right-0 text-center text-[8px] text-gray-300 uppercase tracking-widest">
                                            Halaman {pageIndex + 1} dari {totalPages} | Printed by Dakota Hub
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InvoicePreviewPage;
