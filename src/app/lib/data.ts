
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
};

export function getSalesMonitoringData(salesOrders: SalesOrder[], invoiceListData: Invoice[], taxInvoiceData: TaxInvoice[], spdData: SpdData[]): SalesMonitoringData[] {
    const soData = salesOrders.reduce((acc, order) => {
        if (!acc[order.soNumber]) {
            acc[order.soNumber] = {
                soNumber: order.soNumber,
                customer: order.customer,
                date: new Date().toLocaleDateString('en-CA'), // Placeholder date
                amount: 0,
            };
        }
        acc[order.soNumber].amount += order.quantity * order.price;
        return acc;
    }, {} as {[key: string]: any});


    return Object.values(soData).map(so => {
        const invoice = invoiceListData.find(inv => inv.soNumber === so.soNumber);
        
        // Find related documents only if an invoice exists
        const taxInvoice = invoice ? taxInvoiceData.find(ti => ti.invoiceNumber === invoice.id) : undefined;
        const spd = invoice ? spdData.find(s => s.noInvoice.includes(invoice.id)) : undefined;

        const paymentStatus = (invoice?.status === 'paid') ? 'Paid' : 'Unpaid';

        return {
            soNumber: so.soNumber,
            customer: so.customer,
            date: so.date,
            amount: so.amount,
            invoice: invoice?.id || '',
            invoiceStatus: invoice?.status || 'Draft',
            taxInvoice: taxInvoice?.taxInvoiceNumber || '',
            spd: spd?.spd || '',
            paymentStatus: paymentStatus,
            needsInvoice: !invoice,
            needsSpd: !!invoice && !spd,
        };
    });
}


export type Invoice = {
  id: string;
  soNumber: string;
  poNumber: string;
  customer: string;
  date: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'sent' | 'draft';
  spdNumber: string;
  ownerId?: string;
  createdBy?: string; // Audit Trail: Nama/Email pembuat
};

export type InvoiceNumber = {
  id: string;
  customer: string;
  salesOrder: string;
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
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    ownerId?: string;
    customer: string;
};

export type Customer = {
  id?: string;
  name: string;
  address: string;
  spdAddress: string;
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
