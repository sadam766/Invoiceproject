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
  ArrowRight, 
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  BarChart3,
  Scale,
  CreditCard,
  BadgeCheck,
  Zap,
  Target,
  ShieldAlert
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
import { type SalesListItem, type Invoice, type UserProfile } from '@/app/lib/data';
import { format, isSameDay, parseISO, startOfToday, subDays, eachDayOfInterval, differenceInDays, isBefore } from 'date-fns';
import { DateRangePicker } from '../components/date-range-picker';
import { cn } from '@/lib/utils';

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

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const salesCollection = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'sales'))), [firestore]);
  const { data: salesList } = useCollection<SalesListItem>(salesCollection);

  const invoicesCollection = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'invoices'))), [firestore]);
  const { data: invoiceList } = useCollection<Invoice>(invoicesCollection);

  const stats = useMemo(() => {
    if (!salesList || !invoiceList) return { outstanding: 0, realization: 0, overdueTotal: 0, draftCount: 0 };
    
    const today = startOfToday();
    const currentOutstanding = invoiceList
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => {
          const paidAmount = i.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          return sum + (i.amount - paidAmount);
      }, 0);
    
    const realization = invoiceList
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);

    const overdueTotal = invoiceList
        .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && isBefore(parseISO(inv.dueDate), today))
        .reduce((sum, inv) => {
            const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
            return sum + (inv.amount - paid);
        }, 0);

    return { 
        outstanding: currentOutstanding, 
        realization, 
        overdueTotal,
        draftCount: invoiceList.filter(i => i.status === 'draft').length
    };
  }, [salesList, invoiceList]);

  const agingData = useMemo(() => {
      if (!invoiceList) return { critical: 0, acute: 0 };
      const today = startOfToday();
      let critical = 0; 
      let acute = 0;    

      invoiceList.filter(i => i.status !== 'paid' && i.status !== 'cancelled').forEach(inv => {
          if (!inv.dueDate) return;
          const due = parseISO(inv.dueDate);
          if (isBefore(due, today)) {
              const diff = differenceInDays(today, due);
              const remaining = inv.amount - (inv.payments?.reduce((s, p) => s + p.amount, 0) || 0);
              if (diff > 30) acute += remaining;
              else critical += remaining;
          }
      });
      return { critical, acute };
  }, [invoiceList]);

  const chartData = useMemo(() => {
    if (!invoiceList) return [];
    const last7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    return last7Days.map(day => ({
        day: format(day, 'EEE'),
        count: invoiceList.filter(inv => isSameDay(parseISO(inv.date), day)).length,
    }));
  }, [invoiceList]);

  return (
    <main className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em]">
             <Zap className="h-3 w-3" /> System Intelligence
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">Executive Overview</h1>
          <p className="text-slate-400 font-medium text-sm">Dashboard monitoring piutang dan aktivitas penagihan Dakota secara real-time.</p>
        </div>
        <div className="bg-white p-2 rounded-3xl shadow-soft ring-1 ring-slate-200">
            <DateRangePicker onRangeChange={setDateRange} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group">
          <div className="h-1.5 w-full bg-indigo-500 rounded-t-3xl" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Outstanding</span>
                <Wallet className="h-5 w-5 text-indigo-500 transition-transform group-hover:scale-110" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 tracking-tighter">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
            <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] font-black bg-indigo-50 text-indigo-600 border-indigo-100">Live Balance</Badge>
                <span className="text-[10px] font-bold text-slate-400">Arus piutang aktif</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group">
          <div className="h-1.5 w-full bg-emerald-500 rounded-t-3xl" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Realized Collection</span>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 transition-transform group-hover:scale-110" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700 tracking-tighter">Rp {stats.realization.toLocaleString('id-ID')}</div>
            <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] font-black bg-emerald-50 text-emerald-600 border-emerald-100">Verified</Badge>
                <span className="text-[10px] font-bold text-slate-400">Total kas masuk</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group">
          <div className="h-1.5 w-full bg-rose-500 rounded-t-3xl" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">At-Risk Piutang</span>
                <AlertTriangle className="h-5 w-5 text-rose-500 transition-transform group-hover:scale-110" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-700 tracking-tighter">Rp {stats.overdueTotal.toLocaleString('id-ID')}</div>
            <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] font-black bg-rose-50 text-rose-600 border-rose-100">Overdue</Badge>
                <span className="text-[10px] font-bold text-slate-400">Jatuh tempo sistem</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-none group">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pending Documents</span>
                <Clock className="h-5 w-5 text-indigo-400 transition-transform group-hover:scale-110" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tracking-tighter">{stats.draftCount} <span className="text-sm font-normal text-slate-500">Drafts</span></div>
            <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] font-black bg-white/5 text-indigo-400 border-white/10 italic">In Queue</Badge>
                <span className="text-[10px] font-bold text-slate-500">Menunggu finalisasi</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-4 overflow-hidden border-none">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8 flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-600" /> Daily Activity Matrix</CardTitle>
                <CardDescription>Volume penagihan 7 hari terakhir</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-10">
            <div className="h-[320px] w-full overflow-hidden">
              <ChartContainer config={activityChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: '800' }} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                    <ChartTooltip cursor={{ fill: 'rgba(79, 70, 229, 0.03)' }} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[10, 10, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 overflow-hidden border-none flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
                <div className="space-y-1">
                    <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-rose-500" /> Aging Report Matrix</CardTitle>
                    <CardDescription>Efisiensi penagihan piutang</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10 flex-1">
                <div className="space-y-5">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Piutang Kritis (1 - 30 Hari)</p>
                            <p className="text-2xl font-black text-amber-600 tracking-tighter">Rp {agingData.critical.toLocaleString('id-ID')}</p>
                        </div>
                        <Scale className="h-6 w-6 text-amber-500 opacity-20 mb-1" />
                    </div>
                    <Progress value={(agingData.critical / (stats.outstanding || 1)) * 100} className="h-2.5 bg-slate-100 rounded-full" />
                </div>

                <div className="space-y-5">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Piutang Akut (> 30 Hari)</p>
                            <p className="text-2xl font-black text-rose-700 tracking-tighter">Rp {agingData.acute.toLocaleString('id-ID')}</p>
                        </div>
                        <ShieldAlert className="h-6 w-6 text-rose-600 opacity-20 mb-1" />
                    </div>
                    <Progress value={(agingData.acute / (stats.outstanding || 1)) * 100} className="h-2.5 bg-slate-100 rounded-full" />
                </div>

                <div className="pt-10 border-t border-dashed mt-auto">
                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-[0.2em] h-14 rounded-2xl shadow-premium group" onClick={() => router.push('/dashboard/sales-management')}>
                        Buka Buku Piutang Digital <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
         <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-premium relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Truck className="h-32 w-32" /></div>
            <div className="relative z-10 space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Logistics Readiness</p>
                <div className="text-4xl font-black tracking-tighter italic">
                    {invoiceList?.filter(inv => inv.status === 'sent' && !inv.spdNumber).length || 0} <span className="text-lg font-normal opacity-50 uppercase not-italic">To Ship</span>
                </div>
                <Button variant="secondary" className="w-full h-11 bg-white/10 hover:bg-white/20 text-white border-none rounded-2xl font-black uppercase text-[9px] tracking-widest" onClick={() => router.push('/dashboard/invoices/spd')}>
                    Siapkan Pengiriman (SPD)
                </Button>
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] p-8 ring-1 ring-slate-200 shadow-soft group hover:ring-indigo-400 transition-all">
            <div className="flex justify-between items-start mb-6">
                <div className="bg-emerald-50 p-4 rounded-3xl"><CreditCard className="h-6 w-6 text-emerald-600" /></div>
                <BadgeCheck className="h-6 w-6 text-emerald-200 group-hover:text-emerald-500 transition-colors" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Collections Verified</p>
            <div className="text-3xl font-black text-slate-900 tracking-tighter">
                {invoiceList?.filter(i => i.status === 'paid').length || 0} <span className="text-xs font-bold text-slate-400 uppercase">Paid Docs</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 italic font-medium">Rekonsiliasi dana tervalidasi sistem.</p>
         </div>

         <div className="bg-slate-50 rounded-[2.5rem] p-8 ring-1 ring-slate-200 shadow-soft group hover:ring-indigo-400 transition-all border-none">
            <div className="flex justify-between items-start mb-6">
                <div className="bg-indigo-50 p-4 rounded-3xl"><ReceiptText className="h-6 w-6 text-indigo-600" /></div>
                <Badge variant="outline" className="text-[8px] font-black bg-white rounded-full">Archive Active</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Digital Repository</p>
            <div className="text-3xl font-black text-slate-900 tracking-tighter">
                {invoiceList?.length || 0} <span className="text-xs font-bold text-slate-400 uppercase">Total Items</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 italic font-medium">Database arsip dokumen terpusat.</p>
         </div>
      </div>
    </main>
  );
}
