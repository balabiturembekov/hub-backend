'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  Users,
  BarChart3,
  Shield,
  Zap,
  CheckCircle2,
  Camera,
  TrendingUp,
  Globe,
  ArrowRight,
  Play,
  FileText,
  Settings,
  Bell,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      const user = api.getCurrentUserFromStorage();
      if (user) {
        router.push('/dashboard');
      }
    }
  }, [router]);

  const features = [
    {
      icon: Clock,
      title: 'Precise Time Tracking',
      description: 'Track every minute with our intuitive timer. Start, pause, and resume with keyboard shortcuts for maximum efficiency.',
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Manage your entire team from one dashboard. Assign projects, set hourly rates, and monitor productivity in real-time.',
      color: 'bg-green-500/10 text-green-600',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Get detailed insights with beautiful charts and reports. Export data to CSV for further analysis.',
      color: 'bg-purple-500/10 text-purple-600',
    },
    {
      icon: Camera,
      title: 'Automatic Screenshots',
      description: 'Optional automatic screenshot capture to track work activity. Fully configurable intervals and privacy controls.',
      color: 'bg-orange-500/10 text-orange-600',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Your data is protected with JWT authentication, encrypted storage, and role-based access control.',
      color: 'bg-red-500/10 text-red-600',
    },
    {
      icon: Zap,
      title: 'Real-time Sync',
      description: 'Live updates across all devices. See team activity as it happens with WebSocket and SSE technology.',
      color: 'bg-yellow-500/10 text-yellow-600',
    },
    {
      icon: FileText,
      title: 'Project Organization',
      description: 'Organize work by projects with budgets, clients, and status tracking. Keep everything in one place.',
      color: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      icon: TrendingUp,
      title: 'Performance Insights',
      description: 'Track productivity trends, identify bottlenecks, and make data-driven decisions with comprehensive reports.',
      color: 'bg-pink-500/10 text-pink-600',
    },
    {
      icon: Globe,
      title: 'Multi-tenant Architecture',
      description: 'Perfect for agencies and companies. Each organization has isolated data with custom settings.',
      color: 'bg-cyan-500/10 text-cyan-600',
    },
  ];

  const benefits = [
    {
      icon: CheckCircle2,
      title: 'Increase Productivity',
      description: 'See exactly where time is spent and optimize workflows',
    },
    {
      icon: CheckCircle2,
      title: 'Accurate Billing',
      description: 'Generate precise invoices based on tracked hours',
    },
    {
      icon: CheckCircle2,
      title: 'Better Planning',
      description: 'Use historical data to estimate project timelines',
    },
    {
      icon: CheckCircle2,
      title: 'Team Transparency',
      description: 'Everyone knows what everyone is working on',
    },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime' },
    { value: '10K+', label: 'Active Users' },
    { value: '1M+', label: 'Hours Tracked' },
    { value: '24/7', label: 'Support' },
  ];

  const howItWorks = [
    {
      step: '1',
      title: 'Sign Up',
      description: 'Create your account and set up your company in minutes',
      icon: Settings,
    },
    {
      step: '2',
      title: 'Invite Team',
      description: 'Add team members and assign them to projects',
      icon: Users,
    },
    {
      step: '3',
      title: 'Start Tracking',
      description: 'Begin tracking time with our simple, intuitive interface',
      icon: Play,
    },
    {
      step: '4',
      title: 'Analyze & Improve',
      description: 'Review reports and insights to optimize your workflow',
      icon: BarChart3,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gray-900">Hubnity</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-50 py-20 sm:py-32">
        <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm shadow-sm">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-700">New: Real-time team activity tracking</span>
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              Time Tracking That
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {' '}
                Works for You
              </span>
            </h1>
            <p className="mb-8 text-xl text-gray-600 sm:text-2xl">
              The all-in-one solution for teams who want to track time, manage projects, and boost
              productivity. Simple, powerful, and secure.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">No credit card required • 14-day free trial</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="mb-2 text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="mb-12 text-lg text-gray-600">
              Powerful features designed to help you and your team work more efficiently and make
              better decisions.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="group transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">How It Works</h2>
            <p className="mb-12 text-lg text-gray-600">
              Get started in minutes. No complicated setup required.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                      {item.step}
                    </div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="absolute right-0 top-8 hidden h-0.5 w-full translate-x-1/2 bg-gray-300 lg:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
                Why teams choose Hubnity
              </h2>
              <p className="mb-8 text-lg text-gray-600">
                Join thousands of teams who have transformed their productivity with Hubnity.
              </p>
              <div className="space-y-6">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={index} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                        <Icon className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="mb-1 font-semibold text-gray-900">{benefit.title}</h3>
                        <p className="text-gray-600">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Card className="w-full max-w-md p-8 shadow-xl">
                <div className="mb-6 text-center">
                  <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <BarChart3 className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-gray-900">See It In Action</h3>
                  <p className="text-gray-600">
                    Experience the power of Hubnity with our interactive demo
                  </p>
                </div>
                <Link href="/register">
                  <Button size="lg" className="w-full gap-2">
                    Try It Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-primary/90 py-20 text-primary-foreground sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to get started?</h2>
            <p className="mb-8 text-lg opacity-90 sm:text-xl">
              Join thousands of teams already using Hubnity to track their time and boost
              productivity. Start your free trial today.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
                  Create Your Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm opacity-75">No credit card required • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Clock className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-gray-900">Hubnity</span>
              </div>
              <p className="text-sm text-gray-600">
                The modern time tracking solution for teams who value productivity and transparency.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-gray-900">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/dashboard" className="hover:text-primary">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/tracking" className="hover:text-primary">
                    Time Tracking
                  </Link>
                </li>
                <li>
                  <Link href="/admin/reports" className="hover:text-primary">
                    Reports
                  </Link>
                </li>
                <li>
                  <Link href="/admin/team-activity" className="hover:text-primary">
                    Team Activity
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-gray-900">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <a href="#" className="hover:text-primary">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-gray-900">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <a href="#" className="hover:text-primary">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Support
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-gray-600">
                © {new Date().getFullYear()} Hubnity. All rights reserved.
              </p>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <a href="#" className="hover:text-primary">
                  Terms
                </a>
                <a href="#" className="hover:text-primary">
                  Privacy
                </a>
                <a href="#" className="hover:text-primary">
                  Security
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
