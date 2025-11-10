'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, Square, Clock, Keyboard, Camera, RefreshCw } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useScreenCapture } from '@/hooks/useScreenCapture';
import { useScreenshotSettings } from '@/hooks/useScreenshotSettings';

export function TimeTracker() {
  const { 
    currentUser, 
    projects, 
    activeTimeEntry, 
    startTimer, 
    stopTimer, 
    pauseTimer, 
    resumeTimer,
    isLoading,
  } = useStore();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('none');
  const [currentTime, setCurrentTime] = useState(0);
  const isInitializedRef = useRef(false);
  // Track previous values to adjust state during rendering (following React best practices)
  const [prevProjects, setPrevProjects] = useState(projects);
  const [prevActiveTimeEntry, setPrevActiveTimeEntry] = useState(activeTimeEntry);
  const [prevSelectedProject, setPrevSelectedProject] = useState(selectedProject);
  // Track pending toast notifications to prevent memory leaks
  const [pendingToast, setPendingToast] = useState<{ type: string; message: string } | null>(null);
  
  // Screenshot settings and capture
  const { settings: screenshotSettings } = useScreenshotSettings();
  const { 
    isCapturing: isScreenCapturing,
    hasPermission: hasScreenshotPermission,
    startCapture: startScreenshotCapture,
    stopCapture: stopScreenshotCapture 
  } = useScreenCapture({
    enabled: screenshotSettings.enabled, // Always enabled if user enabled it in settings
    interval: (screenshotSettings.interval || 60) * 1000, // convert to milliseconds, fallback to 60s if undefined
    timeEntryId: activeTimeEntry?.id || null,
  });

  // Auto-resume screenshot capture if timer is running and capture was stopped (bug82)
  // This handles the case when user navigates away and comes back
  useEffect(() => {
    // Check if timer is running and screenshot capture should be active
    if (activeTimeEntry?.status === 'running' && 
        activeTimeEntry?.id && 
        screenshotSettings.enabled && 
        !isScreenCapturing &&
        hasScreenshotPermission !== false) {
      // Only auto-resume if permission was previously granted (not null, not false)
      // If permission was revoked (false), don't auto-resume - user needs to click resume button
      if (hasScreenshotPermission === true) {
        console.log('[TimeTracker] Auto-resuming screenshot capture after remount');
        // Small delay to ensure component is fully mounted
        const timeoutId = setTimeout(() => {
          const state = useStore.getState();
          const currentActiveEntry = state.activeTimeEntry;
          // Double-check conditions before resuming
          if (currentActiveEntry?.status === 'running' && 
              currentActiveEntry?.id && 
              currentActiveEntry.id.trim() !== '' &&
              screenshotSettings.enabled &&
              !isScreenCapturing) {
            console.log('[TimeTracker] Resuming screenshot capture');
            startScreenshotCapture().catch((error) => {
              console.error('[TimeTracker] Failed to auto-resume screenshot capture:', error);
              // If auto-resume fails (e.g., requires user gesture), that's okay
              // User can manually resume if needed
            });
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [activeTimeEntry?.id, activeTimeEntry?.status, screenshotSettings.enabled, isScreenCapturing, hasScreenshotPermission, startScreenshotCapture]);

  // Validate selectedProject during rendering - reset if project was deleted or archived
  // This follows React best practices: adjust state during rendering, not in Effect
  if (projects !== prevProjects || selectedProject !== prevSelectedProject) {
    if (projects && Array.isArray(projects) && selectedProject !== 'none') {
      const projectExists = projects.find((p) => p.id === selectedProject && p.status === 'active');
      // Only reset if project doesn't exist AND it was previously selected (to avoid infinite loops)
      // Check that selectedProject hasn't already been reset to 'none' in this render cycle
      if (!projectExists && prevSelectedProject === selectedProject && selectedProject !== 'none') {
        // Project was deleted/archived - reset during render
        setSelectedProject('none');
        setPrevSelectedProject('none');
        // Schedule toast notification for after render (side effect, but necessary for UX)
        if (currentUser?.role === 'employee') {
          setPendingToast({
            type: 'project_unavailable',
            message: 'The selected project is no longer available. Please select a different project.',
          });
        }
      }
    }
    
    // Update previous values after render logic
    // Always update to track changes, but avoid infinite loops by checking if values actually changed
    if (projects !== prevProjects) {
      setPrevProjects(projects);
    }
    if (selectedProject !== prevSelectedProject) {
      setPrevSelectedProject(selectedProject);
    }
  }
  
  // Show pending toast notifications after render
  useEffect(() => {
    if (pendingToast) {
      const timeoutId = setTimeout(() => {
        toast({
          title: 'Project Unavailable',
          description: pendingToast.message,
          variant: 'destructive',
        });
        setPendingToast(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingToast, toast]);

  // Sync selectedProject with activeTimeEntry.projectId during rendering
  // This follows React best practices: adjust state during rendering, not in Effect
  if (activeTimeEntry?.id !== prevActiveTimeEntry?.id || 
      activeTimeEntry?.projectId !== prevActiveTimeEntry?.projectId ||
      activeTimeEntry?.status !== prevActiveTimeEntry?.status) {
    
    // Only sync for employees, and only if there's an active time entry for current user
    if (currentUser?.role === 'employee' && activeTimeEntry && activeTimeEntry.userId === currentUser.id) {
      // If activeTimeEntry has a projectId, sync selectedProject to it
      if (activeTimeEntry.projectId && activeTimeEntry.projectId !== selectedProject) {
        // Verify project exists and is active before syncing (prevent setting invalid project)
        if (projects && Array.isArray(projects)) {
          const projectExists = projects.find((p) => p.id === activeTimeEntry.projectId && p.status === 'active');
          if (projectExists && activeTimeEntry.projectId) {
            // Sync during render
            setSelectedProject(activeTimeEntry.projectId);
            setPrevSelectedProject(activeTimeEntry.projectId);
          } else if (selectedProject !== 'none') {
            // Project doesn't exist or is archived - reset to 'none' and notify
            setSelectedProject('none');
            setPrevSelectedProject('none');
            // Schedule toast notification for after render
            setPendingToast({
              type: 'project_unavailable_timer',
              message: 'The project associated with your running timer is no longer available.',
            });
          }
        }
      }
      // If activeTimeEntry has no projectId but selectedProject is set, reset it
      else if (!activeTimeEntry.projectId && selectedProject !== 'none' && activeTimeEntry.status === 'stopped') {
        // Only reset if timer is stopped (additional safety check)
        if (activeTimeEntry.userId === currentUser.id) {
          setSelectedProject('none');
          setPrevSelectedProject('none');
        }
      }
    }
    // For non-employees, reset selectedProject when timer stops (they can work without projects)
    else if (currentUser?.role !== 'employee' && !activeTimeEntry && selectedProject !== 'none') {
      // Reset only if no active timer
      setSelectedProject('none');
      setPrevSelectedProject('none');
    }
    
    // Update previous value after render logic
    setPrevActiveTimeEntry(activeTimeEntry);
  }

  // Calculate elapsed time during rendering (not in Effect)
  // This follows React best practices: compute derived state during rendering
  const elapsed = useMemo(() => {
    if (!activeTimeEntry) {
      return 0;
    }

    const status = activeTimeEntry.status;
    const duration = activeTimeEntry.duration || 0;
    const startTime = activeTimeEntry.startTime;

    // For paused and stopped entries, show only the stored duration
    if (status === 'paused' || status === 'stopped') {
      return duration;
    }

    // For running entries, calculate elapsed time in real-time
    if (status === 'running') {
      // If currentTime is not initialized yet (0), return duration to avoid showing incorrect time
      // currentTime will be initialized in useEffect and trigger re-render
      if (currentTime === 0) {
        return duration;
      }
      const now = currentTime;
      
      try {
        const startDate = new Date(startTime);
        if (isNaN(startDate.getTime())) {
          return duration;
        }
        const start = startDate.getTime();
        // duration is cumulative time already tracked (from previous pause cycles)
        // Calculate current session time: (now - start) gives time since last start/resume
        const currentSessionSeconds = Math.floor((now - start) / 1000);
        
        // Log warning if elapsed time is negative (possible clock sync issue)
        if (currentSessionSeconds < 0) {
          console.warn('[TimeTracker] Negative elapsed time detected - possible clock synchronization issue', {
            entryId: activeTimeEntry.id,
            startTime: startTime,
            now: currentTime,
            elapsed: currentSessionSeconds,
          });
        }
        
        const elapsedSeconds = Math.max(0, currentSessionSeconds + duration);
        
        if (isFinite(elapsedSeconds) && !isNaN(elapsedSeconds)) {
          return elapsedSeconds;
        }
        return duration;
      } catch {
        return duration;
      }
    }

    return duration;
  }, [activeTimeEntry, currentTime]);

  // Initialize currentTime on mount (client-side only)
  // This is necessary initialization, not a derived state
  useEffect(() => {
    if (!isInitializedRef.current && currentTime === 0) {
      isInitializedRef.current = true;
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setCurrentTime(Date.now());
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [currentTime]);

  // Update currentTime every second when timer is running
  // This Effect is necessary for synchronizing with the timer (external system)
  useEffect(() => {
    if (!activeTimeEntry || activeTimeEntry.status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry?.id, activeTimeEntry?.status, activeTimeEntry]);

  const handleStart = async () => {
    console.log('handleStart called', { currentUser, isLoading, selectedProject });
    if (!currentUser) {
      console.warn('No current user');
      toast({
        title: 'Error',
        description: 'Please log in to start tracking time',
        variant: 'destructive',
      });
      return;
    }
    
    if (isLoading) {
      console.warn('Already loading');
      return;
    }
    
    // For employees, project selection is required
    const isEmployee = currentUser.role === 'employee';
    if (isEmployee && selectedProject === 'none') {
      toast({
        title: 'Project Required',
        description: 'Please select a project before starting the timer',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate that selected project exists and is active (prevent using invalid project IDs)
    if (selectedProject !== 'none') {
      // Validate projects array before using find
      if (!projects || !Array.isArray(projects)) {
        toast({
          title: 'Error',
          description: 'Projects data is not available. Please refresh the page.',
          variant: 'destructive',
        });
        return;
      }
      const projectExists = projects.find((p) => p.id === selectedProject && p.status === 'active');
      if (!projectExists) {
        toast({
          title: 'Invalid Project',
          description: 'The selected project is no longer available. Please select a different project.',
          variant: 'destructive',
        });
        setSelectedProject('none'); // Reset to 'none' to prevent future attempts
        return;
      }
    }
    
    // Start screenshot capture BEFORE async operations to ensure user gesture is still valid
    // getDisplayMedia must be called from a user gesture handler, and the window can expire
    // if we wait for async operations (network requests, state updates, etc.)
    let screenshotCapturePromise: Promise<void> | null = null;
    if (screenshotSettings.enabled) {
      console.log('[TimeTracker] Starting screenshot capture immediately (before timer start) to preserve user gesture');
      // Call getDisplayMedia immediately while user gesture is still valid
      // Use requestAnimationFrame for minimal delay (faster than setTimeout)
      screenshotCapturePromise = new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Start capture immediately - it will wait for timeEntryId to be available
          startScreenshotCapture().catch((error) => {
            console.error('[TimeTracker] Failed to start screenshot capture:', error);
            // If error is InvalidStateError, it means user gesture expired (shouldn't happen now)
            if (error?.name === 'InvalidStateError') {
              toast({
                title: 'Screen Capture Required',
                description: 'Please click the "Start Screenshot Capture" button to enable screenshots.',
                variant: 'default',
              });
            }
          }).finally(() => {
            resolve();
          });
        });
      });
    }
    
    try {
      const projectId = selectedProject === 'none' ? undefined : selectedProject;
      console.log('Starting timer with:', { userId: currentUser.id, projectId });
      await startTimer(currentUser.id, projectId);
      
      // Get fresh state after startTimer to avoid race conditions
      const state = useStore.getState();
      const freshActiveEntry = state.activeTimeEntry;
      
      // Don't reset selectedProject for employees - they may want to continue with the same project
      // Only reset for admins/owners who can work without projects
      if (currentUser.role !== 'employee') {
        setSelectedProject('none');
      }
      
      // Screenshot capture was already started above (before async operations)
      // Wait for it to complete (or fail) to ensure proper state
      if (screenshotCapturePromise) {
        await screenshotCapturePromise;
      }
      
      // Check if screenshot permission was revoked (only after successful timer start)
      if (screenshotSettings.enabled && freshActiveEntry?.status === 'running' && hasScreenshotPermission === false) {
        // Permission was revoked - don't auto-resume, let user know
        console.log('[TimeTracker] Screenshot permission was revoked, waiting for user action');
      }
      
      toast({
        title: 'Timer started',
        description: 'Time tracking has started',
      });
    } catch (error: unknown) {
      console.error('Failed to start timer:', error);
      
      // CRITICAL FIX: If timer failed to start but screenshot capture was initiated,
      // stop the screenshot capture to prevent orphaned stream
      if (screenshotCapturePromise && screenshotSettings.enabled) {
        console.log('[TimeTracker] Timer failed, stopping screenshot capture');
        try {
          // Wait for screenshot capture to complete (or fail), then stop it
          await screenshotCapturePromise;
          if (isScreenCapturing) {
            stopScreenshotCapture();
          }
        } catch (screenshotError) {
          console.error('[TimeTracker] Error stopping screenshot capture after timer failure:', screenshotError);
          // Try to stop anyway
          if (isScreenCapturing) {
            stopScreenshotCapture();
          }
        }
      }
      
      const errorMessage = (error as { isNetworkError?: boolean; response?: { data?: { message?: string } }; message?: string }).isNetworkError 
        ? 'Network error: Could not connect to server. Please check if the backend is running.'
        : (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to start timer';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleStop = async () => {
    if (!activeTimeEntry || isLoading) return;
    try {
      // Stop screenshot capture before stopping timer
      if (isScreenCapturing) {
        stopScreenshotCapture();
      }
      await stopTimer(activeTimeEntry.id);
      // Don't reset selectedProject for employees - they may want to continue with the same project
      // Only reset for admins/owners who can work without projects
      if (currentUser?.role !== 'employee') {
        setSelectedProject('none');
      }
      toast({
        title: 'Timer stopped',
        description: 'Time tracking has been stopped',
      });
    } catch (error: unknown) {
      console.error('Failed to stop timer:', error);
      toast({
        title: 'Error',
        description: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to stop timer',
        variant: 'destructive',
      });
    }
  };

  const handlePause = async () => {
    if (!activeTimeEntry || activeTimeEntry.status !== 'running' || isLoading) return;
    try {
      // Stop screenshot capture when pausing timer (bug79)
      if (isScreenCapturing) {
        console.log('[TimeTracker] Stopping screenshot capture due to timer pause');
        stopScreenshotCapture();
      }
      await pauseTimer(activeTimeEntry.id);
      toast({
        title: 'Timer paused',
        description: 'Time tracking has been paused',
      });
    } catch (error: unknown) {
      console.error('Failed to pause timer:', error);
      toast({
        title: 'Error',
        description: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to pause timer',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async () => {
    if (!activeTimeEntry || isLoading) return;
    try {
      await resumeTimer(activeTimeEntry.id);
      
      // Get fresh state after resumeTimer to avoid race conditions
      const state = useStore.getState();
      const freshActiveEntry = state.activeTimeEntry;
      
      // Resume screenshot capture if enabled and permission exists (bug79)
      if (screenshotSettings.enabled && !isScreenCapturing && hasScreenshotPermission !== false) {
        // Wait a bit for state to update after resume
        // Note: This setTimeout is in an async function handler, not in render or effect
        // It's safe here as it's part of user action handler
        setTimeout(() => {
          const finalState = useStore.getState();
          const finalActiveEntry = finalState.activeTimeEntry;
          // Double-check conditions before resuming (race condition protection)
          if (finalActiveEntry?.status === 'running' && 
              finalActiveEntry?.id && 
              finalActiveEntry.id.trim() !== '' &&
              finalActiveEntry.id === freshActiveEntry?.id &&
              screenshotSettings.enabled) {
            console.log('[TimeTracker] Resuming screenshot capture after timer resume');
            startScreenshotCapture().catch((error) => {
              console.error('[TimeTracker] Failed to resume screenshot capture:', error);
            });
          }
        }, 100);
      }
      
      toast({
        title: 'Timer resumed',
        description: 'Time tracking has been resumed',
      });
    } catch (error: unknown) {
      console.error('Failed to resume timer:', error);
      toast({
        title: 'Error',
        description: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to resume timer',
        variant: 'destructive',
      });
    }
  };

  // Keyboard shortcuts - use refs for handlers to prevent recreating shortcuts
  const handleStartRef = useRef(handleStart);
  const handleStopRef = useRef(handleStop);
  const handlePauseRef = useRef(handlePause);
  const handleResumeRef = useRef(handleResume);
  
  // Update refs when handlers change (use latest state via refs to prevent stale closures)
  useEffect(() => {
    handleStartRef.current = handleStart;
    handleStopRef.current = handleStop;
    handlePauseRef.current = handlePause;
    handleResumeRef.current = handleResume;
  });

  // Keyboard shortcuts - memoized to prevent recreating on every render
  const shortcuts = useMemo(() => [
    {
      key: ' ',
      action: () => {
        if (!currentUser || isLoading) return;
        if (!activeTimeEntry) {
          // For employees, check if project is selected before starting
          const isEmployee = currentUser.role === 'employee';
          if (isEmployee && selectedProject === 'none') {
            toast({
              title: 'Project Required',
              description: 'Please select a project before starting the timer',
              variant: 'destructive',
            });
            return;
          }
          // Validate project exists before starting (for keyboard shortcut)
          if (isEmployee && selectedProject !== 'none') {
            const state = useStore.getState();
            // Check if projects array is valid
            if (!state.projects || !Array.isArray(state.projects)) {
              toast({
                title: 'Error',
                description: 'Projects data is not available. Please refresh the page.',
                variant: 'destructive',
              });
              return;
            }
            const projectExists = state.projects.find((p) => p.id === selectedProject && p.status === 'active');
            if (!projectExists) {
              toast({
                title: 'Invalid Project',
                description: 'The selected project is no longer available. Please select a different project.',
                variant: 'destructive',
              });
              return;
            }
          }
          handleStartRef.current();
        } else if (activeTimeEntry.status === 'running') {
          handleStopRef.current();
        } else if (activeTimeEntry.status === 'paused') {
          handleResumeRef.current();
        }
      },
      enabled: !!currentUser && !isLoading,
    },
    {
      key: 'p',
      action: () => {
        if (!currentUser || isLoading || !activeTimeEntry) return;
        if (activeTimeEntry.status === 'running') {
          handlePauseRef.current();
        } else if (activeTimeEntry.status === 'paused') {
          handleResumeRef.current();
        }
      },
      enabled: !!currentUser && !!activeTimeEntry && !isLoading,
    },
  ], [currentUser, isLoading, activeTimeEntry, selectedProject, toast]);
  
  useKeyboardShortcuts(shortcuts);

  // Show skeleton only if no user yet (initial load), not during timer operations
  if (!currentUser && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Tracker</CardTitle>
          <CardDescription>Track your work time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-16 w-48 mx-auto" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Please log in to start tracking time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Time Tracker</CardTitle>
              <CardDescription>
                Track your work time {activeTimeEntry?.projectName && `on ${activeTimeEntry.projectName}`}
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Keyboard className="h-3 w-3" />
                  <span className="hidden sm:inline">
                    {!activeTimeEntry ? 'Space' : activeTimeEntry.status === 'running' ? 'Space/P' : 'Space'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard shortcuts: Space to start/stop, P to pause</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm">Current Session</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Time elapsed in the current tracking session</p>
              </TooltipContent>
            </Tooltip>
            <div className="text-5xl font-bold tabular-nums">
              {formatDuration(elapsed)}
            </div>
            {(activeTimeEntry?.projectName || isScreenCapturing || (screenshotSettings.enabled && activeTimeEntry?.status === 'running' && !isScreenCapturing && hasScreenshotPermission === false)) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {activeTimeEntry?.projectName && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help">
                        {activeTimeEntry.projectName}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tracking time for this project</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {isScreenCapturing && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="cursor-help">
                        <Camera className="h-3 w-3 mr-1" />
                        Capturing Screenshots
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Screenshots are being captured automatically while the timer is running</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {screenshotSettings.enabled && activeTimeEntry?.status === 'running' && !isScreenCapturing && hasScreenshotPermission === false && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="destructive" className="cursor-help">
                        <Camera className="h-3 w-3 mr-1" />
                        Screenshots Paused
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Screenshot capture is paused. Click &quot;Resume Screenshot Capture&quot; button to continue.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>

        {!activeTimeEntry ? (
          <div className="space-y-4">
            {/* Show warning only for employees with no active projects */}
            {currentUser?.role === 'employee' && 
             (!projects || !Array.isArray(projects) || projects.filter((p) => p.status === 'active').length === 0) ? (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">No Active Projects</p>
                <p className="mt-1">Please contact your administrator to create a project before starting the timer.</p>
              </div>
            ) : (
              /* Always show Select for employees with projects, and for non-employees */
              <Select 
                value={selectedProject || 'none'} 
                onValueChange={(value) => {
                  setSelectedProject(value || 'none');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    currentUser?.role === 'employee' 
                      ? "Select project" 
                      : "Select project"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {/* Show "No project" option only for non-employees */}
                  {currentUser?.role !== 'employee' && (
                    <SelectItem value="none">No project</SelectItem>
                  )}
                  {/* Show active projects for all users */}
                  {projects && Array.isArray(projects) && projects
                    .filter((p) => p.status === 'active')
                    .map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleStart} 
                  variant="default"
                  className="w-full" 
                  size="lg"
                  disabled={
                    isLoading || 
                    !currentUser || 
                    (currentUser?.role === 'employee' && selectedProject === 'none') ||
                    (currentUser?.role === 'employee' && (!projects || !Array.isArray(projects) || projects.filter((p) => p.status === 'active').length === 0))
                  }
                  type="button"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isLoading ? 'Starting...' : 'Start Timer'}
                  <span className="ml-auto text-xs opacity-60 hidden sm:inline">Space</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {currentUser?.role === 'employee' && (!projects || !Array.isArray(projects) || projects.filter((p) => p.status === 'active').length === 0) ? (
                  <p>No active projects available. Contact your administrator.</p>
                ) : currentUser?.role === 'employee' && selectedProject === 'none' ? (
                  <p>Please select a project to start tracking</p>
                ) : (
                  <p>Press Space to start tracking time</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : activeTimeEntry.status === 'running' ? (
          <div className="space-y-2">
            {/* Resume screenshot button if sharing was stopped */}
            {screenshotSettings.enabled && !isScreenCapturing && hasScreenshotPermission === false && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      console.log('[TimeTracker] User manually resuming screenshot capture');
                      startScreenshotCapture().catch((error) => {
                        console.error('[TimeTracker] Failed to resume screenshot capture:', error);
                        toast({
                          title: 'Error',
                          description: 'Failed to resume screenshot capture. Please check your browser permissions.',
                          variant: 'destructive',
                        });
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resume Screenshot Capture
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Screenshot capture was paused. Click to resume.</p>
                </TooltipContent>
              </Tooltip>
            )}
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handlePause} 
                    variant="outline" 
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                    <span className="ml-auto text-xs opacity-60 hidden sm:inline">P</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press P to pause the timer</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleStop} 
                    variant="destructive" 
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                    <span className="ml-auto text-xs opacity-60 hidden sm:inline">Space</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press Space to stop and save time entry</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleResume} 
                  variant="default"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                  <span className="ml-auto text-xs opacity-60 hidden sm:inline">Space/P</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Press Space or P to resume tracking</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleStop} 
                  variant="destructive" 
                  className="flex-1"
                  disabled={isLoading}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                  <span className="ml-auto text-xs opacity-60 hidden sm:inline">Space</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Press Space to stop and save time entry</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
