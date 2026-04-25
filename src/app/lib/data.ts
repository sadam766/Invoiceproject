
import type { LucideIcon } from 'lucide-react';
import { DollarSign, Users, Package, Activity, Zap } from 'lucide-react';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';

export type Kpi = {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  status: 'active' | 'suspended' | 'pending';
};

export type Product = {
  name: string;
  image: ImagePlaceholder;
  sales: number;
  quantity: number;
};

export type Sale = {
  invoiceId: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
};

export type SalesMonitoringData = {
  soNumber: string;
  poNumber: string;
  customer: string;
  date: string;
  amount: number;
  invoice: string;
  invoiceStatus: 'Paid' | 'Unpaid' | 'Sent' | 'Draft';
  taxInvoice: string;
  spd: string;
  paymentStatus: 'Paid' | 'Unpaid';
  needsInvoice: boolean;
  needsSpd: boolean;
  isPoOnly: boolean;
};

export type Invoice = {
  id: string;
  soNumber: string;
  poNumber: string;
  customer: string;
  billingAddress: string;
  billingNpwp?: string;
  date: string; // Issue Date
  dueDate?: string; // Due Date
  amount: number;
  status: 'paid' | 'unpaid' | 'sent' | 'draft';
  spdNumber: string;
  paymentMethod?: string;
  ownerId?: string;
  createdBy?: string;
  virtualAccounts?: VirtualAccount[];
};

export type InvoiceNumber = {
  id: string;
  customer: string;
  salesOrder: string;
  poNumber?: string;
  date: string;
  amount: number;
  ownerId?: string;
};

export type TaxInvoice = {
    taxInvoiceNumber: string;
    buyerNpwp: string;
    buyerName: string;
    status: string;
    taxInvoiceDate: string;
    invoiceNumber: string;
    ownerId?: string;
};

export type ProductListItem = {
    id?: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    ownerId?: string;
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
};

export type SalesListItem = {
  soNumber: string;
  customer: string;
  sales: string;
  poNumber: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  paidDate?: string;
  ownerId?: string;
};

export type SpdData = {
    spd: string;
    tanggal: string;
    sales: string;
    customer: string;
    noInvoice: string;
    tanggalInvoice: string;
    tglTerimaCustomer: string;
    tglJatuhTempo: string;
    totalPiutang: number;
    keterangan: string;
    noKuitansi: string;
    noFakturPajak: string;
    suratJalan: string;
    ownerId?: string;
};

export type VirtualAccount = {
  id?: string;
  customerCode?: string;
  customerName: string;
  bankName: string;
  vaNumber: string;
  ownerId?: string;
};
