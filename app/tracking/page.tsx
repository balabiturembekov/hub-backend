'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TimeTrackerErrorBoundary } from '@/components/TimeTrackerErrorBoundary';
import { TableErrorBoundary } from '@/components/TableErrorBoundary';
import { TimeEntriesTable } from '@/components/TimeEntriesTable';
import { ScreenshotSettings } from '@/components/ScreenshotSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Clock, 
  Calendar,
  TrendingUp,
  Play,
  Pause,
  Settings,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { ExportDialog } from '@/components/admin/ExportDialog';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { formatDurationFull } from '@/lib/utils';

export default function TrackingPage() {
  const router = useRouter();
  const { timeEntries, loadTimeEntries, currentUser, users, projects, initializeAuth, loadScreenshotSettings } = useStore();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Initialize with 0 to avoid hydration mismatch, set in useEffect
  const [currentTime, setCurrentTime] = useState(0);
  const [hasToken, setHasToken] = useState(false);
  
  // Initialize currentTime on mount to avoid hydration mismatch
  useEffect(() => {
    // Use setTimeout to defer state update, making it asynchronous
    const timeoutId = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Update current time every second for real-time calculations (if there are running entries)
  useEffect(() => {
    if (currentTime === 0) return; // Don't start interval until initialized
    
    const hasRunningEntry = timeEntries.some(
      e => e.userId === currentUser?.id && e.status === 'running'
    );
    
    if (!hasRunningEntry) {
      // No need to update if no running entries
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeEntries, currentUser?.id, currentTime]);

  // Initialize auth and check if user is logged in
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      
      // Check if token exists first (client-side only)
      const token = localStorage.getItem('auth_token');
      setHasToken(!!token);
      if (!token) {
        setIsInitializing(false);
        router.push('/login');
        return;
      }

      // Check if user is already loaded in store (from previous page)
      const existingUser = useStore.getState().currentUser;
      if (existingUser) {
        // User is already loaded, just load time entries and screenshot settings
        setIsInitializing(false);
        await Promise.all([
          loadTimeEntries(),
          loadScreenshotSettings(),
        ]);
        return;
      }

      try {
        await initializeAuth();
        
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const user = useStore.getState().currentUser;
        setIsInitializing(false);
        
        if (!user) {
          // Double check token - maybe it was cleared
          const tokenStillExists = localStorage.getItem('auth_token');
          if (!tokenStillExists) {
            router.push('/login');
            return;
          }
          // If token exists but no user, try to get user from storage
          const userFromStorage = api.getCurrentUserFromStorage();
          if (userFromStorage) {
            useStore.setState({ currentUser: userFromStorage });
            await Promise.all([
              loadTimeEntries(),
              loadScreenshotSettings(),
            ]);
            return;
          }
          // Redirect to login if still no user
          router.push('/login');
          return;
        }

        // Load data if authenticated
        await Promise.all([
          loadTimeEntries(),
          loadScreenshotSettings(),
        ]);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsInitializing(false);
        // Don't redirect on error - check if token still exists
        const tokenStillExists = localStorage.getItem('auth_token');
        if (!tokenStillExists) {
          router.push('/login');
        }
      }
    };
    
    // Wrap init in error handler to prevent unhandled promise rejections
    init().catch((error) => {
      console.error('Unhandled error in tracking init:', error);
      setIsInitializing(false);
    });
  }, [router, initializeAuth, loadTimeEntries, loadScreenshotSettings]);

  // Calculate today's entries and hours (memoized for performance)
  // IMPORTANT: This hook MUST be called before any conditional returns to follow Rules of Hooks
  const { todayEntries, todayHours, activeEntry } = useMemo(() => {
    if (!currentUser?.id) {
      return { todayEntries: [], todayHours: 0, activeEntry: null };
    }

    const myEntriesFiltered = timeEntries.filter(e => e.userId === currentUser.id);
    
    // Find active entry
    const active = myEntriesFiltered.find(e => e.status === 'running' || e.status === 'paused');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Use currentTime state for real-time updates when timer is running
    const now = currentTime;
    
    const todayEntriesFiltered = myEntriesFiltered.filter(e => {
      try {
        const entryDate = new Date(e.startTime);
        if (isNaN(entryDate.getTime())) return false;
        return entryDate >= today;
      } catch {
        return false;
      }
    });

    // Calculate hours including active (running) entries
    const todayHoursValue = todayEntriesFiltered.reduce((acc, e) => {
      let entrySeconds = 0;
      
      if (e.status === 'stopped') {
        // For stopped entries, use stored duration
        const duration = e.duration || 0;
        if (isFinite(duration) && !isNaN(duration) && duration >= 0) {
          entrySeconds = duration;
        }
      } else if (e.status === 'running') {
        // For running entries, calculate current elapsed time
        try {
          const startDate = new Date(e.startTime);
          if (!isNaN(startDate.getTime())) {
            const start = startDate.getTime();
            const elapsed = Math.floor((now - start) / 1000);
            // Add stored duration (from previous pause cycles) + current session time
            entrySeconds = (e.duration || 0) + Math.max(0, elapsed);
          } else {
            entrySeconds = e.duration || 0;
          }
        } catch {
          entrySeconds = e.duration || 0;
        }
      } else if (e.status === 'paused') {
        // For paused entries, use stored duration
        const duration = e.duration || 0;
        if (isFinite(duration) && !isNaN(duration) && duration >= 0) {
          entrySeconds = duration;
        }
      }
      
      if (isFinite(entrySeconds) && !isNaN(entrySeconds) && entrySeconds >= 0) {
        return acc + entrySeconds;
      }
      return acc;
    }, 0) / 3600;

    // Validate and ensure todayHours is a valid number
    const validTodayHours = isFinite(todayHoursValue) && !isNaN(todayHoursValue) && todayHoursValue >= 0
      ? todayHoursValue
      : 0;

    return {
      todayEntries: todayEntriesFiltered,
      todayHours: validTodayHours,
      activeEntry: active || null,
    };
  }, [timeEntries, currentUser, currentTime]);

  // Calculate weekly and monthly stats
  const { weekHours, monthHours } = useMemo(() => {
    if (!currentUser?.id) {
      return { weekHours: 0, monthHours: 0 };
    }

    const myEntries = timeEntries.filter(e => e.userId === currentUser.id);
    // Use currentTime if initialized (it's set in useEffect), otherwise return 0
    // This prevents calling Date.now() during render
    if (currentTime === 0) {
      return { weekHours: 0, monthHours: 0 };
    }
    const now = currentTime;
    
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);

    const weekEntries = myEntries.filter(e => {
      try {
        const entryDate = new Date(e.startTime);
        return !isNaN(entryDate.getTime()) && entryDate >= weekAgo;
      } catch {
        return false;
      }
    });

    const monthEntries = myEntries.filter(e => {
      try {
        const entryDate = new Date(e.startTime);
        return !isNaN(entryDate.getTime()) && entryDate >= monthAgo;
      } catch {
        return false;
      }
    });

    const calculateHours = (entries: typeof myEntries) => {
      return entries.reduce((acc, e) => {
        let entrySeconds = 0;
        
        if (e.status === 'stopped') {
          entrySeconds = e.duration || 0;
        } else if (e.status === 'running') {
          try {
            const startDate = new Date(e.startTime);
            if (!isNaN(startDate.getTime())) {
              const start = startDate.getTime();
              const elapsed = Math.floor((now - start) / 1000);
              entrySeconds = (e.duration || 0) + Math.max(0, elapsed);
            } else {
              entrySeconds = e.duration || 0;
            }
          } catch {
            entrySeconds = e.duration || 0;
          }
        } else if (e.status === 'paused') {
          entrySeconds = e.duration || 0;
        }
        
        if (isFinite(entrySeconds) && !isNaN(entrySeconds) && entrySeconds >= 0) {
          return acc + entrySeconds;
        }
        return acc;
      }, 0) / 3600;
    };

    const week = calculateHours(weekEntries);
    const month = calculateHours(monthEntries);

    return {
      weekHours: isFinite(week) && !isNaN(week) && week >= 0 ? week : 0,
      monthHours: isFinite(month) && !isNaN(month) && month >= 0 ? month : 0,
    };
  }, [timeEntries, currentUser, currentTime]);

  // Memoize filtered entries for ExportDialog
  // IMPORTANT: This hook MUST be called before any conditional returns
  const filteredEntriesForExport = useMemo(() => 
    currentUser?.id ? timeEntries.filter(e => e.userId === currentUser.id) : []
  , [timeEntries, currentUser]);

  // Show loading state while initializing
  // IMPORTANT: All hooks must be called before any conditional returns
  // Use hasToken state to avoid hydration mismatch
  if (isInitializing || !currentUser) {
    if (!hasToken && isInitializing === false) {
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
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <Skeleton className="h-[300px] w-full" />
                </div>
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-9 w-20" />
                </div>
                <Skeleton className="h-[400px] w-full" />
              </div>
            </div>
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
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Time Tracking</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Track your work time and manage your entries
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => setExportDialogOpen(true)} 
                    variant="outline" 
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Data
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="outline" className="gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Back to Dashboard
                    </Button>
                  </Link>
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
                      <CardTitle className="text-sm font-medium">Today</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {isFinite(todayHours) && !isNaN(todayHours) && todayHours >= 0
                          ? formatDurationFull(todayHours)
                          : '0:00:00'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">This Week</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatDurationFull(weekHours)}
                      </div>
                      <p className="text-xs text-muted-foreground">Last 7 days</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">This Month</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatDurationFull(monthHours)}
                      </div>
                      <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Status</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {activeEntry ? (
                        <div className="space-y-1">
                          <Badge 
                            variant={activeEntry.status === 'running' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {activeEntry.status === 'running' ? (
                              <>
                                <Play className="mr-1 h-3 w-3" />
                                Running
                              </>
                            ) : (
                              <>
                                <Pause className="mr-1 h-3 w-3" />
                                Paused
                              </>
                            )}
                          </Badge>
                          {activeEntry.projectName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {activeEntry.projectName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No active timer</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Time Tracker & Summary */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="mb-4 flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-gray-900">Time Tracker</h2>
                    </div>
                    <TimeTrackerErrorBoundary />
                  </div>
                  
                  <div className="space-y-6">
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-primary" />
                          <CardTitle>Today&apos;s Summary</CardTitle>
                        </div>
                        <CardDescription>
                          {format(new Date(), 'EEEE, MMMM d')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Total Hours</p>
                              <p className="text-xs text-muted-foreground">Tracked today</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                {isFinite(todayHours) && !isNaN(todayHours) && todayHours >= 0
                                  ? todayHours.toFixed(2)
                                  : '0.00'}
                              </p>
                              <p className="text-xs text-muted-foreground">hours</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Entries</p>
                              <p className="text-xs text-muted-foreground">Time entries</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">
                                {todayEntries.length}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {todayEntries.length === 1 ? 'entry' : 'entries'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Settings className="h-5 w-5 text-primary" />
                          <CardTitle>Screenshot Settings</CardTitle>
                        </div>
                        <CardDescription>Configure automatic screenshots</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScreenshotSettings />
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Time Entries Table */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-gray-900">Time Entries</h2>
                      <Badge variant="secondary" className="ml-2">
                        {timeEntries.filter(e => e.userId === currentUser?.id).length}
                      </Badge>
                    </div>
                    <Button 
                      onClick={() => setExportDialogOpen(true)} 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <TableErrorBoundary tableName="Time Entries Table">
                        <TimeEntriesTable 
                          userId={currentUser?.id} 
                          showActions={
                            currentUser?.role === 'admin' || 
                            currentUser?.role === 'OWNER' || 
                            currentUser?.role === 'SUPER_ADMIN'
                          }
                        />
                      </TableErrorBoundary>
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
        entries={filteredEntriesForExport}
        users={users}
        projects={projects}
        currentUser={currentUser}
      />
    </div>
  );
}
