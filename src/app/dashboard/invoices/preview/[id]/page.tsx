
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- DEFINISI TIPE DATA (Sama seperti sebelumnya) ---

interface Item {
    id: string;
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
    };
    date: string; // YYYY-MM-DD
    soNumber: string;
    poNumber: string;
    grandTotal: number;
    dppVat: number;
    vat12: number;
    totalRp: number;
    paymentTerms: string;
}

// --- FUNGSI UTILITY (Sama seperti sebelumnya) ---

// Fungsi untuk format mata uang IDR
const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// Fungsi untuk format tanggal menjadi DD-MM-YYYY
const formatDate = (dateString: string): string => {
    if (!dateString || isNaN(new Date(dateString).getTime())) {
        return '';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '-');
};


// --- DUMMY DATA (Data yang digunakan jika data asli belum ada) ---

const dummyInvoiceData: InvoiceData = {
    id: 'INV/2024/05/001',
    items: [
        { id: '1', name: 'Kabel Tembaga 2.5mm', quantity: 100, unit: 'meter', price: 15000.00, total: 1500000.00 },
        // Baris kosong untuk menguji layout dan paginasi
        // { id: '2', name: 'Fiber Optic Cable', quantity: 50, unit: 'roll', price: 200000.00, total: 10000000.00 },
    ],
    customer: {
        name: 'PT Sejahtera Abadi',
        address: 'Jl. Merdeka No. 10, Jakarta',
    },
    date: '2024-05-11',
    soNumber: 'SO-2024-001',
    poNumber: '',
    grandTotal: 1500000.00, // Goods
    dppVat: 1375000.00,
    vat12: 165000.00,
    totalRp: 1665000.00,
    paymentTerms: '90 Hari setelah invoice diterima',
};


// --- KOMPONEN UTAMA ---

const InvoicePreviewPage = () => {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const { toast } = useToast();

    // Simulasi fetch data faktur dari sessionStorage
    useEffect(() => {
        const dataFromSession = sessionStorage.getItem('invoicePreviewData');
        if (dataFromSession) {
            const parsedData = JSON.parse(dataFromSession);
            const formattedItems = parsedData.items.map((item: any) => ({
                id: item.id?.toString() ?? '',
                name: item.name ?? item.item,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                total: item.total ?? item.amount,
            }));

            setInvoiceData({
                id: parsedData.id,
                items: formattedItems,
                customer: {
                    name: parsedData.customer?.name ?? 'N/A',
                    address: parsedData.customer?.address ?? 'N/A',
                },
                date: parsedData.date,
                soNumber: parsedData.soNumber,
                poNumber: parsedData.poNumber || '',
                grandTotal: parsedData.grandTotal,
                dppVat: parsedData.dppVat,
                vat12: parsedData.vat12,
                totalRp: parsedData.grandTotal + parsedData.vat12,
                paymentTerms: parsedData.paymentTerms || '90 Hari setelah invoice diterima',
            });
        } else {
            setInvoiceData(dummyInvoiceData);
        }
    }, []);

    if (!invoiceData) {
        return <div>Loading invoice...</div>
    }


    const {
        id: invoiceId,
        items,
        customer,
        date,
        soNumber,
        poNumber,
        grandTotal,
        dppVat,
        vat12,
        paymentTerms,
        totalRp
    } = invoiceData;

    // --- FUNGSI EXPORT (Untuk print/PDF) ---
    
    // Fungsi untuk export ke PDF/Print
    const handlePrint = () => {
        window.print();
    };

    // Fungsi untuk export ke Excel
    const handleExportExcel = () => {
        if (!invoiceData) return;
        
        const dataToExport = invoiceData.items.map(item => ({
            'Invoice ID': invoiceData.id,
            'Customer': invoiceData.customer.name,
            'SO Number': invoiceData.soNumber,
            'Date': formatDate(invoiceData.date),
            'Item Name': item.name,
            'Quantity': item.quantity,
            'Unit': item.unit,
            'Price': item.price,
            'Total': item.total,
        }));

        dataToExport.push({
            'Invoice ID': '---',
            'Customer': '---',
            'SO Number': '---',
            'Date': '---',
            'Item Name': '---',
            'Quantity': '',
            'Unit': '---',
            'Price': '---',
            'Total': '',
        });

        dataToExport.push({ 'Invoice ID': 'Subtotal (Goods)', 'Customer': '', 'SO Number': '', 'Date': '', 'Item Name': '', 'Quantity': '', 'Unit': '', 'Price': '', 'Total': invoiceData.grandTotal });
        dataToExport.push({ 'Invoice ID': 'DPP VAT', 'Customer': '', 'SO Number': '', 'Date': '', 'Item Name': '', 'Quantity': '', 'Unit': '', 'Price': '', 'Total': invoiceData.dppVat });
        dataToExport.push({ 'Invoice ID': 'VAT 12%', 'Customer': '', 'SO Number': '', 'Date': '', 'Item Name': '', 'Quantity': '', 'Unit': '', 'Price': '', 'Total': invoiceData.vat12 });
        dataToExport.push({ 'Invoice ID': 'Total', 'Customer': '', 'SO Number': '', 'Date': '', 'Item Name': '', 'Quantity': '', 'Unit': '', 'Price': '', 'Total': invoiceData.totalRp });

        exportToExcel(dataToExport, `Invoice-${invoiceData.id.replace(/\//g, '_')}`);
        
        toast({
            title: "Export Successful",
            description: `Invoice ${invoiceData.id} has been exported to Excel.`,
        });
    };

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
            
            {/* INJEKSI STYLE UNTUK PRINT KHUSUS */}
            <style>{`
                @media print {
                    body > *:not(#invoice-paper-container) {
                        display: none;
                    }
                    #invoice-paper-container {
                        display: block;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }
                    body, html {
                        margin: 0;
                        padding: 0;
                        background: none;
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
            `}</style>

            {/* ACTION BAR (Tombol Print dan Export) */}
            <div className="flex justify-center space-x-4 mb-4 print:hidden">
                <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    <Printer size={16} />
                    <span>Print/Export PDF</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <Download size={16} />
                    <span>Export Excel</span>
                </button>
            </div>

            {/* AREA FAKTUR (Kertas) */}
            {/* Ukuran global default menjadi 10px */}
            <div 
                id="invoice-paper-container" 
                className="w-full max-w-4xl mx-auto bg-white shadow-lg p-10 my-8 text-[10px] leading-tight flex flex-col" 
                ref={invoiceRef}
                style={{ minHeight: '23cm' }} // Dikembalikan ke tinggi A4
            >
                
                {/* === BAGIAN HEADER === */}
                <header className="relative pt-0 pb-2 text-[10px] leading-snug">
                    
                    {/* Judul dan Nomor Faktur (Tengah Atas) - Tetap text-sm karena itu judul */}
                    <div className="w-full text-center mb-1">
                        <p className="font-bold uppercase text-sm tracking-tighter">INVOICE/OFFICIAL RECEIPT</p>
                        <p className="font-bold uppercase text-sm">{invoiceId}</p>
                    </div>

                    {/* PT Sejahtera Abadi (Kiri Atas) dan Detail Order (Kanan Atas) */}
                    <div className='flex justify-between items-start mt-4'>
                        {/* Kolom Customer: w-[45%] */}
                        <div className='w-[45%]'> 
                            {/* Font PT Sejahtera Abadi dijadikan text-[10px] tapi font-bold tetap */}
                            <p className="font-bold text-[10px]">{customer.name}</p>
                        </div>

                        {/* Detail Order (Kanan Atas) - text-[10px] */}
                        {/* PERBAIKAN: Menggunakan w-[55%] untuk memperbaiki issue lebar agar layout header 100% (45% + 55%) */}
                        <div className="w-[30%] text-[10px] text-left space-y-0">
                            <p>Sales Order: {soNumber}</p>
                            <p>Order Date: </p>
                            <p>Reference A: </p>
                        </div>
                    </div>

                    {/* Customer Code (Kiri Bawah Header) dan Tanggal (Kanan Bawah Header) - text-[10px] */}
                    <div className='flex justify-between text-[10px] mb-1'>
                            <p>Customer Code :</p>
                            <p>Date: {formatDate(date)}</p>
                    </div>
                </header>
                
                {/* === MAIN - TABEL ITEM === */}
                <main className='mt-0 flex-grow'> 
                    {/* Tabel sudah text-[10px] */}
                    <table className="w-full border-collapse text-[10px]">
                        <thead>
                            <tr className='bg-white border border-black'> 
                                <th className="p-1 text-left w-[8%] border-r border-black border-b border-black font-normal">No.</th>
                                <th className="p-1 text-left w-[40%] border-r border-black border-b border-black font-normal">Item</th>
                                <th className="p-1 text-center w-[15%] border-r border-black border-b border-black font-normal">Quantity Unit</th>
                                <th className="p-1 text-right w-[17%] border-r border-black border-b border-black font-normal">Price</th>
                                <th className="p-1 text-right flex-1 border-b border-black font-normal">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, itemIdx) => (
                                <tr 
                                    key={item.id} 
                                    className='align-top'
                                >
                                    <td className="p-1 h-[18px]">{itemIdx + 1}</td>
                                    <td className="p-1">{item.name}</td>
                                    <td className="p-1 text-center">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                    <td className="p-1 text-right">{formatCurrency(item.price)}</td>
                                    <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>

                
                {/* === BAGIAN FOOTER === */}
                <footer className="pt-0 text-black mt-auto text-[10px]">
                    
                    {/* Baris Angka Total Atas */}
                    <div className="w-full flex justify-end items-end leading-normal">
                        <div className="text-right w-1/2">
                            <div className="h-0.5 border-b border-black w-1/4 ml-auto -mt-24"></div>
                            {/* Angka total dijadikan text-[10px] */}
                            <p className="text-[10px] font-normal">{formatCurrency(grandTotal)}</p>
                        </div>
                    </div>
                    
                    {/* Baris No PO */}
                    <div className="w-full flex justify-start items-end leading-normal mt-0">
                        <p>No PO : {poNumber}</p>
                    </div>

                    
                    {/* Garis Pemisah (Garis Penuh) */}
                    <div className="border-t border-black w-full my-1"></div>

                    {/* Blok Ringkasan Total (Goods, DPP, VAT, Total Rp) */}
                    {/* Semua teks di sini sudah text-[10px] */}
                    <div className="flex justify-end mt-1">
                        <div className="w-1/2 text-[10px] leading-snug">
                            <div className="grid grid-cols-[1fr_auto] gap-x-3">
                                <span className="text-right">Goods:</span>
                                <span className="text-right">{formatCurrency(grandTotal)}</span>
                                <span className="text-right">DPP VAT (11/12):</span>
                                <span className="text-right">{formatCurrency(dppVat)}</span>
                                <span className="text-right">VAT 12%:</span>
                                <span className="text-right">{formatCurrency(vat12)}</span> 
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 font-normal">
                                <span className="text-right">Total Rp:</span>
                                <span className="text-right">{formatCurrency(totalRp)}</span>
                            </div>
                        </div>
                    </div>
                    {/* Garis Pemisah (Garis Penuh) */}
                    <div className="border-t border-black w-full my-1"></div>

                    {/* Blok Ketentuan Pembayaran, Bank, dan Tanda Tangan */}
                    <div className="mt-0 pt-1"> 
                        <div className="flex">
                            {/* Kolom Kiri: Detail Pembayaran & Bank. Semua di sini sudah text-[10px] */}
                            <div className="w-[55%] pr-4 text-[10px] space-y-1">
                                
                                <div className="flex gap-x-1">
                                    <p className='shrink-0'>Payment:</p>
                                    <p className='w-full'>{paymentTerms}</p>
                                </div>
                                
                                <div className="flex gap-x-1">
                                    <p className='shrink-0'>Please state with your payment:</p>
                                    <p className='w-full'>{invoiceId}</p>
                                </div>
                                
                                <p className='mt-2'>For payment, please transfer to our account:</p>
                                {/* Nama PT dijadikan text-[10px] tapi font-semibold tetap */}
                                <p className="font-semibold text-[10px]">PT. Jembo Cable Company Tbk</p>
                                
                                <div className="flex items-start">
                                    <div className="w-1/3 pr-2"> 
                                        <p>Bank Mandiri -</p>
                                        <p>Jakarta Cabang</p>
                                        <p>Sudirman</p>
                                    </div>
                                    <div className="w-2/3 text-left"> 
                                        <p>A/C No. : 102-0100206827 (Rp)</p>
                                        <p>A/C No. : 102-0005000218 (Rp)</p>
                                        <p>A/C No. : 102-0005000226 (USD)</p>
                                    </div>
                                </div>
                                <div className="text-center my-1">OR</div>
                                <div className="flex items-start">
                                    <div className="w-1/3 pr-2"> 
                                        <p>Bank BCA - Jakarta</p>
                                        <p>Cabang KEM TOWER</p>
                                    </div>
                                    <div className="w-2/3 text-left"> 
                                        <p>A/C No. : 684-0198977 (Rp)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Kolom Kanan: Tanda Tangan */}
                            <div className="w-[45%] pl-0 flex flex-col justify-end text-[10px] text-center">
                                {/* Nama PT dijadikan text-[10px] tapi font-semibold tetap */}
                                <p className="font-semibold text-[10px] mb-28">PT. JEMBO CABLE COMPANY Tbk</p> 
                                <div className='border-b border-black w-24 mx-auto mb-1'></div>
                                <p className="font-semibold">Finance</p>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default InvoicePreviewPage;

    