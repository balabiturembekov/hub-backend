'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Screenshot } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ScreenshotGalleryProps {
  timeEntryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenshotGallery({ timeEntryId, open, onOpenChange }: ScreenshotGalleryProps) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  // Use ref for toast to avoid unnecessary re-renders
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Store timeEntryId in ref to use latest value
  const timeEntryIdRef = useRef(timeEntryId);
  useEffect(() => {
    timeEntryIdRef.current = timeEntryId;
  }, [timeEntryId]);

  // Track if component is mounted to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadScreenshots = useCallback(async () => {
    const currentTimeEntryId = timeEntryIdRef.current;
    if (!currentTimeEntryId || currentTimeEntryId.trim() === '') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.getScreenshotsByTimeEntry(currentTimeEntryId);
      setScreenshots(data);
    } catch (error: any) {
      console.error('Failed to load screenshots:', error);
      toastRef.current({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to load screenshots',
        variant: 'destructive',
      });
      setScreenshots([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps - use ref for timeEntryId

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (open && timeEntryId && timeEntryId.trim() !== '') {
      loadScreenshots();
    } else if (open && (!timeEntryId || timeEntryId.trim() === '')) {
      setIsLoading(false);
      setScreenshots([]);
      if (toastRef.current) {
        toastRef.current({
          title: 'Error',
          description: 'Invalid time entry ID',
          variant: 'destructive',
        });
      }
    } else if (!open) {
      // Clear screenshots and selected image when dialog closes
      setScreenshots([]);
      setSelectedImage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, timeEntryId]); // loadScreenshots is stable with empty deps and uses ref

  const handleDeleteClick = (screenshotId: string) => {
    setShowDeleteConfirm(screenshotId);
  };

  const handleDeleteConfirm = async () => {
    const screenshotId = showDeleteConfirm;
    if (!screenshotId) return;

    setIsDeleting(screenshotId);
    setShowDeleteConfirm(null);
    
    try {
      await api.deleteScreenshot(screenshotId);
      // Use functional update to avoid stale closure
      setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId));
      toastRef.current({
        title: 'Success',
        description: 'Screenshot deleted successfully',
      });
    } catch (error: any) {
      toastRef.current({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to delete screenshot',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDownload = (screenshot: Screenshot) => {
    if (typeof window === 'undefined') return;
    
    try {
      const link = document.createElement('a');
      link.href = screenshot.imageUrl;
      link.download = `screenshot-${screenshot.id}.jpg`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer'; // Security best practice
      
      // Use requestIdleCallback if available for better performance
      if (document.body) {
        document.body.appendChild(link);
        link.click();
        
        // Clean up after a delay to ensure click event fires
        setTimeout(() => {
          if (link.parentNode) {
            document.body.removeChild(link);
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to download screenshot:', error);
      toastRef.current({
        title: 'Download Error',
        description: 'Failed to download screenshot. You can try right-clicking and saving the image.',
        variant: 'destructive',
      });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Screenshots</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : screenshots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No screenshots for this time entry</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {screenshots.map((screenshot) => (
              <div
                key={screenshot.id}
                className="relative group cursor-pointer border rounded-lg overflow-hidden"
                onClick={() => setSelectedImage(screenshot.imageUrl)}
              >
                <div className="aspect-video relative bg-muted">
                  <img
                    src={screenshot.thumbnailUrl || screenshot.imageUrl}
                    alt={`Screenshot ${screenshot.timestamp ? new Date(screenshot.timestamp).toISOString() : 'Screenshot'}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(screenshot);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(screenshot.id);
                      }}
                      disabled={isDeleting === screenshot.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-2 text-xs text-muted-foreground">
                  {isMounted 
                    ? new Date(screenshot.timestamp).toLocaleString() 
                    : new Date(screenshot.timestamp).toISOString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full-size image viewer - use portal to avoid hydration issues */}
        {selectedImage && isMounted && open && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={selectedImage}
                alt="Screenshot full size"
                className="w-full h-auto max-h-[90vh] object-contain rounded"
              />
            </div>
          </div>
        )}
      </DialogContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this screenshot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
