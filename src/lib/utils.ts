
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumberWithCommas(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  const num = typeof value === 'string' ? parseFloat(value.toString().replace(/[^0-9.-]+/g,"")) : value;
  if (isNaN(num)) {
    return '';
  }
  return new Intl.NumberFormat('id-ID').format(num);
}

export function parseFormattedNumber(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
}
