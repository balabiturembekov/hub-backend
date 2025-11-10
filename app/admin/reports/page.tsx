'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ProjectChart } from '@/components/Charts/ProjectChart';
import { DailyChart } from '@/components/Charts/DailyChart';
import { HourlyChart } from '@/components/Charts/HourlyChart';
import { MonthlyChart } from '@/components/Charts/MonthlyChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  Clock, 
  FileText,
  TrendingUp,
  Users,
  Award,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { ExportDialog } from '@/components/admin/ExportDialog';
import { formatDurationFull } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { Project } from '@/types';

export default function ReportsPage() {
  const router = useRouter();
  const { users, projects, timeEntries, loadUsers, loadProjects, loadTimeEntries, currentUser, initializeAuth } = useStore();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [period, setPeriod] = useState<'7days' | '30days' | '90days' | 'year'>('7days');
  const [isInitializing, setIsInitializing] = useState(true);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    // End date is today at end of day
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Start date calculation
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    switch (period) {
      case '7days':
        // Last 7 days including today
        start.setDate(start.getDate() - 6);
        break;
      case '30days':
        // Last 30 days including today
        start.setDate(start.getDate() - 29);
        break;
      case '90days':
        // Last 90 days including today
        start.setDate(start.getDate() - 89);
        break;
      case 'year':
        // Last year from today
        start.setFullYear(start.getFullYear() - 1);
        start.setMonth(now.getMonth());
        start.setDate(now.getDate());
        break;
    }

    return { start, end };
  }, [period]);

  // Filter time entries by date range and user
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries || !Array.isArray(timeEntries) || timeEntries.length === 0) {
      return [];
    }
    
    let filtered = timeEntries.filter((entry) => {
      // Only include stopped entries (completed entries)
      if (entry.status !== 'stopped') {
        return false;
      }
      
      // Must have valid duration > 0
      const duration = entry.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        return false;
      }
      
      try {
        const entryDate = new Date(entry.startTime);
        if (isNaN(entryDate.getTime())) {
          return false;
        }
        
        // Compare dates (ignore time for date comparison)
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
        const startDateOnly = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
        const endDateOnly = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate());
        
        return entryDateOnly >= startDateOnly && entryDateOnly <= endDateOnly;
      } catch {
        return false;
      }
    });
    
    // If not admin/owner, filter by current user
    if (currentUser && 
        currentUser.role !== 'admin' && 
        currentUser.role !== 'OWNER' && 
        currentUser.role !== 'SUPER_ADMIN') {
      filtered = filtered.filter((entry) => entry.userId === currentUser?.id);
    }
    
    return filtered;
  }, [timeEntries, dateRange, currentUser]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalHours = filteredTimeEntries.reduce((acc, e) => {
      const duration = e.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        return acc;
      }
      return acc + duration / 3600;
    }, 0);

    const totalEntries = filteredTimeEntries.length;
    
    // Calculate days in period
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const avgHoursPerDay = daysDiff > 0 ? totalHours / daysDiff : 0;

    // Get unique users
    const uniqueUsers = new Set(filteredTimeEntries.map(e => e.userId));
    const activeUsers = uniqueUsers.size;

    // Get top project
    const projectHoursMap = new Map<string, number>();
    filteredTimeEntries.forEach((entry) => {
      const projectId = entry.projectId || 'no-project';
      const duration = entry.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        return;
      }
      const hours = duration / 3600;
      if (!isFinite(hours) || hours <= 0) {
        return;
      }
      projectHoursMap.set(projectId, (projectHoursMap.get(projectId) || 0) + hours);
    });

    let topProject: { name: string; hours: number } | null = null;
    if (projectHoursMap.size > 0) {
      const sortedProjects = Array.from(projectHoursMap.entries())
        .sort((a, b) => b[1] - a[1]);
      const topProjectId = sortedProjects[0][0];
      const topProjectHours = sortedProjects[0][1];
      
      if (topProjectId === 'no-project') {
        topProject = { name: 'No Project', hours: topProjectHours };
      } else {
        const safeProjects = projects && Array.isArray(projects) ? projects : [];
        const project = safeProjects.find(p => p.id === topProjectId);
        topProject = { 
          name: project?.name || 'Unknown Project', 
          hours: topProjectHours 
        };
      }
    }

    return {
      totalHours,
      totalEntries,
      avgHoursPerDay,
      activeUsers,
      topProject,
    };
  }, [filteredTimeEntries, dateRange, projects]);

  // Calculate top performers with sorting
  const topPerformers = useMemo(() => {
    if (!users || users.length === 0 || !filteredTimeEntries || filteredTimeEntries.length === 0) {
      return [];
    }
    
    const performers = users
      .map((user) => {
        const userEntries = filteredTimeEntries.filter((e) => e.userId === user.id);
        const totalHours = userEntries.reduce((acc, e) => {
          const duration = e.duration || 0;
          if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
            return acc;
          }
          return acc + duration / 3600;
        }, 0);

        return {
          user,
          totalHours,
        };
      })
      .filter((p) => p.totalHours > 0) // Only show users with hours > 0
      .sort((a, b) => b.totalHours - a.totalHours) // Sort by hours descending
      .slice(0, 5); // Get top 5

    return performers;
  }, [users, filteredTimeEntries]);

  // Calculate project summary with filtering
  const projectSummary = useMemo(() => {
    if (!filteredTimeEntries || filteredTimeEntries.length === 0) {
      return {
        items: [],
        maxHours: 1,
      };
    }
    
    // Create a map of project IDs to project objects for quick lookup
    const projectMap = new Map(
      (projects || [])
        .filter((p) => p.status === 'active') // Only include active projects
        .map((p) => [p.id, p])
    );

    // Group entries by project
    const projectHoursMap = new Map<string, { project: Project | null; hours: number }>();

    filteredTimeEntries.forEach((entry) => {
      const projectId = entry.projectId || 'no-project';
      const project = projectId === 'no-project' ? null : projectMap.get(projectId) || null;
      
      const duration = entry.duration || 0;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        return;
      }

      const hours = duration / 3600;
      if (!isFinite(hours) || hours <= 0) {
        return;
      }

      if (!projectHoursMap.has(projectId)) {
        projectHoursMap.set(projectId, {
          project,
          hours: 0,
        });
      }

      const current = projectHoursMap.get(projectId)!;
      current.hours += hours;
    });

    // Convert to array and filter out entries with 0 hours
    const summary = Array.from(projectHoursMap.values())
      .filter((item) => item.hours > 0)
      .map((item) => ({
        project: item.project || {
          id: 'no-project',
          name: 'No Project',
          description: '',
          color: '#6b7280',
          status: 'active' as const,
        },
        totalHours: item.hours,
      }))
      .sort((a, b) => b.totalHours - a.totalHours); // Sort by hours descending

    // Calculate max hours for percentage calculation
    const maxHours = summary.length > 0
      ? Math.max(...summary.map((s) => s.totalHours), 0)
      : 1;

    return {
      items: summary,
      maxHours,
    };
  }, [projects, filteredTimeEntries]);

  useEffect(() => {
    // Initialize auth and check if user is logged in
    const init = async () => {
      setIsInitializing(true);
      
      // Check if token exists first
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setIsInitializing(false);
        router.push('/login');
        return;
      }

      // Check if user is already loaded in store (from previous page)
      const existingUser = useStore.getState().currentUser;
      if (existingUser) {
        // User is already loaded, just load data (only load users if admin/owner/super_admin)
        setIsInitializing(false);
        const isAdmin = existingUser.role === 'admin' || 
                       existingUser.role === 'OWNER' || 
                       existingUser.role === 'SUPER_ADMIN';
        await Promise.all([
          ...(isAdmin ? [loadUsers()] : []),
          loadProjects(),
          loadTimeEntries(),
        ]);
        return;
      }

      try {
        await initializeAuth();
        
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const user = useStore.getState().currentUser;
        
        if (!user) {
          // Double check token - maybe it was cleared
          const tokenStillExists = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          if (!tokenStillExists) {
            setIsInitializing(false);
            router.push('/login');
            return;
          }
          // If token exists but no user, try to get user from storage
          const userFromStorage = api.getCurrentUserFromStorage();
          if (userFromStorage) {
            useStore.setState({ currentUser: userFromStorage });
            // Load data (only load users if admin/owner/super_admin)
            const isAdmin = userFromStorage.role === 'admin' || 
                           userFromStorage.role === 'OWNER' || 
                           userFromStorage.role === 'SUPER_ADMIN';
            await Promise.all([
              ...(isAdmin ? [loadUsers()] : []),
              loadProjects(),
              loadTimeEntries(),
            ]);
            setIsInitializing(false);
            return;
          }
          // Redirect to login if still no user
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // Load data if authenticated (only load users if admin/owner/super_admin)
        const isAdmin = user.role === 'admin' || 
                       user.role === 'OWNER' || 
                       user.role === 'SUPER_ADMIN';
        await Promise.all([
          ...(isAdmin ? [loadUsers()] : []),
          loadProjects(),
          loadTimeEntries(),
        ]);
        
        // Set initializing to false only after data is loaded
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsInitializing(false);
        // Don't redirect on error - check if token still exists
        const tokenStillExists = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!tokenStillExists) {
          router.push('/login');
        }
      }
    };
    
    // Wrap init in error handler to prevent unhandled promise rejections
    init().catch((error) => {
      console.error('Unhandled error in reports init:', error);
      setIsInitializing(false);
    });
  }, [router, initializeAuth, loadUsers, loadProjects, loadTimeEntries]);

  // Show loading state while initializing or if no user
  if (isInitializing) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      return null; // Will redirect to login
    }
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-[300px] w-full" />
                <Skeleton className="h-[300px] w-full" />
              </div>
              <Skeleton className="h-[400px] w-full" />
              <Skeleton className="h-[400px] w-full" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-[300px] w-full" />
                <Skeleton className="h-[300px] w-full" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // If no user after initialization, show nothing (will redirect)
  if (!currentUser) {
    return null;
  }

  // Check access - show access denied if not admin/owner/super_admin
  if (currentUser.role !== 'admin' && 
      currentUser.role !== 'OWNER' && 
      currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
                  <p>Admin privileges required to access this page.</p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-b from-primary/5 via-white to-white">
            {/* Header Section */}
            <div className="border-b bg-white px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Reports</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Analyze time tracking data and generate insights
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 days</SelectItem>
                      <SelectItem value="30days">Last 30 days</SelectItem>
                      <SelectItem value="90days">Last 90 days</SelectItem>
                      <SelectItem value="year">This year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setExportDialogOpen(true)} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatDurationFull(stats.totalHours)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.totalEntries} entries tracked
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg. Hours/Day</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.avgHoursPerDay.toFixed(1)}h
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Average per day
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.activeUsers}</div>
                      <p className="text-xs text-muted-foreground">
                        Users with tracked time
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Top Project</CardTitle>
                      <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.topProject ? formatDurationFull(stats.topProject.hours) : '-'}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {stats.topProject?.name || 'No data'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <CardTitle>Daily Activity</CardTitle>
                        <CardDescription>Time tracked per day</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DailyChart />
                      </CardContent>
                    </Card>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <CardTitle>Hourly Activity</CardTitle>
                        <CardDescription>Time tracked by hour of day</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <HourlyChart />
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>Monthly Activity</CardTitle>
                    <CardDescription>Time tracking trends over months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MonthlyChart />
                  </CardContent>
                </Card>

                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>Project Distribution</CardTitle>
                    <CardDescription>Time allocation across projects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProjectChart />
                  </CardContent>
                </Card>

                {/* Top Performers & Project Summary */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        <CardTitle>Top Performers</CardTitle>
                      </div>
                      <CardDescription>Employees with most tracked hours</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {topPerformers.length > 0 ? (
                          topPerformers.map((performer, index) => (
                            <div 
                              key={performer.user.id} 
                              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <UserAvatar
                                    name={performer.user.name}
                                    avatar={performer.user.avatar || undefined}
                                    size="md"
                                  />
                                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                                    {index + 1}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium">{performer.user.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {performer.user.email}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{formatDurationFull(performer.totalHours)}</div>
                                <div className="text-xs text-muted-foreground">hours</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">
                              No data available for this period
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle>Project Summary</CardTitle>
                      </div>
                      <CardDescription>Time allocation across projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {projectSummary.items.length > 0 ? (
                          projectSummary.items.map((item) => {
                            const percentage = projectSummary.maxHours > 0
                              ? (item.totalHours / projectSummary.maxHours) * 100
                              : 0;
                            
                            return (
                              <div key={item.project.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-3 w-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: item.project.color }}
                                    />
                                    <span className="font-medium">{item.project.name}</span>
                                  </div>
                                  <span className="font-semibold">{formatDurationFull(item.totalHours)}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                                      backgroundColor: item.project.color,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">
                              No projects available for this period
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        entries={filteredTimeEntries}
        users={users}
        projects={projects}
        currentUser={currentUser}
      />
    </div>
  );
}
