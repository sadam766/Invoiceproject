
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Sale } from '@/app/lib/data';

const statusVariant = {
  Paid: 'default',
  Unpaid: 'destructive',
} as const;

export default function RecentSales({ sales }: { sales: Sale[] }) {
  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.invoiceId}>
              <TableCell className="font-medium">{sale.invoiceId}</TableCell>
              <TableCell>{sale.customer}</TableCell>
              <TableCell>{sale.date}</TableCell>
              <TableCell className="text-right">
                Rp {sale.amount.toLocaleString('id-ID')}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={statusVariant[sale.status]} className="capitalize">
                  {sale.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
