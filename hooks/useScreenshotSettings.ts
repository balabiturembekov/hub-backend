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
    await updateStoreSettings({ screenshotEnabled: enabled });
  };

  const setIntervalValue = async (interval: ScreenshotInterval) => {
    await updateStoreSettings({ screenshotInterval: interval });
  };

  const updateSettings = async (newSettings: Partial<ScreenshotSettings>) => {
    await updateStoreSettings({
      screenshotEnabled: newSettings.enabled,
      screenshotInterval: newSettings.interval,
    });
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

