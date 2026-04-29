
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

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
  // If code is "ADH004", letters = ADH, digits = 004
  const letters = cleanCode.substring(0, 3);
  const digits = cleanCode.match(/\d+$/)?.[0]?.padStart(3, '0') || '000';
  
  // Excel CODE() - 64 logic
  // A=1, B=2 ... J=10, K=11
  let asciiSlots = "";
  for (let i = 0; i < 3; i++) {
    const charCode = letters.charCodeAt(i);
    // Standard ASCII: A=65. 65-64 = 1.
    const rank = charCode >= 65 && charCode <= 90 ? charCode - 64 : 0;
    // To maintain 16 digits, we need a stable number of digits from ASCII.
    // If rank is 10 (J), it adds "10" (2 digits).
    asciiSlots += rank.toString();
  }
  
  // Final Assembly
  const result = base + asciiSlots + digits + "0";
  
  // Force trim to 16 if too long (e.g. if ASCII ranks were all double digits)
  return result.substring(0, 16).padEnd(16, '0');
}

/**
 * Memformat angka ke format mata uang/akuntansi Indonesia (1.234,56)
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

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Mengonversi string berformat (dengan titik/koma) kembali menjadi angka murni (float)
 */
export function parseFormattedNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;

  let clean = value.toString().replace(/[^\d.,-]/g, '');

  if ((clean.match(/\./g) || []).length > 0) {
    clean = clean.replace(/\./g, '');
  }

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
