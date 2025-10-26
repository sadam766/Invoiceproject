
import type { LucideIcon } from 'lucide-react';
import { DollarSign, Users, Package, Activity, Zap } from 'lucide-react';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';

export type Kpi = {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

export const kpiData: Kpi[] = [
  {
    title: 'Total Revenue',
    value: 'Rp 1.500.000',
    change: '+0.0% vs last month',
    icon: DollarSign,
  },
  {
    title: 'Total Customers',
    value: '2',
    change: '+0.0% vs last month',
    icon: Users,
  },
  {
    title: 'Total Products',
    value: '3',
    change: '+0.0% vs last month',
    icon: Package,
  },
  {
    title: 'Conversion Rate',
    value: '50.0%',
    change: '+0.0% vs last month',
    icon: Zap,
  },
];

export const salesChartData = [
    { month: 'Nov', revenue: 0, sales: 0 },
    { month: 'Dec', revenue: 1000000, sales: 500 },
    { month: 'Jan', revenue: 1500000, sales: 750 },
    { month: 'Feb', revenue: 1200000, sales: 600 },
    { month: 'Mar', revenue: 2000000, sales: 1000 },
    { month: 'Apr', revenue: 1800000, sales: 900 },
    { month: 'May', revenue: 2500000, sales: 1250 },
    { month: 'Jun', revenue: 2300000, sales: 1150 },
    { month: 'Jul', revenue: 3000000, sales: 1500 },
    { month: 'Aug', revenue: 2800000, sales: 1400 },
    { month: 'Sep', revenue: 3500000, sales: 1750 },
    { month: 'Oct', revenue: 4000000, sales: 2000 },
];

export type Product = {
  name: string;
  image: ImagePlaceholder;
  sales: number;
  quantity: number;
};

export const topProducts: Product[] = [
  {
    name: 'Kabel Tembaga 2.5mm',
    image: PlaceHolderImages[0],
    sales: 1500000,
    quantity: 200,
  },
  {
    name: 'Konektor RJ45',
    image: PlaceHolderImages[1],
    sales: 250000,
    quantity: 100,
  },
  {
    name: 'Kabel Fiber Optik',
    image: PlaceHolderImages[2],
    sales: 750000,
    quantity: 50,
  },
];

export type Sale = {
  invoiceId: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
};

export const recentSales: Sale[] = [
  {
    invoiceId: 'INV/2024/002',
    customer: 'CV. Maju Jaya',
    date: 'May 13, 2024',
    amount: 1500000,
    status: 'Paid',
  },
  {
    invoiceId: 'INV/2024/001',
    customer: 'PT. Sejahtera Abadi',
    date: 'May 11, 2024',
    amount: 1000000,
    status: 'Unpaid',
  },
];

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

export function getSalesMonitoringData(): SalesMonitoringData[] {
    const soData = salesOrderListData.reduce((acc, order) => {
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
        const taxInvoice = taxInvoiceData.find(ti => ti.invoiceNumber === invoice?.id);
        const spd = spdData.find(s => s.noInvoice.includes(invoice?.id || ''));

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
};

export let invoiceListData: Invoice[] = [
  {
    id: 'INV/2024/001',
    soNumber: 'SO-2024-001',
    poNumber: 'PO-ABC-001',
    customer: 'PT. Sejahtera Abadi',
    date: '2024-05-11',
    amount: 1000000,
    status: 'unpaid',
    spdNumber: '-',
  },
  {
    id: 'INV/2024/002',
    soNumber: 'SO-2024-002',
    poNumber: 'PO-DEF-002',
    customer: 'CV. Maju Jaya',
    date: '2024-05-13',
    amount: 1500000,
    status: 'paid',
    spdNumber: 'PS/1-J/KEU/2024/DK',
  },
];

export type InvoiceNumber = {
  id: string;
  customer: string;
  salesOrder: string;
  date: string;
  amount: number;
};

export let invoiceNumberData: InvoiceNumber[] = [
    {
        id: 'SAR/25000001',
        customer: 'PT. Sejahtera Abadi',
        salesOrder: 'SO-2024-001',
        date: '11/5/2024',
        amount: 1000000,
    },
    {
        id: 'SAR/25000002',
        customer: 'CV. Maju Jaya',
        salesOrder: 'SO-2024-002',
        date: '13/5/2024',
        amount: 1500000,
    }
]

export type TaxInvoice = {
    buyerNpwp: string;
    buyerName: string;
    status: string;
    taxInvoiceNumber: string;
    taxInvoiceDate: string;
    invoiceNumber: string;
};

export const taxInvoiceData: TaxInvoice[] = [
    {
        buyerNpwp: '01.234.567.8-901.234',
        buyerName: 'PT. Sejahtera Abadi',
        status: 'APPROVED',
        taxInvoiceNumber: '010.000-24.00000001',
        taxInvoiceDate: '2024-05-11',
        invoiceNumber: 'INV/2024/001',
    }
];

export type ProductListItem = {
    id?: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
};

export let productListData: ProductListItem[] = [
    {
        name: 'Kabel Fiber Optik',
        category: 'Kabel',
        quantity: 100,
        unit: 'meter',
        price: 15000,
    },
    {
        name: 'Konektor RJ45',
        category: 'Aksesoris',
        quantity: 500,
        unit: 'pcs',
        price: 2500,
    },
    {
        name: 'Kabel Tembaga 2.5mm',
        category: 'Kabel',
        quantity: 15,
        unit: 'meter',
        price: 7500,
    }
];

export type SalesOrder = {
    soNumber: string;
    customer: string;
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
};

export let salesOrderListData: SalesOrder[] = [
    {
        soNumber: 'SO-2024-001',
        customer: 'PT. Sejahtera Abadi',
        productName: 'Kabel Fiber Optik',
        category: 'Kabel',
        quantity: 50,
        unit: 'meter',
        price: 15000,
    },
    {
        soNumber: 'SO-2024-001',
        customer: 'PT. Sejahtera Abadi',
        productName: 'Konektor RJ45',
        category: 'Aksesoris',
        quantity: 100,
        unit: 'pcs',
        price: 2500,
    },
    {
        soNumber: 'SO-2024-002',
        customer: 'CV. Maju Jaya',
        productName: 'Kabel Tembaga 2.5mm',
        category: 'Kabel',
        quantity: 200,
        unit: 'meter',
        price: 7500,
    },
     {
        soNumber: 'SO-2024-003',
        customer: 'Toko Listrik Sinar Jaya',
        productName: 'Kabel Tembaga 1.5mm',
        category: 'Kabel',
        quantity: 500,
        unit: 'meter',
        price: 5500,
    }
];

export type Customer = {
  id?: string;
  name: string;
  address: string;
  spdAddress: string;
};

export let customerListData: Customer[] = [
  {
    id: '1',
    name: 'PT. Sejahtera Abadi',
    address: 'Jl. Jendral Sudirman No. 123, Jakarta',
    spdAddress: 'Jl. Gatot Subroto No. 45, Jakarta',
  },
  { 
    id: '2',
    name: 'CV. Maju Jaya',
    address: 'Jl. Gajah Mada No. 10, Surabaya',
    spdAddress: 'Jl. Gajah Mada No. 10, Surabaya',
  },
  { 
    id: '3',
    name: 'Toko Listrik Sinar Jaya',
    address: 'Jl. Hayam Wuruk No. 5, Jakarta',
    spdAddress: 'Jl. Hayam Wuruk No. 5, Jakarta',
  },
];

export type SalesListItem = {
  soNumber: string;
  customer: string;
  sales: string;
  poNumber: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  paidDate?: string;
};

export const salesListData: SalesListItem[] = [
  {
    soNumber: 'SO-2024-001',
    customer: 'PT. Sejahtera Abadi',
    sales: 'Budi',
    poNumber: 'PO-ABC-001',
    amount: 1000000,
    status: 'Unpaid',
  },
  {
    soNumber: 'SO-2024-002',
    customer: 'CV. Maju Jaya',
    sales: 'Citra',
    poNumber: 'PO-DEF-002',
    amount: 1500000,
    status: 'Paid',
    paidDate: '2024-05-25',
  },
];

export type SpdData = {
    tanggal: string;
    sales: string;
    customer: string;
    spd: string;
    noInvoice: string;
    tanggalInvoice: string;
    tglTerimaCustomer: string;
    tglJatuhTempo: string;
    totalPiutang: number;
    keterangan: string;
    noKuitansi: string;
    noFakturPajak: string;
    suratJalan: string;
};
  
export let spdData: SpdData[] = [
    {
        tanggal: '2024-05-20',
        sales: 'Budi',
        customer: 'CV. Maju Jaya',
        spd: 'PS/1-J/KEU/2024/DK',
        noInvoice: 'INV/2024/002',
        tanggalInvoice: '2024-05-13',
        tglTerimaCustomer: '-',
        tglJatuhTempo: '-',
        totalPiutang: 1500000,
        keterangan: '-',
        noKuitansi: '-',
        noFakturPajak: '-',
        suratJalan: '-',
    }
];

    
