export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'admin' | 'employee';
  status: 'active' | 'inactive';
  hourlyRate?: number;
  companyId?: string;
  company?: {
    id: string;
    name: string;
  };
}

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  projectId?: string;
  projectName?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  description?: string;
  status: 'running' | 'paused' | 'stopped';
  screenshots?: Screenshot[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  clientName?: string;
  budget?: number;
  status: 'active' | 'archived';
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: 'start' | 'stop' | 'pause' | 'resume';
  timestamp: Date;
  projectId?: string;
}

export interface DashboardStats {
  totalHours: number;
  activeUsers: number;
  totalProjects: number;
  todayHours: number;
}

// DTOs for API
export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  companyName: string;
  companyDomain?: string;
  role?: 'SUPER_ADMIN' | 'OWNER' | 'admin' | 'employee';
  avatar?: string;
  hourlyRate?: number;
}

export interface Screenshot {
  id: string;
  timeEntryId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  timestamp: Date;
  createdAt: Date;
}

export interface ScreenshotSettings {
  screenshotEnabled: boolean;
  screenshotInterval: number; // 30, 60, 300, 600 seconds
}
