
'use client';

import { useState, useMemo } from 'react';
import { addDays, format, startOfToday, isSameDay, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { type Invoice, type Customer } from '@/app/lib/data';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const firestore = useFirestore();
  const { user } = useUser();

  const customersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'customers'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: customerListData } = useCollection<Customer>(customersCollection);
  
  const invoicesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'invoices'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: invoiceListData } = useCollection<Invoice>(invoicesCollection);

  const unpaidInvoices = useMemo(() => {
    if (!invoiceListData) return [];
    return invoiceListData.filter(invoice => invoice.status === 'unpaid' || invoice.status === 'sent');
  }, [invoiceListData]);

  const invoiceDueDates = useMemo(() => {
    return unpaidInvoices.map(invoice => ({
      ...invoice,
      dueDate: addDays(new Date(invoice.date), 30), // Assuming 30 days due date
    }));
  }, [unpaidInvoices]);

  const upcomingDueDates = useMemo(() => {
    const today = startOfToday();
    const nextSevenDays = addDays(today, 7);
    return invoiceDueDates
      .filter(invoice => 
        isWithinInterval(invoice.dueDate, { start: today, end: nextSevenDays })
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [invoiceDueDates]);

  const selectedDayInvoices = useMemo(() => {
    if (!date) return [];
    return invoiceDueDates.filter(invoice => isSameDay(invoice.dueDate, date));
  }, [date, invoiceDueDates]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing Calendar</h1>
        <p className="text-muted-foreground">
          Track upcoming and overdue invoice payments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              modifiers={{
                due: invoiceDueDates.map(i => i.dueDate),
              }}
              modifiersStyles={{
                due: {
                  color: 'hsl(var(--destructive-foreground))',
                  backgroundColor: 'hsl(var(--destructive))'
                },
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Due in Next 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDueDates.length > 0 ? (
              <div className="space-y-4">
                {upcomingDueDates.map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-semibold">{invoice.customer}</p>
                      <p className="text-sm text-muted-foreground">{invoice.id}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold">Rp {invoice.amount.toLocaleString('id-ID')}</p>
                       <p className="text-xs text-destructive">{format(invoice.dueDate, 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices due soon.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Invoices Due on {date ? format(date, 'PPP') : 'Selected Date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDayInvoices.length > 0 ? (
            <ul className="space-y-2">
              {selectedDayInvoices.map(invoice => (
                <li key={invoice.id} className="flex justify-between items-center">
                  <span>{invoice.customer} ({invoice.id})</span>
                  <Badge variant="destructive">Rp {invoice.amount.toLocaleString('id-ID')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices due on this date.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

    