import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  return {
    toast: ({ title, description, variant }: ToastOptions) => {
      try {
        // Validate inputs
        const safeTitle = title && typeof title === 'string' ? title : (variant === 'destructive' ? 'Error' : 'Success');
        const safeDescription = description && typeof description === 'string' ? description : undefined;
        const safeVariant = variant === 'destructive' ? 'destructive' : 'default';
        
        if (safeVariant === 'destructive') {
          sonnerToast.error(safeTitle, {
            description: safeDescription,
          });
        } else {
          sonnerToast.success(safeTitle, {
            description: safeDescription,
          });
        }
      } catch (error) {
        // Fallback to console if toast fails
        console.error('useToast: Error showing toast', error);
        console.log('Toast:', { title, description, variant });
      }
    },
  };
}

