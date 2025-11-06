'use client';

import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Users, Folder, TrendingUp } from 'lucide-react';
import { formatDurationFull } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DashboardStats() {
  const { stats, isLoading, timeEntries, currentUser } = useStore();
  // Initialize with 0 to avoid hydration mismatch, set in useEffect
  const [currentTime, setCurrentTime] = useState(0);
  
  // Check if user is admin/owner (employees shouldn't see active users count)
  const isAdminOrOwner = currentUser?.role === 'admin' || 
                         currentUser?.role === 'OWNER' || 
                         currentUser?.role === 'SUPER_ADMIN';

  // Initialize currentTime on mount to avoid hydration mismatch
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Update current time every second for real-time calculations
  useEffect(() => {
    if (currentTime === 0) return; // Don't start interval until initialized
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTime]);

  // Calculate real-time total hours including active timers
  const realTimeStats = useMemo(() => {
    if (!timeEntries || timeEntries.length === 0) {
      return stats;
    }

    // Calculate total seconds including active timers
    const totalSeconds = timeEntries.reduce((acc, entry) => {
      let entrySeconds = 0;
      
      if (entry.status === 'stopped') {
        // For stopped entries, use stored duration
        entrySeconds = entry.duration || 0;
      } else if (entry.status === 'running') {
        // For running entries, calculate current elapsed time
        try {
          const startDate = new Date(entry.startTime);
          if (!isNaN(startDate.getTime())) {
            const start = startDate.getTime();
            const elapsed = Math.floor((currentTime - start) / 1000);
            // Add stored duration (from previous pause cycles) + current session time
            entrySeconds = (entry.duration || 0) + Math.max(0, elapsed);
          } else {
            entrySeconds = entry.duration || 0;
          }
        } catch {
          entrySeconds = entry.duration || 0;
        }
      } else if (entry.status === 'paused') {
        // For paused entries, use stored duration
        entrySeconds = entry.duration || 0;
      }

      // Validate and add to total
      if (isFinite(entrySeconds) && !isNaN(entrySeconds) && entrySeconds >= 0) {
        return acc + entrySeconds;
      }
      return acc;
    }, 0);

    // Calculate today hours including active timers
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySeconds = timeEntries.reduce((acc, entry) => {
      try {
        const entryDate = new Date(entry.startTime);
        if (isNaN(entryDate.getTime()) || entryDate < today) {
          return acc;
        }

        let entrySeconds = 0;
        if (entry.status === 'stopped') {
          entrySeconds = entry.duration || 0;
        } else if (entry.status === 'running') {
          const start = entryDate.getTime();
          const elapsed = Math.floor((currentTime - start) / 1000);
          entrySeconds = (entry.duration || 0) + Math.max(0, elapsed);
        } else if (entry.status === 'paused') {
          entrySeconds = entry.duration || 0;
        }

        if (isFinite(entrySeconds) && !isNaN(entrySeconds) && entrySeconds >= 0) {
          return acc + entrySeconds;
        }
      } catch {
        // Skip invalid entries
      }
      return acc;
    }, 0);

    const totalHours = totalSeconds / 3600;
    const todayHours = todaySeconds / 3600;

    return {
      ...stats,
      totalHours: isFinite(totalHours) && !isNaN(totalHours) && totalHours >= 0 ? totalHours : stats.totalHours,
      todayHours: isFinite(todayHours) && !isNaN(todayHours) && todayHours >= 0 ? todayHours : stats.todayHours,
    };
  }, [stats, timeEntries, currentTime]);

  const statCards = [
    {
      title: 'Total Hours',
      value: formatDurationFull(
        isFinite(realTimeStats.totalHours) && !isNaN(realTimeStats.totalHours) && realTimeStats.totalHours >= 0
          ? realTimeStats.totalHours
          : 0
      ),
      icon: Clock,
      description: 'All time tracked',
    },
    // Only show Active Users card for admins/owners
    ...(isAdminOrOwner ? [{
      title: 'Active Users',
      value: (
        isFinite(realTimeStats.activeUsers) && !isNaN(realTimeStats.activeUsers) && realTimeStats.activeUsers >= 0
          ? realTimeStats.activeUsers
          : 0
      ).toString(),
      icon: Users,
      description: 'Currently tracking',
    }] : []),
    {
      title: 'Projects',
      value: (
        isFinite(realTimeStats.totalProjects) && !isNaN(realTimeStats.totalProjects) && realTimeStats.totalProjects >= 0
          ? realTimeStats.totalProjects
          : 0
      ).toString(),
      icon: Folder,
      description: 'Active projects',
    },
    {
      title: 'Today',
      value: formatDurationFull(
        isFinite(realTimeStats.todayHours) && !isNaN(realTimeStats.todayHours) && realTimeStats.todayHours >= 0
          ? realTimeStats.todayHours
          : 0
      ),
      icon: TrendingUp,
      description: 'Hours today',
    },
  ];

  // Show skeleton only if loading AND no data yet
  if (isLoading && stats.totalHours === 0 && stats.activeUsers === 0 && stats.totalProjects === 0 && stats.todayHours === 0) {
    // Show 3 cards for employees, 4 for admins/owners
    const skeletonCount = isAdminOrOwner ? 4 : 3;
    return (
      <div className={`grid gap-4 md:grid-cols-2 ${isAdminOrOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`grid gap-4 md:grid-cols-2 ${isAdminOrOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stat.description || stat.title}</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

