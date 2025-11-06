'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useStore } from '@/lib/store';

interface UseScreenCaptureOptions {
  enabled: boolean;
  interval: number; // milliseconds between screenshots
  timeEntryId: string | null;
  onCapture?: (imageData: string) => void;
}

// Bug 86: Global singleton to prevent duplicate screenshot captures across multiple component instances
const globalScreenCapture = {
  stream: null as MediaStream | null,
  video: null as HTMLVideoElement | null,
  canvas: null as HTMLCanvasElement | null,
  interval: null as NodeJS.Timeout | null,
  isCapturing: false,
  isUploading: false, // Bug 111: Prevent concurrent uploads across components
  consecutiveFailures: 0, // Bug 114: Track consecutive upload failures
  timeEntryId: null as string | null, // Bug 94: Store timeEntryId to check if it matches current active entry
  
  setStream(stream: MediaStream | null) {
    this.stream = stream;
  },
  
  getStream(): MediaStream | null {
    return this.stream;
  },
  
  hasActiveStream(): boolean {
    return this.stream !== null && this.stream.getTracks().some(track => track.readyState === 'live');
  },
  
  setVideo(video: HTMLVideoElement | null) {
    this.video = video;
  },
  
  getVideo(): HTMLVideoElement | null {
    return this.video;
  },
  
  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
  },
  
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  },
  
  setInterval(interval: NodeJS.Timeout | null) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = interval;
  },
  
  clearInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  
  setIsCapturing(isCapturing: boolean) {
    this.isCapturing = isCapturing;
  },
  
  getIsCapturing(): boolean {
    return this.isCapturing;
  },
  
  setTimeEntryId(timeEntryId: string | null) {
    this.timeEntryId = timeEntryId;
  },
  
  getTimeEntryId(): string | null {
    return this.timeEntryId;
  },
  
  cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      const stream = this.video.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      this.video.srcObject = null;
      if (this.video.parentNode) {
        this.video.remove();
      }
      this.video = null;
    }
    this.canvas = null;
    this.isCapturing = false;
    this.isUploading = false; // Bug 111: Clear uploading flag on cleanup
    this.consecutiveFailures = 0; // Bug 114: Reset failure counter on cleanup
    this.timeEntryId = null;
  }
};

// Export for use in store logout
export { globalScreenCapture };

export function useScreenCapture({
  enabled,
  interval,
  timeEntryId,
  onCapture,
}: UseScreenCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const firstScreenshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Store checkReady timeout for cleanup
  const endedHandlerRef = useRef<(() => void) | null>(null); // Store ended handler for cleanup
  const isUploadingRef = useRef(false); // Bug 111: Prevent concurrent uploads
  const { toast } = useToast();
  
  // Use ref for toast to avoid stale closures
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Initialize video and canvas elements
  // These elements should persist even when component unmounts if timer is active (bug84)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Bug 86: Use global singleton to prevent duplicate video/canvas elements
    // If global video/canvas exist, reuse them; otherwise create new ones
    if (!globalScreenCapture.getVideo()) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.style.display = 'none';
      // Bug 88: Add to DOM for better browser compatibility
      document.body.appendChild(video);
      globalScreenCapture.setVideo(video);
      videoRef.current = video;
    } else {
      // Reuse existing global video
      videoRef.current = globalScreenCapture.getVideo();
    }

    if (!globalScreenCapture.getCanvas()) {
      const canvas = document.createElement('canvas');
      globalScreenCapture.setCanvas(canvas);
      canvasRef.current = canvas;
    } else {
      // Reuse existing global canvas
      canvasRef.current = globalScreenCapture.getCanvas();
    }

    return () => {
      // Bug 90: Use props directly via closure instead of refs that update asynchronously
      // Check enabled and timeEntryId to determine if timer is active
      // Use current values from closure, not refs that may be stale
      const currentTimeEntryId = timeEntryId; // Use prop directly
      const currentEnabled = enabled; // Use prop directly
      
      // If timer is active (enabled and timeEntryId exists), keep video/canvas alive
      if (currentEnabled && currentTimeEntryId) {
        // Timer still active - don't cleanup video/canvas, let capture continue
        // This is normal behavior when navigating between pages - no need to log every time
        // Only log if this is unexpected (e.g., timer should have stopped)
        return;
      }
      
      // Timer stopped or disabled - cleanup
      // Bug 86: Only cleanup if no other component is using global resources
      // Check if this is the last component using the global video/canvas
      const globalVideo = globalScreenCapture.getVideo();
      const globalCanvas = globalScreenCapture.getCanvas();
      
      if (videoRef.current === globalVideo) {
        // Only cleanup global video if we're the last user
        // For now, keep it alive - other components might need it
        // Full cleanup will happen when all components unmount and timer stops
        videoRef.current = null;
      } else if (videoRef.current) {
        // Local video element - cleanup normally
        const stream = videoRef.current.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        videoRef.current.srcObject = null;
        // Bug 88: Remove from DOM if it was added
        if (videoRef.current.parentNode) {
          videoRef.current.remove();
        }
        videoRef.current = null;
      }
      
      // Canvas is just a reference, no need to remove from DOM
      // But clear the ref to prevent usage after unmount (bug55)
      if (canvasRef.current === globalCanvas) {
        canvasRef.current = null;
      } else {
        canvasRef.current = null;
      }
    };
  }, [enabled, timeEntryId]); // Bug 90: Include deps to use current values

  // Start screen capture - use refs to avoid stale closures
  const isCapturingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const timeEntryIdRef = useRef(timeEntryId);
  const intervalRef2 = useRef(interval);
  const captureFrameRef = useRef<(() => Promise<void>) | null>(null);
  const onCaptureRef = useRef(onCapture);
  const isMountedRef = useRef(true); // Track if component is still mounted
  
  // Update onCapture ref when it changes
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);
  
  // Keep ref in sync with state - but don't rely on this for critical checks
  // Always update ref synchronously when setting state
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  // Update enabled ref when it changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    timeEntryIdRef.current = timeEntryId;
  }, [timeEntryId]);

  // Update interval ref when interval changes
  useEffect(() => {
    intervalRef2.current = interval;
  }, [interval]);

  const startCapture = useCallback(async () => {
    const currentTimeEntryId = timeEntryIdRef.current || timeEntryId;
    const currentEnabled = enabledRef.current;
    
    // Validate timeEntryId (bug48)
    if (!currentTimeEntryId || 
        typeof currentTimeEntryId !== 'string' || 
        currentTimeEntryId.trim() === '') {
      console.log('[Screenshot] Cannot start capture - invalid timeEntryId:', { 
        timeEntryId: currentTimeEntryId,
        type: typeof currentTimeEntryId
      });
      return;
    }
    
    // Bug 86: Check global singleton for existing active stream
    if (globalScreenCapture.hasActiveStream()) {
      const globalStream = globalScreenCapture.getStream();
      console.log('[Screenshot] Cannot start capture - global stream already active:', { 
        timeEntryId: currentTimeEntryId, 
        enabled: currentEnabled, 
        isCapturing: isCapturingRef.current,
        globalIsCapturing: globalScreenCapture.getIsCapturing(),
        activeTracks: globalStream?.getTracks().filter(t => t.readyState === 'live').length || 0
      });
      // Reuse existing stream and sync state
      if (globalStream) {
        // Bug 92: Check if timeEntryId matches current active entry
        const globalTimeEntryId = globalScreenCapture.getTimeEntryId();
        if (globalTimeEntryId !== currentTimeEntryId) {
          console.log('[Screenshot] Global stream exists but timeEntryId mismatch, stopping old capture:', {
            globalTimeEntryId,
            currentTimeEntryId
          });
          // Stop old capture and start new one
          globalScreenCapture.clearInterval();
          if (globalScreenCapture.getStream()) {
            globalScreenCapture.getStream()!.getTracks().forEach(track => track.stop());
            globalScreenCapture.setStream(null);
          }
          globalScreenCapture.setIsCapturing(false);
          globalScreenCapture.setTimeEntryId(null);
          // Continue to create new stream below
        } else {
          // Bug 98: Check if stream is still actually active before reusing
          const activeTracks = globalStream.getTracks().filter(track => track.readyState === 'live');
          if (activeTracks.length === 0) {
            console.log('[Screenshot] Global stream exists but no active tracks, stopping old capture');
            // Stream ended but wasn't cleaned up - clean it up now
            globalScreenCapture.clearInterval();
            globalScreenCapture.setStream(null);
            globalScreenCapture.setIsCapturing(false);
            globalScreenCapture.setTimeEntryId(null);
            // Continue to create new stream below
          } else {
            // TimeEntryId matches and stream is active, reuse existing stream
            streamRef.current = globalStream;
            // Reuse global video/canvas if available
            if (globalScreenCapture.getVideo() && !videoRef.current) {
              videoRef.current = globalScreenCapture.getVideo();
            }
            if (globalScreenCapture.getCanvas() && !canvasRef.current) {
              canvasRef.current = globalScreenCapture.getCanvas();
            }
            // Sync state with global
            isCapturingRef.current = globalScreenCapture.getIsCapturing();
            setIsCapturing(globalScreenCapture.getIsCapturing());
            setHasPermission(true);
            // Resume interval if it was cleared
            if (!intervalRef.current && globalScreenCapture.interval) {
              intervalRef.current = globalScreenCapture.interval;
            }
            return; // Prevent duplicate streams
          }
        }
      }
    }
    
    // Bug 89: Also check local streamRef for race conditions
    if (streamRef.current && streamRef.current.getTracks().some(track => track.readyState === 'live')) {
      console.log('[Screenshot] Cannot start capture - local stream already active:', { 
        timeEntryId: currentTimeEntryId, 
        enabled: currentEnabled, 
        isCapturing: isCapturingRef.current,
        activeTracks: streamRef.current.getTracks().filter(t => t.readyState === 'live').length
      });
      return; // Prevent duplicate streams
    }

    if (!currentEnabled || isCapturingRef.current) {
      console.log('[Screenshot] Cannot start capture:', { 
        timeEntryId: currentTimeEntryId, 
        enabled: currentEnabled, 
        isCapturing: isCapturingRef.current 
      });
      return; // Prevent duplicate starts
    }

    console.log('[Screenshot] Starting capture:', { 
      timeEntryId: currentTimeEntryId, 
      interval: intervalRef2.current,
      enabled: currentEnabled,
      isCapturingBeforeStart: isCapturingRef.current 
    });

    try {
      // Check if component is still mounted before starting
      if (!isMountedRef.current) {
        console.log('[Screenshot] Component unmounted, aborting start');
        return;
      }
      
      // Bug 109: Use global lock to prevent race conditions from multiple components
      // Check and set global capturing state atomically
      if (globalScreenCapture.getIsCapturing()) {
        console.log('[Screenshot] Another component is already starting capture, waiting...');
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 100));
        if (globalScreenCapture.hasActiveStream()) {
          // Another component succeeded, reuse it
          const globalStream = globalScreenCapture.getStream();
          if (globalStream) {
            streamRef.current = globalStream;
            if (globalScreenCapture.getVideo() && !videoRef.current) {
              videoRef.current = globalScreenCapture.getVideo();
            }
            if (globalScreenCapture.getCanvas() && !canvasRef.current) {
              canvasRef.current = globalScreenCapture.getCanvas();
            }
            isCapturingRef.current = globalScreenCapture.getIsCapturing();
            setIsCapturing(globalScreenCapture.getIsCapturing());
            setHasPermission(true);
            if (!intervalRef.current && globalScreenCapture.interval) {
              intervalRef.current = globalScreenCapture.interval;
            }
            return;
          }
        }
      }
      
      // Bug 89 & 109: Set isCapturingRef and global state atomically to prevent race condition
      // This prevents second startCapture call from creating duplicate stream
      isCapturingRef.current = true;
      globalScreenCapture.setIsCapturing(true);
      
      // Request screen capture permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        } as MediaTrackConstraints,
        audio: false,
      });
      } catch (getDisplayMediaError: unknown) {
        // Bug 107 & 118: Cleanup on getDisplayMedia error
        const error = getDisplayMediaError as { name?: string; message?: string };
        console.error('[Screenshot] getDisplayMedia failed:', error);
        
        isCapturingRef.current = false;
        globalScreenCapture.setIsCapturing(false);
        globalScreenCapture.setStream(null);
        globalScreenCapture.setTimeEntryId(null);
        setHasPermission(false);
        setIsCapturing(false);
        
        // Bug 118: Provide better error feedback for user cancellation
        if (isMountedRef.current) {
          try {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
              toastRef.current({
                title: 'Permission Denied',
                description: 'Screen capture permission was denied. Screenshots will not be available.',
                variant: 'destructive',
              });
            } else if (error.name === 'AbortError') {
              toastRef.current({
                title: 'Screen Capture Cancelled',
                description: 'Screen capture was cancelled. Screenshots will not be available.',
                variant: 'default',
              });
            } else if (error.name === 'InvalidStateError') {
              // getDisplayMedia must be called from a user gesture handler
              // This happens when called too late after user action (e.g., after async operations)
              toastRef.current({
                title: 'Screen Capture Requires User Action',
                description: 'Screen capture must be started from a user action. Please click "Start Screenshot Capture" button.',
                variant: 'default',
              });
            } else {
              toastRef.current({
                title: 'Screen Capture Error',
                description: error.message || 'Failed to start screen capture. Please try again.',
                variant: 'destructive',
              });
            }
          } catch (toastError) {
            console.error('[Screenshot] Failed to show toast:', toastError);
          }
        }
        
        throw getDisplayMediaError;
      }

      // Check again after async operation
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        isCapturingRef.current = false; // Reset if aborted
        globalScreenCapture.setIsCapturing(false);
        globalScreenCapture.setStream(null);
        globalScreenCapture.setTimeEntryId(null);
        console.log('[Screenshot] Component unmounted during getDisplayMedia, aborting');
        return;
      }

      streamRef.current = stream;
      // Bug 86: Update global singleton
      globalScreenCapture.setStream(stream);
      globalScreenCapture.setIsCapturing(true);
      globalScreenCapture.setTimeEntryId(currentTimeEntryId); // Bug 94: Store timeEntryId
      setHasPermission(true);
      // isCapturingRef already set above (bug89), just update state
      setIsCapturing(true);
      console.log('[Screenshot] Capture started, ref set to true:', { 
        isCapturingRef: isCapturingRef.current,
        streamActive: !!streamRef.current,
        videoReady: !!(videoRef.current?.videoWidth && videoRef.current?.videoHeight)
      });

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Bug 106: Handle video.play() errors
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('[Screenshot] Failed to play video:', playError);
          // Cleanup on play error
          stream.getTracks().forEach(track => track.stop());
          isCapturingRef.current = false;
          globalScreenCapture.setIsCapturing(false);
          globalScreenCapture.setStream(null);
          globalScreenCapture.setTimeEntryId(null);
          setHasPermission(false);
          setIsCapturing(false);
          throw new Error('Failed to play video stream');
        }
        
        // Check again after async operation
        if (!isMountedRef.current) {
          isCapturingRef.current = false; // Reset if aborted
          globalScreenCapture.setIsCapturing(false);
          globalScreenCapture.setStream(null);
          globalScreenCapture.setTimeEntryId(null);
          stopCaptureRef.current();
          return;
        }
        
        // Bug 110: Wait for video to be ready with proper error handling
        try {
          await new Promise<void>((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            const checkReady = () => {
              attempts++;
              if (attempts > maxAttempts) {
                console.error('[Screenshot] Video not ready after 5 seconds');
                checkReadyTimeoutRef.current = null;
                // Bug 110: Cleanup on timeout
                isCapturingRef.current = false;
                globalScreenCapture.setIsCapturing(false);
                reject(new Error('Video not ready'));
                return;
              }
              // Check if component is still mounted
              if (!isMountedRef.current) {
                checkReadyTimeoutRef.current = null;
                // Bug 110: Cleanup on unmount
                isCapturingRef.current = false;
                globalScreenCapture.setIsCapturing(false);
                reject(new Error('Component unmounted'));
                return;
              }
              
              if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                console.log('[Screenshot] Video ready:', { 
                  width: videoRef.current.videoWidth, 
                  height: videoRef.current.videoHeight,
                  attempts
                });
                checkReadyTimeoutRef.current = null;
                resolve();
              } else {
                checkReadyTimeoutRef.current = setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        } catch (readyError) {
          // Bug 110: Cleanup on checkReady error
          console.error('[Screenshot] Error waiting for video to be ready:', readyError);
          stream.getTracks().forEach(track => track.stop());
          isCapturingRef.current = false;
          globalScreenCapture.setIsCapturing(false);
          globalScreenCapture.setStream(null);
          globalScreenCapture.setTimeEntryId(null);
          setHasPermission(false);
          setIsCapturing(false);
          throw readyError;
        }
      }

      // Handle stream end (user stops sharing or switches apps)
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        // Remove previous ended handler if exists to prevent duplicates
        if (endedHandlerRef.current) {
          videoTracks[0].removeEventListener('ended', endedHandlerRef.current);
        }
        
        // Create new ended handler
        const endedHandler = () => {
          console.log('[Screenshot] Screen sharing ended - user switched apps or stopped sharing');
          
          // Bug 100: Check if timer is still active using store instead of stale refs
          // Screenshots should continue even when user switches apps if timer is active
          let isTimerActive = false;
          let currentTimeEntryId: string | null = null;
          
          try {
            const state = useStore.getState();
            const activeTimeEntry = state.activeTimeEntry;
            const screenshotSettings = state.screenshotSettings;
            
            currentTimeEntryId = activeTimeEntry?.id || null;
            isTimerActive = !!(activeTimeEntry && 
                              (activeTimeEntry.status === 'running' || activeTimeEntry.status === 'paused') &&
                              activeTimeEntry.id &&
                              screenshotSettings?.screenshotEnabled);
          } catch {
            // Fallback to refs if store check fails
            currentTimeEntryId = timeEntryIdRef.current;
            isTimerActive = enabledRef.current && !!currentTimeEntryId;
          }
          
          if (isTimerActive && currentTimeEntryId) {
            // Timer is still active - don't stop capture completely
            // The stream ended but timer is running, so we should attempt to resume
            // However, getDisplayMedia requires user gesture, so we just mark permission as revoked
            // User will need to manually resume when they return to the page
            console.log('[Screenshot] Stream ended but timer still active - will need manual resume');
            if (isMountedRef.current) {
              setIsCapturing(false);
              setHasPermission(false); // Mark permission as revoked
              try {
                toastRef.current({
                  title: 'Screen Sharing Interrupted',
                  description: 'Screen sharing was interrupted but timer is still running. Click "Resume Screenshot Capture" when you return.',
                  variant: 'default',
                });
              } catch (error) {
                console.error('[Screenshot] Failed to show toast:', error);
              }
            }
            // Don't call stopCapture - let the stream cleanup happen naturally
            // But clear the stream ref and global singleton so we know it's not active
            streamRef.current = null;
            // Bug 95: Update global singleton properly
            globalScreenCapture.setStream(null);
            globalScreenCapture.clearInterval();
            globalScreenCapture.setIsCapturing(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            isCapturingRef.current = false;
            return;
          }
          
          // Timer is not active - full stop
          if (isMountedRef.current) {
            setIsCapturing(false);
            setHasPermission(false); // Mark permission as revoked
          }
          stopCaptureRef.current();
          // Show notification that sharing stopped - use ref to avoid stale closure
          if (isMountedRef.current) {
            try {
              toastRef.current({
                title: 'Screen Sharing Stopped',
                description: 'Screen sharing was interrupted. Click "Resume Screenshot Capture" to continue.',
                variant: 'default',
              });
            } catch (error) {
              console.error('[Screenshot] Failed to show toast:', error);
            }
          }
        };
        
        endedHandlerRef.current = endedHandler;
        videoTracks[0].addEventListener('ended', endedHandler);
      }

      // Define captureFrame function locally to avoid closure issues
      const captureFrameLocal = async () => {
        const currentTimeEntryId = timeEntryIdRef.current;
        if (!videoRef.current || !canvasRef.current || !currentTimeEntryId || !isCapturingRef.current) {
          console.log('[Screenshot] Cannot capture frame:', {
            hasVideo: !!videoRef.current,
            hasCanvas: !!canvasRef.current,
            timeEntryId: currentTimeEntryId,
            isCapturing: isCapturingRef.current
          });
          return;
        }

        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;

          // Bug 116: Check if video element is still in DOM before any operations
          if (!video.parentNode) {
            console.warn('[Screenshot] Video element removed from DOM during capture');
            return;
          }

          // Bug 120 & 121: Get current video dimensions and validate before setting canvas
          const currentVideoWidth = video.videoWidth;
          const currentVideoHeight = video.videoHeight;
          
          // Check if video has valid dimensions
          if (!currentVideoWidth || !currentVideoHeight) {
            console.warn('[Screenshot] Video not ready yet:', { 
              videoWidth: currentVideoWidth, 
              videoHeight: currentVideoHeight 
            });
            return;
          }

          // Draw video frame to canvas
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('[Screenshot] Failed to get canvas context');
            return;
          }
          
          // Bug 115: Validate canvas context
          try {
            ctx.getImageData(0, 0, 1, 1);
          } catch (ctxError) {
            console.warn('[Screenshot] Canvas context is lost or invalid:', ctxError);
            return;
          }
          
          // Bug 120 & 121: Set canvas dimensions using current video dimensions
          canvas.width = currentVideoWidth;
          canvas.height = currentVideoHeight;
          
          console.log('[Screenshot] Capturing frame:', { 
            timeEntryId: currentTimeEntryId,
            dimensions: { width: canvas.width, height: canvas.height }
          });

          // Bug 119: Wrap drawImage in try-catch to handle errors
          try {
            // Bug 121: Re-check video dimensions right before drawImage
            if (video.videoWidth !== currentVideoWidth || video.videoHeight !== currentVideoHeight) {
              console.warn('[Screenshot] Video dimensions changed during capture, updating canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            
            // Bug 116: Final check that video is still in DOM
            if (!video.parentNode) {
              console.warn('[Screenshot] Video element removed from DOM during drawImage');
              return;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch (drawError) {
            console.error('[Screenshot] Failed to draw video to canvas (first screenshot):', drawError);
            return;
          }

          // Convert to base64 JPEG (quality 0.8)
          const imageData = canvas.toDataURL('image/jpeg', 0.8);

          // Call callback if provided (use ref to avoid stale closure)
          if (onCaptureRef.current) {
            try {
              onCaptureRef.current(imageData);
            } catch (error) {
              console.error('[Screenshot] Error in onCapture callback:', error);
            }
          }

          // Upload to server
          try {
            console.log('[Screenshot] Uploading screenshot:', { 
              timeEntryId: currentTimeEntryId, 
              imageSize: imageData.length 
            });
            await api.uploadScreenshot(currentTimeEntryId, imageData);
            console.log('[Screenshot] Screenshot uploaded successfully');
            // Bug 114: Reset failure counter on success
            globalScreenCapture.consecutiveFailures = 0;
          } catch (error: unknown) {
            const uploadError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
            
            // Bug 114: Increment failure counter
            globalScreenCapture.consecutiveFailures++;
            
            // Bug 117: Only log error details for first few failures
            if (globalScreenCapture.consecutiveFailures <= 3) {
              console.error('[Screenshot] Failed to upload screenshot:', error, `(${globalScreenCapture.consecutiveFailures} consecutive failures)`);
            } else {
              console.warn(`[Screenshot] Upload failed (${globalScreenCapture.consecutiveFailures} consecutive failures)`);
            }
            
            // Bug 114: Stop after too many consecutive failures
            if (globalScreenCapture.consecutiveFailures >= 5) {
              console.error('[Screenshot] Too many consecutive upload failures, stopping capture');
              stopCaptureRef.current();
              return;
            }
            
            // Bug 103: Handle 401 (Unauthorized) - user logged out, stop capture
            if (uploadError.response?.status === 401 || uploadError.message === 'Unauthorized') {
              console.log('[Screenshot] Unauthorized (401), user logged out, stopping capture');
              globalScreenCapture.consecutiveFailures = 0;
              stopCaptureRef.current();
              return;
            }
            
            // Bug 53: Handle 404 (Time entry not found)
            if (uploadError.response?.status === 404 && uploadError.response?.data?.message?.includes('Time entry')) {
              console.log('[Screenshot] Time entry was deleted, stopping capture');
              globalScreenCapture.consecutiveFailures = 0;
              stopCaptureRef.current();
              return;
            }
            
            // Bug 103: Handle 403 (Forbidden)
            if (uploadError.response?.status === 403) {
              console.log('[Screenshot] Forbidden (403), user may have lost permission, stopping capture');
              globalScreenCapture.consecutiveFailures = 0;
              stopCaptureRef.current();
              return;
            }
            
            // Handle 400 (Bad Request) - invalid image data or format issues
            if (uploadError.response?.status === 400) {
              const errorMessage = uploadError.response?.data?.message || 'Invalid screenshot data';
              console.warn('[Screenshot] Bad Request (400):', errorMessage);
              
              // If it's a data format issue (not time entry related), continue but skip this frame
              // Don't increment failure counter for format issues - might be temporary
              if (errorMessage.includes('image') || errorMessage.includes('base64') || errorMessage.includes('format')) {
                console.warn('[Screenshot] Image format issue, skipping this frame');
                return; // Skip this frame but continue capture
              }
              
              // If it's related to time entry (e.g., time entry stopped), stop capture
              if (errorMessage.includes('Time entry') || errorMessage.includes('time entry')) {
                console.log('[Screenshot] Time entry issue (400), stopping capture');
                globalScreenCapture.consecutiveFailures = 0;
                stopCaptureRef.current();
                return;
              }
              
              // For other 400 errors, increment failure counter normally
              // This will eventually stop capture after 5 failures
            }
            
            // Don't show toast on every failed upload to avoid spam
          }
        } catch (error) {
          console.error('Error capturing frame:', error);
        }
      };

      // Bug 86: Use global interval to prevent duplicates
      // Clear existing interval first (both local and global)
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      globalScreenCapture.clearInterval();
      // Bug 111: Clear uploading flag when starting new capture
      globalScreenCapture.isUploading = false;
      
      // Capture first screenshot after video is ready (already waited for video above)
      // Clear any existing timeout first
      if (firstScreenshotTimeoutRef.current) {
        clearTimeout(firstScreenshotTimeoutRef.current);
        firstScreenshotTimeoutRef.current = null;
      }
      
      console.log('[Screenshot] Capturing first screenshot after stabilization');
      firstScreenshotTimeoutRef.current = setTimeout(async () => {
        console.log('[Screenshot] First screenshot timeout fired');
        firstScreenshotTimeoutRef.current = null; // Clear ref after execution
        
        // Bug 104: Check if capture is still active using global state
        if (!globalScreenCapture.getIsCapturing() || !globalScreenCapture.hasActiveStream()) {
          console.warn('[Screenshot] Skipping first screenshot - not capturing anymore');
          return;
        }
        
        // Check if timer is still active
        try {
          const state = useStore.getState();
          const activeTimeEntry = state.activeTimeEntry;
          const screenshotSettings = state.screenshotSettings;
          if (!activeTimeEntry || 
              (activeTimeEntry.status !== 'running' && activeTimeEntry.status !== 'paused') ||
              !screenshotSettings?.screenshotEnabled) {
            console.warn('[Screenshot] Skipping first screenshot - timer not active or disabled');
            return;
          }
        } catch {
          // Continue if store check fails
        }
        
        if (isCapturingRef.current) {
          try {
            await captureFrameLocal();
          } catch (error) {
            console.error('[Screenshot] Error in first screenshot:', error);
          }
        } else {
          console.warn('[Screenshot] Skipping first screenshot - not capturing anymore');
        }
      }, 2000); // Wait 2 seconds for video to fully stabilize
      
      // Bug 96: Get current interval from store instead of ref to ensure it's always current
      let currentInterval: number;
      try {
        const state = useStore.getState();
        const screenshotSettings = state.screenshotSettings;
        // Convert seconds to milliseconds
        currentInterval = (screenshotSettings?.screenshotInterval || 60) * 1000;
      } catch {
        // Fallback to ref if store check fails
        currentInterval = intervalRef2.current;
      }
      
      console.log('[Screenshot] Setting up interval:', { interval: currentInterval, intervalMs: currentInterval });
      
      // Use currentInterval from store to ensure it's always up-to-date
      // Bug 86: Store interval in both local ref and global singleton
      // Use global singleton's interval function to ensure it continues across component unmounts
      const createInterval = () => {
        return setInterval(async () => {
          // Bug 113: Check if tab is visible - pause capture in background tabs to save resources
          if (typeof document !== 'undefined' && document.hidden) {
            console.log('[Screenshot] Tab is hidden, skipping capture to save resources');
            return;
          }
          
          // Bug 114: Stop capture after too many consecutive failures
          if (globalScreenCapture.consecutiveFailures >= 5) {
            console.error('[Screenshot] Too many consecutive upload failures, stopping capture');
            globalScreenCapture.cleanup();
            return;
          }
          
          console.log('[Screenshot] Interval tick - capturing frame', {
            isCapturing: globalScreenCapture.getIsCapturing(),
            hasVideo: !!globalScreenCapture.getVideo(),
            hasCanvas: !!globalScreenCapture.getCanvas(),
            timeEntryId: globalScreenCapture.getTimeEntryId(),
            consecutiveFailures: globalScreenCapture.consecutiveFailures
          });
          
          // Bug 111: Prevent concurrent uploads in global interval
          // Use a global flag to track if upload is in progress
          // Since multiple components can use this interval, we need global protection
          if (globalScreenCapture.isUploading) {
            console.log('[Screenshot] Upload already in progress (global), skipping capture');
            return;
          }
          
          // Use global resources instead of local refs
          const globalVideo = globalScreenCapture.getVideo();
          const globalCanvas = globalScreenCapture.getCanvas();
          const globalStream = globalScreenCapture.getStream();
          const globalTimeEntryId = globalScreenCapture.getTimeEntryId();
          
          // Verify all required resources are still available
          if (!globalVideo || !globalCanvas || !globalTimeEntryId || !globalStream) {
            console.warn('[Screenshot] Required resources not available, skipping capture');
            return;
          }
          
          // Bug 111: Set global uploading flag
          globalScreenCapture.isUploading = true;
          
          // Bug 99 & 102: Check if user is still logged in and timeEntryId matches active entry
          try {
            const state = useStore.getState();
            
            // Bug 99: Check if user is still logged in
            if (!state.currentUser) {
              console.log('[Screenshot] User logged out, stopping capture');
              globalScreenCapture.cleanup();
              return;
            }
            
            // Bug 94: Check if timeEntryId still matches active entry
            const activeTimeEntry = state.activeTimeEntry;
            if (!activeTimeEntry || activeTimeEntry.id !== globalTimeEntryId) {
              console.log('[Screenshot] TimeEntryId mismatch or no active entry, stopping capture');
              globalScreenCapture.setIsCapturing(false);
              globalScreenCapture.clearInterval();
              globalScreenCapture.setTimeEntryId(null);
              if (globalScreenCapture.getStream()) {
                globalScreenCapture.getStream()!.getTracks().forEach(track => track.stop());
                globalScreenCapture.setStream(null);
              }
              return;
            }
          } catch {
            // Fallback: continue if store check fails
          }
          
          // Check if still capturing using global state
          if (!globalScreenCapture.getIsCapturing() || !globalScreenCapture.hasActiveStream()) {
            console.warn('[Screenshot] Not capturing anymore, clearing interval');
            globalScreenCapture.clearInterval();
            return;
          }
          
          // Check enabled state from global store (not local ref which may be stale)
          try {
            const state = useStore.getState();
            const screenshotSettings = state.screenshotSettings;
            if (!screenshotSettings?.screenshotEnabled) {
              console.log('[Screenshot] Disabled in settings, skipping capture');
              return;
            }
          } catch {
            // Fallback to local ref if store check fails
            if (!enabledRef.current) {
              console.log('[Screenshot] Disabled (fallback check), skipping capture');
              return;
            }
          }
          
          try {
            // Use global video and canvas for capture
            const video = globalVideo;
            const canvas = globalCanvas;
            
            // Bug 105: Check if video element is still in DOM and valid
            if (!video || !video.parentNode) {
              console.warn('[Screenshot] Video element removed from DOM, recreating');
              // Recreate video element if it was removed
              try {
                const newVideo = document.createElement('video');
                newVideo.autoplay = true;
                newVideo.playsInline = true;
                newVideo.style.display = 'none';
                document.body.appendChild(newVideo);
                if (globalStream) {
                  newVideo.srcObject = globalStream;
                  // Bug 108: Handle play() errors when recreating video
                  try {
                    await newVideo.play();
                  } catch (playError) {
                    console.error('[Screenshot] Failed to play recreated video:', playError);
                    // Cleanup failed video
                    if (newVideo.parentNode) {
                      newVideo.remove();
                    }
                    globalStream.getTracks().forEach(track => track.stop());
                    throw playError;
                  }
                }
                globalScreenCapture.setVideo(newVideo);
                // Use new video for this capture attempt
                const updatedVideo = globalScreenCapture.getVideo();
                if (!updatedVideo || !updatedVideo.videoWidth || !updatedVideo.videoHeight) {
                  console.warn('[Screenshot] Recreated video not ready yet');
                  return;
                }
                // Continue with updated video below
              } catch (error) {
                console.error('[Screenshot] Failed to recreate video element:', error);
                // Bug 108: Cleanup on recreation error
                globalScreenCapture.setIsCapturing(false);
                globalScreenCapture.clearInterval();
                globalScreenCapture.setTimeEntryId(null);
                if (globalScreenCapture.getStream()) {
                  globalScreenCapture.getStream()!.getTracks().forEach(track => track.stop());
                  globalScreenCapture.setStream(null);
                }
                return;
              }
            }
            
            const finalVideo = globalScreenCapture.getVideo();
            if (!finalVideo) {
              console.warn('[Screenshot] Video element not available');
              return;
            }
            
            // Check if video has valid dimensions
            if (!finalVideo.videoWidth || !finalVideo.videoHeight) {
              console.warn('[Screenshot] Video not ready yet');
              return;
            }
            
            // Use finalVideo instead of video
            const videoToUse = finalVideo;
            
            // Bug 120 & 121: Get current video dimensions and validate before setting canvas
            const currentVideoWidth = videoToUse.videoWidth;
            const currentVideoHeight = videoToUse.videoHeight;
            
            // Check if video is still valid
            if (!videoToUse || currentVideoWidth === 0 || currentVideoHeight === 0) {
              console.warn('[Screenshot] Video element is invalid or not ready');
              globalScreenCapture.isUploading = false;
              return;
            }
            
            // Bug 116: Check if video element is still in DOM
            if (!videoToUse.parentNode) {
              console.warn('[Screenshot] Video element removed from DOM during capture');
              globalScreenCapture.isUploading = false;
              return;
            }
            
            // Draw video frame to canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.warn('[Screenshot] Failed to get canvas context');
              globalScreenCapture.isUploading = false;
              return;
            }
            
            // Bug 115: Validate canvas context
            try {
              ctx.getImageData(0, 0, 1, 1);
            } catch (ctxError) {
              console.warn('[Screenshot] Canvas context is lost or invalid:', ctxError);
              globalScreenCapture.isUploading = false;
              return;
            }
            
            // Bug 120 & 121: Set canvas dimensions using current video dimensions
            canvas.width = currentVideoWidth;
            canvas.height = currentVideoHeight;
            
            // Bug 119 & 122: Wrap drawImage in try-catch to handle errors
            try {
              // Bug 121: Re-check video dimensions right before drawImage
              if (videoToUse.videoWidth !== currentVideoWidth || videoToUse.videoHeight !== currentVideoHeight) {
                console.warn('[Screenshot] Video dimensions changed during capture, updating canvas');
                canvas.width = videoToUse.videoWidth;
                canvas.height = videoToUse.videoHeight;
              }
              
              // Bug 116: Final check that video is still in DOM
              if (!videoToUse.parentNode) {
                console.warn('[Screenshot] Video element removed from DOM during drawImage');
                globalScreenCapture.isUploading = false;
                return;
              }
              
              ctx.drawImage(videoToUse, 0, 0, canvas.width, canvas.height);
            } catch (drawError) {
              console.error('[Screenshot] Failed to draw video to canvas (global interval):', drawError);
              globalScreenCapture.isUploading = false;
              return;
            }
            
            // Convert to base64 JPEG
            let imageData: string;
            try {
              imageData = canvas.toDataURL('image/jpeg', 0.8);
              if (!imageData || imageData.length === 0) {
                console.warn('[Screenshot] toDataURL returned empty string');
                return;
              }
              
              // Check if imageData is too large
              const maxBase64Length = 50 * 1024 * 1024;
              if (imageData.length > maxBase64Length) {
                imageData = canvas.toDataURL('image/jpeg', 0.5);
                if (imageData.length > maxBase64Length) {
                  console.error('[Screenshot] Image still too large after quality reduction, skipping upload');
                  return;
                }
              }
            } catch (error) {
              console.error('[Screenshot] Failed to convert canvas to data URL:', error);
              return;
            }
            
            // Upload to server
            // Bug 93: Get timeEntryId from global singleton (should always be set)
            const uploadTimeEntryId = globalTimeEntryId;
            
            if (!uploadTimeEntryId) {
              console.warn('[Screenshot] No timeEntryId available for upload, skipping');
              return;
            }
            
            try {
              await api.uploadScreenshot(uploadTimeEntryId, imageData);
              console.log('[Screenshot] Screenshot uploaded successfully');
              // Bug 114: Reset failure counter on success
              globalScreenCapture.consecutiveFailures = 0;
            } catch (error: unknown) {
              const uploadError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
              
              // Bug 114: Increment failure counter
              globalScreenCapture.consecutiveFailures++;
              
              // Bug 117: Only log error details for first few failures to avoid spam
              if (globalScreenCapture.consecutiveFailures <= 3) {
                console.error('[Screenshot] Failed to upload screenshot:', error, `(${globalScreenCapture.consecutiveFailures} consecutive failures)`);
              } else {
                console.warn(`[Screenshot] Upload failed (${globalScreenCapture.consecutiveFailures} consecutive failures)`);
              }
              
              // Bug 103: Handle 401 (Unauthorized) - user logged out, stop capture
              if (uploadError.response?.status === 401 || uploadError.message === 'Unauthorized') {
                console.log('[Screenshot] Unauthorized (401), user logged out, stopping capture');
                globalScreenCapture.isUploading = false;
                globalScreenCapture.consecutiveFailures = 0;
                globalScreenCapture.cleanup();
                return;
              }
              
              // Bug 53: Handle 404 (Time entry not found)
              if (uploadError.response?.status === 404 && uploadError.response?.data?.message?.includes('Time entry')) {
                console.log('[Screenshot] Time entry was deleted, stopping capture');
                globalScreenCapture.isUploading = false;
                globalScreenCapture.consecutiveFailures = 0;
                globalScreenCapture.setIsCapturing(false);
                globalScreenCapture.clearInterval();
                globalScreenCapture.setTimeEntryId(null);
                if (globalScreenCapture.getStream()) {
                  globalScreenCapture.getStream()!.getTracks().forEach(track => track.stop());
                  globalScreenCapture.setStream(null);
                }
                return;
              }
              
              // Bug 103: Handle 403 (Forbidden) - user may have lost permission
              if (uploadError.response?.status === 403) {
                console.log('[Screenshot] Forbidden (403), user may have lost permission, stopping capture');
                globalScreenCapture.isUploading = false;
                globalScreenCapture.consecutiveFailures = 0;
                globalScreenCapture.cleanup();
                return;
              }
            } finally {
              // Bug 111: Always clear global uploading flag
              globalScreenCapture.isUploading = false;
            }
          } catch (error) {
            console.error('[Screenshot] Error in interval captureFrame:', error);
            // Bug 111: Clear uploading flag on error
            globalScreenCapture.isUploading = false;
          }
        }, currentInterval);
      };
      
      intervalRef.current = createInterval();
      globalScreenCapture.setInterval(intervalRef.current);
    } catch (error: unknown) {
      console.error('Screen capture error:', error);
      const captureError = error as { name?: string; message?: string };
      
      // Cleanup timeouts and intervals on error
      if (firstScreenshotTimeoutRef.current) {
        clearTimeout(firstScreenshotTimeoutRef.current);
        firstScreenshotTimeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setHasPermission(false);
      setIsCapturing(false);
      isCapturingRef.current = false;
      
      // Use toastRef to avoid stale closure
      try {
        if (captureError.name === 'NotAllowedError' || captureError.name === 'PermissionDeniedError') {
          toastRef.current({
            title: 'Permission Denied',
            description: 'Screen capture permission was denied. Please allow access to enable screenshots.',
            variant: 'destructive',
          });
        } else if (captureError.name === 'NotReadableError') {
          toastRef.current({
            title: 'Screen Capture Error',
            description: 'Unable to access screen. Please check your browser settings.',
            variant: 'destructive',
          });
        } else {
          toastRef.current({
            title: 'Error',
            description: 'Failed to start screen capture: ' + (captureError.message || 'Unknown error'),
            variant: 'destructive',
          });
        }
      } catch (toastError) {
        console.error('[Screenshot] Failed to show toast:', toastError);
      }
    }
  }, [timeEntryId]);

  // Capture a single frame - use refs to avoid stale closures
  const captureFrame = useCallback(async () => {
    // Bug 111: Prevent concurrent captureFrame executions
    if (isUploadingRef.current) {
      console.log('[Screenshot] Upload already in progress, skipping capture');
      return;
    }
    
    const currentTimeEntryId = timeEntryIdRef.current;
    // Check enabled state before capturing
    if (!enabledRef.current) {
      console.log('[Screenshot] Cannot capture frame - enabled is false');
      return;
    }
    if (!videoRef.current || !canvasRef.current || !currentTimeEntryId || !isCapturingRef.current) {
      console.log('[Screenshot] Cannot capture frame:', {
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
        timeEntryId: currentTimeEntryId,
        isCapturing: isCapturingRef.current,
        enabled: enabledRef.current
      });
      return;
    }
    
    // Bug 111: Set uploading flag
    isUploadingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Check if video has valid dimensions (bug74 - check for very small images)
      if (!video.videoWidth || !video.videoHeight) {
        console.warn('[Screenshot] Video not ready yet:', { 
          videoWidth: video.videoWidth, 
          videoHeight: video.videoHeight 
        });
        return;
      }
      
      // Check if image is too small (bug74 - minimum reasonable size)
      const MIN_WIDTH = 10;
      const MIN_HEIGHT = 10;
      if (video.videoWidth < MIN_WIDTH || video.videoHeight < MIN_HEIGHT) {
        console.warn('[Screenshot] Image too small:', { 
          width: video.videoWidth, 
          height: video.videoHeight,
          minWidth: MIN_WIDTH,
          minHeight: MIN_HEIGHT
        });
        return;
      }

      // Bug 116: Check if video element is still in DOM before any operations
      if (!video.parentNode) {
        console.warn('[Screenshot] Video element removed from DOM during capture');
        isUploadingRef.current = false;
        return;
      }
      
      // Bug 120 & 121: Get current video dimensions and validate before setting canvas
      const currentVideoWidth = video.videoWidth;
      const currentVideoHeight = video.videoHeight;
      
      // Check if video element is still valid (bug61)
      if (!video || currentVideoWidth === 0 || currentVideoHeight === 0) {
        console.warn('[Screenshot] Video element is invalid or not ready');
        isUploadingRef.current = false;
        return;
      }
      
      // Draw video frame to canvas (bug62 - check canvas and context)
      if (!canvas || !canvas.getContext) {
        console.warn('[Screenshot] Canvas element is invalid or removed');
        isUploadingRef.current = false;
        return;
      }
      
      const ctx = canvas.getContext('2d');
      // Bug 115: Check if context is valid and not lost
      if (!ctx) {
        console.warn('[Screenshot] Failed to get canvas context');
        isUploadingRef.current = false;
        return;
      }
      
      // Bug 115: Try to access context properties to verify it's not lost
      try {
        // Quick validation - try to get image data (this will fail if context is lost)
        ctx.getImageData(0, 0, 1, 1);
      } catch (ctxError) {
        console.warn('[Screenshot] Canvas context is lost or invalid:', ctxError);
        isUploadingRef.current = false;
        return;
      }

      // Bug 120 & 121: Set canvas dimensions using current video dimensions (prevents race condition)
      canvas.width = currentVideoWidth;
      canvas.height = currentVideoHeight;
      
      console.log('[Screenshot] Capturing frame:', { 
        timeEntryId: currentTimeEntryId,
        dimensions: { width: canvas.width, height: canvas.height }
      });

      // Bug 119: Wrap drawImage in try-catch to handle DOM removal or video errors
      try {
        // Bug 121: Re-check video dimensions right before drawImage to ensure consistency
        if (video.videoWidth !== currentVideoWidth || video.videoHeight !== currentVideoHeight) {
          console.warn('[Screenshot] Video dimensions changed during capture, updating canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Bug 116: Final check that video is still in DOM
        if (!video.parentNode) {
          console.warn('[Screenshot] Video element removed from DOM during drawImage');
          isUploadingRef.current = false;
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (drawError) {
        console.error('[Screenshot] Failed to draw video to canvas:', drawError);
        isUploadingRef.current = false;
        return;
      }

      // Convert to base64 JPEG (quality 0.8) (bug63 - check for errors and size)
      let imageData: string;
      try {
        imageData = canvas.toDataURL('image/jpeg', 0.8);
        if (!imageData || imageData.length === 0) {
          console.warn('[Screenshot] toDataURL returned empty string');
          return;
        }
        // Check if imageData is too large (bug63 - backend limit is 50MB)
        // Base64 is ~33% larger than binary, so 50MB base64 ≈ 37MB binary
        const maxBase64Length = 50 * 1024 * 1024; // 50MB in characters
        if (imageData.length > maxBase64Length) {
          console.error('[Screenshot] Image data too large:', imageData.length, 'bytes, max:', maxBase64Length);
          // Try with lower quality
          imageData = canvas.toDataURL('image/jpeg', 0.5);
          if (imageData.length > maxBase64Length) {
            console.error('[Screenshot] Image still too large after quality reduction, skipping upload');
            return;
          }
        }
      } catch (error) {
        console.error('[Screenshot] Failed to convert canvas to data URL:', error);
        isUploadingRef.current = false;
        return;
      }

      // Call callback if provided (use ref to avoid stale closure)
      if (onCaptureRef.current) {
        try {
          onCaptureRef.current(imageData);
        } catch (error) {
          console.error('[Screenshot] Error in onCapture callback:', error);
        }
      }

      // Upload to server - check if enabled and stream is active (bug51, bug84)
      // Note: Don't check isMountedRef here - capture should continue even when component unmounts
      if (!enabledRef.current) {
        console.log('[Screenshot] Disabled, skipping upload');
        return;
      }
      
      // Check if stream is still active (bug51)
      if (!streamRef.current || streamRef.current.getTracks().length === 0) {
        console.log('[Screenshot] Stream not active, skipping upload');
        return;
      }
      
      // Check if stream tracks are still active
      const activeTracks = streamRef.current.getTracks().filter(track => track.readyState === 'live');
      if (activeTracks.length === 0) {
        console.log('[Screenshot] No active tracks in stream, skipping upload');
        return;
      }
      
      try {
        console.log('[Screenshot] Uploading screenshot:', { 
          timeEntryId: currentTimeEntryId, 
          imageSize: imageData.length 
        });
        await api.uploadScreenshot(currentTimeEntryId, imageData);
        
        // Bug 114: Reset failure counter on success
        globalScreenCapture.consecutiveFailures = 0;
        
        // Check again after async operation (bug51, bug53, bug84)
        // Note: Don't check isMountedRef - capture continues even when component unmounts
        if (!enabledRef.current) {
          console.log('[Screenshot] Disabled during upload');
          isUploadingRef.current = false;
          return;
        }
        
        // Check stream again after upload (bug51)
        if (!streamRef.current || streamRef.current.getTracks().length === 0) {
          console.log('[Screenshot] Stream became inactive during upload');
          isUploadingRef.current = false;
          return;
        }
        
        console.log('[Screenshot] Screenshot uploaded successfully');
      } catch (error: unknown) {
        const uploadError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
        
        // Bug 114: Increment failure counter
        globalScreenCapture.consecutiveFailures++;
        
        // Bug 117: Only log error details for first few failures to avoid spam
        if (globalScreenCapture.consecutiveFailures <= 3) {
          console.error('[Screenshot] Failed to upload screenshot:', error, `(${globalScreenCapture.consecutiveFailures} consecutive failures)`);
        } else {
          console.warn(`[Screenshot] Upload failed (${globalScreenCapture.consecutiveFailures} consecutive failures)`);
        }
        
        // Bug 114: Stop after too many consecutive failures
        if (globalScreenCapture.consecutiveFailures >= 5) {
          console.error('[Screenshot] Too many consecutive upload failures, stopping capture');
          isUploadingRef.current = false;
          stopCaptureRef.current();
          return;
        }
        
        // Bug 103: Handle 401 (Unauthorized) - user logged out, stop capture
        if (uploadError.response?.status === 401 || uploadError.message === 'Unauthorized') {
          console.log('[Screenshot] Unauthorized (401), user logged out, stopping capture');
          isUploadingRef.current = false;
          globalScreenCapture.consecutiveFailures = 0;
          stopCaptureRef.current();
          return;
        }
        
        // Bug 53: Handle 404 (Time entry not found)
        if (uploadError.response?.status === 404 && uploadError.response?.data?.message?.includes('Time entry')) {
          console.log('[Screenshot] Time entry was deleted, stopping capture');
          isUploadingRef.current = false;
          globalScreenCapture.consecutiveFailures = 0;
          stopCaptureRef.current();
          return;
        }
        
        // Bug 103: Handle 403 (Forbidden)
        if (uploadError.response?.status === 403) {
          console.log('[Screenshot] Forbidden (403), user may have lost permission, stopping capture');
          isUploadingRef.current = false;
          globalScreenCapture.consecutiveFailures = 0;
          stopCaptureRef.current();
          return;
        }
        
        // Don't show toast on every failed upload to avoid spam
        // Note: Don't check isMountedRef - capture continues even when component unmounts (bug84)
      } finally {
        // Bug 111: Always clear uploading flag
        isUploadingRef.current = false;
      }
    } catch (error) {
      console.error('Error capturing frame:', error);
      // Bug 111: Clear uploading flag on error
      isUploadingRef.current = false;
    }
  }, []); // Remove all deps - use refs instead

  // Update captureFrame ref when it changes
  useEffect(() => {
    captureFrameRef.current = captureFrame;
  }, [captureFrame]);

  // Stop screen capture
  const stopCapture = useCallback(() => {
    console.log('[Screenshot] Stopping capture');
    
    // Bug 112: Clear uploading flag when stopping
    isUploadingRef.current = false;
    globalScreenCapture.isUploading = false;
    
    // Clear first screenshot timeout
    if (firstScreenshotTimeoutRef.current) {
      clearTimeout(firstScreenshotTimeoutRef.current);
      firstScreenshotTimeoutRef.current = null;
    }
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Bug 86: Clear global interval
    globalScreenCapture.clearInterval();
    
    // Update ref immediately
    isCapturingRef.current = false;
    
    // Bug 86: Update global singleton
    globalScreenCapture.setIsCapturing(false);
    globalScreenCapture.setTimeEntryId(null); // Bug 94: Clear timeEntryId

    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      // Remove ended event listener before stopping tracks
      if (videoTracks.length > 0 && endedHandlerRef.current) {
        videoTracks[0].removeEventListener('ended', endedHandlerRef.current);
        endedHandlerRef.current = null;
      }
      
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      // Bug 86: Update global singleton
      globalScreenCapture.setStream(null);
    }

    if (videoRef.current) {
      // Stop all tracks before clearing srcObject
      const stream = videoRef.current.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
    }

    setIsCapturing(false);
  }, []);

  // Store functions in refs to avoid stale closures in useEffect
  const startCaptureRef = useRef(startCapture);
  const stopCaptureRef = useRef(stopCapture);
  
  useEffect(() => {
    startCaptureRef.current = startCapture;
    stopCaptureRef.current = stopCapture;
  }, [startCapture, stopCapture]);

  // Update interval when it changes during active capture (must be after stopCapture declaration)
  useEffect(() => {
    const oldInterval = intervalRef2.current;
    
    // Only log if interval actually changed (not on initial mount)
    if (oldInterval !== null && oldInterval !== interval) {
      console.log('[Screenshot] Interval changed:', { 
        oldInterval, 
        newInterval: interval, 
        oldIntervalMs: oldInterval,
        newIntervalMs: interval 
      });
    }
    
    // Update ref immediately
    intervalRef2.current = interval;
    
    // If currently capturing, update the interval immediately
    // Use isCapturingRef instead of isCapturing state to avoid race conditions
    if (isCapturingRef.current && intervalRef.current && oldInterval !== interval && captureFrameRef.current) {
      console.log('[Screenshot] Immediately updating active interval from', oldInterval, 'to', interval, 'ms');
      
      // Check if enabled is still true before updating interval
      if (!enabledRef.current) {
        console.log('[Screenshot] Enabled is false, stopping capture instead of updating interval');
        stopCaptureRef.current();
        return;
      }
      
      clearInterval(intervalRef.current);
      // Bug 91: Also clear global interval before creating new one
      globalScreenCapture.clearInterval();
      
      const newInterval = setInterval(async () => {
        console.log('[Screenshot] Interval tick (updated) - capturing frame');
        
        // Bug 99 & 102: Check if user is still logged in
        try {
          const state = useStore.getState();
          if (!state.currentUser) {
            console.log('[Screenshot] User logged out, clearing updated interval');
            globalScreenCapture.cleanup();
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }
        } catch {
          // Continue if store check fails
        }
        
        // Bug 101: Update global timeEntryId if it changed
        try {
          const state = useStore.getState();
          const activeTimeEntry = state.activeTimeEntry;
          const currentTimeEntryId = activeTimeEntry?.id || null;
          if (currentTimeEntryId && currentTimeEntryId !== globalScreenCapture.getTimeEntryId()) {
            console.log('[Screenshot] TimeEntryId changed, updating global singleton:', {
              old: globalScreenCapture.getTimeEntryId(),
              new: currentTimeEntryId
            });
            globalScreenCapture.setTimeEntryId(currentTimeEntryId);
          }
        } catch {
          // Continue if store check fails
        }
        
        // Check if still capturing and enabled using global state
        if (!globalScreenCapture.getIsCapturing() || !globalScreenCapture.hasActiveStream()) {
          console.warn('[Screenshot] Not capturing anymore, clearing updated interval');
          globalScreenCapture.clearInterval();
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        
        // Check enabled from store
        try {
          const state = useStore.getState();
          if (!state.screenshotSettings?.screenshotEnabled) {
            console.log('[Screenshot] Disabled in settings, clearing interval');
            globalScreenCapture.clearInterval();
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }
        } catch {
          // Fallback to local ref
          if (!enabledRef.current) {
            console.log('[Screenshot] Disabled (fallback), clearing interval');
            globalScreenCapture.clearInterval();
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }
        }
        
        if (captureFrameRef.current) {
          try {
            await captureFrameRef.current();
          } catch (error) {
            console.error('[Screenshot] Error in updated interval captureFrame:', error);
          }
        }
      }, interval);
      
      intervalRef.current = newInterval;
      // Bug 91: Update global interval
      globalScreenCapture.setInterval(newInterval);
    }
  }, [interval, captureFrame]);

  // Track previous timeEntryId to detect changes
  const prevTimeEntryIdRef = useRef<string | null>(timeEntryId);
  const isInitialMountRef = useRef(true);
  
  // Auto-stop when disabled or timeEntryId changes
  // NOTE: We don't auto-start here because getDisplayMedia must be called from a user gesture handler
  // Start should be called explicitly from a button click handler
  useEffect(() => {
    // Skip on initial mount to avoid stopping capture immediately after start
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevTimeEntryIdRef.current = timeEntryId;
      return;
    }
    
    const timeEntryIdChanged = prevTimeEntryIdRef.current !== timeEntryId;
    const prevTimeEntryId = prevTimeEntryIdRef.current;
    prevTimeEntryIdRef.current = timeEntryId;
    
    // Use ref instead of state to check if capturing - state may be stale
    // Only stop if actually capturing AND conditions require stopping
    const currentEnabled = enabledRef.current;
    if (isCapturingRef.current && ((!currentEnabled || !timeEntryId) || timeEntryIdChanged)) {
      console.log('[Screenshot] Stopping capture due to:', {
        enabled: currentEnabled,
        timeEntryId: !!timeEntryId,
        timeEntryIdChanged,
        oldTimeEntryId: prevTimeEntryId,
        newTimeEntryId: timeEntryId,
        isCapturingFromState: isCapturing,
        isCapturingFromRef: isCapturingRef.current
      });
      stopCaptureRef.current();
    }
    
    // Reset permission state when timeEntryId changes (new timer session)
    if (timeEntryId && hasPermission === false) {
      // Keep permission state, but don't auto-resume - user needs to click resume button
      console.log('[Screenshot] Permission was revoked, waiting for user to resume');
    }
  }, [enabled, timeEntryId, isCapturing, hasPermission, stopCapture]);

      // Cleanup on unmount only (single cleanup to prevent double cleanup)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false; // Mark as unmounted
      
      // Check if timer is still active using global store (not local props which may be stale)
      // Screenshots should continue even when user navigates to another page/app
      try {
        const state = useStore.getState();
        const activeTimeEntry = state.activeTimeEntry;
        const screenshotSettings = state.screenshotSettings;
        
        const isTimerActive = activeTimeEntry && 
                             (activeTimeEntry.status === 'running' || activeTimeEntry.status === 'paused') &&
                             activeTimeEntry.id &&
                             screenshotSettings?.screenshotEnabled;
        
        // Check global singleton for active capture
        const isGlobalCaptureActive = globalScreenCapture.getIsCapturing() && 
                                      globalScreenCapture.hasActiveStream();
        
        if (isTimerActive && isGlobalCaptureActive) {
          // Timer still active - DO NOT stop capture or cleanup resources (bug84)
          // Capture will continue working even when component is unmounted
          // This allows screenshots to continue when user switches pages/apps
          // This is normal behavior during navigation - no need to log every time
          // Don't clear intervals, stop stream, or remove video/canvas - let capture continue
          // Global resources (globalScreenCapture) remain active
          // Only clear local refs, not global resources
          intervalRef.current = null; // Clear local ref, but global interval continues
          return; // Exit early - don't stop capture
        }
      } catch (error) {
        console.error('[Screenshot] Error checking store state in cleanup:', error);
        // Fallback: use local props if store check fails
        const currentTimeEntryId = timeEntryId;
        const currentEnabled = enabled;
        if (isCapturingRef.current && currentEnabled && currentTimeEntryId) {
          // Timer still active - this is normal during navigation
          intervalRef.current = null; // Clear local ref only
          return;
        }
      }
      
      // Timer stopped or disabled - full cleanup
      // Only cleanup if this is the last component using global resources
      if (firstScreenshotTimeoutRef.current) {
        clearTimeout(firstScreenshotTimeoutRef.current);
        firstScreenshotTimeoutRef.current = null;
      }
      if (checkReadyTimeoutRef.current) {
        clearTimeout(checkReadyTimeoutRef.current);
        checkReadyTimeoutRef.current = null;
      }
      
      // Only clear local interval ref, not global interval
      if (intervalRef.current) {
        // Don't clearInterval here - let global interval continue
        // Just clear local ref
        intervalRef.current = null;
      }
      
      // Only stop capture if global capture is not active
      // This prevents stopping when another component instance is using it
      if (!globalScreenCapture.getIsCapturing() || !globalScreenCapture.hasActiveStream()) {
        stopCaptureRef.current();
      } else {
        console.log('[Screenshot] Not stopping capture - global capture still active');
      }
    };
  }, [enabled, timeEntryId]); // Bug 90: Include deps to use current values in cleanup

  return {
    isCapturing,
    hasPermission,
    startCapture,
    stopCapture,
    captureFrame,
  };
}

