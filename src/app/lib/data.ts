
import type { LucideIcon } from 'lucide-react';

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
  id: string; 
  erpInvoiceId?: string; 
  soNumber: string;
  poNumber: string;
  customer: string;
  customerCode?: string;
  customerName?: string;
  billingAddress: string;
  billingNpwp?: string;
  date: string; 
  dueDate?: string; 
  amount: number;
  status: 'paid' | 'unpaid' | 'sent' | 'draft' | 'received' | 'cancelled' | 'finalized' | 'partial';
  voidReason?: string;
  spdNumber?: string;
  paymentMethod?: string;
  vaNumber?: string;
  vaStatus?: 'pending' | 'approved' | 'rejected';
  vaApprovedBy?: string;
  vaApprovedAt?: string;
  ownerId?: string;
  createdBy?: string;
  creatorId?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  revisionLogs?: RevisionLog[];
  sjNumbers?: string[]; 
  negotiation?: number;
  negotiationMode?: 'percent' | 'nominal';
  dpValue?: number; 
  dpDeduction?: number; 
  retention?: number;
  payments?: PaymentRecord[];
  items?: InvoiceItem[];
  isDpInvoice?: boolean;
};

export type AppNotification = {
  id: string;
  recipientId: string;
  senderId: string;
  title: string;
  message: string;
  invoiceId: string;
  status: 'unread' | 'read';
  createdAt: string;
};

export type InvoiceNumber = {
  id: string;
  customer: string;
  customerCode?: string;
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

export type SalesOrderItem = {
    id: string | number;
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
};

export type SalesOrder = {
    id?: string;
    soNumber: string;
    poNumber: string;
    customer: string;
    customerCode?: string;
    customerAddress?: string;
    orderDate: string;
    deliveryDate: string;
    status: 'draft' | 'confirmed' | 'invoiced' | 'cancelled';
    items: SalesOrderItem[];
    totalAmount: number;
    taxAmount: number;
    grandTotal: number;
    ownerId?: string;
    createdBy?: string;
    lastUpdatedAt?: string;
    revisionLogs?: RevisionLog[];
    attachments?: string[];
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
  customerCode: string;
  email?: string;
  contactPerson?: string;
  phone?: string;
  addresses: CustomerAddress[];
  billingSchedule?: string;
  defaultShippingAddressId?: string;
  virtualAccountNumber?: string;
  ownerId?: string;
  createdBy?: string;
};

export type SalesListItem = {
  id?: string;
  soNumber: string;
  customer: string;
  customerCode?: string;
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
    envelopePrinted?: boolean;
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
