'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ProjectDialog } from '@/components/admin/ProjectDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FolderOpen,
  Search,
  CheckCircle2,
  Archive,
  DollarSign,
  Filter,
  X,
  Folder,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ProjectsPage() {
  const router = useRouter();
  const { 
    projects, 
    loadProjects, 
    deleteProject, 
    isLoading, 
    currentUser, 
    initializeAuth,
    timeEntries,
  } = useStore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
        // User is already loaded, just load projects
        setIsInitializing(false);
        await loadProjects();
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
            await loadProjects();
            setIsInitializing(false);
            return;
          }
          // Redirect to login if still no user
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // Load data if authenticated
        await loadProjects();
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
      console.error('Unhandled error in projects init:', error);
      setIsInitializing(false);
    });
  }, [router, initializeAuth, loadProjects]);

  // Calculate statistics
  const stats = useMemo(() => {
    const safeProjects = projects && Array.isArray(projects) ? projects : [];
    const total = safeProjects.length;
    const active = safeProjects.filter(p => p.status === 'active').length;
    const archived = safeProjects.filter(p => p.status === 'archived').length;
    const withBudget = safeProjects.filter(p => p.budget && p.budget > 0);
    const totalBudget = withBudget.reduce((sum, p) => sum + (p.budget || 0), 0);
    const avgBudget = withBudget.length > 0 ? totalBudget / withBudget.length : 0;

    // Calculate hours per project
    const projectHours = safeProjects.map(project => {
      const entries = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).filter(e => e.projectId === project.id);
      const totalSeconds = entries.reduce((sum, e) => {
        if (e.status === 'stopped' || e.status === 'paused') {
          return sum + (e.duration || 0);
        } else if (e.status === 'running') {
          // For running entries, use duration (which includes paused time)
          return sum + (e.duration || 0);
        }
        return sum;
      }, 0);
      return {
        projectId: project.id,
        hours: totalSeconds / 3600,
      };
    });

    const totalHours = projectHours.reduce((sum, p) => sum + p.hours, 0);

    return {
      total,
      active,
      archived,
      withBudget: withBudget.length,
      totalBudget,
      avgBudget,
      totalHours,
    };
  }, [projects, timeEntries]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.clientName?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    return filtered;
  }, [projects, searchQuery, statusFilter]);

  const handleCreate = () => {
    setSelectedProject(null);
    setDialogOpen(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setDialogOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    try {
      await deleteProject(projectToDelete.id);
      toast({
        title: 'Success',
        description: 'Project deleted successfully',
      });
      setProjectToDelete(null);
      // Reload projects after deletion
      await loadProjects();
    } catch (error: unknown) {
      console.error('Failed to delete project:', error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast({
        title: 'Error',
        description: err.response?.data?.message || err.message || 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedProject(null);
    loadProjects();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

  const canManage = currentUser?.role === 'admin' || 
                   currentUser?.role === 'OWNER' || 
                   currentUser?.role === 'SUPER_ADMIN';

  // Get hours for a project
  const getProjectHours = (projectId: string) => {
    const entries = (timeEntries && Array.isArray(timeEntries) ? timeEntries : []).filter(e => e.projectId === projectId);
    const totalSeconds = entries.reduce((sum, e) => {
      if (e.status === 'stopped' || e.status === 'paused') {
        return sum + (e.duration || 0);
      } else if (e.status === 'running') {
        return sum + (e.duration || 0);
      }
      return sum;
    }, 0);
    return totalSeconds / 3600;
  };

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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Projects</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage and organize your projects
                    </p>
                  </div>
                  {canManage && (
                    <Button onClick={handleCreate} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Project
                    </Button>
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.active} active, {stats.archived} archived
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
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
                        <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats.totalBudget > 0 ? `$${stats.totalBudget.toLocaleString()}` : '-'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stats.withBudget} projects with budget
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats.totalHours > 0 ? stats.totalHours.toFixed(1) : '0'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Hours tracked across all projects
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
                      <CardDescription>Search and filter projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, description, or client..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
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
                          Showing {filteredProjects.length} of {projects.length} projects
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Projects Grid/List */}
                  {isLoading && projects.length === 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardHeader>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-48" />
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-3/4" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <Card>
                      <CardContent className="py-12">
                        <EmptyState
                          icon={<FolderOpen className="h-12 w-12 mx-auto" />}
                          title={hasActiveFilters ? "No projects found" : "No projects yet"}
                          description={
                            hasActiveFilters
                              ? "Try adjusting your filters to see more results"
                              : "Create your first project to start organizing your work"
                          }
                          action={
                            hasActiveFilters
                              ? {
                                  label: 'Clear Filters',
                                  onClick: clearFilters,
                                }
                              : canManage
                                ? {
                                    label: 'Create Project',
                                    onClick: handleCreate,
                                  }
                                : undefined
                          }
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-5 w-5 text-primary" />
                          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
                          <Badge variant="secondary" className="ml-2">
                            {filteredProjects.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredProjects.map((project) => {
                          const projectHours = getProjectHours(project.id);
                          return (
                            <Card 
                              key={project.id}
                              className="transition-all hover:shadow-lg hover:-translate-y-1"
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div
                                        className="h-3 w-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: project.color }}
                                      />
                                      <CardTitle className="text-lg">{project.name}</CardTitle>
                                    </div>
                                    {project.description && (
                                      <CardDescription className="line-clamp-2">
                                        {project.description}
                                      </CardDescription>
                                    )}
                                  </div>
                                  {canManage && (
                                    <div className="flex gap-1 ml-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleEdit(project)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Edit project</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteClick(project)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete project</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {project.clientName && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Client</span>
                                      <span className="font-medium">{project.clientName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <Badge
                                      variant={project.status === 'active' ? 'default' : 'outline'}
                                      className={
                                        project.status === 'active'
                                          ? 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20'
                                          : ''
                                      }
                                    >
                                      {project.status === 'active' ? (
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                      ) : (
                                        <Archive className="mr-1 h-3 w-3" />
                                      )}
                                      {project.status}
                                    </Badge>
                                  </div>
                                  {project.budget && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Budget</span>
                                      <span className="font-medium">${project.budget.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {projectHours > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Hours Tracked</span>
                                      <span className="font-medium">{projectHours.toFixed(1)}h</span>
                                    </div>
                                  )}
                                  <div
                                    className="h-2 w-full rounded-full"
                                    style={{ backgroundColor: project.color }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        {canManage && (
          <>
            <ProjectDialog
              open={dialogOpen}
              onOpenChange={handleDialogClose}
              project={selectedProject}
            />

            <DeleteConfirmDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onConfirm={handleDeleteConfirm}
              title="Delete Project"
              description={`Are you sure you want to delete "${projectToDelete?.name}"? This action cannot be undone.`}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
