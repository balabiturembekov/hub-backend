'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportTimeEntriesToCSV, exportUserStatsToCSV, exportProjectStatsToCSV } from '@/lib/export';
import { TimeEntry, User, Project } from '@/types';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: TimeEntry[];
  users: User[];
  projects: Project[];
  currentUser: User | null;
}

export function ExportDialog({
  open,
  onOpenChange,
  entries,
  users,
  projects,
  currentUser,
}: ExportDialogProps) {
  const { toast } = useToast();
  const [exportType, setExportType] = useState<'entries' | 'users' | 'projects'>('entries');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Validate projectFilter - reset to 'all' if project was deleted or archived
  useEffect(() => {
    if (projectFilter !== 'all' && projectFilter !== 'none') {
      const projectExists = projects.find((p) => p.id === projectFilter && p.status === 'active');
      if (!projectExists) {
        setProjectFilter('all');
      }
    }
  }, [projectFilter, projects]);

  // Validate userFilter - reset to 'all' if user was deleted or inactive
  useEffect(() => {
    if (userFilter !== 'all') {
      const userExists = users.find((u) => u.id === userFilter && u.status === 'active');
      if (!userExists) {
        setUserFilter('all');
      }
    }
  }, [userFilter, users]);

  // Define role flags BEFORE handleExport to avoid ReferenceError
  const isAdmin = currentUser?.role === 'admin' || 
                 currentUser?.role === 'OWNER' || 
                 currentUser?.role === 'SUPER_ADMIN';
  const isEmployee = currentUser?.role === 'employee';

  const handleExport = () => {
    try {
      let filteredEntries = entries;

      // Apply filters
      // For employees, only their own entries are already filtered (passed as entries prop)
      // For admins, apply user filter if set
      if (!isEmployee && userFilter !== 'all') {
        filteredEntries = filteredEntries.filter((e) => e.userId === userFilter);
      }

      if (projectFilter !== 'all') {
        if (projectFilter === 'none') {
          filteredEntries = filteredEntries.filter((e) => !e.projectId);
        } else {
          filteredEntries = filteredEntries.filter((e) => e.projectId === projectFilter);
        }
      }

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
        } else if (dateFilter === 'year') {
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filteredEntries = filteredEntries.filter((e) => {
            try {
              const entryDate = new Date(e.startTime);
              if (isNaN(entryDate.getTime())) return false;
              return entryDate >= yearAgo;
            } catch {
              return false;
            }
          });
        }
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = '';

      switch (exportType) {
        case 'entries':
          filename = `time-entries-${timestamp}.csv`;
          exportTimeEntriesToCSV(filteredEntries, users, projects, filename);
          break;
        case 'users':
          filename = `user-statistics-${timestamp}.csv`;
          exportUserStatsToCSV(users, entries, filename);
          break;
        case 'projects':
          filename = `project-statistics-${timestamp}.csv`;
          exportProjectStatsToCSV(projects, entries, users, filename);
          break;
      }

      toast({
        title: 'Success',
        description: `Exported ${exportType} to ${filename}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose what to export and apply filters if needed
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="exportType">Export Type</Label>
            <Select value={exportType} onValueChange={(value: 'entries' | 'users' | 'projects') => setExportType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select export type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entries">Time Entries</SelectItem>
                {isAdmin && <SelectItem value="users">User Statistics</SelectItem>}
                {isAdmin && <SelectItem value="projects">Project Statistics</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {exportType === 'entries' && (
            <>
              {/* Only show user filter for admins/owners/super_admins (employees see only their own entries) */}
              {!isEmployee && (
                <div className="grid gap-2">
                  <Label htmlFor="userFilter">User Filter</Label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="projectFilter">Project Filter</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
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
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dateFilter">Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="year">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleExport}>
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

