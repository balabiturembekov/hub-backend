'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TimeEntry } from '@/types';
import { formatDuration } from '@/lib/utils';
import { format } from 'date-fns';

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
}

export function TimeEntryDialog({ open, onOpenChange, entry }: TimeEntryDialogProps) {
  const { updateTimeEntry, projects, isLoading } = useStore();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    projectId: '',
    description: '',
    duration: '',
  });

  useEffect(() => {
    if (entry) {
      // Validate projectId - reset to 'none' if project doesn't exist or is archived
      let projectId = entry.projectId || 'none';
      if (projectId !== 'none') {
        const projectExists = projects.find((p) => p.id === projectId && p.status === 'active');
        if (!projectExists) {
          projectId = 'none';
        }
      }
      
      setFormData({
        projectId,
        description: entry.description || '',
        duration: formatDuration(entry.duration),
      });
    } else {
      setFormData({
        projectId: 'none',
        description: '',
        duration: '',
      });
    }
  }, [entry, open, projects]);

  const parseDuration = (durationStr: string): number | null => {
    // Parse format like "2h 30m" or "2.5h" or "150m"
    const trimmed = durationStr.trim();
    
    if (!trimmed) {
      return null; // Return null for empty string to show validation error
    }
    
    // Try "2h 30m" format
    const hourMinMatch = trimmed.match(/(\d+)h\s*(\d+)m?/i);
    if (hourMinMatch) {
      const hours = parseInt(hourMinMatch[1], 10);
      const minutes = parseInt(hourMinMatch[2], 10);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes >= 60) {
        return null; // Invalid format
      }
      return hours * 3600 + minutes * 60;
    }
    
    // Try "2.5h" or "2h" format
    const hourMatch = trimmed.match(/([\d.]+)h?/i);
    if (hourMatch) {
      const hours = parseFloat(hourMatch[1]);
      if (isNaN(hours) || !isFinite(hours) || hours < 0) {
        return null;
      }
      // Validate hours doesn't exceed max (2147483647 seconds = ~68 years)
      const seconds = Math.round(hours * 3600);
      if (seconds > 2147483647) {
        return null; // Exceeds max
      }
      return seconds;
    }
    
    // Try "150m" format
    const minMatch = trimmed.match(/(\d+)m/i);
    if (minMatch) {
      const minutes = parseInt(minMatch[1], 10);
      if (isNaN(minutes) || minutes < 0) {
        return null;
      }
      const seconds = minutes * 60;
      if (seconds > 2147483647) {
        return null; // Exceeds max
      }
      return seconds;
    }
    
    return null; // Return null if no valid format found
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    
    // Prevent double submission
    if (isLoading) {
      return;
    }
    
    // Validate duration input
    if (!formData.duration.trim()) {
      toast({
        title: 'Error',
        description: 'Duration is required',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const duration = parseDuration(formData.duration);
      if (duration === null) {
        toast({
          title: 'Error',
          description: 'Please enter duration in format: "2h 30m", "2.5h", or "150m"',
          variant: 'destructive',
        });
        return;
      }

      if (duration <= 0) {
        toast({
          title: 'Error',
          description: 'Duration must be greater than zero',
          variant: 'destructive',
        });
        return;
      }

      // Validate duration doesn't exceed max (68+ years)
      if (duration > 2147483647) {
        toast({
          title: 'Error',
          description: 'Duration exceeds maximum allowed value (68+ years)',
          variant: 'destructive',
        });
        return;
      }

      const payload: any = {
        duration,
      };

      if (formData.projectId && formData.projectId !== 'none') {
        payload.projectId = formData.projectId;
      } else {
        payload.projectId = null;
      }

      if (formData.description) {
        payload.description = formData.description;
      }

      await updateTimeEntry(entry.id, payload);
      toast({
        title: 'Success',
        description: 'Time entry updated successfully',
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to update time entry',
        variant: 'destructive',
      });
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update time entry details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date & Time</Label>
              <Input
                id="date"
                value={(() => {
                  try {
                    const date = new Date(entry.startTime);
                    if (isNaN(date.getTime())) return 'Invalid date';
                    // Use format from date-fns instead of toLocaleString to avoid hydration mismatch
                    return format(date, 'PPp');
                  } catch {
                    return 'Invalid date';
                  }
                })()}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={formData.projectId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="duration">
                Duration (e.g., "2h 30m", "2.5h", or "150m")
              </Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="2h 30m"
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                disabled={isLoading}
                placeholder="What did you work on?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || entry.status === 'running'}>
              {isLoading ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
