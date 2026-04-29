
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
import { cn } from '@/lib/utils';

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
    isOriginalPrinted: boolean;
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
                                const { id: displayInvoiceId, customer, soNumber, date, subtotal: subTotalItems, negotiation, dpValue, poNumber, grandTotal, dppVat, vat12, paymentTerms } = invoiceData;

                                return (
                                    <div key={`${printType}-${pageIndex}`} className={`w-full max-w-4xl mx-auto bg-white shadow-lg p-4 my-8 text-[10px] leading-tight flex flex-col page-break`} style={{ height: '280mm' }}>
                                        <header className="relative pt-0 pb-0 text-[10px] leading-snug">
                                            <p className="absolute right-0 top-0 font-black text-sm uppercase tracking-widest text-slate-300">{printType}</p>
                                            <div className="w-full text-center mb-1 leading-none">
                                                <p className="font-bold uppercase text-xs tracking-tighter mb-0.5">{invoiceTitle}</p>
                                                <p className="font-bold uppercase text-xs">{displayInvoiceId}</p>
                                            </div>
                                            <div className='flex justify-between items-start mt-4'>
                                                <div className='w-[45%]'>
                                                    <p className="font-black text-[10px] mb-0">{customer.name}</p>
                                                    <p className="italic text-[9px] text-slate-600 leading-tight mt-1">{customer.address}</p>
                                                </div>
                                                <div className="w-[30%] text-[10px] text-left leading-normal space-y-0 font-bold">
                                                    <p className="mb-0">Sales Order: {soNumber}</p> 
                                                    <p className="mb-0">Ref PO: {poNumber}</p>
                                                    <p className="mb-0">Date: {formatDate(date)}</p>
                                                </div>
                                            </div>
                                        </header>

                                        <main className='mt-6 flex-grow'>
                                            <table className="w-full border-collapse text-[10px] mt-0">
                                                <thead>
                                                    <tr className='bg-slate-50 border border-black'>
                                                        <th className="p-1 text-left w-[8%] border-r border-black border-b border-black font-bold">No.</th>
                                                        <th className="p-1 text-left w-[40%] border-r border-black border-b border-black font-bold">Item Description</th>
                                                        <th className="p-1 text-center w-[15%] border-r border-black border-b border-black font-bold">Qty</th>
                                                        <th className="p-1 text-right w-[17%] border-r border-black border-b border-black font-bold">Unit Price</th>
                                                        <th className="p-1 text-right flex-1 border-b border-black font-bold">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {chunk.map((item, itemIdx) => (
                                                        <tr key={item.id} className='align-top border-x border-black'>
                                                            <td className="p-1 border-r border-black">{pageIndex * ITEMS_PER_PAGE + itemIdx + 1}</td>
                                                            <td className="p-1 border-r border-black font-bold uppercase">{item.name}</td>
                                                            <td className="p-1 border-r border-black text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                                            <td className="p-1 border-r border-black text-right">{formatCurrency(item.price)}</td>
                                                            <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Row Fillers for alignment */}
                                                    {Array.from({ length: ITEMS_PER_PAGE - chunk.length }).map((_, i) => (
                                                        <tr key={`empty-${i}`} className='border-x border-black'>
                                                            <td className="p-1 h-[25px] border-r border-black">&nbsp;</td>
                                                            <td className="p-1 border-r border-black">&nbsp;</td>
                                                            <td className="p-1 border-r border-black">&nbsp;</td>
                                                            <td className="p-1 border-r border-black">&nbsp;</td>
                                                            <td className="p-1">&nbsp;</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="border border-black"><td colSpan={5} className="h-0"></td></tr>
                                                </tbody>
                                            </table>
                                        </main>
                                        
                                        {isLastPage ? (
                                            <footer className="pt-4 text-black mt-auto text-[10px]">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="w-[55%] space-y-4">
                                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                                            <p className="font-bold text-[9px] uppercase tracking-widest text-slate-400 mb-2">Payment Instructions:</p>
                                                            <p className="font-black text-slate-800">PT. JEMBO CABLE COMPANY Tbk</p>
                                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                                <div>
                                                                    <p className="text-[8px] font-bold text-slate-500 uppercase">Mandiri Account (IDR)</p>
                                                                    <p className="font-mono font-black">102-0100206827</p>
                                                                </div>
                                                                {invoiceData.virtualAccount && (
                                                                    <div>
                                                                        <p className="text-[8px] font-bold text-indigo-500 uppercase">Mandiri Virtual Account</p>
                                                                        <p className="font-mono font-black text-indigo-700">{invoiceData.virtualAccount}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-[8px] italic text-slate-400">Note: Please include the Invoice Number in your payment reference.</p>
                                                    </div>

                                                    <div className="w-[40%] space-y-1">
                                                        <div className="flex justify-between py-1 border-b">
                                                            <span className="font-bold uppercase text-slate-500">Subtotal</span>
                                                            <span className="font-black">Rp {formatCurrency(subTotalItems)}</span>
                                                        </div>
                                                        {negotiation > 0 && (
                                                            <div className="flex justify-between py-1 border-b text-rose-600">
                                                                <span className="font-bold uppercase">Discount/Neg.</span>
                                                                <span className="font-black">({formatCurrency(negotiation)})</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between py-1 border-b">
                                                            <span className="font-bold uppercase text-slate-500">VAT (12%)</span>
                                                            <span className="font-black">Rp {formatCurrency(vat12)}</span>
                                                        </div>
                                                        <div className="flex justify-between py-2 bg-slate-900 text-white px-2 rounded-lg mt-2">
                                                            <span className="font-black uppercase tracking-widest text-[9px] mt-1">Grand Total</span>
                                                            <span className="text-sm font-black">Rp {formatCurrency(grandTotal)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-end mt-10">
                                                    <div className="text-center w-40">
                                                        <p className="mb-16 uppercase font-bold text-slate-400 text-[8px] tracking-widest">Received By</p>
                                                        <div className="border-t border-black w-full pt-1 font-bold">( ............................ )</div>
                                                    </div>
                                                    <div className="text-center w-40">
                                                        <p className="mb-16 uppercase font-bold text-slate-400 text-[8px] tracking-widest">Authorized Signature</p>
                                                        <div className="border-t border-black w-full pt-1 font-bold">Finance Department</div>
                                                    </div>
                                                </div>
                                                {isCopy && <p className="text-center mt-6 text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Arsip Internal - Dokumen ini adalah salinan sah dari dokumen asli</p>}
                                            </footer>
                                        ) : null}
                                        <div className="text-right text-gray-400 text-[8px] mt-auto pt-4 font-bold">
                                            {printType} | Halaman {pageIndex + 1} dari {totalPages}
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
