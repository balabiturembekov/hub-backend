import { TimeEntry, User, Project } from '@/types';
import { format } from 'date-fns';

/**
 * Generic CSV export function
 */
export function exportToCSV(
  data: Record<string, any>[],
  filename: string = 'export.csv'
): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Helper function to escape CSV cell content
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If cell contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Get headers from first object keys
  const headers = Object.keys(data[0]);

  // Convert data to CSV rows
  const rows = data.map((row) => {
    try {
      return headers.map((header) => escapeCSV(row[header]));
    } catch (error) {
      console.error('Error formatting CSV row:', error);
      return headers.map(() => 'Error');
    }
  });

  // Combine headers and rows
  const csvContent = [
    headers.map((h) => escapeCSV(h)).join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) {
      document.body.removeChild(link);
    }
  } finally {
    // Always revoke object URL to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Export time entries to CSV format
 */
export function exportTimeEntriesToCSV(
  entries: TimeEntry[],
  users: User[],
  projects: Project[],
  filename: string = 'time-entries.csv'
): void {
  // CSV Headers
  const headers = [
    'Date',
    'User',
    'Project',
    'Start Time',
    'End Time',
    'Duration (hours)',
    'Description',
    'Status',
  ];

  // Helper function to escape CSV cell content
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If cell contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Convert entries to CSV rows with proper error handling
  const rows = entries.map((entry) => {
    try {
      const user = users.find((u) => u.id === entry.userId);
      const project = projects.find((p) => p.id === entry.projectId);

      // Validate dates before formatting
      const startDate = new Date(entry.startTime);
      let endDate: Date | null = entry.endTime ? new Date(entry.endTime) : null;
      
      if (isNaN(startDate.getTime())) {
        console.warn('Invalid startTime in entry:', entry.id);
      }
      if (endDate && isNaN(endDate.getTime())) {
        console.warn('Invalid endTime in entry:', entry.id);
        endDate = null;
      }

      // Validate duration
      const duration = entry.duration || 0;
      const hours = isFinite(duration) && duration >= 0 ? (duration / 3600).toFixed(2) : '0.00';

      return [
        isNaN(startDate.getTime()) ? 'Invalid date' : format(startDate, 'yyyy-MM-dd'),
        escapeCSV(user?.name || entry.userName || 'Unknown'),
        escapeCSV(project?.name || entry.projectName || 'No project'),
        isNaN(startDate.getTime()) ? 'Invalid time' : format(startDate, 'HH:mm:ss'),
        endDate && !isNaN(endDate.getTime()) ? format(endDate, 'HH:mm:ss') : '-',
        hours,
        escapeCSV(entry.description || ''),
        entry.status.toUpperCase(),
      ];
    } catch (error) {
      console.error('Error formatting CSV row for entry:', entry.id, error);
      // Return a safe default row
      return ['Error', 'Error', 'Error', 'Error', '-', '0.00', 'Error processing entry', 'ERROR'];
    }
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(cell)).join(',')),
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Always revoke object URL to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Export user statistics to CSV
 */
export function exportUserStatsToCSV(
  users: User[],
  entries: TimeEntry[],
  filename: string = 'user-statistics.csv'
): void {
  const headers = ['User', 'Email', 'Role', 'Total Hours', 'Total Entries', 'Active Entries'];

  // Helper function to escape CSV cell content
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If cell contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = users.map((user) => {
    try {
      const userEntries = entries.filter((e) => e.userId === user.id && e.status === 'stopped');
      const totalSeconds = userEntries.reduce((acc, e) => {
        const duration = e.duration || 0;
        return acc + (isFinite(duration) && duration >= 0 ? duration : 0);
      }, 0);
      const totalHours = totalSeconds / 3600;
      const activeEntries = entries.filter((e) => e.userId === user.id && e.status === 'running').length;

      return [
        escapeCSV(user.name || 'Unknown'),
        escapeCSV(user.email || ''),
        user.role.toUpperCase(),
        isFinite(totalHours) && totalHours >= 0 ? totalHours.toFixed(2) : '0.00',
        userEntries.length.toString(),
        activeEntries.toString(),
      ];
    } catch (error) {
      console.error('Error formatting CSV row for user:', user.id, error);
      return ['Error', 'Error', 'ERROR', '0.00', '0', '0'];
    }
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Always revoke object URL to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Export project statistics to CSV
 */
export function exportProjectStatsToCSV(
  projects: Project[],
  entries: TimeEntry[],
  users: User[],
  filename: string = 'project-statistics.csv'
): void {
  const headers = [
    'Project',
    'Client',
    'Status',
    'Budget',
    'Total Hours',
    'Total Entries',
    'Active Users',
  ];

  // Helper function to escape CSV cell content
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If cell contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = projects.map((project) => {
    try {
      const projectEntries = entries.filter((e) => e.projectId === project.id && e.status === 'stopped');
      const totalSeconds = projectEntries.reduce((acc, e) => {
        const duration = e.duration || 0;
        return acc + (isFinite(duration) && duration >= 0 ? duration : 0);
      }, 0);
      const totalHours = totalSeconds / 3600;
      const uniqueUsers = new Set(projectEntries.map((e) => e.userId).filter(Boolean));

      return [
        escapeCSV(project.name || 'Unknown'),
        escapeCSV(project.clientName || '-'),
        project.status.toUpperCase(),
        project.budget && isFinite(project.budget) && project.budget >= 0 
          ? `$${project.budget.toFixed(2)}` 
          : '-',
        isFinite(totalHours) && totalHours >= 0 ? totalHours.toFixed(2) : '0.00',
        projectEntries.length.toString(),
        uniqueUsers.size.toString(),
      ];
    } catch (error) {
      console.error('Error formatting CSV row for project:', project.id, error);
      return ['Error', 'Error', 'ERROR', '-', '0.00', '0', '0'];
    }
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Always revoke object URL to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

