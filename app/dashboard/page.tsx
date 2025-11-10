'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { DashboardStats } from '@/components/DashboardStats';
import { TimeTrackerErrorBoundary } from '@/components/TimeTrackerErrorBoundary';
import { ChartErrorBoundary } from '@/components/ChartErrorBoundary';
import { TableErrorBoundary } from '@/components/TableErrorBoundary';
import { ActiveUsers } from '@/components/ActiveUsers';
import { RecentActivity } from '@/components/RecentActivity';
import { TimeEntriesTable } from '@/components/TimeEntriesTable';
import { HourlyChart } from '@/components/Charts/HourlyChart';
import { DailyChart } from '@/components/Charts/DailyChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  Sparkles,
  Activity,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const {
    currentUser,
    initializeAuth,
    loadUsers,
    loadProjects,
    loadTimeEntries,
    loadStats,
    loadActivities,
    isLoading,
    timeEntries,
    stats,
  } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Initialize WebSocket
  useSocket();

  useEffect(() => {
    // Initialize auth and check if user is logged in
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
        // User is already loaded, just load data
        setIsInitializing(false);
        // Set loading state before loading data
        useStore.setState({ isLoading: true });
        try {
          // Load data (only load users if admin/owner/super_admin)
          const isAdmin = existingUser.role === 'admin' || 
                         existingUser.role === 'OWNER' || 
                         existingUser.role === 'SUPER_ADMIN';
          await Promise.all([
            ...(isAdmin ? [loadUsers()] : []),
            loadProjects(),
            loadTimeEntries(),
            loadStats(),
            loadActivities(),
          ]);
        } finally {
          // Ensure loading is false after all data is loaded (or failed)
          useStore.setState({ isLoading: false });
        }
        // Small delay to ensure state updates are propagated to all components
        await new Promise(resolve => setTimeout(resolve, 100));
        return;
      }

      try {
        await initializeAuth();
        
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const user = useStore.getState().currentUser;
        
        if (!user) {
          // Double check token - maybe it was cleared
          const tokenStillExists = localStorage.getItem('auth_token');
          if (!tokenStillExists) {
            setIsInitializing(false);
            router.push('/login');
            return;
          }
          // If token exists but no user, try to get user from storage
          const userFromStorage = api.getCurrentUserFromStorage();
          if (userFromStorage) {
            useStore.setState({ currentUser: userFromStorage });
            // Set loading state before loading data
            useStore.setState({ isLoading: true });
            try {
              // Load data (only load users if admin/owner/super_admin)
              const { loadScreenshotSettings } = useStore.getState();
              const isAdmin = userFromStorage.role === 'admin' || 
                             userFromStorage.role === 'OWNER' || 
                             userFromStorage.role === 'SUPER_ADMIN';
              await Promise.all([
                ...(isAdmin ? [loadUsers()] : []),
                loadProjects(),
                loadTimeEntries(),
                loadStats(),
                loadActivities(),
                loadScreenshotSettings(),
              ]);
            } finally {
              // Ensure loading is false after all data is loaded (or failed)
              useStore.setState({ isLoading: false });
            }
            // Small delay to ensure state updates are propagated to all components
            await new Promise(resolve => setTimeout(resolve, 100));
            setIsInitializing(false);
            return;
          }
          // Redirect to login if still no user
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // Set loading state before loading data
        useStore.setState({ isLoading: true });
        
        // Load data if authenticated
        try {
          const { loadScreenshotSettings } = useStore.getState();
          // user is guaranteed to be non-null here due to the if (!user) check above
          const isAdmin = user && (user.role === 'admin' || 
                                   user.role === 'OWNER' || 
                                   user.role === 'SUPER_ADMIN');
          await Promise.all([
            ...(isAdmin ? [loadUsers()] : []),
            loadProjects(),
            loadTimeEntries(),
            loadStats(),
            loadActivities(),
            loadScreenshotSettings(),
          ]);
        } finally {
          // Ensure loading is false after all data is loaded (or failed)
          useStore.setState({ isLoading: false });
        }
        
        // Small delay to ensure state updates are propagated to all components
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set initializing to false only after data is loaded
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        useStore.setState({ isLoading: false });
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
      console.error('Unhandled error in dashboard init:', error);
      setIsInitializing(false);
      useStore.setState({ isLoading: false });
    });
  }, [router, initializeAuth, loadUsers, loadProjects, loadTimeEntries, loadStats, loadActivities]);

  // Show loading state while initializing or loading data
  if (isInitializing || (isLoading && (!timeEntries || !Array.isArray(timeEntries) || timeEntries.length === 0))) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if user exists (with token check to avoid premature redirect)
  // Use hasToken state to avoid hydration mismatch
  if (!currentUser && !hasToken && isInitializing === false) {
    router.push('/login');
    return null;
  }

  // If no user but token exists, show loading
  if (!currentUser && hasToken) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading user...</p>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.role === 'OWNER' || 
    currentUser.role === 'SUPER_ADMIN'
  );

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-b from-primary/5 via-white to-white">
            {/* Welcome Section */}
            <div className="border-b bg-white px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    {greeting()}, {currentUser?.name?.split(' ')[0] || currentUser?.name || 'there'}! 👋
                  </h1>
                  <p className="mt-1 text-sm text-gray-600">
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/tracking">
                    <Button variant="outline" className="gap-2">
                      <Clock className="h-4 w-4" />
                      View Tracking
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin/reports">
                      <Button variant="outline" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        View Reports
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Stats Section */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
                    </div>
                  </div>
                  <DashboardStats />
                </div>

                {/* Time Tracker & Active Users */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className={currentUser?.role === 'employee' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-gray-900">Time Tracker</h2>
                      </div>
                    </div>
                    <TimeTrackerErrorBoundary />
                  </div>
                  {/* Only show ActiveUsers component for admins/owners/super_admins */}
                  {isAdmin && (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <h2 className="text-lg font-semibold text-gray-900">Active Team</h2>
                        </div>
                      </div>
                      <ActiveUsers />
                    </div>
                  )}
                </div>

                {/* Charts Section */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
                    </div>
                    {isAdmin && (
                      <Link href="/admin/reports">
                        <Button variant="ghost" size="sm" className="gap-2">
                          View All Reports
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <ChartErrorBoundary chartName="Hourly Chart">
                      <Card className="transition-shadow hover:shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base">Hourly Activity</CardTitle>
                          <CardDescription>Last 24 hours</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <HourlyChart />
                        </CardContent>
                      </Card>
                    </ChartErrorBoundary>
                    <ChartErrorBoundary chartName="Daily Chart">
                      <Card className="transition-shadow hover:shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base">Daily Overview</CardTitle>
                          <CardDescription>Last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <DailyChart />
                        </CardContent>
                      </Card>
                    </ChartErrorBoundary>
                  </div>
                </div>

                {/* Recent Activity (Admin only) */}
                {isAdmin && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                      </div>
                    </div>
                    <RecentActivity />
                  </div>
                )}

                {/* Time Entries Table */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-gray-900">Recent Time Entries</h2>
                    </div>
                    <Link href="/tracking">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View All
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <TableErrorBoundary tableName="Time Entries Table">
                        <TimeEntriesTable 
                          showActions={!!isAdmin}
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
    </div>
  );
}
