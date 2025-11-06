import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  // Validate input
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format duration in HH:MM:SS format (always shows hours, even if 0)
 */
export function formatDurationFull(hours: number): string {
  // Validate input
  if (!isFinite(hours) || isNaN(hours) || hours < 0) {
    return '0:00:00';
  }
  
  // Convert hours to seconds
  const totalSeconds = Math.floor(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatHours(seconds: number): string {
  // Validate input
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0h';
  }
  
  // Prevent overflow issues
  const safeSeconds = Math.max(0, Math.min(seconds, Number.MAX_SAFE_INTEGER));
  const hours = safeSeconds / 3600;
  
  // Additional check for Infinity after division (though it shouldn't happen with our validation)
  if (!isFinite(hours)) {
    return '0h';
  }
  
  if (hours >= 1) {
    return `${hours.toFixed(2)}h`;
  }
  const minutes = safeSeconds / 60;
  // Additional check for Infinity
  if (!isFinite(minutes)) {
    return '0m';
  }
  return `${minutes.toFixed(0)}m`;
}
