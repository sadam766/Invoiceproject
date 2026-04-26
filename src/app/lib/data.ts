import type { LucideIcon } from 'lucide-react';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  status: 'active' | 'suspended' | 'pending';
};

export type RevisionLog = {
    updatedBy: string;
    updatedAt: string;
    action: string;
};

export type PaymentRecord = {
    id: string;
    date: string;
    amount: number;
    reference: string;
    recordedBy: string;
    method: string;
    notes?: string;
};

export type InvoiceItem = {
    id: string | number;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    originalName?: string;
    originalQty?: number;
    originalPrice?: number;
    prevInvoicedQty?: number;
    varianceQty?: number;
    varianceReason?: string;
};

export type Invoice = {
  id: string; // Manual Invoice Number (Primary Display)
  erpInvoiceId?: string; // ERP Reference ID (Secondary ID)
  soNumber: string;
  poNumber: string;
  customer: string;
  billingAddress: string;
  billingNpwp?: string;
  date: string; // Issue Date
  dueDate?: string; // Due Date
  amount: number;
  status: 'paid' | 'unpaid' | 'sent' | 'draft' | 'received' | 'cancelled' | 'finalized' | 'partial';
  voidReason?: string;
  spdNumber?: string;
  paymentMethod?: string;
  ownerId?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  revisionLogs?: RevisionLog[];
  sjNumbers?: string[]; 
  negotiation?: number;
  negotiationMode?: 'percent' | 'nominal';
  dpValue?: number; // Nilai DP yang ditagih
  dpDeduction?: number; // Nilai DP yang dipotong
  unusedDpCredit?: number; // Kredit dari retur/pembatalan sebelumnya
  isOverBillingAllowed?: boolean; // Persetujuan kelebihan kirim
  retention?: number;
  payments?: PaymentRecord[];
  items?: InvoiceItem[];
  isDpInvoice?: boolean;
};

export type InvoiceNumber = {
  id: string;
  customer: string;
  salesOrder: string;
  poNumber?: string;
  date: string;
  amount: number;
  ownerId?: string;
  createdBy?: string;
};

export type TaxInvoice = {
    taxInvoiceNumber: string;
    buyerNpwp: string;
    buyerName: string;
    status: string;
    taxInvoiceDate: string;
    invoiceNumber: string;
    ownerId?: string;
    createdBy?: string;
};

export type ProductListItem = {
    id?: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    ownerId?: string;
    createdBy?: string;
};

export type SalesOrder = {
    id?: string;
    soNumber: string;
    poNumber?: string;
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    ownerId?: string;
    customer: string;
    createdBy?: string;
};

export type CustomerAddress = {
  id: string;
  label: string;
  address: string;
  npwp?: string;
  isDefault: boolean;
};

export type Customer = {
  id?: string;
  name: string;
  email?: string;
  addresses: CustomerAddress[];
  ownerId?: string;
  createdBy?: string;
};

export type SalesListItem = {
  id?: string;
  soNumber: string;
  customer: string;
  sales: string;
  poNumber: string;
  amount: number;
  paidOffline?: number; 
  status: 'Paid' | 'Unpaid' | 'Waiting' | 'Partial' | 'Cancelled';
  voidReason?: string;
  paidDate?: string;
  ownerId?: string;
  createdBy?: string;
};

export type SpdInvoiceEntry = {
    invoiceId: string;
    customer: string;
    address: string;
    status: 'pending' | 'received' | 'rejected';
    sjNumbers?: string[];
};

export type SpdData = {
    id: string;
    date: string;
    courier: string;
    invoices: SpdInvoiceEntry[];
    status: 'in_delivery' | 'received' | 'rejected' | 'cancelled';
    voidReason?: string;
    ownerId?: string;
    createdBy?: string;
};

export type VirtualAccount = {
  id?: string;
  customerCode?: string;
  customerName: string;
  bankName: string;
  vaNumber: string;
  ownerId?: string;
  createdBy?: string;
};
