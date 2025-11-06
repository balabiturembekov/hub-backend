'use client';

import { useStore } from '@/lib/store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { formatHours } from '@/lib/utils';

export function DailyChart() {
  const { timeEntries, isLoading, currentUser } = useStore();

  // Get last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    return subDays(new Date(), 6 - i);
  });

  const dailyData = last7Days.map((date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    let entriesInDay = timeEntries.filter((entry) => {
      try {
        const entryDate = new Date(entry.startTime);
        if (isNaN(entryDate.getTime())) return false;
        return entryDate >= dayStart && entryDate <= dayEnd && entry.status === 'stopped';
      } catch {
        return false;
      }
    });

    // If not admin/owner/super_admin, filter by current user
    if (currentUser?.role !== 'admin' && 
        currentUser?.role !== 'OWNER' && 
        currentUser?.role !== 'SUPER_ADMIN') {
      entriesInDay = entriesInDay.filter((entry) => entry.userId === currentUser?.id);
    }

    const totalHours = entriesInDay.reduce((acc, entry) => {
      const duration = entry.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration < 0) {
        return acc;
      }
      return acc + duration / 3600;
    }, 0);

    return {
      date: format(date, 'EEE'),
      fullDate: format(date, 'MMM dd'),
      hours: Number(totalHours.toFixed(2)),
    };
  });

  // Show skeleton only if loading AND no data yet
  if (isLoading && timeEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Hours</CardTitle>
          <CardDescription>Hours tracked over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Hours</CardTitle>
        <CardDescription>Hours tracked over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => [`${formatHours((value as number) * 3600)}h`, 'Hours']}
              labelFormatter={(label) => dailyData.find(d => d.date === label)?.fullDate || label}
            />
            <Legend />
            <Bar dataKey="hours" fill="#3b82f6" name="Hours" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

