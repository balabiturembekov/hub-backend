import { User, Project, TimeEntry } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    status: 'active',
    hourlyRate: 50,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'employee',
    status: 'active',
    hourlyRate: 30,
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'employee',
    status: 'active',
    hourlyRate: 25,
  },
];

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    description: 'Complete redesign of company website',
    color: '#3b82f6',
    clientName: 'Acme Corp',
    status: 'active',
  },
  {
    id: '2',
    name: 'Mobile App',
    description: 'iOS and Android mobile application',
    color: '#10b981',
    clientName: 'TechStart',
    status: 'active',
  },
  {
    id: '3',
    name: 'Marketing Campaign',
    description: 'Q4 marketing campaign',
    color: '#f59e0b',
    clientName: 'BrandCo',
    status: 'active',
  },
];

export const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    userId: '2',
    userName: 'Jane Smith',
    projectId: '1',
    projectName: 'Website Redesign',
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 60 * 60 * 1000),
    duration: 3600,
    description: 'Worked on homepage design',
    status: 'stopped',
  },
  {
    id: '2',
    userId: '3',
    userName: 'Bob Johnson',
    projectId: '2',
    projectName: 'Mobile App',
    startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
    duration: 7200,
    description: 'API integration',
    status: 'running',
  },
];

