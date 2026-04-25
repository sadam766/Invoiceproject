
'use client';

import * as React from 'react';
import { format, subDays, startOfMonth, endOfMonth, isToday, isYesterday, startOfToday } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DateRangePickerProps {
  className?: string;
  onRangeChange: (range: { from: Date; to: Date }) => void;
}

export function DateRangePicker({
  className,
  onRangeChange,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfToday(),
    to: startOfToday(),
  });

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      onRangeChange({ from: range.from, to: range.to });
    }
  };

  const setPreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    const today = startOfToday();
    let from = today;
    let to = today;

    switch (preset) {
      case 'yesterday':
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case 'last7':
        from = subDays(today, 6);
        to = today;
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
    }

    const newRange = { from, to };
    setDate(newRange);
    onRangeChange(newRange);
  };

  const getLabel = () => {
    if (!date?.from) return 'Pilih Tanggal';
    if (isToday(date.from) && isToday(date.to || date.from)) return 'Hari Ini';
    if (isYesterday(date.from) && isYesterday(date.to || date.from)) return 'Kemarin';
    
    if (date.to) {
      return (
        <>
          {format(date.from, 'dd MMM')} - {format(date.to, 'dd MMM yyyy')}
        </>
      );
    }
    return format(date.from, 'dd MMM yyyy');
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-3 font-bold text-[11px] uppercase tracking-wider bg-background">
              Presets <ChevronDown className="ml-2 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setPreset('today')}>Hari Ini</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreset('yesterday')}>Kemarin</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreset('last7')}>7 Hari Terakhir</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreset('thisMonth')}>Bulan Ini</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              size="sm"
              className={cn(
                'h-9 justify-start text-left font-bold text-[11px] uppercase tracking-wider min-w-[220px] bg-background',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
              {getLabel()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
