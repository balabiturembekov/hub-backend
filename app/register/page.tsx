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
import { 
  Clock, 
  User, 
  Mail, 
  Lock, 
  Building2, 
  Globe, 
  UserPlus, 
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, currentUser } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
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
    setLocalError('');
    
    // Prevent double submission
    if (isLoading) {
      return;
    }
    
    // Trim all inputs
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCompanyName = companyName.trim();
    const trimmedCompanyDomain = companyDomain.trim();
    
    // Client-side validation
    if (!trimmedName) {
      setLocalError('Name is required');
      return;
    }

    if (!trimmedEmail) {
      setLocalError('Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address');
      return;
    }
    
    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }
    
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    
    if (!trimmedCompanyName) {
      setLocalError('Company name is required');
      return;
    }
    
    // Validate domain format if provided
    if (trimmedCompanyDomain) {
      // Basic domain validation: should not contain spaces, should have at least one dot
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(trimmedCompanyDomain)) {
        setLocalError('Please enter a valid domain (e.g., example.com)');
        return;
      }
    }
    
    try {
      await register(
        trimmedName,
        trimmedEmail,
        password,
        trimmedCompanyName,
        trimmedCompanyDomain || undefined
      );
      // Clear any errors before redirect
      setLocalError('');
      useStore.setState({ error: null });
      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const error = err as { 
        isNetworkError?: boolean; 
        apiUrl?: string;
        response?: { data?: { message?: string } }; 
        message?: string;
      };
      if (error.isNetworkError) {
        const apiUrl = error.apiUrl || 'http://localhost:3001/api';
        setLocalError(
          error.message || 
          `Cannot connect to backend server at ${apiUrl}. Please check if the backend is running.`
        );
      } else {
        setLocalError(error.response?.data?.message || error.message || 'Registration failed');
      }
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '' };
    if (password.length < 6) return { strength: 1, label: 'Weak', color: 'bg-red-500' };
    if (password.length < 10) return { strength: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { strength: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength();
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  // Don't render if user is already logged in (will redirect)
  if (currentUser) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-primary/5 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Get started</h1>
          <p className="text-muted-foreground">Create your account to start tracking time</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl">Create account</CardTitle>
            </div>
            <CardDescription>Fill in your details to create a new account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {(error || localError) && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error || localError}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">Company name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="My Company Inc."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyDomain" className="text-sm font-medium">
                    Company domain
                    <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="companyDomain"
                      type="text"
                      placeholder="mycompany.com"
                      value={companyDomain}
                      onChange={(e) => setCompanyDomain(e.target.value)}
                      disabled={isLoading}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional: Your company domain for branding
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-9"
                      minLength={6}
                    />
                  </div>
                  {password && (
                    <div className="space-y-1">
                      <div className="flex gap-1 h-1.5">
                        <div className={`flex-1 rounded-full ${passwordStrength.strength >= 1 ? passwordStrength.color : 'bg-gray-200'}`} />
                        <div className={`flex-1 rounded-full ${passwordStrength.strength >= 2 ? passwordStrength.color : 'bg-gray-200'}`} />
                        <div className={`flex-1 rounded-full ${passwordStrength.strength >= 3 ? passwordStrength.color : 'bg-gray-200'}`} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {passwordStrength.label && `Password strength: ${passwordStrength.label}`}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-9"
                      minLength={6}
                    />
                  </div>
                  {confirmPassword && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {passwordsMatch ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Passwords must match</span>
                      )}
                    </div>
                  )}
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
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              
              <div className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
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
