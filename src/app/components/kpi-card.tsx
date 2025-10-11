import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  change: string;
};

export default function KpiCard({
  title,
  value,
  icon: Icon,
  change,
}: KpiCardProps) {
  const isNegative = change.startsWith('-');
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p
          className={cn(
            'text-xs text-muted-foreground',
            isNegative ? 'text-red-600' : 'text-emerald-600'
          )}
        >
          {change} from last month
        </p>
      </CardContent>
    </Card>
  );
}
