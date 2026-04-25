
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
  isPoOnly: boolean; // True jika hanya ada PO tanpa SO
};

export function getSalesMonitoringData(
    salesOrders: SalesOrder[], 
    invoiceListData: Invoice[], 
    taxInvoiceData: TaxInvoice[], 
    spdData: SpdData[]
): SalesMonitoringData[] {
    // 1. Group data by SO
    const soData = salesOrders.reduce((acc, order) => {
        if (!acc[order.soNumber]) {
            acc[order.soNumber] = {
                soNumber: order.soNumber,
                poNumber: order.poNumber || '',
                customer: order.customer,
                date: new Date().toLocaleDateString('en-CA'),
                amount: 0,
            };
        }
        acc[order.soNumber].amount += order.quantity * order.price;
        return acc;
    }, {} as {[key: string]: any});

    // 2. Identify Invoices without real SO (PO-based)
    const poOnlyInvoices = invoiceListData.filter(inv => 
        !salesOrders.some(so => so.soNumber === inv.soNumber)
    );

    const results: SalesMonitoringData[] = Object.values(soData).map(so => {
        const invoice = invoiceListData.find(inv => inv.soNumber === so.soNumber);
        const taxInvoice = invoice ? taxInvoiceData.find(ti => ti.invoiceNumber === invoice.id) : undefined;
        const spd = invoice ? spdData.find(s => s.noInvoice.includes(invoice.id)) : undefined;

        return {
            soNumber: so.soNumber,
            poNumber: so.poNumber,
            customer: so.customer,
            date: so.date,
            amount: so.amount,
            invoice: invoice?.id || '',
            invoiceStatus: (invoice?.status || 'Draft') as any,
            taxInvoice: taxInvoice?.taxInvoiceNumber || '',
            spd: spd?.spd || '',
            paymentStatus: (invoice?.status === 'paid') ? 'Paid' : 'Unpaid',
            needsInvoice: !invoice,
            needsSpd: !!invoice && !spd,
            isPoOnly: false
        };
    });

    // 3. Add PO-based invoices to the list
    poOnlyInvoices.forEach(inv => {
        if (!results.find(r => r.invoice === inv.id)) {
            results.push({
                soNumber: '(Waiting SO)',
                poNumber: inv.poNumber,
                customer: inv.customer,
                date: inv.date,
                amount: inv.amount,
                invoice: inv.id,
                invoiceStatus: inv.status as any,
                taxInvoice: '',
                spd: '',
                paymentStatus: (inv.status === 'paid') ? 'Paid' : 'Unpaid',
                needsInvoice: false,
                needsSpd: false,
                isPoOnly: true
            });
        }
    });

    return results;
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

export type VirtualAccount = {
  id?: string;
  customerCode?: string;
  customerName: string;
  bankName: string;
  vaNumber: string;
  ownerId?: string;
};
