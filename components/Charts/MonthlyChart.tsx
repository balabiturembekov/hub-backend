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
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { formatHours } from '@/lib/utils';

export function MonthlyChart() {
  const { timeEntries, currentUser, isLoading } = useStore();

  // Get all days of current month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const monthlyData = daysInMonth.map((date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Filter entries for this day
    // Validate timeEntries array before filtering
    let entriesInDay = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).filter((entry) => {
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

    // Calculate total hours
    const totalHours = entriesInDay.reduce((acc, entry) => {
      const duration = entry.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration < 0) {
        return acc;
      }
      return acc + duration / 3600;
    }, 0);

    return {
      date: format(date, 'MMM dd'),
      day: format(date, 'EEE'),
      dayNumber: format(date, 'd'),
      hours: Number(totalHours.toFixed(2)),
    };
  });

  // Show skeleton only if loading AND no data yet
  // Validate timeEntries array before checking length
  if (isLoading && (!timeEntries || !Array.isArray(timeEntries) || timeEntries.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Hours</CardTitle>
          <CardDescription>
            Total hours worked per day in {format(now, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Hours</CardTitle>
        <CardDescription>
          Total hours worked per day in {format(now, 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="dayNumber" 
              tick={{ fontSize: 12 }}
              interval={Math.floor(daysInMonth.length / 15)} // Show approximately 15 labels
            />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [`${formatHours((value as number) * 3600)}`, 'Hours']}
              labelFormatter={(label) => {
                const dataPoint = monthlyData.find(d => d.dayNumber === label);
                return dataPoint ? `${dataPoint.day}, ${dataPoint.date}` : label;
              }}
            />
            <Legend />
            <Bar dataKey="hours" fill="#10b981" name="Hours" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

