
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
