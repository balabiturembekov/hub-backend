'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { UserDialog } from '@/components/admin/UserDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Search,
  UserCheck,
  Shield,
  DollarSign,
  Filter,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function EmployeesPage() {
  const router = useRouter();
  const { users, loadUsers, deleteUser, isLoading, currentUser, initializeAuth } = useStore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        // User is already loaded, just load users if admin/owner
        setIsInitializing(false);
        if (existingUser.role === 'admin' || 
            existingUser.role === 'OWNER' || 
            existingUser.role === 'SUPER_ADMIN') {
          await loadUsers();
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
            }
            setIsInitializing(false);
            return;
          }
          // Redirect to login if still no user
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // Load data if authenticated and has admin/owner role
        if (user.role === 'admin' || 
            user.role === 'OWNER' || 
            user.role === 'SUPER_ADMIN') {
          await loadUsers();
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
      console.error('Unhandled error in employees init:', error);
      setIsInitializing(false);
    });
  }, [router, initializeAuth, loadUsers]);

  // Calculate statistics
  const stats = useMemo(() => {
    const safeUsers = users && Array.isArray(users) ? users : [];
    const total = safeUsers.length;
    const active = safeUsers.filter(u => u.status === 'active').length;
    const inactive = safeUsers.filter(u => u.status === 'inactive').length;
    const admins = safeUsers.filter(u => 
      u.role === 'admin' || u.role === 'OWNER' || u.role === 'SUPER_ADMIN'
    ).length;
    const employees = safeUsers.filter(u => u.role === 'employee').length;
    const withRate = safeUsers.filter(u => u.hourlyRate && u.hourlyRate > 0).length;
    const avgRate = safeUsers.length > 0
      ? safeUsers.reduce((sum, u) => sum + (u.hourlyRate || 0), 0) / safeUsers.length
      : 0;

    return {
      total,
      active,
      inactive,
      admins,
      employees,
      withRate,
      avgRate,
    };
  }, [users]);

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => {
        if (roleFilter === 'admin') {
          return user.role === 'admin' || user.role === 'OWNER' || user.role === 'SUPER_ADMIN';
        }
        return user.role === roleFilter;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    return filtered;
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleCreate = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteUser(userToDelete.id);
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      setUserToDelete(null);
      // Reload users after deletion
      await loadUsers();
    } catch (error: unknown) {
      console.error('Failed to delete user:', error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast({
        title: 'Error',
        description: err.response?.data?.message || err.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    loadUsers();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  // Show loading state while initializing
  if (isInitializing) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      return null; // Will redirect to login
    }
    return (
      <div className="flex h-screen overflow-hidden bg-background">
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!currentUser) {
    return null;
  }

  // Check access - show access denied if not admin/owner/super_admin
  if (currentUser.role !== 'admin' && 
      currentUser.role !== 'OWNER' && 
      currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
    <TooltipProvider>
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
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Employees</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage your team members and their roles
                    </p>
                  </div>
                  <Button onClick={handleCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Button>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.active} active, {stats.inactive} inactive
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Admins</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.admins}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.employees} employees
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Hourly Rate</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats.avgRate > 0 ? `$${stats.avgRate.toFixed(2)}` : '-'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stats.withRate} employees with rate
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filters */}
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" />
                        <CardTitle>Filters</CardTitle>
                      </div>
                      <CardDescription>Search and filter employees</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear
                          </Button>
                        )}
                      </div>
                      {hasActiveFilters && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          Showing {filteredUsers.length} of {users.length} employees
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Employees Table */}
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <CardTitle>Team Members</CardTitle>
                        <Badge variant="secondary" className="ml-2">
                          {filteredUsers.length}
                        </Badge>
                      </div>
                      <CardDescription>
                        {filteredUsers.length === users.length
                          ? 'All employees in your organization'
                          : `Filtered results from ${users.length} total employees`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Hourly Rate</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoading && users.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                    <p>Loading employees...</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : filteredUsers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="h-64">
                                  <EmptyState
                                    icon={<Users className="h-12 w-12 mx-auto" />}
                                    title={hasActiveFilters ? "No employees found" : "No employees yet"}
                                    description={
                                      hasActiveFilters
                                        ? "Try adjusting your filters to see more results"
                                        : "Add your first team member to get started"
                                    }
                                    action={
                                      hasActiveFilters
                                        ? {
                                            label: 'Clear Filters',
                                            onClick: clearFilters,
                                          }
                                        : {
                                            label: 'Add Employee',
                                            onClick: handleCreate,
                                          }
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredUsers.map((user) => (
                                <TableRow 
                                  key={user.id}
                                  className="transition-colors hover:bg-muted/50"
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      <UserAvatar 
                                        name={user.name}
                                        avatar={user.avatar}
                                        size="md"
                                      />
                                      <div>
                                        <div className="font-medium">{user.name}</div>
                                        {user.id === currentUser?.id && (
                                          <span className="text-xs text-muted-foreground">(You)</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm">{user.email}</span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={
                                        user.role === 'admin' || 
                                        user.role === 'OWNER' || 
                                        user.role === 'SUPER_ADMIN'
                                          ? 'default' 
                                          : 'secondary'
                                      }
                                    >
                                      {user.role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={user.status === 'active' ? 'default' : 'outline'}
                                      className={
                                        user.status === 'active'
                                          ? 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20'
                                          : ''
                                      }
                                    >
                                      {user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {user.hourlyRate ? (
                                      <span className="font-medium">${user.hourlyRate}/hr</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(user)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Edit employee</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteClick(user)}
                                            disabled={user.id === currentUser?.id}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {user.id === currentUser?.id
                                            ? "Cannot delete yourself"
                                            : "Delete employee"}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>

        <UserDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          user={selectedUser}
        />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete User"
          description={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
          isLoading={isLoading}
        />
      </div>
    </TooltipProvider>
  );
}
