import { create } from 'zustand';
import { User, TimeEntry, Project, Activity, DashboardStats, ScreenshotSettings } from '@/types';
import { api } from './api';

interface AppState {
  // Users
  users: User[];
  currentUser: User | null;
  
  // Time Entries
  timeEntries: TimeEntry[];
  activeTimeEntry: TimeEntry | null;
  
  // Projects
  projects: Project[];
  
  // Activities
  activities: Activity[];
  
  // Stats
  stats: DashboardStats;
  
  // Screenshot Settings (company level)
  screenshotSettings: ScreenshotSettings | null;
  screenshotSettingsLoading: boolean;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User | null) => void;
  addUser: (user: User) => void;
  
  setTimeEntries: (entries: TimeEntry[]) => void;
  addTimeEntry: (entry: TimeEntry) => void;
  updateTimeEntry: (id: string, entry: Partial<TimeEntry>) => void;
  
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  
  addActivity: (activity: Activity) => void;
  setActivities: (activities: Activity[]) => void;
  
  updateStats: (stats: Partial<DashboardStats>) => void;
  
  // API Actions
  loadUsers: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadTimeEntries: () => Promise<void>;
  loadCurrentUser: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadActivities: () => Promise<void>;
  loadScreenshotSettings: () => Promise<void>;
  updateScreenshotSettings: (settings: Partial<ScreenshotSettings>) => Promise<void>;
  
  // Timer actions (now with API)
  startTimer: (userId: string, projectId?: string) => Promise<void>;
  stopTimer: (entryId: string) => Promise<void>;
  pauseTimer: (entryId: string) => Promise<void>;
  resumeTimer: (entryId: string) => Promise<void>;
  
  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string, companyDomain?: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  
  // Admin actions
  createUser: (data: Partial<User>) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Profile actions
  updateMyProfile: (data: Partial<User>) => Promise<void>;
  
  // Time entry actions
  deleteTimeEntry: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  users: [],
  currentUser: null,
  timeEntries: [],
  activeTimeEntry: null,
  projects: [],
  activities: [],
  stats: {
    totalHours: 0,
    activeUsers: 0,
    totalProjects: 0,
    todayHours: 0,
  },
  screenshotSettings: null,
  screenshotSettingsLoading: false,
  isLoading: false,
  error: null,
  
  setUsers: (users) => set({ users }),
  setCurrentUser: (user) => set({ currentUser: user }),
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
  
  setTimeEntries: (entries) => set({ timeEntries: entries }),
  addTimeEntry: (entry) =>
    set((state) => {
      // Validate timeEntries is an array
      const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
      
      // Check if entry already exists (avoid duplicates)
      const existing = safeTimeEntries.find((e) => e.id === entry.id);
      if (existing) {
        // If entry exists, update it instead of adding duplicate
        return {
          timeEntries: safeTimeEntries.map((e) => e.id === entry.id ? entry : e),
          activeTimeEntry: state.activeTimeEntry?.id === entry.id && entry.status !== 'stopped' 
            ? entry 
            : state.activeTimeEntry,
        };
      }

      // Only set as activeTimeEntry if it belongs to current user and is running/paused
      const shouldSetActive = 
        (entry.status === 'running' || entry.status === 'paused') 
          && entry.userId === state.currentUser?.id;
      
      // If adding a new active entry and there's already an active entry for this user, don't overwrite
      // (This prevents WebSocket from overwriting user's current timer)
      let newActiveTimeEntry: TimeEntry | null = state.activeTimeEntry;
      if (shouldSetActive) {
        // Only set if there's no current active entry for this user
        const hasActiveEntryForUser = state.activeTimeEntry 
          && state.activeTimeEntry.userId === entry.userId
          && (state.activeTimeEntry.status === 'running' || state.activeTimeEntry.status === 'paused');
        
        if (!hasActiveEntryForUser) {
          newActiveTimeEntry = entry;
        } else if (state.activeTimeEntry && state.activeTimeEntry.id === entry.id) {
          // If this is the same entry (update via WebSocket), update it
          newActiveTimeEntry = entry;
        }
      } else if (state.activeTimeEntry?.id === entry.id) {
        // If entry is being added and matches current active, but status is stopped, clear active
        if (entry.status === 'stopped') {
          newActiveTimeEntry = null;
        }
      }
      
      return {
        timeEntries: [entry, ...safeTimeEntries],
        activeTimeEntry: newActiveTimeEntry,
      };
    }),
  updateTimeEntry: async (id, updates) => {
    try {
      set({ isLoading: true, error: null });
      const entry = await api.updateTimeEntry(id, updates);
      set((state) => {
        const updatedEntry = { ...entry };
        const isActiveEntry = state.activeTimeEntry?.id === id;
        const isCurrentUserEntry = updatedEntry.userId === state.currentUser?.id;
        const shouldBeActive = 
          (updatedEntry.status === 'running' || updatedEntry.status === 'paused') && isCurrentUserEntry;
        
        // Determine new activeTimeEntry state
        let newActiveTimeEntry: TimeEntry | null = state.activeTimeEntry;
        
        if (isActiveEntry) {
          // If this was the active entry, update or clear it based on status
          newActiveTimeEntry = shouldBeActive ? updatedEntry : null;
        } else if (shouldBeActive && isCurrentUserEntry) {
          // If this should be active and is current user's entry, set it
          newActiveTimeEntry = updatedEntry;
        }
        // Otherwise, keep current activeTimeEntry
        
        // Validate timeEntries is an array
        const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
        
        return {
          timeEntries: safeTimeEntries.map((e) =>
            e.id === id ? updatedEntry : e
          ),
          activeTimeEntry: newActiveTimeEntry,
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to update time entry', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  
  addActivity: (activity) =>
    set((state) => {
      // Validate activities is an array
      const safeActivities = state.activities && Array.isArray(state.activities) ? state.activities : [];
      
      // Check if activity already exists (prevent duplicates from WebSocket + API)
      const existingIndex = safeActivities.findIndex((a) => a.id === activity.id);
      if (existingIndex !== -1) {
        // Update existing activity instead of adding duplicate
        const updated = [...safeActivities];
        updated[existingIndex] = activity;
        return { activities: updated };
      }
      // Add new activity at the beginning (most recent first)
      return {
        activities: [activity, ...safeActivities].slice(0, 100),
      };
    }),
  setActivities: (activities) => set({ activities }),
  
  updateStats: (updates) =>
    set((state) => ({ stats: { ...state.stats, ...updates } })),
  
  // API loaders
  loadUsers: async () => {
    try {
      const state = get();
      // Don't load if user is logged out
      if (!state.currentUser) {
        set({ users: [], isLoading: false });
        return;
      }
      
      // Only admins/owners/super_admins can load users list
      if (state.currentUser.role !== 'admin' && 
          state.currentUser.role !== 'OWNER' && 
          state.currentUser.role !== 'SUPER_ADMIN') {
        set({ users: [], isLoading: false });
        return;
      }
      
      set({ isLoading: true, error: null });
      const users = await api.getUsers();
      set({ users, isLoading: false });
    } catch (error: any) {
      // Don't logout on 403 for users endpoint - it's expected for non-admin users
      if (error.response?.status === 403) {
        set({ users: [], isLoading: false });
        return;
      }
      set({ error: error.message || 'Failed to load users', isLoading: false });
    }
  },
  
  loadProjects: async () => {
    try {
      const state = get();
      // Don't load if user is logged out
      if (!state.currentUser) {
        set({ projects: [], isLoading: false });
        return;
      }
      
      set({ isLoading: true, error: null });
      const projects = await api.getProjects();
      // Validate that projects is an array
      if (!Array.isArray(projects)) {
        console.error('Invalid projects response:', projects);
        set({ 
          error: 'Invalid projects data received from server', 
          isLoading: false 
        });
        return;
      }
      set({ projects, isLoading: false });
    } catch (error: any) {
      // Don't clear existing projects on error - keep previous state
      // This prevents UI from breaking if a temporary network error occurs
      const currentState = get();
      console.error('Failed to load projects:', error);
      set({ 
        error: error.message || 'Failed to load projects', 
        isLoading: false,
        // Keep existing projects if available, otherwise set to empty array
        projects: currentState.projects.length > 0 ? currentState.projects : []
      });
    }
  },
  
  loadTimeEntries: async () => {
    try {
      const state = get();
      const currentUser = state.currentUser;
      
      // Don't load if user is logged out
      if (!currentUser) {
        set({ timeEntries: [], activeTimeEntry: null, isLoading: false });
        return;
      }
      
      // Set loading state (don't prevent concurrent calls if isLoading is already true
      // as multiple load functions may be called in parallel)
      set({ isLoading: true, error: null });
      
      // Load all entries for admin/owner/super_admin, or user-specific entries for regular users
      const entries = (currentUser.role === 'admin' || 
                      currentUser.role === 'OWNER' || 
                      currentUser.role === 'SUPER_ADMIN')
        ? await api.getTimeEntries()
        : await api.getMyTimeEntries();
      
      // Validate entries is an array
      const safeEntries = entries && Array.isArray(entries) ? entries : [];
      
      // Find active entry for current user (running or paused)
      const activeEntry = safeEntries.find(
        e => (e.status === 'running' || e.status === 'paused') && e.userId === currentUser.id
      ) || null;
      
      set({ 
        timeEntries: safeEntries,
        activeTimeEntry: activeEntry,
        isLoading: false 
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load time entries', isLoading: false });
    }
  },
  
  loadCurrentUser: async () => {
    try {
      const user = await api.getCurrentUser();
      if (user) {
        set({ currentUser: user });
      }
    } catch (error) {
      set({ currentUser: null });
    }
  },
  
  loadScreenshotSettings: async () => {
    const state = get();
    if (!state.currentUser) {
      return; // Can't load settings without user
    }
    
    // Check if companyId changed - if so, clear old settings (bug78)
    const currentCompanyId = state.currentUser.companyId;
    const previousCompanyId = state.screenshotSettings 
      ? (state.currentUser.companyId) // Previous user's companyId is not stored, but we can check if settings exist
      : null;
    
    // If settings exist but user changed, clear them first (this will be handled by the new load)
    // Actually, we can't check previous companyId easily, so we'll just reload settings
    
    // Prevent concurrent loads - if already loading, skip
    if (state.screenshotSettingsLoading) {
      console.log('Screenshot settings already loading, skipping duplicate request');
      return;
    }
    
    try {
      set({ screenshotSettingsLoading: true });
      const settings = await api.getCompanyScreenshotSettings();
      
      // After successful load, verify that companyId matches (bug78)
      const stateAfterLoad = get();
      if (stateAfterLoad.currentUser && stateAfterLoad.currentUser.companyId !== currentCompanyId) {
        console.log('Company changed during loadScreenshotSettings, clearing settings');
        set({ screenshotSettings: null, screenshotSettingsLoading: false });
        return;
      }
      
      // Check if user is still logged in after async operation
      const stateAfterRequest = get();
      if (!stateAfterRequest.currentUser) {
        console.log('User logged out during loadScreenshotSettings, aborting');
        set({ screenshotSettingsLoading: false });
        return;
      }
      
      // Validate interval (bug49 - handle null, undefined, NaN, negative, zero)
      const validIntervals = [30, 60, 300, 600];
      let interval = 60; // default
      if (settings.screenshotInterval !== null && 
          settings.screenshotInterval !== undefined && 
          typeof settings.screenshotInterval === 'number' &&
          !isNaN(settings.screenshotInterval) &&
          settings.screenshotInterval > 0 &&
          Number.isInteger(settings.screenshotInterval) &&
          validIntervals.includes(settings.screenshotInterval)) {
        interval = settings.screenshotInterval;
      } else {
        console.warn('Invalid screenshotInterval from API:', settings.screenshotInterval, 'using default 60');
      }
      
      set({
        screenshotSettings: {
          screenshotEnabled: settings.screenshotEnabled ?? false,
          screenshotInterval: interval,
        },
        screenshotSettingsLoading: false,
      });
    } catch (error: any) {
      console.error('Failed to load screenshot settings:', error);
      
      // Check if user is still logged in after error
      const stateAfterError = get();
      if (!stateAfterError.currentUser) {
        console.log('User logged out during loadScreenshotSettings error handling');
        set({ screenshotSettingsLoading: false });
        return;
      }
      
      // Handle different error types
      if (error.response?.status === 404) {
        // Company not found - set default settings (bug76)
        console.warn('Company not found (404), setting default screenshot settings');
        set({
          screenshotSettings: {
            screenshotEnabled: false,
            screenshotInterval: 60,
          },
          screenshotSettingsLoading: false,
        });
      } else if (error.isNetworkError || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        console.warn('Network error loading screenshot settings, keeping existing or default');
        // Set default on network error only if we don't have existing settings
        const currentState = get();
        if (!currentState.screenshotSettings) {
          set({
            screenshotSettings: {
              screenshotEnabled: false,
              screenshotInterval: 60,
            },
            screenshotSettingsLoading: false,
          });
        } else {
          // Keep existing settings if load fails (bug57)
          set({ screenshotSettingsLoading: false });
        }
      } else if (error.response?.status >= 500) {
        console.warn('Server error loading screenshot settings, keeping existing or default');
        // Set default on server error only if we don't have existing settings
        const currentState = get();
        if (!currentState.screenshotSettings) {
          set({
            screenshotSettings: {
              screenshotEnabled: false,
              screenshotInterval: 60,
            },
            screenshotSettingsLoading: false,
          });
        } else {
          // Keep existing settings if load fails (bug57)
          set({ screenshotSettingsLoading: false });
        }
      } else {
        // Other errors (403, etc.) - set default if no existing settings
        const currentState = get();
        if (!currentState.screenshotSettings) {
          set({
            screenshotSettings: {
              screenshotEnabled: false,
              screenshotInterval: 60,
            },
            screenshotSettingsLoading: false,
          });
        } else {
          set({ screenshotSettingsLoading: false });
        }
      }
    }
  },
  
  updateScreenshotSettings: async (settings) => {
    const state = get();
    if (!state.currentUser) {
      throw new Error('User must be logged in to update settings');
    }
    
    // Check if user is admin/owner
    const canEdit = state.currentUser.role === 'admin' || state.currentUser.role === 'OWNER';
    if (!canEdit) {
      throw new Error('Only administrators and owners can update screenshot settings');
    }
    
    // Prevent concurrent updates - use atomic check-and-set
    const currentState = get();
    if (currentState.screenshotSettingsLoading) {
      console.log('Screenshot settings update already in progress, skipping');
      return;
    }
    
    // Set loading flag atomically
    set({ screenshotSettingsLoading: true });
    
    // Save previous state for revert BEFORE any updates
    const previousSettings = get().screenshotSettings;
    
    try {
      // Get current settings and merge with new ones (use fresh state after set)
      const currentStateAfterSet = get();
      const currentSettings = currentStateAfterSet.screenshotSettings || {
        screenshotEnabled: false,
        screenshotInterval: 60,
      };
      
      const updatedSettings = {
        screenshotEnabled: settings.screenshotEnabled ?? currentSettings.screenshotEnabled,
        screenshotInterval: settings.screenshotInterval ?? currentSettings.screenshotInterval,
      };
      
      // Optimistic update
      set({
        screenshotSettings: updatedSettings,
      });
      
      // Update on server
      const serverSettings = await api.updateCompanyScreenshotSettings({
        screenshotEnabled: updatedSettings.screenshotEnabled,
        screenshotInterval: updatedSettings.screenshotInterval,
      });
      
      // Check if user is still logged in and has permission after async operation
      const stateAfterUpdate = get();
      if (!stateAfterUpdate.currentUser) {
        console.log('User logged out during updateScreenshotSettings, reverting');
        set({
          screenshotSettings: previousSettings || {
            screenshotEnabled: false,
            screenshotInterval: 60,
          },
          screenshotSettingsLoading: false,
        });
        return;
      }
      
      // Validate and set server response
      const validIntervals = [30, 60, 300, 600];
      const interval = validIntervals.includes(serverSettings.screenshotInterval)
        ? serverSettings.screenshotInterval
        : 60;
      
      const finalSettings = {
        screenshotEnabled: serverSettings.screenshotEnabled,
        screenshotInterval: interval,
      };
      
      set({
        screenshotSettings: finalSettings,
        screenshotSettingsLoading: false,
      });
      
      // Note: WebSocket event will be sent by server, but we skip reload if settings match
      // to avoid unnecessary API call. The check in useSocket will handle this.
    } catch (error: any) {
      // Revert on error using previous state
      // If previousSettings is null, set default
      set({
        screenshotSettings: previousSettings || {
          screenshotEnabled: false,
          screenshotInterval: 60,
        },
        screenshotSettingsLoading: false,
      });
      throw error;
    }
  },
  
  loadStats: async () => {
    try {
      const state = get();
      const currentUser = state.currentUser;
      
      if (!currentUser) {
        return;
      }
      
             // Load entries based on user role
             const entries = (currentUser.role === 'admin' || 
                              currentUser.role === 'OWNER' || 
                              currentUser.role === 'SUPER_ADMIN')
               ? await api.getTimeEntries()
               : await api.getMyTimeEntries();
      
      const projects = await api.getProjects();
      const activeEntries = await api.getActiveTimeEntries();
      
      // Validate entries is an array
      const safeEntries = entries && Array.isArray(entries) ? entries : [];
      
      // Calculate total seconds including running entries (for initial load)
      // Note: Real-time updates will be handled by DashboardStats component
      const now = Date.now();
      const totalSeconds = safeEntries.reduce((acc, e) => {
        let entrySeconds = 0;
        
        if (e.status === 'stopped') {
          entrySeconds = e.duration || 0;
        } else if (e.status === 'running') {
          // Include current elapsed time for running entries
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
        
        if (!isFinite(entrySeconds) || isNaN(entrySeconds) || entrySeconds < 0) {
          return acc;
        }
        return acc + entrySeconds;
      }, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySeconds = safeEntries.reduce((acc, e) => {
        try {
          const entryDate = new Date(e.startTime);
          if (isNaN(entryDate.getTime()) || entryDate < today) {
            return acc;
          }
          
          let entrySeconds = 0;
          if (e.status === 'stopped') {
            entrySeconds = e.duration || 0;
          } else if (e.status === 'running') {
            const start = entryDate.getTime();
            const elapsed = Math.floor((now - start) / 1000);
            entrySeconds = (e.duration || 0) + Math.max(0, elapsed);
          } else if (e.status === 'paused') {
            entrySeconds = e.duration || 0;
          }
          
          if (!isFinite(entrySeconds) || isNaN(entrySeconds) || entrySeconds < 0) {
            return acc;
          }
          return acc + entrySeconds;
        } catch {
          return acc;
        }
      }, 0);
      
      const totalHours = totalSeconds / 3600;
      const todayHoursValue = todaySeconds / 3600;
      
      // Validate activeEntries and projects are arrays
      const safeActiveEntries = activeEntries && Array.isArray(activeEntries) ? activeEntries : [];
      const safeProjects = projects && Array.isArray(projects) ? projects : [];
      
      set({
        stats: {
          totalHours: isFinite(totalHours) && !isNaN(totalHours) ? totalHours : 0,
          activeUsers: new Set(safeActiveEntries.map(e => e.userId)).size,
          totalProjects: safeProjects.filter(p => p.status === 'active').length,
          todayHours: isFinite(todayHoursValue) && !isNaN(todayHoursValue) ? todayHoursValue : 0,
        },
      });
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      // Don't throw error for stats - it's not critical
    }
  },
  
  loadActivities: async () => {
    try {
      const state = get();
      const currentUser = state.currentUser;
      
      if (!currentUser) {
        set({ activities: [] });
        return;
      }
      
      // Load activities based on user role
      // Employees only see their own activities, admins/owners see all
      let activities: Activity[];
      try {
        activities = (currentUser.role === 'admin' || 
                      currentUser.role === 'OWNER' || 
                      currentUser.role === 'SUPER_ADMIN')
          ? await api.getActivities({ limit: 100 })
          : await api.getActivities({ userId: currentUser.id, limit: 100 });
      } catch (error: any) {
        // If 404, the endpoint might not be available yet (backend not restarted)
        // Log error but don't break the app - activities will be loaded via WebSocket
        if (error.response?.status === 404) {
          console.warn('Activities endpoint not found (404). Backend may need to be restarted. Activities will be loaded via WebSocket.');
          set({ activities: [] });
          return;
        }
        // Re-throw other errors
        throw error;
      }
      
      // Validate activities array
      if (!Array.isArray(activities)) {
        console.warn('loadActivities: Invalid activities data received, expected array', activities);
        set({ activities: [] });
        return;
      }

      // Merge with existing activities from WebSocket to prevent duplicates
      // Activities from API are authoritative (most recent), but keep WebSocket activities that are newer
      const existingActivities = state.activities && Array.isArray(state.activities) ? state.activities : [];
      const existingIds = new Set(existingActivities.map(a => a.id));
      const apiIds = new Set(activities.map(a => a.id));
      
      // Optimize: Use Set for O(1) lookup instead of O(n) some() calls
      // Keep WebSocket activities that are not in API response
      const webSocketOnlyActivities = existingActivities.filter(a => !apiIds.has(a.id));
      
      // Combine: API activities first (most recent), then existing WebSocket activities
      // Sort by timestamp desc to maintain order
      const combined = [...activities, ...webSocketOnlyActivities]
        .sort((a, b) => {
          try {
            // Handle both Date and string timestamps safely
            const timeA = a.timestamp instanceof Date 
              ? a.timestamp.getTime() 
              : (typeof a.timestamp === 'string' 
                ? new Date(a.timestamp).getTime() 
                : Date.now());
            const timeB = b.timestamp instanceof Date 
              ? b.timestamp.getTime() 
              : (typeof b.timestamp === 'string' 
                ? new Date(b.timestamp).getTime() 
                : Date.now());
            
            // Validate timestamps
            if (isNaN(timeA) || isNaN(timeB)) {
              console.warn('Invalid timestamp in activity sorting', { a, b });
              return 0; // Keep original order if timestamps are invalid
            }
            
            return timeB - timeA; // Descending order (newest first)
          } catch (error) {
            console.error('Error sorting activities by timestamp', error, { a, b });
            return 0; // Keep original order on error
          }
        })
        .slice(0, 100); // Limit to 100 most recent
      
      set({ activities: combined });
    } catch (error: any) {
      console.error('Failed to load activities:', error);
      // Don't set error state - activities are not critical
      // Keep existing activities if load fails
    }
  },
  
  // Auth actions
  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.login({ email, password });
      // api.login already saves user to localStorage, so get it from there first
      let user = api.getCurrentUserFromStorage();
      if (!user) {
        // If not in storage, try to fetch from API
        user = await api.getCurrentUser();
      }
      if (!user) {
        throw new Error('Failed to load user data after login');
      }
      // Ensure user is set in state
      set({ currentUser: user, isLoading: false });
      // Double-check it's persisted
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        const userStr = localStorage.getItem('current_user');
        if (!token || !userStr) {
          console.warn('Login: Token or user not properly saved to localStorage');
        }
      }
      // Load screenshot settings after successful login
      get().loadScreenshotSettings().catch((error) => {
        console.error('Failed to load screenshot settings after login:', error);
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Login failed', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  register: async (name, email, password, companyName, companyDomain) => {
    try {
      set({ isLoading: true, error: null });
      await api.register({ name, email, password, companyName, companyDomain });
      const user = await api.getCurrentUser();
      set({ currentUser: user, isLoading: false });
      // Load screenshot settings after successful registration
      get().loadScreenshotSettings().catch((error) => {
        console.error('Failed to load screenshot settings after registration:', error);
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Registration failed', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  logout: async () => {
    const state = get();
    
    // Stop active timer if exists before logging out
    if (state.activeTimeEntry && (state.activeTimeEntry.status === 'running' || state.activeTimeEntry.status === 'paused')) {
      try {
        console.log('[Logout] Stopping active timer before logout:', { 
          entryId: state.activeTimeEntry.id, 
          status: state.activeTimeEntry.status 
        });
        await api.stopTimeEntry(state.activeTimeEntry.id);
        console.log('[Logout] Active timer stopped successfully');
      } catch (error: any) {
        console.error('[Logout] Failed to stop timer during logout:', error);
        // Continue with logout even if stopping timer fails
      }
    }
    
    // Bug 97: Stop screenshot capture before clearing state
    try {
      // Import dynamically to avoid circular dependency
      const useScreenCaptureModule = require('@/hooks/useScreenCapture');
      const globalScreenCapture = useScreenCaptureModule.globalScreenCapture;
      if (globalScreenCapture && typeof globalScreenCapture.cleanup === 'function') {
        console.log('[Logout] Stopping screenshot capture before logout');
        globalScreenCapture.cleanup();
      }
    } catch (error) {
      console.error('[Logout] Failed to stop screenshot capture:', error);
      // Continue with logout even if stopping screenshot capture fails
    }
    
    // Clear all state
    set({ 
      currentUser: null, 
      users: [], 
      projects: [], 
      timeEntries: [], 
      activities: [],
      activeTimeEntry: null,
      screenshotSettings: null,
      screenshotSettingsLoading: false,
      isLoading: false,
      error: null,
    });
    // Then clear storage
    api.logout();
  },
  
  initializeAuth: async () => {
    // Check if token exists first (bug68 - handle localStorage errors)
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          set({ currentUser: null });
          return;
        }
      } catch (error: any) {
        // Handle localStorage errors (private mode, quota exceeded, etc.)
        console.warn('Failed to access localStorage for auth token:', error);
        set({ currentUser: null });
        return;
      }
    }

    const user = api.getCurrentUserFromStorage();
    if (user) {
      set({ currentUser: user });
      // Verify token is still valid
      try {
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          set({ currentUser });
        } else {
          // getCurrentUser returns null only if token is invalid (401)
          // Clear everything only if token was actually invalid
          let tokenStillExists: string | null = null;
          try {
            tokenStillExists = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          } catch (error: any) {
            console.warn('Failed to check token existence:', error);
          }
          if (!tokenStillExists) {
            // Token was already cleared, don't logout again
            set({ currentUser: null });
          } else {
            // Token exists but getCurrentUser returned null - likely invalid (bug69)
            api.logout();
            set({ currentUser: null });
          }
        }
      } catch (error: any) {
        // Only 401 means invalid token - need to logout
        // 403 is just permission denied, don't logout
        // Network errors should not cause logout
        if (error.response?.status === 401) {
          api.logout();
          set({ currentUser: null });
        } else {
          // For other errors (network, 403, etc.), keep user from storage
          // Don't logout - just keep the existing user
        }
      }
    } else {
      // No user in storage, verify if token is valid
      try {
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          set({ currentUser });
        } else {
          // getCurrentUser returns null - check if token still exists
          const tokenStillExists = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          if (!tokenStillExists) {
            // Token was already cleared, don't logout again
            set({ currentUser: null });
          } else {
            // Token exists but getCurrentUser returned null - likely invalid
            api.logout();
            set({ currentUser: null });
          }
        }
      } catch (error: any) {
        // Only 401 means invalid token - need to logout
        // 403 is just permission denied, don't logout
        // Network errors should not cause logout
        if (error.response?.status === 401) {
          api.logout();
          set({ currentUser: null });
        } else {
          // For other errors (network, 403, etc.), don't logout
          // Just set user to null but keep token
          set({ currentUser: null });
        }
      }
      
      // Load screenshot settings after user is loaded (if user exists)
      const finalUser = get().currentUser;
      if (finalUser) {
        // Clear screenshot settings first to ensure clean state (bug78)
        // This ensures that if user changed companies, old settings are cleared
        set({ screenshotSettings: null });
        // Load screenshot settings in background (don't wait)
        get().loadScreenshotSettings().catch((error) => {
          console.error('Failed to load screenshot settings during auth init:', error);
        });
      } else {
        // If no user, clear screenshot settings (bug78)
        set({ screenshotSettings: null, screenshotSettingsLoading: false });
      }
    }
  },
  
  // Timer actions with API
  startTimer: async (userId, projectId) => {
    try {
      const state = get();
      
      // Prevent starting a new timer if one is already running/paused for this user
      if (state.activeTimeEntry && state.activeTimeEntry.userId === userId 
          && (state.activeTimeEntry.status === 'running' || state.activeTimeEntry.status === 'paused')) {
        throw new Error('Timer is already running. Please stop or pause it first.');
      }
      
      // Prevent concurrent starts
      if (state.isLoading) {
        console.warn('[Store] Already loading, ignoring start timer request');
        return;
      }
      
      console.log('[Store] Starting timer:', { userId, projectId });
      set({ isLoading: true, error: null });
      
      const payload = {
        userId,
        projectId: projectId || undefined,
        startTime: new Date(),
      };
      console.log('[Store] Creating time entry with payload:', payload);
      
      const entry = await api.createTimeEntry(payload);
      console.log('[Store] Time entry created:', entry);
      
      // Use get() again to get latest state in case it changed during async operation
      const currentState = get();
      set({
        activeTimeEntry: entry,
        timeEntries: [entry, ...currentState.timeEntries],
        isLoading: false,
      });
      console.log('[Store] Timer started successfully');
    } catch (error: any) {
      console.error('[Store] Error starting timer:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start timer';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  },
  
  stopTimer: async (entryId) => {
    try {
      set({ isLoading: true, error: null });
      const entry = await api.stopTimeEntry(entryId);
      const state = get();
      // Validate timeEntries is an array
      const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
      
      set({
        timeEntries: safeTimeEntries.map((e) =>
          e.id === entryId ? entry : e
        ),
        activeTimeEntry: null,
        isLoading: false,
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to stop timer', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  pauseTimer: async (entryId) => {
    try {
      set({ isLoading: true, error: null });
      const entry = await api.pauseTimeEntry(entryId);
      const state = get();
      // Validate timeEntries is an array
      const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
      
      set({
        timeEntries: safeTimeEntries.map((e) =>
          e.id === entryId ? entry : e
        ),
        // Keep activeTimeEntry even when paused so user can resume
        activeTimeEntry:
          state.activeTimeEntry?.id === entryId
            ? entry
            : state.activeTimeEntry,
        isLoading: false,
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to pause timer', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  resumeTimer: async (entryId) => {
    try {
      set({ isLoading: true, error: null });
      const entry = await api.resumeTimeEntry(entryId);
      const state = get();
      // Validate timeEntries is an array
      const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
      
      set({
        timeEntries: safeTimeEntries.map((e) =>
          e.id === entryId ? entry : e
        ),
        activeTimeEntry: entry,
        isLoading: false,
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to resume timer', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // Admin actions
  createUser: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const user = await api.createUser(data);
      set((state) => ({
        users: [...state.users, user],
        isLoading: false,
      }));
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to create user', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  updateUser: async (id, data) => {
    try {
      set({ isLoading: true, error: null });
      const user = await api.updateUser(id, data);
      // Update localStorage if this is the current user
      const state = get();
      if (state.currentUser?.id === id) {
        api.setCurrentUser(user);
        set({ currentUser: user });
      }
      set((state) => {
        // Validate users is an array
        const safeUsers = state.users && Array.isArray(state.users) ? state.users : [];
        
        return {
          users: safeUsers.map((u) => (u.id === id ? user : u)),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to update user', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  deleteUser: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await api.deleteUser(id);
      set((state) => {
        // Validate users is an array
        const safeUsers = state.users && Array.isArray(state.users) ? state.users : [];
        
        return {
          users: safeUsers.filter((u) => u.id !== id),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to delete user', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  createProject: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const project = await api.createProject(data);
      set((state) => ({
        projects: [...state.projects, project],
        isLoading: false,
      }));
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to create project', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  updateProject: async (id, data) => {
    try {
      set({ isLoading: true, error: null });
      const project = await api.updateProject(id, data);
      set((state) => {
        // Validate projects is an array
        const safeProjects = state.projects && Array.isArray(state.projects) ? state.projects : [];
        
        return {
          projects: safeProjects.map((p) => (p.id === id ? project : p)),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to update project', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  deleteProject: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await api.deleteProject(id);
      set((state) => {
        // Validate projects is an array
        const safeProjects = state.projects && Array.isArray(state.projects) ? state.projects : [];
        
        return {
          projects: safeProjects.filter((p) => p.id !== id),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to delete project', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // Profile actions
  updateMyProfile: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const user = await api.updateMyProfile(data);
      // Update localStorage
      api.setCurrentUser(user);
      set((state) => {
        // Validate users is an array
        const safeUsers = state.users && Array.isArray(state.users) ? state.users : [];
        
        return {
          currentUser: user,
          users: safeUsers.map((u) => (u.id === user.id ? user : u)),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to update profile', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // Time entry actions
  deleteTimeEntry: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await api.deleteTimeEntry(id);
      set((state) => {
        // Validate timeEntries is an array
        const safeTimeEntries = state.timeEntries && Array.isArray(state.timeEntries) ? state.timeEntries : [];
        
        return {
          timeEntries: safeTimeEntries.filter((e) => e.id !== id),
          activeTimeEntry: state.activeTimeEntry?.id === id ? null : state.activeTimeEntry,
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to delete time entry', 
        isLoading: false 
      });
      throw error;
    }
  },
}));
