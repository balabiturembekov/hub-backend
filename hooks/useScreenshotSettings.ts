'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';

export type ScreenshotInterval = 30 | 60 | 300 | 600; // 30s, 1m, 5m, 10m

interface ScreenshotSettings {
  enabled: boolean;
  interval: ScreenshotInterval;
}

const DEFAULT_SETTINGS: ScreenshotSettings = {
  enabled: false,
  interval: 60, // 1 minute default
};

export function useScreenshotSettings() {
  const { 
    currentUser, 
    screenshotSettings, 
    screenshotSettingsLoading,
    loadScreenshotSettings,
    updateScreenshotSettings: updateStoreSettings,
  } = useStore();

  // Check if user is admin/owner (can edit settings)
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'OWNER';

  // Map store settings to component format
  const settings: ScreenshotSettings = useMemo(() => {
    if (!screenshotSettings) {
      return DEFAULT_SETTINGS;
    }
    
    // Validate interval
    const validIntervals: ScreenshotInterval[] = [30, 60, 300, 600];
    const interval = validIntervals.includes(screenshotSettings.screenshotInterval as ScreenshotInterval)
      ? (screenshotSettings.screenshotInterval as ScreenshotInterval)
      : DEFAULT_SETTINGS.interval;
    
    return {
      enabled: screenshotSettings.screenshotEnabled ?? DEFAULT_SETTINGS.enabled,
      interval: interval,
    };
  }, [screenshotSettings]);

  const setEnabled = async (enabled: boolean) => {
    try {
      // Validate enabled is a boolean
      if (typeof enabled !== 'boolean') {
        console.error('useScreenshotSettings: enabled must be a boolean', enabled);
        return;
      }
      await updateStoreSettings({ screenshotEnabled: enabled });
    } catch (error) {
      console.error('useScreenshotSettings: Error setting enabled', error);
      throw error;
    }
  };

  const setIntervalValue = async (interval: ScreenshotInterval) => {
    try {
      // Validate interval is a valid value
      const validIntervals: ScreenshotInterval[] = [30, 60, 300, 600];
      if (!validIntervals.includes(interval)) {
        console.error('useScreenshotSettings: Invalid interval value', interval);
        return;
      }
      await updateStoreSettings({ screenshotInterval: interval });
    } catch (error) {
      console.error('useScreenshotSettings: Error setting interval', error);
      throw error;
    }
  };

  const updateSettings = async (newSettings: Partial<ScreenshotSettings>) => {
    try {
      // Validate newSettings structure
      if (!newSettings || typeof newSettings !== 'object') {
        console.error('useScreenshotSettings: Invalid settings object', newSettings);
        return;
      }
      
      // Validate enabled if provided
      if (newSettings.enabled !== undefined && typeof newSettings.enabled !== 'boolean') {
        console.error('useScreenshotSettings: enabled must be a boolean', newSettings.enabled);
        return;
      }
      
      // Validate interval if provided
      if (newSettings.interval !== undefined) {
        const validIntervals: ScreenshotInterval[] = [30, 60, 300, 600];
        if (!validIntervals.includes(newSettings.interval)) {
          console.error('useScreenshotSettings: Invalid interval value', newSettings.interval);
          return;
        }
      }
      
      await updateStoreSettings({
        screenshotEnabled: newSettings.enabled,
        screenshotInterval: newSettings.interval,
      });
    } catch (error) {
      console.error('useScreenshotSettings: Error updating settings', error);
      throw error;
    }
  };

  return {
    settings,
    isLoading: screenshotSettingsLoading,
    canEdit,
    setEnabled,
    setInterval: setIntervalValue, // Alias to avoid conflict with global setInterval
    updateSettings,
    // Expose reload function if needed
    reload: loadScreenshotSettings,
  };
}

