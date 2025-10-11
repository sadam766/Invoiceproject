
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
          )}
        >
          <span className={cn(isNegative ? 'text-red-500' : 'text-green-500')}>
            {change.split(' ')[0]}
          </span>{' '}
          vs last month
        </p>
      </CardContent>
    </Card>
  );
}
