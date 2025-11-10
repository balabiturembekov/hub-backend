'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const updateStatsRef = useRef(useStore.getState().updateStats);

  // Update ref when updateStats changes
  // Note: updateStats is a function that doesn't change, but we update ref to avoid stale closures
  // This effect runs on every render, but it's cheap (just assigning a ref)
  useEffect(() => {
    updateStatsRef.current = useStore.getState().updateStats;
  });

  useEffect(() => {
    // Create EventSource connection with error handling
    let eventSource: EventSource;
    try {
      eventSource = new EventSource('/api/sse');
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      return; // Early return if EventSource creation fails
    }
    
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        // Validate event data
        if (!event.data || typeof event.data !== 'string') {
          console.warn('SSE: Invalid event data:', event.data);
          return;
        }
        
        const data = JSON.parse(event.data);
        
        // Validate data structure
        if (!data || typeof data !== 'object') {
          console.warn('SSE: Invalid data structure:', data);
          return;
        }
        
        // Validate type field
        if (!data.type || typeof data.type !== 'string') {
          console.warn('SSE: Missing or invalid type field:', data);
          return;
        }
        
        if (data.type === 'stats_update') {
          // Get current timeEntries from store inside the handler to avoid stale closure
          const state = useStore.getState();
          const timeEntries = state.timeEntries;
          
          // Validate timeEntries is an array
          if (!timeEntries || !Array.isArray(timeEntries)) {
            console.warn('SSE: timeEntries is not an array, skipping stats update');
            return;
          }
          
          // Recalculate stats based on current time entries
          const totalSeconds = timeEntries.reduce(
            (acc, entry) => {
              // Validate entry structure
              if (!entry || typeof entry.duration !== 'number' || isNaN(entry.duration)) {
                return acc;
              }
              return acc + entry.duration;
            },
            0
          );
          const activeUsers = new Set(
            timeEntries
              .filter((e) => e && e.status === 'running' && e.userId)
              .map((e) => e.userId)
          ).size;

          updateStatsRef.current({
            totalHours: totalSeconds / 3600,
            activeUsers,
            todayHours: totalSeconds / 3600,
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Close and cleanup on error to prevent memory leaks
      // Use the eventSource from closure, not ref (ref might be null if already cleaned up)
      try {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      } catch (closeError) {
        // Ignore errors when closing
      }
      if (eventSourceRef.current) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []); // Empty deps - updateStats accessed via ref
}
