'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Clock, Users } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ActiveUsers() {
  const { users, activeTimeEntry, timeEntries, isLoading, currentUser } = useStore();
  // Initialize with 0 to avoid hydration mismatch, set in useEffect
  const [currentTime, setCurrentTime] = useState(0);
  
  // Initialize currentTime on mount to avoid hydration mismatch
  // IMPORTANT: All hooks MUST be called before any conditional returns
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (currentTime === 0) return; // Don't start interval until initialized
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime]);

  // Security check: Only admins/owners/super_admins should see this component
  // This is a defensive check in case the component is rendered somewhere without proper guards
  // IMPORTANT: This check must be AFTER all hooks
  if (!currentUser || 
      (currentUser.role !== 'admin' && 
       currentUser.role !== 'OWNER' && 
       currentUser.role !== 'SUPER_ADMIN')) {
    return null;
  }

  // Validate users and timeEntries arrays before filtering
  const activeUsers = (users && Array.isArray(users) ? users : [])
    .filter((user) => {
      const hasActiveEntry = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).some(
        (entry) => entry.userId === user.id && entry.status === 'running'
      );
      return hasActiveEntry;
    })
    .slice(0, 5);

  // Show skeleton only if loading AND no data yet
  // Validate users array before checking length
  if (isLoading && (!users || !Array.isArray(users) || users.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Users currently tracking time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Users currently tracking time</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Users className="h-10 w-10 mx-auto" />}
            title="No active users"
            description="Users will appear here when they start tracking time"
            className="py-6"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
        <CardTitle>Active Users</CardTitle>
        <CardDescription>Users currently tracking time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeUsers.map((user) => {
            const entry = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).find(
              (e) => e.userId === user.id && e.status === 'running'
            );
            if (!entry) return null;

            try {
              const elapsed = entry.duration || 0;
              const startDate = new Date(entry.startTime);
              if (isNaN(startDate.getTime())) return null;
              const start = startDate.getTime();
              const currentElapsed =
                Math.floor((currentTime - start) / 1000) + elapsed;
              
              if (currentElapsed < 0 || !isFinite(currentElapsed)) {
                return null;
              }

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      name={user.name || 'Unknown'}
                      avatar={user.avatar}
                      size="md"
                    />
                    <div>
                      <p className="text-sm font-medium">{user.name || 'Unknown'}</p>
                      {entry.projectName && (
                        <p className="text-xs text-muted-foreground">
                          {entry.projectName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {formatDuration(currentElapsed)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="default" className="ml-2 cursor-help">
                          Live
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Currently tracking time</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            } catch {
              return null;
            }
          })}
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}

