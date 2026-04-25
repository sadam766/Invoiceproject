
'use client';

import { useMemo, useState, useEffect } from 'react';
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
  AlertCircle, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Clock,
  ArrowUpRight,
  User,
  CheckCircle2,
  Truck,
  PackageCheck,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfToday(),
    to: startOfToday(),
  });

  // Data Fetching
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
  const { data: invoiceList } = useCollection<Invoice>(invoicesCollection);

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

  // LOGIC: Filtered Data based on Date Picker
  const filteredInvoices = useMemo(() => {
    if (!invoiceList) return [];
    return invoiceList.filter(inv => {
        const invDate = parseISO(inv.date);
        return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [invoiceList, dateRange]);

  // LOGIC: Today's Milestones (Always Today for this widget)
  const todayMilestones = useMemo(() => {
    if (!invoiceList) return [];
    const today = startOfToday();
    return [...invoiceList]
      .filter(i => isSameDay(parseISO(i.date), today))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [invoiceList]);

  // LOGIC: Chart Data (Last 7 Days)
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
    if (!filteredInvoices || !salesList) return { outstanding: 0, realization: 0, target: 0, taxPending: 0 };
    
    const outstanding = filteredInvoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const realization = filteredInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const target = salesList.reduce((sum, s) => sum + s.amount, 0);
    
    const taxPending = filteredInvoices.filter(inv => 
      !taxList?.some(t => t.invoiceNumber === inv.id)
    ).length;

    return { outstanding, realization, target, taxPending };
  }, [filteredInvoices, stats, salesList, taxList]);

  const logisticStats = useMemo(() => {
    const pendingShipment = filteredInvoices.filter(inv => inv.status === 'sent' && !inv.spdNumber).length;
    const inTransit = spdList?.filter(s => s.status === 'in_delivery').length || 0;
    return { pendingShipment, inTransit };
  }, [filteredInvoices, spdList]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase font-black">Dakota Command Center</h1>
          <div className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
            Global overview of Dakota business performance. 
            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-black uppercase">
                {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM/yy')}
            </Badge>
          </div>
        </div>
        <DateRangePicker onRangeChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Outstanding</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Piutang belum tertagih di periode ini.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Realisasi (Paid)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">Rp {stats.realization.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Dana masuk terverifikasi.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pajak Pending</CardTitle>
            <ReceiptText className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{stats.taxPending} <span className="text-xs font-normal">Docs</span></div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Menunggu input Nomor Faktur Pajak.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-md">
          <CardHeader className="border-b bg-muted/5">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-tighter">
                        <BarChart3 className="h-4 w-4 text-primary" /> Daily Activity Chart
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold">Volume penerbitan invoice 7 hari terakhir.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
              <ChartContainer config={activityChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                        dataKey="day" 
                        axisLine={false} 
                        tickLine={false} 
                        style={{ fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                        barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md">
            <CardHeader className="border-b bg-muted/5">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-tighter">
                    <Clock className="h-4 w-4 text-orange-500" /> Today's Milestones
                </CardTitle>
                <CardDescription className="text-[10px] font-bold">Invoice terbaru yang diterbitkan hari ini.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {todayMilestones.length > 0 ? todayMilestones.map(inv => (
                        <div key={inv.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-primary group-hover:underline cursor-pointer" onClick={() => router.push('/dashboard/invoices')}>
                                    {inv.id}
                                </span>
                                <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">{inv.customer}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black">Rp {inv.amount.toLocaleString('id-ID')}</p>
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black uppercase">{inv.status}</Badge>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-muted-foreground opacity-30 flex flex-col items-center gap-2">
                            <PackageCheck className="h-10 w-10" />
                            <p className="text-xs font-bold">Belum ada aktivitas hari ini.</p>
                        </div>
                    )}
                </div>
                {todayMilestones.length > 0 && (
                    <div className="p-3 border-t bg-muted/10 text-center">
                        <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase h-7" onClick={() => router.push('/dashboard/invoices')}>
                            View All Invoices <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         <Card className="bg-indigo-50/20 border-indigo-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-2 tracking-widest">
                    <Truck className="h-4 w-4" /> Logistic Readiness
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black">{logisticStats.pendingShipment} <span className="text-xs font-normal">Ready to Ship</span></div>
                <Progress value={(logisticStats.pendingShipment / (filteredInvoices.length || 1)) * 100} className="h-1.5 mt-3" />
            </CardContent>
         </Card>
         <Card className="bg-amber-50/20 border-amber-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-2 tracking-widest">
                    <AlertTriangle className="h-4 w-4" /> Aging Documents
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black">{logisticStats.inTransit} <span className="text-xs font-normal">On Delivery</span></div>
                <p className="text-[10px] text-muted-foreground mt-2 font-medium italic">Dokumen fisik sedang dibawa kurir.</p>
            </CardContent>
         </Card>
      </div>
    </main>
  );
}
