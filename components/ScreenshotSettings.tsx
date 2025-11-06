'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScreenshotSettings, ScreenshotInterval } from '@/hooks/useScreenshotSettings';
import { useToast } from '@/hooks/use-toast';
import { Camera, CameraOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ScreenshotSettings() {
  const { settings, setEnabled, setInterval, canEdit, isLoading } = useScreenshotSettings();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    };
  }, []);

  const intervalOptions: { value: ScreenshotInterval; label: string }[] = [
    { value: 30, label: 'Every 30 seconds' },
    { value: 60, label: 'Every 1 minute' },
    { value: 300, label: 'Every 5 minutes' },
    { value: 600, label: 'Every 10 minutes' },
  ];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!canEdit || isUpdating) return; // Prevent multiple simultaneous updates
    
    if (checked) {
      // Show warning when enabling
      setShowWarning(true);
      // Clear previous timeout if exists
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(false);
        warningTimeoutRef.current = null;
      }, 5000);
    } else {
      // Hide warning immediately if disabling
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      setShowWarning(false);
    }
    
    setIsUpdating(true);
    try {
      await setEnabled(checked);
    } catch (error: any) {
      console.error('Failed to update screenshot settings:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to update screenshot settings',
        variant: 'destructive',
      });
      // Error will revert the UI state automatically via the hook
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  {settings.enabled ? (
                    <Camera className="h-5 w-5 text-green-500" />
                  ) : (
                    <CameraOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {settings.enabled 
                    ? 'Screenshot capture is enabled. Screenshots will be taken automatically while tracking time.' 
                    : 'Screenshot capture is disabled. Enable it to automatically capture screenshots while tracking time.'}
                </p>
              </TooltipContent>
            </Tooltip>
            <CardTitle>Screenshot Capture</CardTitle>
          </div>
          <CardDescription>
            {canEdit
              ? 'Automatically capture screenshots while tracking time'
              : 'Screenshot capture settings are managed by your administrator'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showWarning && canEdit && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> When you start tracking time, your browser will ask you to choose what to share:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Entire Screen:</strong> Captures your whole screen, even when switching between apps</li>
                <li><strong>Window/Tab:</strong> Only captures the selected window or browser tab</li>
              </ul>
              <p className="mt-2">Your screen will only be captured while the timer is running.</p>
            </div>
          )}

          {!canEdit && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-800 dark:text-blue-200">
              <p>These settings are configured by your administrator. Contact an admin to change screenshot capture settings.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="screenshot-enabled">Screenshot Capture</Label>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? 'Capture screenshots automatically during time tracking'
                  : `Screenshots are ${settings.enabled ? 'enabled' : 'disabled'} for your company`}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  id="screenshot-enabled"
                  checked={settings.enabled}
                  onCheckedChange={canEdit ? handleToggle : undefined}
                  disabled={!canEdit || isUpdating || isLoading}
                />
              </TooltipTrigger>
              <TooltipContent>
                {canEdit
                  ? (settings.enabled
                      ? 'Screenshots are enabled'
                      : 'Enable automatic screenshot capture')
                  : 'Only administrators can change this setting'}
              </TooltipContent>
            </Tooltip>
          </div>

          {settings.enabled && (
            <div className="space-y-2">
              <Label htmlFor="screenshot-interval">Capture Interval</Label>
              <Select
                value={settings.interval.toString()}
                onValueChange={canEdit && !isUpdating ? (async (value) => {
                  setIsUpdating(true);
                  try {
                    await setInterval(parseInt(value) as ScreenshotInterval);
                  } catch (error: any) {
                    console.error('Failed to update interval:', error);
                    toast({
                      title: 'Error',
                      description: error.response?.data?.message || error.message || 'Failed to update screenshot interval',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsUpdating(false);
                  }
                }) : undefined}
                disabled={!canEdit || isUpdating || isLoading}
              >
                <SelectTrigger id="screenshot-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {canEdit ? (
                  <>
                    Screenshots will be taken at the selected interval while your timer is active.
                    <br />
                    <span className="mt-1 block">
                      <strong>Tip:</strong> Choose "Entire Screen" when prompted to capture screenshots even when switching between applications.
                    </span>
                  </>
                ) : (
                  `Screenshots are captured every ${intervalOptions.find(opt => opt.value === settings.interval)?.label.toLowerCase() || 'minute'} while tracking time.`
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

