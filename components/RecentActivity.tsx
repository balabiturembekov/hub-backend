'use client';

import { useStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { Play, Pause, Square, Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function RecentActivity() {
  const { activities, isLoading, currentUser } = useStore();
  
  // Security check: Only admins/owners/super_admins should see this component
  // Employees should not see activity at all
  if (!currentUser || 
      (currentUser.role !== 'admin' && 
       currentUser.role !== 'OWNER' && 
       currentUser.role !== 'SUPER_ADMIN')) {
    return null;
  }
  
  // Filter activities: admins/owners see all
  // Validate activities array before using
  const filteredActivities = (activities && Array.isArray(activities) ? activities : []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'start':
      case 'resume':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'pause':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'stop':
        return <Square className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getActivityText = (type: string) => {
    switch (type) {
      case 'start':
        return 'started tracking';
      case 'resume':
        return 'resumed tracking';
      case 'pause':
        return 'paused tracking';
      case 'stop':
        return 'stopped tracking';
      default:
        return type;
    }
  };

  // Show skeleton only if loading AND no data yet
  if (isLoading && filteredActivities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest activity across the team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest activity across the team</CardDescription>
      </CardHeader>
      <CardContent>
        {filteredActivities.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-12 w-12 mx-auto" />}
            title="No activity yet"
            description="Activity will appear here when team members start tracking time"
            className="py-8"
          />
        ) : (
          <div className="space-y-4">
            {filteredActivities
              .filter((activity) => activity.userName && activity.userName.trim() !== '') // Filter out activities with empty user names
              .slice(0, 10)
              .map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <UserAvatar 
                  name={activity.userName || 'Unknown User'}
                  avatar={activity.userAvatar}
                  size="sm"
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.userName || 'Unknown User'}</span>{' '}
                    {getActivityText(activity.type)}
                    {activity.projectId && (
                      <span className="text-muted-foreground">
                        {' '}
                        on a project
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      try {
                        const date = new Date(activity.timestamp);
                        if (isNaN(date.getTime())) return 'Invalid date';
                        return format(date, 'PPp');
                      } catch {
                        return 'Invalid date';
                      }
                    })()}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center cursor-help">
                      {getActivityIcon(activity.type)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {activity.type === 'start' 
                        ? 'Started tracking time' 
                        : activity.type === 'resume'
                        ? 'Resumed tracking time'
                        : activity.type === 'pause'
                        ? 'Paused tracking time'
                        : activity.type === 'stop'
                        ? 'Stopped tracking time'
                        : 'Activity'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}

