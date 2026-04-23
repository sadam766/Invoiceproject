import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Memformat angka ke format mata uang/akuntansi Indonesia (1.234,56)
 * Membatasi maksimal 2 angka di belakang koma.
 */
export function formatNumberWithCommas(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  
  const num = typeof value === 'string' 
    ? parseFormattedNumber(value) 
    : value;

  if (isNaN(num)) {
    return '';
  }

  // Gunakan Intl.NumberFormat dengan standar Indonesia
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Mengonversi string berformat (dengan titik/koma) kembali menjadi angka murni (float)
 * Mendukung input fleksibel: "1.234,50", "1234.50", "1234,50"
 */
export function parseFormattedNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;

  // Hapus karakter yang bukan angka, koma, titik, atau minus
  let clean = value.replace(/[^\d.,-]/g, '');

  // Jika mengandung keduanya (titik dan koma), tentukan mana yang desimal
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Format Indo: 1.234,56 -> hapus titik, ubah koma jadi titik
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // Format US: 1,234.56 -> hapus koma
      return parseFloat(clean.replace(/,/g, '')) || 0;
    }
  }

  // Jika hanya ada koma, asumsikan itu desimal (Standar Indo)
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }

  // Jika hanya ada titik, cek apakah itu ribuan atau desimal
  if (clean.includes('.')) {
    // Jika ada lebih dari satu titik, itu pasti ribuan
    if ((clean.match(/\./g) || []).length > 1) {
      return parseFloat(clean.replace(/\./g, '')) || 0;
    }
    // Jika satu titik diikuti tepat 3 angka, kemungkinan besar ribuan dalam konteks Indo
    // Contoh: 1.000 vs 1.23. Tapi demi fleksibilitas input user:
    const parts = clean.split('.');
    if (parts[1].length === 3) {
      // Ambil risiko ini ribuan jika tidak ada indikasi lain
      // Namun jika user ingin desimal 1.000 (presisi 3), ini akan jadi 1000.
      return parseFloat(clean.replace(/\./g, '')) || 0;
    }
    return parseFloat(clean) || 0;
  }

  return parseFloat(clean) || 0;
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
