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
  AlertCircle, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Clock,
  ArrowUpRight,
  User,
  MoreVertical,
  CheckCircle2
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
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { type SalesListItem, type Invoice, type TaxInvoice, type UserProfile } from '@/app/lib/data';
import { format, isSameDay, parseISO } from 'date-fns';

const performanceChartConfig = {
  value: {
    label: "Total Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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

  // LOGIC: Calculations
  const stats = useMemo(() => {
    if (!invoiceList || !salesList) return { outstanding: 0, realization: 0, target: 0, taxPending: 0 };
    
    const outstanding = invoiceList
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const realization = invoiceList
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const target = salesList.reduce((sum, s) => sum + s.amount, 0);
    
    const taxPending = invoiceList.filter(inv => 
      !taxList?.some(t => t.invoiceNumber === inv.id)
    ).length;

    return { outstanding, realization, target, taxPending };
  }, [invoiceList, salesList, taxList]);

  const salesPerformanceData = useMemo(() => {
    if (!salesList) return [];
    const perfMap: Record<string, number> = {};
    salesList.forEach(s => {
      perfMap[s.sales] = (perfMap[s.sales] || 0) + s.amount;
    });
    return Object.entries(perfMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [salesList]);

  const topPending = useMemo(() => {
    if (!invoiceList) return [];
    return [...invoiceList]
      .filter(i => i.status !== 'paid')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [invoiceList]);

  const pipeline = useMemo(() => {
    if (!invoiceList) return { proforma: 0, official: 0, tax: 0 };
    return {
      proforma: invoiceList.filter(i => i.id.startsWith('KW')).length,
      official: invoiceList.filter(i => i.id.startsWith('SAR')).length,
      tax: taxList?.length || 0
    };
  }, [invoiceList, taxList]);

  const dayEvents = useMemo(() => {
    if (!invoiceList || !selectedDate) return [];
    return invoiceList.filter(inv => {
        const d = inv.dueDate ? parseISO(inv.dueDate) : null;
        return d && isSameDay(d, selectedDate);
    });
  }, [invoiceList, selectedDate]);

  const progressPercent = stats.target > 0 ? (stats.realization / stats.target) * 100 : 0;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto">
      {/* Header: Global Filter & Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dakota Command Center</h1>
          <p className="text-muted-foreground">Monitor real-time Dakota Sales, Invoicing, and Taxation.</p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background px-3 py-1 text-xs">
                Data Updated: {new Date().toLocaleTimeString()}
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
                <TrendingUp className="mr-2 h-4 w-4" /> Global Overview
            </Button>
        </div>
      </div>

      {/* Row 1: Financial Health Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:bg-muted/10 transition-colors border-l-4 border-l-red-500" onClick={() => router.push('/dashboard/invoices')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Piutang (Outstanding)</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {stats.outstanding.toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" /> Segera lakukan penagihan
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/10 transition-colors border-l-4 border-l-blue-500" onClick={() => router.push('/dashboard/sales-management')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Target vs Realisasi</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">Rp {stats.realization.toLocaleString('id-ID')}</div>
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                    <span>PROGRESS: {progressPercent.toFixed(1)}%</span>
                    <span>TARGET: Rp {stats.target.toLocaleString('id-ID')}</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/10 transition-colors border-l-4 border-l-teal-500" onClick={() => router.push('/dashboard/invoices/tax')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pajak Menunggu Lapor</CardTitle>
            <ReceiptText className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxPending} Invoice</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> Klik untuk proses e-Faktur
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Pipeline & Mini Calendar */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-bold">Billing Pipeline Progres</CardTitle>
            <CardDescription>Alur dokumen dari penagihan awal hingga perpajakan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex justify-between items-center py-6 px-4">
                {/* Connector Lines */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0" />
                
                {/* Step 1: Proforma */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="bg-primary text-white p-3 rounded-full shadow-lg">
                        <Clock className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase">Proforma (KW)</span>
                    <Badge variant="secondary" className="font-mono">{pipeline.proforma}</Badge>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg">
                        <ArrowUpRight className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase">Official (SAR)</span>
                    <Badge variant="secondary" className="font-mono">{pipeline.official}</Badge>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="bg-teal-600 text-white p-3 rounded-full shadow-lg">
                        <ReceiptText className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase">Faktur Pajak</span>
                    <Badge variant="secondary" className="font-mono">{pipeline.tax}</Badge>
                </div>
            </div>

            <div className="mt-6 border-t pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Tindakan Cepat:</h4>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => router.push('/dashboard/invoices/add')}>
                        Tarik Faktur Baru
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => router.push('/dashboard/invoices/tax')}>
                        Input Seri Pajak
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
            <CardHeader className="pb-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" /> Penjadwalan Billing
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row h-full">
                    <div className="p-4 border-r">
                        <Calendar 
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md"
                        />
                    </div>
                    <div className="flex-1 p-4 bg-muted/5">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                            Jadwal: {selectedDate ? format(selectedDate, 'dd MMM') : 'Hari Ini'}
                        </h4>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                            {dayEvents.length > 0 ? dayEvents.map(ev => (
                                <div key={ev.id} className="p-2 border rounded bg-background text-[10px] shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/dashboard/invoices')}>
                                    <div className="flex justify-between font-bold">
                                        <span className="truncate max-w-[80px]">{ev.customer}</span>
                                        <span>Rp {ev.amount.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="text-muted-foreground mt-1">{ev.id}</div>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-30">
                                    <Clock className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-[10px]">Tidak ada jadwal</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Row 3: Pending Payments & Performance */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-base font-bold text-red-600 uppercase flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Top 5 Pending Payments
                </CardTitle>
                <CardDescription>Daftar customer dengan tunggakan terbesar saat ini.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/sales-management')}>View All</Button>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>CUSTOMER</TableHead>
                        <TableHead>DUE DATE</TableHead>
                        <TableHead className="text-right">AMOUNT</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {topPending.map((inv) => (
                        <TableRow key={inv.id}>
                            <TableCell className="font-bold py-3">
                                {inv.customer}
                                <p className="text-[10px] font-normal text-muted-foreground">{inv.id}</p>
                            </TableCell>
                            <TableCell className="text-xs">
                                {inv.dueDate ? format(parseISO(inv.dueDate), 'dd/MM/yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-right font-black text-red-600 text-xs">
                                Rp {inv.amount.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push('/dashboard/invoices')}>
                                    <ArrowRight className="h-3 w-3" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {topPending.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 opacity-40 italic">Semua tagihan terbayar lunas.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle className="text-base font-bold">Kontribusi Sales</CardTitle>
                <CardDescription>Berdasarkan total nilai PO yang didaftarkan.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ChartContainer config={performanceChartConfig}>
                        <BarChart data={salesPerformanceData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                width={80}
                                style={{ fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {salesPerformanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - (index * 0.15)})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </div>
                <div className="mt-4 space-y-2">
                    {salesPerformanceData.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="font-bold">{s.name}</span>
                            </div>
                            <span className="text-muted-foreground">Rp {s.value.toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
