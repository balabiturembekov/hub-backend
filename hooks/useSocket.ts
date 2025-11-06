'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';

// Socket.io works with HTTP/HTTPS URLs and automatically upgrades to WebSocket
// Extract base URL from API URL if WS_URL is not set, or use default
const getWebSocketURL = (): string => {
  // Next.js embeds NEXT_PUBLIC_* variables at build time
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  // Try to derive from API URL
  const apiUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) 
    ? process.env.NEXT_PUBLIC_API_URL 
    : 'http://localhost:3001/api';
  // Remove /api suffix if present and use as base URL
  const baseUrl = apiUrl.replace(/\/api\/?$/, '');
  return baseUrl;
};

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const screenshotSettingsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const currentUser = useStore((state) => state.currentUser);
  
  // Use refs to store handlers to prevent re-subscription
  const updateStatsRef = useRef(useStore.getState().updateStats);
  const addActivityRef = useRef(useStore.getState().addActivity);
  const updateTimeEntryRef = useRef(useStore.getState().updateTimeEntry);
  const addTimeEntryRef = useRef(useStore.getState().addTimeEntry);
  const loadScreenshotSettingsRef = useRef(useStore.getState().loadScreenshotSettings);

  // Update refs when handlers change
  // Note: These are functions that don't change, but we update refs to avoid stale closures
  // This effect runs on every render, but it's cheap (just assigning refs)
  useEffect(() => {
    updateStatsRef.current = useStore.getState().updateStats;
    addActivityRef.current = useStore.getState().addActivity;
    updateTimeEntryRef.current = useStore.getState().updateTimeEntry;
    addTimeEntryRef.current = useStore.getState().addTimeEntry;
    loadScreenshotSettingsRef.current = useStore.getState().loadScreenshotSettings;
  });

  useEffect(() => {
    // Don't connect if user is not logged in
    if (!currentUser) {
      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = api.getAuthToken();
    if (!token) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Disconnect existing socket before creating a new one
    // This prevents multiple connections if currentUser changes rapidly
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Create socket connection (bug71 - handle connection failures)
    let socket: Socket;
    try {
      const wsUrl = getWebSocketURL();
      socket = io(wsUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
    } catch (error) {
      console.error('WebSocket: Failed to create socket connection:', error);
      // Don't set socketRef if creation fails
      return;
    }

    socketRef.current = socket;
    
    // Handle connection errors (bug71)
    socket.on('connect_error', (error) => {
      console.error('WebSocket: Connection error:', error);
      // Socket.io will automatically retry, but we log the error
    });

    // Stats updates
    socket.on('stats:update', (data: any) => {
      if (data.totalHours !== undefined) {
        updateStatsRef.current({
          totalHours: data.totalHours,
          activeUsers: data.activeUsers || 0,
          totalProjects: data.totalProjects || 0,
          todayHours: data.todayHours || 0,
        });
      }
    });

    // Time entry updates
    socket.on('time-entry:update', (data: any) => {
      try {
        const status: 'running' | 'paused' | 'stopped' = 
          data.status === 'RUNNING' ? 'running' : 
          data.status === 'PAUSED' ? 'paused' : 
          'stopped';
        
        // Validate startTime before creating Date
        if (!data.startTime) {
          console.error('WebSocket: Invalid time entry data - missing startTime', data);
          return;
        }

        const entry = {
          id: data.id,
          userId: data.userId,
          userName: data.user?.name || data.userName || '',
          projectId: data.projectId,
          projectName: data.project?.name || data.projectName,
          startTime: new Date(data.startTime),
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          duration: data.duration || 0,
          description: data.description,
          status,
        };

        // Validate dates
        if (isNaN(entry.startTime.getTime())) {
          console.error('WebSocket: Invalid startTime', data.startTime);
          return;
        }
        if (entry.endTime && isNaN(entry.endTime.getTime())) {
          console.error('WebSocket: Invalid endTime', data.endTime);
          entry.endTime = undefined;
        }

        // Check if entry exists and belongs to current user
        const state = useStore.getState();
        const existing = state.timeEntries.find((e) => e.id === entry.id);
        const isCurrentUserEntry = entry.userId === state.currentUser?.id;
        
        // Don't update via WebSocket if a request is in progress (user might be editing)
        // This prevents WebSocket updates from overwriting user's edits
        if (state.isLoading) {
          // Skip this update if a request is in progress
          return;
        }
        
        // Only update/add if it's for current user or if it's a new entry
        if (existing) {
          // Update existing entry
          const canSeeAllEntries = state.currentUser?.role === 'admin' || 
                                   state.currentUser?.role === 'OWNER' || 
                                   state.currentUser?.role === 'SUPER_ADMIN';
          if (isCurrentUserEntry || canSeeAllEntries) {
            // Only send fields that are allowed in UpdateTimeEntryDto
            // Filter out: id, userId, userName, projectName
            const updateData: Partial<typeof entry> = {};
            if (entry.projectId !== undefined) updateData.projectId = entry.projectId;
            if (entry.startTime !== undefined) updateData.startTime = entry.startTime;
            if (entry.endTime !== undefined) updateData.endTime = entry.endTime;
            if (entry.duration !== undefined) updateData.duration = entry.duration;
            if (entry.description !== undefined) updateData.description = entry.description;
            if (entry.status !== undefined) updateData.status = entry.status;
            updateTimeEntryRef.current(entry.id, updateData);
          } else {
            // Update in timeEntries but don't affect activeTimeEntry
            useStore.setState((prevState) => ({
              timeEntries: prevState.timeEntries.map((e) => e.id === entry.id ? entry : e),
            }));
          }
        } else {
          // Only add if it's for current user or if admin/owner/super_admin
          const canSeeAllEntries = state.currentUser?.role === 'admin' || 
                                   state.currentUser?.role === 'OWNER' || 
                                   state.currentUser?.role === 'SUPER_ADMIN';
          if (isCurrentUserEntry || canSeeAllEntries) {
            addTimeEntryRef.current(entry);
          }
        }

        // Sync activeTimeEntry if this is the current user's entry and status changed
        if (isCurrentUserEntry) {
          const currentState = useStore.getState();
          const isActive = currentState.activeTimeEntry?.id === entry.id;
          
          // If entry is stopped, clear activeTimeEntry
          if (entry.status === 'stopped' && isActive) {
            useStore.setState({ activeTimeEntry: null });
          }
          // If entry becomes running/paused and is current active entry, update it
          else if ((entry.status === 'running' || entry.status === 'paused') && isActive) {
            useStore.setState({ activeTimeEntry: entry });
          }
          // If entry becomes running/paused and there's no active entry, set it
          else if ((entry.status === 'running' || entry.status === 'paused') && !currentState.activeTimeEntry) {
            useStore.setState({ activeTimeEntry: entry });
          }
        }
      } catch (error) {
        console.error('WebSocket: Error processing time-entry:update', error);
      }
    });

    // New activity
    socket.on('activity:new', (data: any) => {
      try {
        const state = useStore.getState();
        const currentUserId = state.currentUser?.id;
        const currentUserRole = state.currentUser?.role;
        
        // Employees should only see their own activities
        // Admins/owners/super_admins see all activities
        if (currentUserRole === 'employee' && data.userId !== currentUserId) {
          // Skip this activity for employees if it's not their own
          return;
        }

        // Validate required fields
        if (!data.id || !data.userId) {
          console.warn('WebSocket: Invalid activity data received, missing id or userId', data);
          return;
        }

        // Validate and parse timestamp
        let timestamp: Date;
        if (data.timestamp) {
          try {
            timestamp = new Date(data.timestamp);
            if (isNaN(timestamp.getTime())) {
              console.warn('WebSocket: Invalid timestamp in activity, using current time', data.timestamp);
              timestamp = new Date();
            }
          } catch {
            console.warn('WebSocket: Error parsing timestamp, using current time', data.timestamp);
            timestamp = new Date();
          }
        } else {
          timestamp = new Date();
        }

        // Validate type - should be one of: start, stop, pause, resume
        const validTypes = ['start', 'stop', 'pause', 'resume'];
        const activityType = data.type?.toLowerCase() || 'start';
        const finalType = validTypes.includes(activityType) ? activityType : 'start';
        
        addActivityRef.current({
          id: data.id,
          userId: data.userId,
          userName: data.userName || data.user?.name || 'Unknown User',
          userAvatar: data.userAvatar || data.user?.avatar || undefined, // Include user avatar
          type: finalType,
          timestamp,
          projectId: data.projectId,
        });
      } catch (error) {
        console.error('WebSocket: Error processing activity:new', error);
      }
    });

    // Screenshot settings update
    socket.on('screenshot-settings:update', (data: any) => {
      try {
        console.log('WebSocket: Screenshot settings updated', data);
        
        // Validate data structure
        if (!data || typeof data.screenshotEnabled !== 'boolean' || typeof data.screenshotInterval !== 'number') {
          console.warn('WebSocket: Invalid screenshot settings data:', data);
          return;
        }
        
        // Validate interval is in allowed values (bug47)
        const validIntervals = [30, 60, 300, 600];
        if (!validIntervals.includes(data.screenshotInterval)) {
          console.warn('WebSocket: Invalid screenshot interval value:', data.screenshotInterval);
          return;
        }
        
        // Validate interval is positive (bug49)
        if (data.screenshotInterval <= 0 || !Number.isInteger(data.screenshotInterval)) {
          console.warn('WebSocket: Invalid screenshot interval (must be positive integer):', data.screenshotInterval);
          return;
        }
        
        // Note: WebSocket events are already filtered by company room, so we don't need to check companyId
        // The server only broadcasts to company:${companyId} room, and users only join their own company room
        
        // Clear existing debounce timer
        if (screenshotSettingsDebounceRef.current) {
          clearTimeout(screenshotSettingsDebounceRef.current);
          screenshotSettingsDebounceRef.current = null;
        }
        
        // Debounce reload to prevent multiple rapid requests
        screenshotSettingsDebounceRef.current = setTimeout(() => {
          // Check if we're not already loading and not in the middle of an update
          const state = useStore.getState();
          if (!state.screenshotSettingsLoading) {
            // Check if settings match what we already have (to skip reload if we just updated)
            const currentSettings = state.screenshotSettings;
            if (currentSettings && 
                currentSettings.screenshotEnabled === data.screenshotEnabled &&
                currentSettings.screenshotInterval === data.screenshotInterval) {
              console.log('WebSocket: Settings match current state, skipping reload');
              screenshotSettingsDebounceRef.current = null;
              return;
            }
            
            // Reload screenshot settings from server to ensure consistency
            loadScreenshotSettingsRef.current().catch((error) => {
              console.error('WebSocket: Error reloading screenshot settings', error);
            });
          } else {
            console.log('WebSocket: Skipping reload - settings already loading');
          }
          screenshotSettingsDebounceRef.current = null;
        }, 300); // 300ms debounce
      } catch (error) {
        console.error('WebSocket: Error processing screenshot-settings:update', error);
      }
    });

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      // Clear any existing debounce timer on reconnect (bug56)
      // This prevents stale updates from previous connection
      if (screenshotSettingsDebounceRef.current) {
        clearTimeout(screenshotSettingsDebounceRef.current);
        screenshotSettingsDebounceRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      // Clear debounce timer on disconnect to prevent stale updates
      if (screenshotSettingsDebounceRef.current) {
        clearTimeout(screenshotSettingsDebounceRef.current);
        screenshotSettingsDebounceRef.current = null;
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Ping/pong
    socket.on('pong', () => {
      // Connection is alive
    });

    return () => {
      // Clear debounce timer if exists
      if (screenshotSettingsDebounceRef.current) {
        clearTimeout(screenshotSettingsDebounceRef.current);
        screenshotSettingsDebounceRef.current = null;
      }
      
      // Remove all listeners before disconnecting to prevent memory leaks
      // Use socket from closure, but check if it still exists
      if (socket && socket.connected) {
        try {
          socket.off('stats:update');
          socket.off('time-entry:update');
          socket.off('activity:new');
          socket.off('screenshot-settings:update');
          socket.off('connect');
          socket.off('disconnect');
          socket.off('connect_error');
          socket.off('pong');
          socket.disconnect();
        } catch (error) {
          console.warn('Error disconnecting socket:', error);
        }
      }
      socketRef.current = null;
    };
  }, [currentUser?.id]); // Only depend on currentUser.id to prevent unnecessary reconnections

  return socketRef.current;
}

