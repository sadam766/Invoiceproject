
'use client';

import { useState, useMemo } from 'react';
import { addDays, format, startOfToday, isSameDay, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { type Invoice, type Customer, type TaxInvoice } from '@/app/lib/data';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ReceiptText,
  Eye,
  MessageSquareShare,
  ArrowRight
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function CalendarPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const firestore = useFirestore();

  // Fetch Collections
  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: invoiceListData } = useCollection<Invoice>(invoicesCollection);

  const taxInvoicesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'taxInvoices'));
  }, [firestore]);
  const { data: taxListData } = useCollection<TaxInvoice>(taxInvoicesCollection);

  // LOGIC: Event Processing
  const events = useMemo(() => {
    if (!invoiceListData) return [];

    const today = startOfToday();

    return invoiceListData.map(inv => {
      const invDate = inv.dueDate ? parseISO(inv.dueDate) : addDays(parseISO(inv.date), 30);
      const isPaid = inv.status === 'paid';
      const isOverdue = !isPaid && invDate < today;
      const isDueSoon = !isPaid && !isOverdue && isWithinInterval(invDate, { start: today, end: addDays(today, 7) });

      let type: 'overdue' | 'paid' | 'pending' | 'tax' | 'proforma-alert' = 'pending';
      if (isPaid) type = 'paid';
      else if (isOverdue) type = 'overdue';
      else if (isDueSoon) type = 'pending';

      // Special Alert: Proforma Aging (KW/ older than 7 days)
      const isProforma = inv.id.startsWith('KW');
      const issueDate = parseISO(inv.date);
      const agingDays = differenceInDays(today, issueDate);
      if (isProforma && !isPaid && agingDays > 7) {
          type = 'proforma-alert';
      }

      return { ...inv, eventDate: invDate, eventType: type, agingDays };
    });
  }, [invoiceListData]);

  // Tax Reminders
  const taxEvents = useMemo(() => {
    if (!taxListData) return [];
    return taxListData.map(tax => ({
      ...tax,
      eventDate: parseISO(tax.taxInvoiceDate),
      eventType: 'tax' as const
    }));
  }, [taxListData]);

  // Combine All Events
  const allEvents = useMemo(() => [...events, ...taxEvents], [events, taxEvents]);

  // Summaries
  const upcomingDueDates = useMemo(() => {
    return events
      .filter(e => e.eventType === 'pending' || e.eventType === 'overdue')
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
      .slice(0, 5);
  }, [events]);

  const selectedDayInvoices = useMemo(() => {
    if (!date) return [];
    return allEvents.filter(e => isSameDay(e.eventDate, date));
  }, [date, allEvents]);

  const handleQuickAction = (invoice: any) => {
    if (invoice.id) {
       router.push(`/dashboard/invoices`);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Tax Calendar</h1>
          <p className="text-muted-foreground">
            Pantau arus kas, jatuh tempo invoice, dan batas waktu perpajakan.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-muted">
          <CardContent className="pt-6">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border p-4 w-full"
              modifiers={{
                due: events.filter(e => e.eventType === 'pending').map(e => e.eventDate),
                overdue: events.filter(e => e.eventType === 'overdue').map(e => e.eventDate),
                paid: events.filter(e => e.eventType === 'paid').map(e => e.eventDate),
                tax: taxEvents.map(e => e.eventDate),
                alert: events.filter(e => e.eventType === 'proforma-alert').map(e => e.eventDate),
              }}
              modifiersStyles={{
                due: { border: '2px solid hsl(var(--warning))', borderRadius: '50%' },
                overdue: { backgroundColor: 'hsl(var(--destructive))', color: 'white', borderRadius: '50%' },
                paid: { backgroundColor: 'hsl(var(--primary))', color: 'white', opacity: 0.5, borderRadius: '50%' },
                tax: { border: '2px solid #3b82f6', borderRadius: '50%' },
                alert: { border: '2px dashed #f59e0b', fontWeight: 'bold' }
              }}
            />
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground justify-center border-t pt-4">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Overdue</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border-2 border-yellow-500" /> Akan Datang</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary/50" /> Lunas</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border-2 border-blue-500" /> Faktur Pajak</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 border-2 border-dashed border-orange-500" /> Aging Proforma</div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Due in Next 7 Days</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingDueDates.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDueDates.map(inv => (
                    <div key={inv.id} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      inv.eventType === 'overdue' ? "bg-red-50/50 border-red-100" : "bg-muted/30 border-transparent"
                    )}>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-bold truncate max-w-[150px]">{inv.customer}</p>
                        <p className="text-[10px] text-muted-foreground">{inv.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black">Rp {inv.amount.toLocaleString('id-ID')}</p>
                        <p className={cn("text-[9px] font-bold", inv.eventType === 'overdue' ? "text-destructive" : "text-orange-500")}>
                           {inv.eventType === 'overdue' ? 'OVERDUE' : format(inv.eventDate, 'dd MMM')}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-7" asChild>
                     <a href="/dashboard/invoices">View All Invoices <ArrowRight className="ml-1 h-3 w-3" /></a>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-10 space-y-2 opacity-40">
                  <CheckCircle2 className="h-8 w-8 mx-auto" />
                  <p className="text-xs">Tidak ada tagihan mendesak.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-100 bg-orange-50/20">
             <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-orange-700">
                    <AlertCircle className="h-4 w-4" />
                    <CardTitle className="text-xs font-bold uppercase">Pending Task: Proforma Aging</CardTitle>
                </div>
             </CardHeader>
             <CardContent>
                {events.filter(e => e.eventType === 'proforma-alert').length > 0 ? (
                    <div className="space-y-2">
                        {events.filter(e => e.eventType === 'proforma-alert').map(p => (
                            <div key={p.id} className="text-[10px] flex justify-between items-center bg-white p-2 rounded border border-orange-100 shadow-sm">
                                <span>{p.id} ({p.agingDays} Hari)</span>
                                <Button variant="link" size="sm" className="h-auto p-0 text-orange-600 font-bold" onClick={() => router.push('/dashboard/invoices/add')}>Tarik Faktur</Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-muted-foreground italic">Semua Proforma Invoice terpantau aman.</p>
                )}
             </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                    Jadwal untuk {date ? format(date, 'PPP') : 'Hari Ini'}
                </CardTitle>
            </div>
            <Badge variant="outline">{selectedDayInvoices.length} Kejadian</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {selectedDayInvoices.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDayInvoices.map(event => (
                <div key={(event as any).id || (event as any).taxInvoiceNumber} className="group relative p-4 rounded-xl border bg-card hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {event.eventType === 'tax' ? (
                            <ReceiptText className="h-4 w-4 text-blue-600" />
                        ) : event.eventType === 'paid' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                            <Clock className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                            {event.eventType === 'tax' ? 'Faktur Pajak' : 'Penagihan'}
                        </span>
                    </div>
                    <Badge variant={event.eventType === 'paid' ? 'outline' : event.eventType === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                        {(event as any).status || 'Jadwal'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    <h4 className="font-bold text-sm">{(event as any).customer || (event as any).buyerName}</h4>
                    <p className="text-xs text-muted-foreground">ID: {(event as any).id || (event as any).taxInvoiceNumber}</p>
                    <p className="text-xs font-medium">Rp {((event as any).amount || 0).toLocaleString('id-ID')}</p>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-dashed">
                     <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => handleQuickAction(event)}>
                        <Eye className="h-3 w-3 mr-1" /> View Detail
                     </Button>
                     {event.eventType !== 'paid' && event.eventType !== 'tax' && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] flex-1 text-primary hover:bg-primary/5">
                            <MessageSquareShare className="h-3 w-3 mr-1" /> Reminder
                        </Button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
              <CalendarDays className="h-10 w-10 mb-2" />
              <p className="text-sm">Tidak ada jadwal jatuh tempo atau pelaporan pada tanggal ini.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
