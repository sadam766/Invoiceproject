import type { LucideIcon } from 'lucide-react';
import { Activity, DollarSign, Package, Users } from 'lucide-react';
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
    value: '$45,231.89',
    change: '+20.1%',
    icon: DollarSign,
  },
  {
    title: 'Total Customers',
    value: '2,350',
    change: '+18.1%',
    icon: Users,
  },
  {
    title: 'Total Products',
    value: '1,234',
    change: '+19%',
    icon: Package,
  },
  {
    title: 'Conversion Rate',
    value: '12.5%',
    change: '-2.1%',
    icon: Activity,
  },
];

export const salesChartData = [
  { month: 'January', revenue: 4000, sales: 2400 },
  { month: 'February', revenue: 3000, sales: 1398 },
  { month: 'March', revenue: 5000, sales: 7800 },
  { month: 'April', revenue: 2780, sales: 3908 },
  { month: 'May', revenue: 1890, sales: 4800 },
  { month: 'June', revenue: 3390, sales: 3800 },
  { month: 'July', revenue: 4490, sales: 4300 },
];

export type Product = {
  name: string;
  image: ImagePlaceholder;
  sales: number;
  quantity: number;
};

export const topProducts: Product[] = [
  {
    name: 'Wireless Headphones',
    image: PlaceHolderImages[0],
    sales: 1650.5,
    quantity: 150,
  },
  {
    name: 'Smartwatch Pro',
    image: PlaceHolderImages[1],
    sales: 1280.0,
    quantity: 120,
  },
  {
    name: 'DSLR Camera Kit',
    image: PlaceHolderImages[2],
    sales: 950.75,
    quantity: 85,
  },
  {
    name: 'Gaming Laptop',
    image: PlaceHolderImages[3],
    sales: 2300.0,
    quantity: 50,
  },
  {
    name: 'Ergonomic Chair',
    image: PlaceHolderImages[4],
    sales: 780.2,
    quantity: 95,
  },
];

export type Sale = {
  invoiceId: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
};

export const recentSales: Sale[] = [
  {
    invoiceId: 'INV001',
    customer: 'Liam Johnson',
    date: '2023-10-23',
    amount: 250.0,
    status: 'Paid',
  },
  {
    invoiceId: 'INV002',
    customer: 'Olivia Smith',
    date: '2023-10-22',
    amount: 150.0,
    status: 'Pending',
  },
  {
    invoiceId: 'INV003',
    customer: 'Noah Williams',
    date: '2023-10-21',
    amount: 350.0,
    status: 'Paid',
  },
  {
    invoiceId: 'INV004',
    customer: 'Emma Brown',
    date: '2023-10-20',
    amount: 450.0,
    status: 'Failed',
  },
  {
    invoiceId: 'INV005',
    customer: 'Ava Jones',
    date: '2023-10-19',
    amount: 550.0,
    status: 'Paid',
  },
];
