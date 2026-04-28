
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a default customer code based on name
 * E.g. "PT JEMBO CABLE" -> "JEM582"
 */
export function generateDefaultCode(name: string): string {
    if (!name) return '';
    const clean = name.replace(/PT\.|PT|CV\.|CV|UD\.|UD/gi, '').trim();
    if (clean.length < 3) return clean.toUpperCase() + (Math.floor(Math.random() * 900) + 100);
    
    const prefix = clean.substring(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 900) + 100;
    return `${prefix}${random}`;
}

/**
 * Generate a Virtual Account number based on Customer Code
 * Formula: 86625 (Bank) + 26 (Year) + Encoded Code
 * Target: 16 digits
 */
export function generateVirtualAccount(customerCode: string): string {
  if (!customerCode) return '';
  
  const bankPrefix = "86625";
  const yearPrefix = "26"; // 2026 short
  const base = bankPrefix + yearPrefix;
  
  // Extract letters and numbers
  const letters = customerCode.replace(/[^A-Z]/gi, '').toUpperCase();
  const digits = customerCode.replace(/[^0-9]/g, '');
  
  // Convert letters to numeric values (A=01, B=02...)
  let letterNumeric = "";
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i) - 64;
    letterNumeric += Math.max(1, code).toString().padStart(2, '0');
  }
  
  // Construct the body: LetterMapping + Digits
  // We need 16 - 7 = 9 digits for the body
  const body = (letterNumeric + digits).slice(0, 9).padStart(9, '0');
  
  return base + body;
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
  // Untuk format Indonesia, kita hapus titik (ribuan) dan ubah koma menjadi titik (desimal)
  let clean = value.toString().replace(/[^\d.,-]/g, '');

  // Cek apakah ada titik sebagai pemisah ribuan (lebih dari satu titik atau titik di posisi ribuan)
  if ((clean.match(/\./g) || []).length > 0) {
    // Jika ada titik, kita asumsikan itu pemisah ribuan dan kita hapus
    clean = clean.replace(/\./g, '');
  }

  // Ubah koma menjadi titik untuk parseFloat
  clean = clean.replace(',', '.');

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
