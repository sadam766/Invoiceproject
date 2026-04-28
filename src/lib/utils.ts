import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a default customer code based on name following 3 Letter + 3 Digit pattern
 * E.g. "PT JEMBO CABLE" -> "JEM001"
 */
export function generateDefaultCode(name: string): string {
    if (!name) return '';
    const clean = name.replace(/PT\.|PT|CV\.|CV|UD\.|UD/gi, '').trim();
    const prefix = clean.substring(0, 3).toUpperCase().padEnd(3, 'X');
    // Default to 001 for suggestion, user expected to edit this
    return `${prefix}001`;
}

/**
 * Generate a Virtual Account number based on User's Excel Formula
 * Formula logic: 86625 (Bank) + 26 (Year) + ASCII Code logic
 * Format: 86625 + 26 + (Char1-64) + (Char2-64) + (Char3-64) + Last 3 Digits
 */
export function generateVirtualAccount(customerCode: string): string {
  if (!customerCode || customerCode.length < 6) return '';
  
  const bankPrefix = "86625";
  const yearPrefix = "26"; // 2026
  const base = bankPrefix + yearPrefix;
  
  // Extract 3 letters and last 3 digits (ADH004 -> letters: ADH, digits: 004)
  const letters = customerCode.substring(0, 3).toUpperCase();
  const lastDigits = customerCode.substring(customerCode.length - 3);
  
  // Replicate Excel CODE() - 64 logic
  // A = 65, 65-64 = 01
  // D = 68, 68-64 = 04
  // H = 72, 72-64 = 08
  let letterNumeric = "";
  for (let i = 0; i < 3; i++) {
    const charCode = letters.charCodeAt(i);
    // Ensure we handle non-letter characters gracefully, but target is A-Z
    const rank = charCode >= 65 && charCode <= 90 ? charCode - 64 : 0;
    letterNumeric += rank.toString().padStart(2, '0');
  }
  
  // Final Assembly: 8662526 + 010408 + 004 = 16 digits
  const result = base + letterNumeric + lastDigits;
  
  return result.substring(0, 16);
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
