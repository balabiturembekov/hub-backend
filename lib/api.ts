import axios, { AxiosInstance, AxiosError } from 'axios';
import { User, Project, TimeEntry, Activity, LoginDto, RegisterDto, Screenshot } from '@/types';
import * as Sentry from '@sentry/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests (bug68 - handle localStorage errors)
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        try {
          const token = localStorage.getItem('auth_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error: any) {
          // Handle localStorage errors (private mode, quota exceeded, etc.)
          console.warn('Failed to access localStorage for auth token:', error);
          // Continue without token - request will fail with 401 if needed
        }
      }
      return config;
    });

    // Handle auth errors and network errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Network error (no response)
        if (!error.response) {
          const apiUrl = API_URL;
          const errorMessage = error.message || 'Network error';
          const isConnectionRefused = errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ERR_CONNECTION_REFUSED');
          const isNetworkUnavailable = errorMessage.includes('ERR_NETWORK') || errorMessage.includes('Network Error');
          
          console.error('Network Error:', {
            message: errorMessage,
            apiUrl,
            code: error.code,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              baseURL: error.config?.baseURL,
            },
          });
          
          // Create more informative error message
          let userMessage = 'Network error: Could not connect to server.';
          if (isConnectionRefused || isNetworkUnavailable) {
            userMessage = `Cannot connect to backend server at ${apiUrl}. Please check if the backend is running.`;
          } else if (error.code === 'ENOTFOUND') {
            userMessage = `Cannot resolve server address. Please check your API URL: ${apiUrl}`;
          } else if (error.code === 'ETIMEDOUT') {
            userMessage = `Connection timeout. The server at ${apiUrl} is not responding.`;
          } else {
            userMessage = `Network error: ${errorMessage}. API URL: ${apiUrl}`;
          }
          
          const networkError = new Error(userMessage);
          (networkError as any).isNetworkError = true;
          (networkError as any).apiUrl = apiUrl;
          (networkError as any).originalError = error;
          
          // Report network errors to Sentry (but not auth errors)
          // Check if we're not in development or if Sentry is explicitly enabled
          const shouldReport = 
            process.env.NODE_ENV !== 'development' || 
            process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === 'true';
          
          if (shouldReport) {
            Sentry.captureException(error, {
              tags: { 
                type: 'network_error',
                api_url: apiUrl,
                error_code: error.code || 'unknown',
              },
              level: 'warning',
              extra: {
                apiUrl,
                errorMessage,
                errorCode: error.code,
              },
            });
          }
          
          return Promise.reject(networkError);
        }
        
        // 401 Unauthorized - token is invalid or expired, need to logout
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('current_user');
            } catch (error: any) {
              console.error('Failed to clear localStorage:', error);
            }
            // Don't redirect if already on login/register page or during logout
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
              // Use window.location.href to ensure full page reload and clear any pending requests
              window.location.href = '/login';
            }
          }
          // Return a silent rejection for auth errors to prevent error propagation
          return Promise.reject(new Error('Unauthorized'));
        }
        
        // 403 Forbidden - user doesn't have permission, but token is valid
        // Don't logout for 403, just reject the request
        if (error.response?.status === 403) {
          // 403 is expected for non-admin users accessing admin endpoints
          // Just reject without logout
          return Promise.reject(error);
        }
        
        // 400 Bad Request - log for debugging but let specific handlers deal with it
        if (error.response?.status === 400) {
          const errorMessage = (error.response?.data as any)?.message || (error as Error).message || 'Bad Request';
          console.warn('[API] Bad Request (400):', errorMessage, {
            url: error.config?.url,
            method: error.config?.method,
          });
          // Don't report to Sentry for 400 - usually client-side validation issues
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: RegisterDto) {
    const response = await this.client.post('/auth/register', data);
    if (response.data.access_token) {
      this.setAuthToken(response.data.access_token);
      this.setCurrentUser(response.data.user);
    }
    return response.data;
  }

  async login(data: LoginDto) {
    const response = await this.client.post('/auth/login', data);
    if (response.data.access_token) {
      this.setAuthToken(response.data.access_token);
      this.setCurrentUser(response.data.user);
    }
    return response.data;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // Check if token exists before making request
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return null;
        }
      }
      const response = await this.client.get('/auth/me');
      return this.mapUser(response.data);
    } catch (error: any) {
      // Only 401 means unauthorized (invalid token)
      // 403 shouldn't happen for /auth/me, but if it does, just return null
      if (error.response?.status === 401) {
        return null;
      }
      // For other errors, also return null
      return null;
    }
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    const response = await this.client.get('/users');
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /users', response.data);
      return [];
    }
    return response.data.map((data: any) => this.mapUser(data));
  }

  async getUser(id: string): Promise<User> {
    const response = await this.client.get(`/users/${id}`);
    return this.mapUser(response.data);
  }

  async getMyProfile(): Promise<User> {
    const response = await this.client.get('/users/me');
    return this.mapUser(response.data);
  }

  async createUser(data: Partial<User>): Promise<User> {
    const response = await this.client.post('/users', data);
    return this.mapUser(response.data);
  }

  async updateMyProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.patch('/users/me', data);
    return this.mapUser(response.data);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const response = await this.client.patch(`/users/${id}`, data);
    return this.mapUser(response.data);
  }

  async deleteUser(id: string): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await this.client.get('/projects');
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /projects', response.data);
      return [];
    }
    return response.data.map((data: any) => {
      try {
        return this.mapProject(data);
      } catch (error) {
        console.error('Error mapping project:', error, data);
        return null;
      }
    }).filter((project): project is Project => project !== null);
  }

  async getActiveProjects(): Promise<Project[]> {
    const response = await this.client.get('/projects/active');
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /projects/active', response.data);
      return [];
    }
    return response.data.map((data: any) => {
      try {
        return this.mapProject(data);
      } catch (error) {
        console.error('Error mapping project:', error, data);
        return null;
      }
    }).filter((project): project is Project => project !== null);
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.client.get(`/projects/${id}`);
    return this.mapProject(response.data);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    const response = await this.client.post('/projects', data);
    return this.mapProject(response.data);
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const response = await this.client.patch(`/projects/${id}`, data);
    return this.mapProject(response.data);
  }

  async deleteProject(id: string): Promise<void> {
    await this.client.delete(`/projects/${id}`);
  }

  // Time Entries
  async getTimeEntries(userId?: string, projectId?: string): Promise<TimeEntry[]> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (projectId) params.append('projectId', projectId);
    
    const url = `/time-entries${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.client.get(url);
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /time-entries', response.data);
      return [];
    }
    return response.data.map((data: any) => {
      try {
        return this.mapTimeEntry(data);
      } catch (error) {
        console.error('Error mapping time entry:', error, data);
        return null;
      }
    }).filter((entry): entry is TimeEntry => entry !== null);
  }

  async getActiveTimeEntries(userId?: string): Promise<TimeEntry[]> {
    const url = userId ? `/time-entries/active?userId=${userId}` : '/time-entries/active';
    const response = await this.client.get(url);
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /time-entries/active', response.data);
      return [];
    }
    return response.data.map((data: any) => {
      try {
        return this.mapTimeEntry(data);
      } catch (error) {
        console.error('Error mapping time entry:', error, data);
        return null;
      }
    }).filter((entry): entry is TimeEntry => entry !== null);
  }

  async getMyTimeEntries(): Promise<TimeEntry[]> {
    const response = await this.client.get('/time-entries/my');
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /time-entries/my', response.data);
      return [];
    }
    return response.data.map((data: any) => {
      try {
        return this.mapTimeEntry(data);
      } catch (error) {
        console.error('Error mapping time entry:', error, data);
        return null;
      }
    }).filter((entry): entry is TimeEntry => entry !== null);
  }

  async getTimeEntry(id: string): Promise<TimeEntry> {
    const response = await this.client.get(`/time-entries/${id}`);
    return this.mapTimeEntry(response.data);
  }

  async createTimeEntry(data: Partial<TimeEntry>): Promise<TimeEntry> {
    const payload: any = {
      userId: data.userId,
    };
    
    if (data.projectId) {
      payload.projectId = data.projectId;
    }
    
    if (data.description) {
      payload.description = data.description;
    }
    
    if (data.startTime) {
      payload.startTime = data.startTime instanceof Date 
        ? data.startTime.toISOString() 
        : data.startTime;
    }
    
    console.log('[API] Creating time entry:', payload);
    // Don't send status - backend will set it to RUNNING by default
    const response = await this.client.post('/time-entries', payload);
    console.log('[API] Time entry created:', response.data);
    return this.mapTimeEntry(response.data);
  }

  async updateTimeEntry(id: string, data: Partial<TimeEntry>): Promise<TimeEntry> {
    // Filter out fields that should not be sent to backend
    // DTO only accepts: projectId, startTime, endTime, duration, description, status
    const payload: any = {};
    
    if (data.projectId !== undefined) {
      payload.projectId = data.projectId;
    }
    
    if (data.startTime !== undefined) {
      payload.startTime = data.startTime instanceof Date 
        ? data.startTime.toISOString() 
        : data.startTime;
    }
    
    if (data.endTime !== undefined) {
      payload.endTime = data.endTime instanceof Date 
        ? data.endTime.toISOString() 
        : data.endTime;
    }
    
    if (data.duration !== undefined) {
      payload.duration = data.duration;
    }
    
    if (data.description !== undefined) {
      payload.description = data.description;
    }
    
    // Convert status from lowercase to UPPERCASE (backend expects RUNNING, PAUSED, STOPPED)
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = {
        'running': 'RUNNING',
        'paused': 'PAUSED',
        'stopped': 'STOPPED',
      };
      payload.status = statusMap[data.status] || data.status.toUpperCase();
    }
    
    const response = await this.client.patch(`/time-entries/${id}`, payload);
    return this.mapTimeEntry(response.data);
  }

  async stopTimeEntry(id: string): Promise<TimeEntry> {
    const response = await this.client.put(`/time-entries/${id}/stop`);
    return this.mapTimeEntry(response.data);
  }

  async pauseTimeEntry(id: string): Promise<TimeEntry> {
    const response = await this.client.put(`/time-entries/${id}/pause`);
    return this.mapTimeEntry(response.data);
  }

  async resumeTimeEntry(id: string): Promise<TimeEntry> {
    const response = await this.client.put(`/time-entries/${id}/resume`);
    return this.mapTimeEntry(response.data);
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await this.client.delete(`/time-entries/${id}`);
  }

  // Private helpers
  private setAuthToken(token: string) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('auth_token', token);
      } catch (error: any) {
        console.error('Failed to save auth token:', error);
        // Handle QuotaExceededError or SecurityError
        if (error.name === 'QuotaExceededError') {
          console.error('LocalStorage quota exceeded. Please clear some data.');
        } else if (error.name === 'SecurityError') {
          console.error('LocalStorage access denied (security error).');
        }
      }
    }
  }

  setCurrentUser(user: any) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('current_user', JSON.stringify(this.mapUser(user)));
      } catch (error: any) {
        console.error('Failed to save current user:', error);
        // Handle QuotaExceededError or SecurityError
        if (error.name === 'QuotaExceededError') {
          console.error('LocalStorage quota exceeded. Please clear some data.');
        } else if (error.name === 'SecurityError') {
          console.error('LocalStorage access denied (security error).');
        }
      }
    }
  }

  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  getCurrentUserFromStorage(): User | null {
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('current_user');
        if (userStr) {
          try {
            return JSON.parse(userStr);
          } catch (error) {
            console.error('Failed to parse user from storage:', error);
            // Clear corrupted data (bug70)
            try {
              localStorage.removeItem('current_user');
            } catch (clearError) {
              console.error('Failed to clear corrupted user data:', clearError);
            }
            return null;
          }
        }
      } catch (error: any) {
        // Handle localStorage errors (private mode, quota exceeded, etc.) (bug68)
        console.warn('Failed to access localStorage for current user:', error);
        return null;
      }
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  // Mappers
  private mapUser(data: any): User {
    // Validate required fields
    if (!data || !data.id || !data.name || !data.email) {
      throw new Error('Invalid user data: missing required fields');
    }
    
    // Map backend roles to frontend roles
    let role: User['role'] = 'employee';
    if (data.role === 'SUPER_ADMIN') {
      role = 'SUPER_ADMIN';
    } else if (data.role === 'OWNER') {
      role = 'OWNER';
    } else if (data.role === 'ADMIN') {
      role = 'admin';
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || undefined,
      role,
      status: data.status === 'ACTIVE' ? 'active' : 'inactive',
      hourlyRate: typeof data.hourlyRate === 'number' && !isNaN(data.hourlyRate) && data.hourlyRate >= 0 ? data.hourlyRate : undefined,
      companyId: data.companyId,
      company: data.company ? {
        id: data.company.id,
        name: data.company.name,
      } : undefined,
    };
  }

  private mapProject(data: any): Project {
    // Validate required fields
    if (!data || !data.id || !data.name) {
      throw new Error('Invalid project data: missing required fields');
    }
    
    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      color: data.color || '#3b82f6',
      clientName: data.clientName || undefined,
      budget: typeof data.budget === 'number' && !isNaN(data.budget) && data.budget >= 0 ? data.budget : undefined,
      status: data.status === 'ACTIVE' ? 'active' : 'archived',
    };
  }

  private mapTimeEntry(data: any): TimeEntry {
    // Validate required fields
    if (!data || !data.id) {
      throw new Error('Invalid time entry data: missing id');
    }
    if (!data.startTime) {
      throw new Error('Invalid time entry data: missing startTime');
    }

    // Validate and create dates
    const startTime = new Date(data.startTime);
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid time entry data: invalid startTime "${data.startTime}"`);
    }

    let endTime: Date | undefined;
    if (data.endTime) {
      endTime = new Date(data.endTime);
      if (isNaN(endTime.getTime())) {
        console.warn(`Invalid endTime "${data.endTime}", ignoring`);
        endTime = undefined;
      }
    }

    // Validate duration
    const duration = typeof data.duration === 'number' ? Math.max(0, data.duration) : 0;

    return {
      id: data.id,
      userId: data.userId,
      userName: data.user?.name || data.userName || '',
      projectId: data.projectId,
      projectName: data.project?.name || data.projectName,
      startTime,
      endTime,
      duration,
      description: data.description,
      status: this.mapEntryStatus(data.status),
    };
  }

  private mapEntryStatus(status: string): 'running' | 'paused' | 'stopped' {
    switch (status) {
      case 'RUNNING':
        return 'running';
      case 'PAUSED':
        return 'paused';
      case 'STOPPED':
        return 'stopped';
      default:
        return 'stopped';
    }
  }

  // Screenshot methods
  async uploadScreenshot(timeEntryId: string, imageData: string): Promise<Screenshot> {
    const response = await this.client.post('/screenshots', {
      timeEntryId,
      imageData, // base64 encoded
    });
    return this.mapScreenshot(response.data);
  }

  async getScreenshotsByTimeEntry(timeEntryId: string): Promise<Screenshot[]> {
    const response = await this.client.get(`/screenshots/time-entry/${timeEntryId}`);
    if (!Array.isArray(response.data)) {
      return [];
    }
    return response.data.map((data: any) => this.mapScreenshot(data));
  }

  async deleteScreenshot(screenshotId: string): Promise<void> {
    await this.client.delete(`/screenshots/${screenshotId}`);
  }

  // Team Activity
  async getTeamActivity(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    projectId?: string;
  }) {
    const response = await this.client.get('/team-activity', { params });
    return response.data;
  }

  // Activities
  async getActivities(params?: { userId?: string; limit?: number }): Promise<Activity[]> {
    const response = await this.client.get('/time-entries/activities', { params });
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from /time-entries/activities', response.data);
      return [];
    }
    return response.data;
  }

  // Company Screenshot Settings
  async getCompanyScreenshotSettings() {
    const response = await this.client.get('/companies/screenshot-settings');
    return response.data;
  }

  async updateCompanyScreenshotSettings(settings: {
    screenshotEnabled?: boolean;
    screenshotInterval?: number;
  }) {
    const response = await this.client.patch('/companies/screenshot-settings', settings);
    return response.data;
  }

  private mapScreenshot(data: any): Screenshot {
    // Validate required fields
    if (!data || !data.id || !data.timeEntryId) {
      throw new Error('Invalid screenshot data: missing required fields');
    }
    
    // Validate and process imageUrl
    if (!data.imageUrl || typeof data.imageUrl !== 'string') {
      throw new Error('Invalid screenshot data: missing or invalid imageUrl');
    }
    const imageUrl = data.imageUrl.startsWith('http') 
      ? data.imageUrl 
      : `${API_URL.replace('/api', '')}${data.imageUrl}`;
    
    // Validate and process thumbnailUrl
    let thumbnailUrl: string | undefined = undefined;
    if (data.thumbnailUrl && typeof data.thumbnailUrl === 'string') {
      thumbnailUrl = data.thumbnailUrl.startsWith('http') 
        ? data.thumbnailUrl 
        : `${API_URL.replace('/api', '')}${data.thumbnailUrl}`;
    }
    
    // Validate and create dates
    if (!data.timestamp) {
      throw new Error('Invalid screenshot data: missing timestamp');
    }
    const timestamp = new Date(data.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error(`Invalid screenshot data: invalid timestamp "${data.timestamp}"`);
    }
    
    if (!data.createdAt) {
      throw new Error('Invalid screenshot data: missing createdAt');
    }
    const createdAt = new Date(data.createdAt);
    if (isNaN(createdAt.getTime())) {
      throw new Error(`Invalid screenshot data: invalid createdAt "${data.createdAt}"`);
    }
    
    return {
      id: data.id,
      timeEntryId: data.timeEntryId,
      imageUrl,
      thumbnailUrl,
      timestamp,
      createdAt,
    };
  }
}

export const api = new ApiClient();

