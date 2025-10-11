
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
  invoiceStatus: 'Paid' | 'Unpaid';
  taxInvoice: string;
  spd: string;
  paymentStatus: 'Paid' | 'Unpaid';
  needsSpd: boolean;
};

export const salesMonitoringData: SalesMonitoringData[] = [
  {
    soNumber: 'SO-2024-002',
    customer: 'CV. Maju Jaya',
    date: '2024-05-12',
    amount: 1500000,
    invoice: 'INV/2024/002',
    invoiceStatus: 'Paid',
    taxInvoice: 'N/A',
    spd: 'PS/1-J/KEU/2024/DK',
    paymentStatus: 'Paid',
    needsSpd: false,
  },
  {
    soNumber: 'SO-2024-001',
    customer: 'PT. Sejahtera Abadi',
    date: '2024-05-10',
    amount: 1000000,
    invoice: 'INV/2024/001',
    invoiceStatus: 'Unpaid',
    taxInvoice: '010.000-24.00000001',
    spd: '',
    paymentStatus: 'Unpaid',
    needsSpd: true,
  },
];

export type Invoice = {
  id: string;
  soNumber: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  spdNumber: string;
};

export const invoiceListData: Invoice[] = [
  {
    id: 'INV/2024/001',
    soNumber: 'SO-2024-001',
    customer: 'PT. Sejahtera Abadi',
    date: '2024-05-11',
    amount: 1000000,
    status: 'Unpaid',
    spdNumber: '-',
  },
  {
    id: 'INV/2024/002',
    soNumber: 'SO-2024-002',
    customer: 'CV. Maju Jaya',
    date: '2024-05-13',
    amount: 1500000,
    status: 'Paid',
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

export const invoiceNumberData: InvoiceNumber[] = [
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
    transactionCode: string;
    taxInvoiceNumber: string;
    taxInvoiceDate: string;
    taxPeriod: number;
};

export const taxInvoiceData: TaxInvoice[] = [
    {
        buyerNpwp: '01.234.567.8-901.234',
        buyerName: 'PT. Sejahtera Abadi',
        transactionCode: '01',
        taxInvoiceNumber: '010.000-24.00000001',
        taxInvoiceDate: '2024-05-11',
        taxPeriod: 5,
    }
];

export type ProductListItem = {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
};

export const productListData: ProductListItem[] = [
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
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
};

export const salesOrderListData: SalesOrder[] = [
    {
        soNumber: 'SO-2024-001',
        productName: 'Kabel Fiber Optik',
        category: 'Kabel',
        quantity: 50,
        unit: 'meter',
        price: 15000,
    },
    {
        soNumber: 'SO-2024-001',
        productName: 'Konektor RJ45',
        category: 'Aksesoris',
        quantity: 100,
        unit: 'pcs',
        price: 2500,
    },
    {
        soNumber: 'SO-2024-002',
        productName: 'Kabel Tembaga 2.5mm',
        category: 'Kabel',
        quantity: 200,
        unit: 'meter',
        price: 7500,
    }
];
