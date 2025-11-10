'use client';

import { useEffect, useRef } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  
  // Update ref when shortcuts change
  useEffect(() => {
    // Validate shortcuts is an array
    if (!shortcuts || !Array.isArray(shortcuts)) {
      console.warn('useKeyboardShortcuts: shortcuts must be an array', shortcuts);
      shortcutsRef.current = [];
      return;
    }
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      try {
        // Validate shortcuts array
        if (!shortcutsRef.current || !Array.isArray(shortcutsRef.current)) {
          return;
        }
        
        // Don't trigger shortcuts when user is typing in input/textarea
        const target = event.target as HTMLElement;
        if (!target) {
          return;
        }
        
        const buttonTarget = target as HTMLButtonElement;
        
        // Check if target is inside a dialog/modal
        const isInDialog = target.closest('[role="dialog"]') || 
                          target.closest('[data-radix-portal]') ||
                          target.closest('[data-state]'); // Radix UI dialogs
        
        if (isInDialog) {
          // Only allow Escape in dialogs, block all other shortcuts
          if (event.key !== 'Escape') {
            return;
          }
        }
        
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target.tagName === 'BUTTON' && buttonTarget.type === 'submit') ||
          target.closest('[role="combobox"]') || // Select/Dropdown
          target.closest('[role="listbox"]') || // Select options
          target.closest('[data-radix-select-trigger]') || // Radix Select
          target.closest('[data-radix-select-content]') // Radix Select content
        ) {
          // Allow Space in buttons and Escape anywhere
          if (event.key !== 'Escape' && event.key !== ' ') {
            return;
          }
          // Don't trigger Space shortcut if user is in an input
          if (event.key === ' ' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            return;
          }
        }

        // Use ref to get latest shortcuts
        for (const shortcut of shortcutsRef.current) {
          // Validate shortcut structure
          if (!shortcut || typeof shortcut !== 'object') {
            continue;
          }
          
          if (shortcut.enabled === false) continue;
          
          // Validate shortcut.key
          if (!shortcut.key || typeof shortcut.key !== 'string') {
            console.warn('useKeyboardShortcuts: Invalid shortcut key', shortcut);
            continue;
          }
          
          // Validate shortcut.action
          if (typeof shortcut.action !== 'function') {
            console.warn('useKeyboardShortcuts: Invalid shortcut action', shortcut);
            continue;
          }

          const keyMatch = 
            event.key === shortcut.key ||
            event.code === `Key${shortcut.key.toUpperCase()}` ||
            event.key.toLowerCase() === shortcut.key.toLowerCase();

          const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
          const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
          const shiftMatch = shortcut.shiftKey === undefined ? true : shortcut.shiftKey === event.shiftKey;
          const altMatch = shortcut.altKey === undefined ? true : shortcut.altKey === event.altKey;

          if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
            event.preventDefault();
            try {
              shortcut.action();
            } catch (error) {
              console.error('useKeyboardShortcuts: Error executing shortcut action', error);
            }
            break;
          }
        }
      } catch (error) {
        console.error('useKeyboardShortcuts: Error in handleKeyDown', error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - shortcuts accessed via ref
}

