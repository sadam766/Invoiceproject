'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Wallet, 
  TrendingUp, 
  ReceiptText, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { type SalesListItem, type Invoice, type TaxInvoice, type UserProfile, type SpdData } from '@/app/lib/data';
import { format, isSameDay, parseISO, isWithinInterval, startOfToday, subDays, eachDayOfInterval } from 'date-fns';
import { DateRangePicker } from '../components/date-range-picker';

const activityChartConfig = {
  count: {
    label: "Invoices",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfToday(),
    to: startOfToday(),
  });

  // AUDIT FIX: Real-time Database Pull
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const salesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'));
  }, [firestore]);
  const { data: salesList } = useCollection<SalesListItem>(salesCollection);

  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: invoiceList } = useCollection<Invoice>(invoiceListCollection);

  const taxInvoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'taxInvoices'));
  }, [firestore]);
  const { data: taxList } = useCollection<TaxInvoice>(taxInvoicesCollection);

  const spdsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'spds'));
  }, [firestore]);
  const { data: spdList } = useCollection<SpdData>(spdsCollection);

  const filteredInvoices = useMemo(() => {
    if (!invoiceList) return [];
    return invoiceList.filter(inv => {
        const invDate = parseISO(inv.date);
        return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [invoiceList, dateRange]);

  const todayMilestones = useMemo(() => {
    if (!invoiceList) return [];
    const today = startOfToday();
    return [...invoiceList]
      .filter(i => isSameDay(parseISO(i.date), today))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [invoiceList]);

  const chartData = useMemo(() => {
    if (!invoiceList) return [];
    const last7Days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
    });

    return last7Days.map(day => {
        const count = invoiceList.filter(inv => isSameDay(parseISO(inv.date), day)).length;
        return {
            day: format(day, 'EEE'),
            count: count,
        };
    });
  }, [invoiceList]);

  const stats = useMemo(() => {
    if (!salesList || !invoiceList) return { outstanding: 0, realization: 0, target: 0, taxPending: 0 };
    
    const currentOutstanding = filteredInvoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => {
          const paidAmount = i.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          return sum + (i.amount - paidAmount);
      }, 0);
    
    const systemRealization = filteredInvoices
      .filter(i => i.status !== 'cancelled')
      .reduce((sum, i) => {
          const paidAmount = i.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          return sum + paidAmount;
      }, 0);

    const activeSales = salesList.filter(s => s.status !== 'Cancelled');
    const legacyPaid = activeSales.reduce((sum, s) => sum + (s.paidOffline || 0), 0);
    
    const taxPending = filteredInvoices.filter(inv => 
      inv.status !== 'cancelled' && !taxList?.some(t => t.invoiceNumber === inv.id)
    ).length;

    return { 
        outstanding: currentOutstanding, 
        realization: systemRealization + legacyPaid, 
        taxPending 
    };
  }, [filteredInvoices, salesList, taxList, invoiceList]);

  const logisticStats = useMemo(() => {
    const pendingShipment = filteredInvoices.filter(inv => inv.status === 'sent' && !inv.spdNumber).length;
    const inTransit = spdList?.filter(s => s.status === 'in_delivery').length || 0;
    return { pendingShipment, inTransit };
  }, [filteredInvoices, spdList]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-50">Dakota Command Center</h1>
          <div className="text-slate-400 font-medium flex items-center gap-2 text-sm">
            Live Database Sync Active.
            <Badge variant="secondary" className="bg-indigo-600/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest border-indigo-100">
                {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM/yy')}
            </Badge>
          </div>
        </div>
        <DateRangePicker onRangeChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white overflow-hidden">
          <div className="h-1 w-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400">Total Outstanding</CardTitle>
            <Wallet className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Piutang belum tertagih</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white overflow-hidden">
          <div className="h-1 w-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400">Realisasi (Paid)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">Rp {stats.realization.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Dana Masuk & Migrasi</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 bg-white overflow-hidden">
          <div className="h-1 w-full bg-indigo-600" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400">Pajak Pending</CardTitle>
            <ReceiptText className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{stats.taxPending} <span className="text-xs font-normal">Docs</span></div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Menunggu Faktur Pajak</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-md border-none ring-1 ring-slate-200 overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-900">
                <BarChart3 className="h-4 w-4 text-indigo-600" /> Daily Activity Chart
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ChartContainer config={activityChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '10px', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '10px' }} 
                      allowDecimals={false}
                      domain={[0, 'dataMax + 1']}
                    />
                    <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md border-none ring-1 ring-slate-200">
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-900">
                    <Clock className="h-4 w-4 text-amber-500" /> Today's Milestones
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                    {todayMilestones.length > 0 ? todayMilestones.map(inv => (
                        <div key={inv.id} className="p-4 hover:bg-indigo-50/20 transition-colors flex items-center justify-between group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-indigo-600 cursor-pointer" onClick={() => router.push('/dashboard/invoices')}>{inv.id}</span>
                                <span className="text-[10px] font-bold uppercase truncate max-w-[150px] text-slate-600">{inv.customer}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-900">Rp {inv.amount.toLocaleString('id-ID')}</p>
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black uppercase">{inv.status}</Badge>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-slate-400 opacity-30 flex flex-col items-center gap-2">
                            <PackageCheck className="h-10 w-10" />
                            <p className="text-xs font-bold uppercase">Belum ada aktivitas.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         <Card className="bg-indigo-50/20 border-indigo-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Logistic Readiness
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black">{logisticStats.pendingShipment} <span className="text-xs font-normal text-slate-400">Ready to Ship</span></div>
                <Progress value={(logisticStats.pendingShipment / (filteredInvoices.length || 1)) * 100} className="h-1.5 mt-3 bg-indigo-100" />
            </CardContent>
         </Card>
         <Card className="bg-amber-50/20 border-amber-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Aging Documents
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black">{logisticStats.inTransit} <span className="text-xs font-normal text-slate-400">On Delivery</span></div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium italic">Dokumen fisik dalam perjalanan kurir.</p>
            </CardContent>
         </Card>
      </div>
    </main>
  );
}
