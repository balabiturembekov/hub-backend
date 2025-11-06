'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TimeTracker } from './TimeTracker';

export function TimeTrackerErrorBoundary() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error for TimeTracker component
        console.error('TimeTracker error:', error, errorInfo);
        // You can send to error reporting service here
      }}
    >
      <TimeTracker />
    </ErrorBoundary>
  );
}

