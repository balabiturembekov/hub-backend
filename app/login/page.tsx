'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Clock, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, currentUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Check if user is already logged in
  useEffect(() => {
    // Check token in localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      // If token exists, check if user is in store or storage
      const userFromStore = useStore.getState().currentUser;
      const userFromStorage = api.getCurrentUserFromStorage();
      if (userFromStore || userFromStorage) {
        // User is already logged in, redirect to dashboard
        router.push('/dashboard');
      }
    }
  }, [router]);

  // Clear error from store when component mounts
  useEffect(() => {
    useStore.setState({ error: null });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isLoading) {
      return;
    }
    
    setLocalError('');
    
    // Client-side validation
    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }
    
    try {
      await login(email.trim(), password);
      // Clear any errors before redirect
      setLocalError('');
      useStore.setState({ error: null });
      // Use router.push for client-side navigation (faster than window.location)
      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      // Clear local error first, then set new one
      setLocalError('');
      const error = err as { isNetworkError?: boolean; response?: { data?: { message?: string } }; message?: string };
      if (error.isNetworkError) {
        setLocalError('Network error: Could not connect to server. Please check if the backend is running on http://localhost:3001');
      } else {
        setLocalError(error.response?.data?.message || error.message || 'Login failed');
      }
    }
  };

  // Don't render if user is already logged in (will redirect)
  if (currentUser) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-primary/5 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hubnity</h1>
          <p className="text-muted-foreground">Time Tracking & Team Management</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl">Welcome back</CardTitle>
            </div>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {(error || localError) && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error || localError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full gap-2" 
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Log in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              
              <div className="text-center text-sm text-muted-foreground pt-2">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Create one
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Hubnity. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
