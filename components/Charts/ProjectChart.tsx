'use client';

import { useStore } from '@/lib/store';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatHours } from '@/lib/utils';
import { ChartPie } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ProjectChart() {
  const { timeEntries, projects, isLoading, currentUser } = useStore();

  // Filter time entries by user if not admin/owner/super_admin
  let filteredEntries = timeEntries.filter((e) => e.status === 'stopped');
  if (currentUser?.role !== 'admin' && 
      currentUser?.role !== 'OWNER' && 
      currentUser?.role !== 'SUPER_ADMIN') {
    filteredEntries = filteredEntries.filter((e) => e.userId === currentUser?.id);
  }

  const projectHours = projects
    .filter((p) => p.status === 'active')
    .map((project) => {
      const entries = filteredEntries.filter((e) => e.projectId === project.id);
      const totalSeconds = entries.reduce((acc, entry) => {
        const duration = entry.duration || 0;
        if (!isFinite(duration) || isNaN(duration) || duration < 0) {
          return acc;
        }
        return acc + duration;
      }, 0);
      
      const hours = totalSeconds / 3600;
      if (!isFinite(hours) || isNaN(hours)) {
        return null;
      }
      
      return {
        name: project.name,
        hours: Number(hours.toFixed(2)),
        color: project.color,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  // Show skeleton only if loading AND no data yet
  if (isLoading && (projects.length === 0 || timeEntries.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time by Project</CardTitle>
          <CardDescription>Distribution of hours across projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (projectHours.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time by Project</CardTitle>
          <CardDescription>Distribution of hours across projects</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ChartPie className="h-12 w-12 mx-auto" />}
            title="No project data"
            description="Track time on projects to see the distribution here"
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time by Project</CardTitle>
        <CardDescription>Distribution of hours across projects</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={projectHours}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => {
                const name = entry.name || '';
                const hours = entry.hours || 0;
                return `${name}: ${formatHours(hours * 3600)}h`;
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="hours"
            >
              {projectHours.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${formatHours(value * 3600)}h`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

