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
  BarChart3,
  Scale,
  CreditCard
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
import { format, isSameDay, parseISO, isWithinInterval, startOfToday, subDays, eachDayOfInterval, differenceInDays, isBefore } from 'date-fns';
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

  const filteredInvoices = useMemo(() => {
    if (!invoiceList) return [];
    return invoiceList.filter(inv => {
        const invDate = parseISO(inv.date);
        return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [invoiceList, dateRange]);

  const stats = useMemo(() => {
    if (!salesList || !invoiceList) return { outstanding: 0, realization: 0, taxPending: 0, overdueTotal: 0 };
    
    const today = startOfToday();
    const currentOutstanding = invoiceList
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => {
          const paidAmount = i.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          return sum + (i.amount - paidAmount);
      }, 0);
    
    const systemRealization = invoiceList
      .filter(i => i.status !== 'cancelled')
      .reduce((sum, i) => {
          const paidAmount = i.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          return sum + paidAmount;
      }, 0);

    const legacyPaid = salesList.reduce((sum, s) => sum + (s.paidOffline || 0), 0);
    
    const taxPending = invoiceList.filter(inv => 
      inv.status !== 'cancelled' && !taxList?.some(t => t.invoiceNumber === inv.id)
    ).length;

    const overdueTotal = invoiceList
        .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && isBefore(parseISO(inv.dueDate), today))
        .reduce((sum, inv) => {
            const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
            return sum + (inv.amount - paid);
        }, 0);

    return { 
        outstanding: currentOutstanding, 
        realization: systemRealization + legacyPaid, 
        taxPending,
        overdueTotal
    };
  }, [salesList, taxList, invoiceList]);

  const agingData = useMemo(() => {
      if (!invoiceList) return { normal: 0, critical: 0, acute: 0 };
      const today = startOfToday();
      
      const unpaids = invoiceList.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
      
      let critical = 0; // 1-30 hari
      let acute = 0;    // > 30 hari

      unpaids.forEach(inv => {
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

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto bg-background animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">Dakota Intelligence</h1>
          <div className="text-slate-400 font-medium flex items-center gap-2 text-sm">
            Live Account Receivable Monitor.
            <Badge variant="secondary" className="bg-indigo-600/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest border-indigo-100">
                Data Hub Active
            </Badge>
          </div>
        </div>
        <DateRangePicker onRangeChange={setDateRange} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-xl shadow-slate-100 ring-1 ring-slate-200 bg-white overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Outstanding</CardTitle>
            <Wallet className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Total Tagihan Berjalan</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-emerald-50 ring-1 ring-slate-200 bg-white overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kas Diterima</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700">Rp {stats.realization.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Pelunasan Terverifikasi</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-rose-50 ring-1 ring-slate-200 bg-white overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-rose-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Overdue AR</CardTitle>
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-700">Rp {stats.overdueTotal.toLocaleString('id-ID')}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Piutang Jatuh Tempo</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-indigo-50 ring-1 ring-slate-200 bg-indigo-600 overflow-hidden rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-indigo-100 tracking-widest">Pajak Menunggu</CardTitle>
            <ReceiptText className="h-5 w-5 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{stats.taxPending} <span className="text-xs font-normal opacity-70">Dokumen</span></div>
            <p className="text-[10px] text-indigo-200 mt-1 font-bold uppercase">Sisa FP Belum Terbit</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7 mt-2">
        <Card className="lg:col-span-4 shadow-xl border-none ring-1 ring-slate-200 overflow-hidden rounded-3xl">
          <CardHeader className="border-b bg-slate-50/50 py-6">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-900">
                <BarChart3 className="h-5 w-5 text-indigo-600" /> Penagihan 7 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="h-[300px] w-full">
              <ChartContainer config={activityChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                    <ChartTooltip cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-xl border-none ring-1 ring-slate-200 rounded-3xl bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 py-6">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-900">
                    <Scale className="h-5 w-5 text-rose-500" /> Aging Report Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kritis (1 - 30 Hari)</p>
                            <p className="text-xl font-black text-amber-600">Rp {agingData.critical.toLocaleString('id-ID')}</p>
                        </div>
                        <AlertTriangle className="h-5 w-5 text-amber-500 mb-1" />
                    </div>
                    <Progress value={(agingData.critical / (stats.outstanding || 1)) * 100} className="h-2 bg-slate-100" />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Akut (> 30 Hari)</p>
                            <p className="text-xl font-black text-rose-700">Rp {agingData.acute.toLocaleString('id-ID')}</p>
                        </div>
                        <Scale className="h-5 w-5 text-rose-600 mb-1" />
                    </div>
                    <Progress value={(agingData.acute / (stats.outstanding || 1)) * 100} className="h-2 bg-slate-100" />
                </div>

                <div className="pt-6 border-t border-dashed">
                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl" onClick={() => router.push('/dashboard/sales-management')}>
                        Buka Buku Piutang <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mt-2">
         <Card className="bg-indigo-50/30 border-indigo-100 rounded-3xl shadow-sm border-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 tracking-widest">
                    <Truck className="h-4 w-4" /> Logistic Readiness
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-indigo-900">{invoiceList?.filter(inv => inv.status === 'sent' && !inv.spdNumber).length || 0} <span className="text-xs font-normal text-indigo-400">Ready to Ship</span></div>
                <p className="text-[10px] text-indigo-500 mt-2 font-medium italic">Invoice terbit menunggu kurir.</p>
            </CardContent>
         </Card>
         <Card className="bg-emerald-50/30 border-emerald-100 rounded-3xl shadow-sm border-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2 tracking-widest">
                    <CreditCard className="h-4 w-4" /> Verified Collection
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-emerald-900">{invoiceList?.filter(i => i.status === 'paid').length || 0} <span className="text-xs font-normal text-emerald-400">Paid Invoices</span></div>
                <p className="text-[10px] text-emerald-500 mt-2 font-medium italic">Data pembayaran tervalidasi.</p>
            </CardContent>
         </Card>
         <Card className="bg-slate-900 border-slate-800 rounded-3xl shadow-xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest">
                    <ReceiptText className="h-4 w-4 text-indigo-400" /> Digital Archive
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-white">{invoiceList?.length || 0} <span className="text-xs font-normal text-slate-500">Total Docs</span></div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium italic">Total dokumen terdaftar di sistem.</p>
            </CardContent>
         </Card>
      </div>
    </main>
  );
}
