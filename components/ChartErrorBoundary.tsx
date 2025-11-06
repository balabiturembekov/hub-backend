'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
  chartName?: string;
}

export function ChartErrorBoundary({ children, chartName = 'Chart' }: ChartErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>{chartName} Error</CardTitle>
            </div>
            <CardDescription>
              Failed to load {chartName.toLowerCase()}. Please refresh the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The chart encountered an error while rendering data.
            </p>
          </CardContent>
        </Card>
      }
      onError={(error, errorInfo) => {
        console.error(`${chartName} error:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

