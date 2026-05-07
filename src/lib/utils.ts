
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';
import { type Invoice, type Customer } from "@/app/lib/data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a Virtual Account number based on refined Excel Formula
 * Format: 86625 (Bank) + 2026 (Year) + ASCII Code logic + Last 3 Digits + 0
 * Example: ADH004 -> 8662520261480040
 */
export function generateVirtualAccount(customerCode: string): string {
  const cleanCode = (customerCode || '').trim().toUpperCase();
  if (cleanCode.length < 4) return '';
  
  const bankPrefix = "86625";
  const yearFull = "2026";
  const base = bankPrefix + yearFull;
  
  // Extract 3 letters and last 3 digits
  const letters = cleanCode.substring(0, 3);
  const digits = cleanCode.match(/\d+$/)?.[0]?.padStart(3, '0') || '000';
  
  let asciiSlots = "";
  for (let i = 0; i < 3; i++) {
    const charCode = letters.charCodeAt(i);
    const rank = charCode >= 65 && charCode <= 90 ? charCode - 64 : 0;
    asciiSlots += rank.toString();
  }
  
  const result = base + asciiSlots + digits + "0";
  return result.substring(0, 16).padEnd(16, '0');
}

/**
 * Memformat angka ke format mata uang/akuntansi Indonesia (1.234,56)
 */
export function formatCurrency(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '0,00';
  }
  
  const num = typeof value === 'string' 
    ? parseFormattedNumber(value) 
    : value;

  if (isNaN(num)) {
    return '0,00';
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Memformat angka ke format mata uang/akuntansi Indonesia (Tanpa desimal jika bulat)
 * Sekarang mendukung hingga 3 digit desimal jika ada.
 */
export function formatNumberWithCommas(value: number | string | undefined, minDecimals?: number): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  
  const num = typeof value === 'string' 
    ? parseFormattedNumber(value) 
    : value;

  if (isNaN(num)) {
    return '';
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: minDecimals !== undefined ? minDecimals : (num % 1 !== 0 ? 2 : 0),
    maximumFractionDigits: 3
  }).format(num);
}

/**
 * Mengonversi string berformat (dengan titik/koma) kembali menjadi angka murni (float)
 * Mendukung deteksi cerdas untuk titik (.) atau koma (,) sebagai desimal.
 */
export function parseFormattedNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;

  let str = value.toString().replace(/[^\d.,-]/g, '');

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // ID Style: 1.000,50 (Koma adalah desimal)
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // US Style: 1,000.50 (Titik adalah desimal)
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  } else if (hasComma) {
    // Hanya ada koma: Anggap sebagai desimal (misal: 5,5 -> 5.5)
    return parseFloat(str.replace(',', '.')) || 0;
  } else if (hasDot) {
    // Hanya ada titik: Bisa jadi desimal (5.5) atau ribuan (1.000)
    // Berdasarkan instruksi user, jika titik muncul tunggal kita prioritaskan sebagai desimal
    // kecuali diikuti tepat 3 digit dan bukan di akhir string.
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      // Kasus ambigu seperti 1.000 atau 5.000 - kita ikuti konteks harga/qty
      // Namun untuk fleksibilitas desimal, kita biarkan parseFloat menanganinya.
      return parseFloat(str) || 0;
    }
    return parseFloat(str) || 0;
  }

  return parseFloat(str) || 0;
}

export const generateExcelTemplate = (headers: string[], fileName: string) => {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportTaxInvoicesToExcel = (invoices: Invoice[], allCustomers: Customer[], taxCode: string) => {
    const workbook = XLSX.utils.book_new();

    const fakturData = invoices.map((inv, index) => {
        const customer = allCustomers.find(c => c.name === inv.customer);
        const ref = `${inv.id} ${inv.soNumber || ''} ${inv.poNumber}`.trim();
        const defaultAddr = customer?.addresses?.find(a => a.isDefault) || customer?.addresses?.[0];
        
        return [
            index + 1,
            ref,
            taxCode,
            inv.date,
            "Normal",
            defaultAddr?.npwp || "-",
            inv.customer,
            customer?.customerCode || "-",
            "NORMAL"
        ];
    });

    const fakturHeader = [
        ["Baris", "Referensi", "Kode_Transaksi", "Tanggal_Faktur", "Jenis_Faktur", "NPWP_NIK_Pembeli", "Nama_Pembeli", "ID_TKU_Pembeli", "Action"]
    ];
    
    const finalFakturRows = [...fakturHeader, ...fakturData, ["END"]];
    const fakturSheet = XLSX.utils.aoa_to_sheet(finalFakturRows);
    XLSX.utils.book_append_sheet(workbook, fakturSheet, "Faktur");

    const detailData: any[] = [];
    invoices.forEach((inv, index) => {
        const items = inv.items || [];
        const discountTotal = inv.discount || 0;
        const discountPerItem = items.length > 0 ? (discountTotal / items.length) : 0;

        items.forEach(item => {
            let unitCode = "UM.0033";
            const lowerUnit = item.unit?.toLowerCase();
            if (lowerUnit === "meter" || lowerUnit === "m") unitCode = "UM.0013";
            else if (lowerUnit === "unit" || lowerUnit === "pcs") unitCode = "UM.0018";

            const type = item.category?.toLowerCase().includes("kabel") ? "A" : "B";

            const hargaTotal = item.quantity * item.price;
            const dppItem = Math.round(hargaTotal - discountPerItem);
            
            const finalDpp = taxCode === "04" ? Math.round((11 / 12) * dppItem) : dppItem;
            const ppn = Math.round(finalDpp * 0.12);

            detailData.push([
                index + 1,
                type,
                item.name,
                Math.round(item.price),
                item.quantity,
                Math.round(hargaTotal),
                Math.round(discountPerItem),
                finalDpp,
                ppn,
                0,
                0,
                unitCode,
                "NORMAL"
            ]);
        });
    });

    const detailHeader = [
        ["Baris", "Tipe", "Nama", "Harga_Satuan", "Jumlah_Barang", "Harga_Total", "Diskon", "DPP", "PPN", "Tarif_PPnBM", "PPnBM", "Satuan_Ukur", "Action"]
    ];

    const finalDetailRows = [...detailHeader, ...detailData, ["END"]];
    const detailSheet = XLSX.utils.aoa_to_sheet(finalDetailRows);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "DetailFaktur");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
    XLSX.writeFile(workbook, `eFaktur_Dakota_${timestamp}.xlsx`);
};

export const importFromExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
