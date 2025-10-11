import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kpiData, salesChartData, recentSales, topProducts } from '@/app/lib/data';
import KpiCard from './components/kpi-card';
import SalesChart from './components/sales-chart';
import RecentSales from './components/recent-sales';
import TopProducts from './components/top-products';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Sales Dashboard
            </h1>
            <div className="flex items-center space-x-2">
              <Tabs defaultValue="last_30_days" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="last_7_days">Last 7 Days</TabsTrigger>
                  <TabsTrigger value="last_30_days">Last 30 Days</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <SalesChart data={salesChartData} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <CardDescription>
                  Your best-selling products this month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopProducts products={topProducts} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>
                A list of your most recent sales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentSales sales={recentSales} />
            </CardContent>
          </Card>
        </main>
      </div>
    </main>
  );
}
