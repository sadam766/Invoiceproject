
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';

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
    const [invoiceData, setInvoiceData] = useState<InvoiceData>(dummyInvoiceData);

    // Simulasi fetch data faktur
    useEffect(() => {
        // Di sini Anda bisa memuat data nyata dari API
        // Untuk demo, kita menggunakan dummy data
    }, []);

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
    
    // Fungsi untuk export ke PDF/Print (Sama seperti sebelumnya)
    const handlePrint = () => {
        window.print();
    };

    // Fungsi untuk export ke Excel (Sama seperti sebelumnya)
    const handleExportExcel = () => {
        alert('Export to Excel logic needs to be implemented (e.g., using libraries like SheetJS/XLSX)');
    };

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen p-4 font-sans text-black">
            
            {/* INJEKSI STYLE UNTUK PRINT KHUSUS */}
            <style jsx global>{`
                @media print {
                    /* Sembunyikan semua kecuali elemen cetak */
                    body > *:not(#invoice-paper-container) {
                        display: none;
                    }

                    /* Tampilkan elemen cetak */
                    #invoice-paper-container {
                        display: block;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }

                    /* Menghilangkan margin dan padding pada elemen utama saat dicetak */
                    body, html {
                        margin: 0;
                        padding: 0;
                        background: none;
                    }

                    /* Pengaturan kertas A4 (asumsi) */
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
            <div id="invoice-paper-container" className="w-full max-w-4xl mx-auto bg-white shadow-lg p-10 my-8 text-[10px] leading-tight flex flex-col" ref={invoiceRef} style={{ minHeight: '29.7cm' }}>
                
                {/* === BAGIAN HEADER === */}
                <header className="relative pt-0 pb-2 text-[10px] leading-snug">
                    
                    {/* Judul dan Nomor Faktur (Tengah Atas) */}
                    <div className="w-full text-center mb-1">
                        <p className="font-bold uppercase text-sm tracking-tighter">INVOICE/OFFICIAL RECEIPT</p>
                        <p className="font-bold uppercase text-sm">{invoiceId}</p>
                    </div>

                    {/* PT Sejahtera Abadi (Kiri Atas) dan Detail Order (Kanan Atas) */}
                    <div className='flex justify-between items-start mt-4'>
                        <div className='w-1/2'>
                            <p className="font-bold text-xs">{customer.name}</p>
                        </div>
                        {/* Detail Order (Kanan Atas) */}
                        <div className='w-1/2 text-right text-[10px] space-y-0'>
                            <p>Sales Order: {soNumber}</p>
                            <p>Order Date: </p>
                            <p>Reference A: </p>
                        </div>
                    </div>

                    {/* Customer Code (Kiri Bawah Header) dan Tanggal (Kanan Bawah Header) */}
                    <div className='flex justify-between items-end mt-4'>
                        <div className='w-1/2'>
                            <p>Customer Code :</p>
                        </div>
                        <div className='w-1/2 text-right'>
                            <p>Date: {formatDate(date)}</p>
                        </div>
                    </div>
                </header>
                
                {/* === MAIN - TABEL ITEM === */}
                <main className='mt-2 flex-grow'>
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <thead>
                            <tr className='bg-white'> 
                                <th className="p-1 text-left w-[8%] border-r border-black font-normal border-b border-black">No.</th>
                                <th className="p-1 text-left w-[40%] border-r border-black font-normal border-b border-black">Item</th>
                                <th className="p-1 text-center w-[15%] border-r border-black font-normal border-b border-black">Quantity Unit</th>
                                <th className="p-1 text-right w-[17%] border-r border-black font-normal border-b border-black">Price</th>
                                <th className="p-1 text-right flex-1 font-normal border-b border-black">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, itemIdx) => (
                                <tr key={item.id} className='align-top'>
                                    <td className="p-1 border-r border-black h-[18px]">{itemIdx + 1}</td>
                                    <td className="p-1 border-r border-black">{item.name}</td>
                                    <td className="p-1 text-center border-r border-black">{item.quantity.toLocaleString('id-ID')} {item.unit}</td>
                                    <td className="p-1 text-right border-r border-black">{formatCurrency(item.price)}</td>
                                    <td className="p-1 text-right">{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                            {/* Baris kosong agar tabel penuh */}
                            {Array.from({ length: Math.max(0, 20 - items.length) }).map((_, index) => (
                                <tr key={`empty-${index}`} className='align-top' style={{height: '18px'}}>
                                    <td className="border-r border-black border-l-0">&nbsp;</td>
                                    <td className="border-r border-black"></td>
                                    <td className="border-r border-black"></td>
                                    <td className="border-r border-black"></td>
                                    <td className="border-r-0"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>
                
                {/* === BAGIAN FOOTER === */}
                <footer className="pt-2 text-black mt-auto text-[10px]">
                    
                    {/* Baris No PO dan Angka Total Atas */}
                    <div className="w-full border-t border-black pt-1 flex justify-between items-center leading-normal">
                        <p>No PO : {poNumber}</p>
                        {/* Angka 1.500.000,00 di pojok kanan atas gambar footer */}
                        <p className="text-sm font-normal">{formatCurrency(grandTotal)}</p>
                    </div>
                    
                    {/* Garis Pemisah */}
                    <div className="border-t border-black w-full my-1"></div>

                    {/* Blok Ringkasan Total (Goods, DPP, VAT, Total Rp) */}
                    <div className="flex justify-end mt-1">
                        <div className="w-1/2 text-[10px] leading-snug">
                            <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                <span className="text-left">Goods:</span>
                                <span className="text-right">{formatCurrency(grandTotal)}</span>
                                <span className="text-left">DPP VAT (11/12):</span>
                                <span className="text-right">{formatCurrency(dppVat)}</span>
                                <span className="text-left">VAT 12%:</span>
                                <span className="text-right">{formatCurrency(vat12)}</span>
                            </div>
                            
                            <div className="border-t border-black w-full my-1"></div>
                            
                            <div className="grid grid-cols-[1fr_auto] gap-x-4 font-normal">
                                <span className="text-left">Total Rp:</span>
                                <span className="text-right">{formatCurrency(totalRp)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Blok Ketentuan Pembayaran, Bank, dan Tanda Tangan */}
                    <div className="mt-2 pt-2">
                        <div className="flex">
                            {/* Kolom Kiri: Detail Pembayaran & Bank */}
                            <div className="w-1/2 pr-4 text-[9px] space-y-1">
                                <div className="flex">
                                    <p className='w-40 shrink-0'>Payment:</p>
                                    <p className='flex-1'>{paymentTerms}</p>
                                </div>
                                <div className="flex">
                                    <p className='w-40 shrink-0'>Please state with your payment:</p>
                                    <p className='flex-1'>{invoiceId}</p>
                                </div>
                                <p className='mt-2'>For payment, please transfer to our account:</p>
                                <p className="font-semibold">PT. Jembo Cable Company Tbk</p>
                                
                                <div className="flex items-start">
                                    <div className="w-2/5 pr-2">
                                        <p>Bank Mandiri -</p>
                                        <p>Jakarta Cabang</p>
                                        <p>Sudirman</p>
                                    </div>
                                    <div className="w-3/5 text-left">
                                        <p>A/C No. : 102-0100206827 (Rp)</p>
                                        <p>A/C No. : 102-0005000218 (Rp)</p>
                                        <p>A/C No. : 102-0005000226 (USD)</p>
                                    </div>
                                </div>
                                <div className="text-center my-1">OR</div>
                                <div className="flex items-start">
                                    <div className="w-2/5 pr-2">
                                        <p>Bank BCA - Jakarta</p>
                                        <p>Cabang KEM TOWER</p>
                                    </div>
                                    <div className="w-3/5 text-left">
                                        <p>A/C No. : 684-0198977 (Rp)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Kolom Kanan: Tanda Tangan */}
                            <div className="w-1/2 pl-4 flex flex-col justify-end text-[10px] text-right">
                                <p className="font-semibold mb-16 pt-8">PT. JEMBO CABLE COMPANY Tbk</p>
                                <div className='border-b border-black w-24 ml-auto mb-1'></div>
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
