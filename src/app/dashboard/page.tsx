
'use client';
import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type SalesListItem, type Customer, type ProductListItem, type Sale } from '@/app/lib/data';
import KpiCard from '../components/kpi-card';
import SalesChart from '../components/sales-chart';
import RecentSales from '../components/recent-sales';
import TopProducts from '../components/top-products';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, DollarSign, Users, Package, ShoppingCart, Lock } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch user profile to get the role
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const userRole = userProfile?.role || 'staff';
  const isAdmin = userRole === 'admin';

  const salesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'));
  }, [firestore]);
  const { data: sales } = useCollection<SalesListItem>(salesCollection);

  const customersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customers'));
  }, [firestore]);
  const { data: customers } = useCollection<Customer>(customersCollection);

  const productsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: products } = useCollection<ProductListItem>(productsCollection);

  const { kpiData, salesChartData, recentSales, topProducts } = useMemo(() => {
    const totalRevenue = sales?.reduce((acc, sale) => acc + sale.amount, 0) || 0;
    const totalCustomers = customers?.length || 0;
    const totalProducts = products?.length || 0;

    const kpiData = [
      {
        title: 'Total Revenue',
        value: isAdmin ? `Rp ${totalRevenue.toLocaleString('id-ID')}` : '**********',
        change: '+0.0% vs last month',
        icon: isAdmin ? DollarSign : Lock,
        restricted: !isAdmin,
      },
      {
        title: 'Total Customers',
        value: totalCustomers.toString(),
        change: '+0.0% vs last month',
        icon: Users,
        restricted: false,
      },
      {
        title: 'Total Products',
        value: totalProducts.toString(),
        change: '+0.0% vs last month',
        icon: Package,
        restricted: false,
      },
      {
        title: 'Total Sales',
        value: sales?.length.toString() || '0',
        change: '+0.0% vs last month',
        icon: ShoppingCart,
        restricted: false,
      },
    ];

    const salesByMonth = (sales || []).reduce((acc, sale) => {
        if (!sale.paidDate) return acc;
        const month = new Date(sale.paidDate).toLocaleString('default', { month: 'short' });
        acc[month] = (acc[month] || 0) + sale.amount;
        return acc;
    }, {} as Record<string, number>);

    const salesChartData = [
        { month: 'Jan', revenue: 0, sales: 0 }, { month: 'Feb', revenue: 0, sales: 0 },
        { month: 'Mar', revenue: 0, sales: 0 }, { month: 'Apr', revenue: 0, sales: 0 },
        { month: 'May', revenue: 0, sales: 0 }, { month: 'Jun', revenue: 0, sales: 0 },
        { month: 'Jul', revenue: 0, sales: 0 }, { month: 'Aug', revenue: 0, sales: 0 },
        { month: 'Sep', revenue: 0, sales: 0 }, { month: 'Oct', revenue: 0, sales: 0 },
        { month: 'Nov', revenue: 0, sales: 0 }, { month: 'Dec', revenue: 0, sales: 0 },
    ].map(item => ({
        ...item,
        revenue: isAdmin ? (salesByMonth[item.month] || 0) : 0,
        sales: (salesByMonth[item.month] || 0) / 1000 // Placeholder logic
    }));

    const recentSales: Sale[] = (sales || [])
        .sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime())
        .slice(0, 5)
        .map(sale => ({
            invoiceId: sale.soNumber,
            customer: sale.customer,
            date: sale.paidDate ? new Date(sale.paidDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
            amount: sale.amount,
            status: sale.status,
        }));
    
    const topProducts = [];

    return { kpiData, salesChartData, recentSales, topProducts };
  }, [sales, customers, products, isAdmin]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                Dashboard
                </h1>
                <p className="text-muted-foreground">Halo, {user?.displayName}. Berikut ringkasan performa bisnis.</p>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    12 Bulan Terakhir <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                <DropdownMenuItem>Last 30 Days</DropdownMenuItem>
                <DropdownMenuItem>Last 90 Days</DropdownMenuItem>
                <DropdownMenuItem>Last Year</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Sales Overview {!isAdmin && <span className="text-xs font-normal text-muted-foreground ml-2">(Data Terbatas)</span>}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {isAdmin ? (
                <SalesChart data={salesChartData} />
            ) : (
                <div className="flex h-[300px] w-full items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Lock className="h-8 w-8" />
                        <p className="text-sm">Grafik pendapatan hanya tersedia untuk Admin.</p>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? <TopProducts products={topProducts} /> : <p className="text-sm text-muted-foreground">No product sales data available.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Recent Sales</CardTitle>
            </div>
            <Button variant="link">View All</Button>
        </CardHeader>
        <CardContent>
          <RecentSales sales={recentSales} />
        </CardContent>
      </Card>
    </main>
  );
}
