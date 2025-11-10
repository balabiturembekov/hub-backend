'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  Filter, 
  Download, 
  Users,
  TrendingUp,
  Activity,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/export';
import { formatDurationFull } from '@/lib/utils';

interface TeamMemberStats {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  userRole: string;
  hourlyRate: number | null;
  totalHours: number;
  totalEarned: number;
  activityLevel: 'high' | 'medium' | 'low';
  projectBreakdown: {
    projectId: string | null;
    projectName: string | null;
    projectColor: string | null;
    hours: number;
    earned: number;
  }[];
  entriesCount: number;
  lastActivity: Date | null;
}

interface TeamActivityResponse {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalMembers: number;
  totalHours: number;
  totalEarned: number;
  members: TeamMemberStats[];
}

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '90days', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
];

export default function TeamActivityPage() {
  const router = useRouter();
  const { currentUser, users, projects, loadUsers, loadProjects, initializeAuth } = useStore();
  const { toast } = useToast();
  const [data, setData] = useState<TeamActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [period, setPeriod] = useState<string>('30days');
  const [userIdFilter, setUserIdFilter] = useState<string>('all');
  const [projectIdFilter, setProjectIdFilter] = useState<string>('all');

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'OWNER' || currentUser.role === 'SUPER_ADMIN');
  const canAccess = !!currentUser;

  // Initialize auth and check if user is logged in
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      
      // Check if token exists first (client-side only)
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setIsInitializing(false);
        router.push('/login');
        return;
      }

      // Check if user is already loaded in store (from previous page)
      const existingUser = useStore.getState().currentUser;
      if (existingUser) {
        // User is already loaded, just load users and projects if admin
        setIsInitializing(false);
        if (existingUser.role === 'admin' || 
            existingUser.role === 'OWNER' || 
            existingUser.role === 'SUPER_ADMIN') {
          await loadUsers();
          await loadProjects();
        } else {
          await loadProjects();
        }
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
            if (userFromStorage.role === 'admin' || 
                userFromStorage.role === 'OWNER' || 
                userFromStorage.role === 'SUPER_ADMIN') {
              await loadUsers();
              await loadProjects();
            } else {
              await loadProjects();
            }
            setIsInitializing(false);
            return;
          }
          // Redirect to login if still no user
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // Load users and projects if authenticated
        if (user.role === 'admin' || 
            user.role === 'OWNER' || 
            user.role === 'SUPER_ADMIN') {
          await loadUsers();
          await loadProjects();
        } else {
          await loadProjects();
        }
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
      console.error('Unhandled error in team-activity init:', error);
      setIsInitializing(false);
    });
  }, [router, initializeAuth, loadUsers, loadProjects]);

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, userIdFilter, projectIdFilter, currentUser]);

  const loadData = async () => {
    if (!canAccess) {
      return;
    }

    setIsLoading(true);
    try {
      const params: any = { period };
      // Only admins can filter by user; employees see only their own data automatically
      if (isAdmin && userIdFilter !== 'all') {
        params.userId = userIdFilter;
      }
      if (projectIdFilter !== 'all') {
        params.projectId = projectIdFilter;
      }
      const response = await api.getTeamActivity(params);
      
      // Validate and convert dates
      if (response.period) {
        const startDate = new Date(response.period.startDate);
        const endDate = new Date(response.period.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format received from server');
        }
        
        response.period.startDate = startDate;
        response.period.endDate = endDate;
      }
      
      if (response.members && Array.isArray(response.members)) {
        response.members = response.members
          .filter((member: any) => member && typeof member === 'object')
          .map((member: any) => {
            let lastActivity: Date | null = null;
            if (member.lastActivity) {
              try {
                const date = new Date(member.lastActivity);
                if (!isNaN(date.getTime())) {
                  lastActivity = date;
                }
              } catch (error) {
                console.warn('Invalid lastActivity date:', member.lastActivity);
              }
            }
            
            // Validate numeric fields
            const totalHours = isFinite(member.totalHours) && member.totalHours >= 0 ? member.totalHours : 0;
            const totalEarned = isFinite(member.totalEarned) && member.totalEarned >= 0 ? member.totalEarned : 0;
            
            return {
              ...member,
              totalHours,
              totalEarned,
              lastActivity,
              projectBreakdown: Array.isArray(member.projectBreakdown)
                ? member.projectBreakdown
                    .filter((pb: any) => pb && typeof pb === 'object')
                    .map((pb: any) => ({
                      ...pb,
                      hours: isFinite(pb.hours) && pb.hours >= 0 ? pb.hours : 0,
                      earned: isFinite(pb.earned) && pb.earned >= 0 ? pb.earned : 0,
                    }))
                : [],
            };
          });
      } else {
        response.members = [];
      }
      
      // Validate totals
      if (!isFinite(response.totalHours)) response.totalHours = 0;
      if (!isFinite(response.totalEarned)) response.totalEarned = 0;
      if (!isFinite(response.totalMembers)) response.totalMembers = 0;
      
      setData(response);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to load team activity',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!data || !data.members.length) {
      toast({
        title: 'Error',
        description: 'No data to export',
        variant: 'destructive',
      });
      return;
    }

    const csvData = data.members.flatMap((member) =>
      member.projectBreakdown.map((project) => ({
        'Team Member': member.userName,
        Email: member.userEmail,
        'Hourly Rate': member.hourlyRate ? `$${member.hourlyRate}` : '-',
        Project: project.projectName || 'No Project',
        'Hours Worked': formatDurationFull(project.hours),
        'Amount Earned': `$${project.earned.toFixed(2)}`,
        'Activity Level': member.activityLevel,
        'Total Hours': formatDurationFull(member.totalHours),
        'Total Earned': `$${member.totalEarned.toFixed(2)}`,
        'Last Activity': member.lastActivity && !isNaN(member.lastActivity.getTime())
          ? format(member.lastActivity, 'yyyy-MM-dd HH:mm')
          : '-',
      }))
    );

    exportToCSV(csvData, `team-activity-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    toast({
      title: 'Success',
      description: 'Data exported successfully',
    });
  };

  const getActivityBadgeVariant = (level: string) => {
    switch (level) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getActivityBadgeColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20';
      case 'low':
        return 'bg-muted/50 text-muted-foreground hover:bg-muted border-border';
      default:
        return '';
    }
  };

  const clearFilters = () => {
    setUserIdFilter('all');
    setProjectIdFilter('all');
  };

  const hasActiveFilters = userIdFilter !== 'all' || projectIdFilter !== 'all';

  // Calculate average hours per member
  const avgHoursPerMember = data && data.totalMembers > 0 
    ? data.totalHours / data.totalMembers 
    : 0;

  // Calculate average earned per member
  const avgEarnedPerMember = data && data.totalMembers > 0 
    ? data.totalEarned / data.totalMembers 
    : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-b from-primary/5 via-background to-background">
            {/* Header Section */}
            <div className="border-b bg-card px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Time & Activity</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isAdmin 
                      ? "See team members' time worked, activity levels, and amounts earned per project"
                      : "View your time worked, activity levels, and amounts earned per project"}
                  </p>
                </div>
                <Button onClick={handleExport} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Filters - only show for admins */}
                {isAdmin && (
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Filter className="h-5 w-5 text-primary" />
                          <CardTitle>Filters</CardTitle>
                        </div>
                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear
                          </Button>
                        )}
                      </div>
                      <CardDescription>Filter team activity by period, member, and project</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Period</label>
                          <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERIODS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Team Member</label>
                          <Select value={userIdFilter} onValueChange={setUserIdFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Members</SelectItem>
                              {users
                                .filter((u) => u.status === 'active')
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Project</label>
                          <Select value={projectIdFilter} onValueChange={setProjectIdFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Projects</SelectItem>
                              {projects
                                .filter((p) => p.status === 'active')
                                .map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary Cards */}
                {isLoading ? (
                  <div className={`grid gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    {(isAdmin ? [1, 2, 3, 4] : [1, 2, 3]).map((i) => (
                      <Card key={i}>
                        <CardContent className="pt-6">
                          <Skeleton className="h-20 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : data ? (
                  <>
                    <div className={`grid gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                      {isAdmin && (
                        <Card className="transition-shadow hover:shadow-md">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{data.totalMembers}</div>
                            <p className="text-xs text-muted-foreground">
                              {avgHoursPerMember > 0 ? `${avgHoursPerMember.toFixed(1)}h avg` : 'No activity'}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatDurationFull(data.totalHours)}</div>
                          <p className="text-xs text-muted-foreground">
                            {isAdmin && data.totalMembers > 0 
                              ? `${(data.totalHours / data.totalMembers).toFixed(1)}h per member`
                              : 'Hours tracked'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">${data.totalEarned.toFixed(2)}</div>
                          <p className="text-xs text-muted-foreground">
                            {isAdmin && data.totalMembers > 0 
                              ? `$${avgEarnedPerMember.toFixed(2)} per member`
                              : 'Total earnings'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Period</CardTitle>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm font-medium">
                            {!isNaN(data.period.startDate.getTime()) && !isNaN(data.period.endDate.getTime())
                              ? `${format(data.period.startDate, 'MMM dd')} - ${format(data.period.endDate, 'MMM dd, yyyy')}`
                              : 'Invalid date range'}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {PERIODS.find(p => p.value === period)?.label || period}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Team Members Table */}
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-primary" />
                          <CardTitle>{isAdmin ? 'Team Members' : 'My Activity'}</CardTitle>
                          <Badge variant="secondary" className="ml-2">
                            {data.members.length}
                          </Badge>
                        </div>
                        <CardDescription>
                          {isAdmin 
                            ? 'Time worked and amounts earned per team member'
                            : 'Your time worked and amounts earned per project'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                              <Skeleton key={i} className="h-20 w-full" />
                            ))}
                          </div>
                        ) : data.members.length === 0 ? (
                          <EmptyState
                            icon={<Activity className="h-12 w-12 mx-auto" />}
                            title={isAdmin ? "No team activity" : "No activity"}
                            description={isAdmin 
                              ? "No time entries found for the selected period and filters."
                              : "No time entries found for the selected period."}
                          />
                        ) : (
                          <Accordion type="single" collapsible className="w-full">
                            {data.members.map((member) => (
                              <AccordionItem 
                                key={member.userId} 
                                value={member.userId}
                                className="border rounded-lg mb-2 px-4 transition-colors hover:bg-muted/50"
                              >
                                <AccordionTrigger className="hover:no-underline py-4">
                                  <div className="flex items-center gap-4 w-full pr-4">
                                    <UserAvatar
                                      name={member.userName}
                                      avatar={member.userAvatar || undefined}
                                      size="md"
                                    />
                                    <div className="flex-1 text-left">
                                      <div className="font-medium">{member.userName}</div>
                                      <div className="text-sm text-muted-foreground">{member.userEmail}</div>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                      <div className="text-right">
                                        <div className="text-muted-foreground">Hours</div>
                                        <div className="font-semibold">{formatDurationFull(member.totalHours)}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-muted-foreground">Earned</div>
                                        <div className="font-semibold">${member.totalEarned.toFixed(2)}</div>
                                      </div>
                                      <Badge 
                                        variant={getActivityBadgeVariant(member.activityLevel)}
                                        className={getActivityBadgeColor(member.activityLevel)}
                                      >
                                        {member.activityLevel}
                                      </Badge>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="pt-4 space-y-4 pb-4">
                                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                                      <div className="rounded-lg border p-3">
                                        <div className="text-muted-foreground mb-1">Hourly Rate</div>
                                        <div className="font-semibold">
                                          {member.hourlyRate ? `$${member.hourlyRate}/hr` : 'Not set'}
                                        </div>
                                      </div>
                                      <div className="rounded-lg border p-3">
                                        <div className="text-muted-foreground mb-1">Time Entries</div>
                                        <div className="font-semibold">{member.entriesCount}</div>
                                      </div>
                                      <div className="rounded-lg border p-3">
                                        <div className="text-muted-foreground mb-1">Last Activity</div>
                                        <div className="font-semibold">
                                          {member.lastActivity && !isNaN(member.lastActivity.getTime())
                                            ? format(member.lastActivity, 'MMM dd, yyyy HH:mm')
                                            : 'Never'}
                                        </div>
                                      </div>
                                    </div>
                                    {member.projectBreakdown.length > 0 && (
                                      <div>
                                        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4" />
                                          Projects Breakdown
                                        </div>
                                        <div className="rounded-lg border overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Project</TableHead>
                                                <TableHead className="text-right">Hours</TableHead>
                                                <TableHead className="text-right">Earned</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {member.projectBreakdown.map((project) => (
                                                <TableRow 
                                                  key={project.projectId || `no-project-${project.projectName}`}
                                                  className="transition-colors hover:bg-muted/50"
                                                >
                                                  <TableCell>
                                                    <div className="flex items-center gap-2">
                                                      <div
                                                        className="h-3 w-3 rounded-full flex-shrink-0"
                                                        style={{
                                                          backgroundColor: project.projectColor || '#6b7280',
                                                        }}
                                                      />
                                                      <span className="font-medium">{project.projectName}</span>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">
                                                    {formatDurationFull(project.hours)}
                                                  </TableCell>
                                                  <TableCell className="text-right font-semibold">
                                                    ${project.earned.toFixed(2)}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
