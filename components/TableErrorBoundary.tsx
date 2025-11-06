'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface TableErrorBoundaryProps {
  children: React.ReactNode;
  tableName?: string;
}

export function TableErrorBoundary({ children, tableName = 'Table' }: TableErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>{tableName} Error</CardTitle>
            </div>
            <CardDescription>
              Failed to load {tableName.toLowerCase()}. Please refresh the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The table encountered an error while loading data.
            </p>
          </CardContent>
        </Card>
      }
      onError={(error, errorInfo) => {
        console.error(`${tableName} error:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

