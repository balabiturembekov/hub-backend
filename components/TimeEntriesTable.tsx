'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Trash2, Search, Clock, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { formatDuration, formatDurationFull } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TimeEntryDialog } from '@/components/admin/TimeEntryDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { useToast } from '@/hooks/use-toast';
import { TimeEntry } from '@/types';

interface TimeEntriesTableProps {
  userId?: string;
  showActions?: boolean;
}

export function TimeEntriesTable({ userId, showActions = true }: TimeEntriesTableProps) {
  const { timeEntries, projects, users, deleteTimeEntry, isLoading, currentUser } = useStore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [screenshotGalleryOpen, setScreenshotGalleryOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);
  const [entryForScreenshots, setEntryForScreenshots] = useState<TimeEntry | null>(null);

  // Validate projectFilter - reset to 'all' if project was deleted or archived
  useEffect(() => {
    if (projectFilter !== 'all' && projectFilter !== 'none') {
      // Validate projects array before using find
      if (!projects || !Array.isArray(projects)) {
        return;
      }
      const projectExists = projects.find((p) => p.id === projectFilter && p.status === 'active');
      if (!projectExists) {
        setProjectFilter('all');
      }
    }
  }, [projectFilter, projects]);

  // Validate userFilter - reset to 'all' if user was deleted or inactive
  useEffect(() => {
    if (userFilter !== 'all') {
      // Validate users array before using find
      if (!users || !Array.isArray(users)) {
        return;
      }
      const userExists = users.find((u) => u.id === userFilter && u.status === 'active');
      if (!userExists) {
        setUserFilter('all');
      }
    }
  }, [userFilter, users]);

  // Filter entries
  let filteredEntries = timeEntries;

  // For employees, only show their own entries
  const isEmployee = currentUser?.role === 'employee';
  if (isEmployee) {
    filteredEntries = filteredEntries.filter((e) => e.userId === currentUser?.id);
  }

  // Filter by user (only for admins/owners/super_admins)
  if (userId) {
    filteredEntries = filteredEntries.filter((e) => e.userId === userId);
  } else if (userFilter !== 'all' && !isEmployee) {
    filteredEntries = filteredEntries.filter((e) => e.userId === userFilter);
  }

  // Filter by project
  if (projectFilter !== 'all') {
    if (projectFilter === 'none') {
      filteredEntries = filteredEntries.filter((e) => !e.projectId);
    } else {
      filteredEntries = filteredEntries.filter((e) => e.projectId === projectFilter);
    }
  }

  // Filter by date
  if (dateFilter !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateFilter === 'today') {
      filteredEntries = filteredEntries.filter((e) => {
        try {
          const entryDate = new Date(e.startTime);
          if (isNaN(entryDate.getTime())) return false;
          return entryDate >= today;
        } catch {
          return false;
        }
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredEntries = filteredEntries.filter((e) => {
        try {
          const entryDate = new Date(e.startTime);
          if (isNaN(entryDate.getTime())) return false;
          return entryDate >= weekAgo;
        } catch {
          return false;
        }
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredEntries = filteredEntries.filter((e) => {
        try {
          const entryDate = new Date(e.startTime);
          if (isNaN(entryDate.getTime())) return false;
          return entryDate >= monthAgo;
        } catch {
          return false;
        }
      });
    }
  }

  // Search filter
  if (searchTerm) {
    filteredEntries = filteredEntries.filter((e) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (e.userName || '').toLowerCase().includes(searchLower) ||
        (e.projectName || '').toLowerCase().includes(searchLower) ||
        (e.description || '').toLowerCase().includes(searchLower)
      );
    });
  }

  // Sort by date (newest first)
  filteredEntries = [...filteredEntries].sort((a, b) => {
    try {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      if (isNaN(timeA)) return 1; // Invalid dates go to end
      if (isNaN(timeB)) return -1;
      return timeB - timeA;
    } catch {
      return 0; // If comparison fails, keep order
    }
  });

  const handleEdit = (entry: TimeEntry) => {
    if (entry.status === 'running') {
      toast({
        title: 'Error',
        description: 'Cannot edit a running time entry',
        variant: 'destructive',
      });
      return;
    }
    setSelectedEntry(entry);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (entry: TimeEntry) => {
    // Prevent deleting active time entries (running or paused)
    if (entry.status === 'running' || entry.status === 'paused') {
      toast({
        title: 'Error',
        description: 'Cannot delete an active time entry. Please stop it first.',
        variant: 'destructive',
      });
      return;
    }
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    
    try {
      await deleteTimeEntry(entryToDelete.id);
      toast({
        title: 'Success',
        description: 'Time entry deleted successfully',
      });
      setEntryToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to delete time entry',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedEntry(null);
  };

  const canEdit = (entry: TimeEntry) => {
    const isAdminOrOwner = currentUser?.role === 'admin' || 
                          currentUser?.role === 'OWNER' || 
                          currentUser?.role === 'SUPER_ADMIN';
    return entry.userId === currentUser?.id || isAdminOrOwner;
  };

  const getProjectColor = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = projects.find((p) => p.id === projectId);
    return project?.color;
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Input
                    placeholder="Search entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search by user name, project name, or description</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* Only show user filter for admins/owners/super_admins (employees see only their own entries) */}
          {!userId && !isEmployee && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users && Array.isArray(users) && users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="none">No project</SelectItem>
              {projects
                .filter((p) => p.status === 'active')
                .map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Only show User column for admins/owners/super_admins (employees see only their own entries) */}
                {!isEmployee && <TableHead>User</TableHead>}
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                {showActions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && filteredEntries.length === 0 ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      {showActions && (
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-16 ml-auto" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showActions ? (isEmployee ? 5 : 6) : (isEmployee ? 4 : 5)} className="h-64">
                    <EmptyState
                      icon={<Clock className="h-12 w-12 mx-auto" />}
                      title={
                        searchTerm || projectFilter !== 'all' || userFilter !== 'all' || dateFilter !== 'all'
                          ? 'No entries found'
                          : 'No time entries yet'
                      }
                      description={
                        searchTerm || projectFilter !== 'all' || userFilter !== 'all' || dateFilter !== 'all'
                          ? 'Try adjusting your filters to see more results'
                          : 'Start tracking your time to see entries here'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    {/* Only show User cell for admins/owners/super_admins */}
                    {!isEmployee && (
                      <TableCell className="font-medium">{entry.userName}</TableCell>
                    )}
                    <TableCell>
                      {entry.projectName ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: getProjectColor(entry.projectId),
                                color: getProjectColor(entry.projectId),
                              }}
                              className="cursor-help"
                            >
                              {entry.projectName}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Time tracked for this project</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">No project</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        try {
                          const date = new Date(entry.startTime);
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return format(date, 'MMM dd, yyyy HH:mm');
                        } catch {
                          return 'Invalid date';
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {entry.status === 'running' ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-green-600 font-medium cursor-help">Live</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Timer is currently running and tracking time</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        formatDurationFull(entry.duration / 3600)
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={
                              entry.status === 'running'
                                ? 'default'
                                : entry.status === 'paused'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="cursor-help"
                          >
                            {entry.status}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {entry.status === 'running' 
                              ? 'Timer is currently running and tracking time' 
                              : entry.status === 'paused'
                              ? 'Timer is paused and not tracking time'
                              : 'Timer has been stopped and time entry is saved'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    {showActions && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEntryForScreenshots(entry);
                                  setScreenshotGalleryOpen(true);
                                }}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View screenshots</p>
                            </TooltipContent>
                          </Tooltip>
                          {canEdit(entry) && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(entry)}
                                    disabled={entry.status === 'running'}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {entry.status === 'running' 
                                      ? 'Stop the timer before editing' 
                                      : 'Edit time entry'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(entry)}
                                    disabled={entry.status === 'running'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {entry.status === 'running' 
                                      ? 'Stop the timer before deleting' 
                                      : 'Delete time entry'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TimeEntryDialog
        open={editDialogOpen}
        onOpenChange={handleDialogClose}
        entry={selectedEntry}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Time Entry"
        description="Are you sure you want to delete this time entry? This action cannot be undone."
        isLoading={isLoading}
      />

      <ScreenshotGallery
        timeEntryId={entryForScreenshots?.id || ''}
        open={screenshotGalleryOpen}
        onOpenChange={(open) => {
          setScreenshotGalleryOpen(open);
          if (!open) {
            setEntryForScreenshots(null);
          }
        }}
      />
    </TooltipProvider>
  );
}
