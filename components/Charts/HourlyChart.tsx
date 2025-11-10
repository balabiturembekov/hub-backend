'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export function HourlyChart() {
  const { timeEntries, isLoading, currentUser } = useStore();
  // Initialize with 0 to avoid hydration mismatch, set in useEffect
  const [currentTime, setCurrentTime] = useState(0);

  // Initialize currentTime on mount to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  // Group entries by hour for the last 24 hours
  const last24Hours = useMemo(() => {
    const hour = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const h = new Date(hour);
      h.setHours(h.getHours() - (23 - i), 0, 0, 0);
      return h;
    });
  }, []);

  const hourlyData = useMemo(() => {
    if (currentTime === 0) {
      // Return empty data until currentTime is initialized to avoid hydration mismatch
      return last24Hours.map((hour) => ({
        time: format(hour, 'HH:mm'),
        hours: 0,
      }));
    }

    return last24Hours.map((hour) => {
      const hourStart = hour.getTime();
      const hourEnd = hourStart + 3600000;
      
      // Validate timeEntries array before filtering
      let entriesInHour = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).filter((entry) => {
        try {
          const entryStartDate = new Date(entry.startTime);
          if (isNaN(entryStartDate.getTime())) return false;
          const entryStart = entryStartDate.getTime();
          const entryEnd = entry.endTime ? (() => {
            const endDate = new Date(entry.endTime);
            return isNaN(endDate.getTime()) ? currentTime : endDate.getTime();
          })() : currentTime;
        
        if (entry.status === 'running') {
          return entryStart < hourEnd && entryEnd >= hourStart;
        }
        return entryStart < hourEnd && entryEnd > hourStart;
      } catch {
        return false;
      }
    });

    // If not admin/owner/super_admin, filter by current user
    if (currentUser?.role !== 'admin' && 
        currentUser?.role !== 'OWNER' && 
        currentUser?.role !== 'SUPER_ADMIN') {
      entriesInHour = entriesInHour.filter((entry) => entry.userId === currentUser?.id);
    }

      const totalHours = entriesInHour.reduce((acc, entry) => {
        try {
          const entryStartDate = new Date(entry.startTime);
          if (isNaN(entryStartDate.getTime())) return acc;
          const entryStart = entryStartDate.getTime();
          const entryEnd = entry.endTime ? (() => {
            const endDate = new Date(entry.endTime);
            return isNaN(endDate.getTime()) ? currentTime : endDate.getTime();
          })() : currentTime;
          
          const overlapStart = Math.max(entryStart, hourStart);
          const overlapEnd = Math.min(entryEnd, hourEnd);
          const overlapHours = Math.max(0, (overlapEnd - overlapStart) / 3600000);
          
          return acc + overlapHours;
        } catch {
          return acc;
        }
      }, 0);

      return {
        time: format(hour, 'HH:mm'),
        hours: Number(totalHours.toFixed(2)),
      };
    });
  }, [last24Hours, timeEntries, currentUser?.role, currentUser?.id, currentTime]);

  // Show skeleton only if loading AND no data yet
  // Validate timeEntries array before checking length
  if (isLoading && (!timeEntries || !Array.isArray(timeEntries) || timeEntries.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hours by Time of Day</CardTitle>
          <CardDescription>Last 24 hours of activity</CardDescription>
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
        <CardTitle>Hours by Time of Day</CardTitle>
        <CardDescription>Last 24 hours of activity</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="hours"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Hours"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

