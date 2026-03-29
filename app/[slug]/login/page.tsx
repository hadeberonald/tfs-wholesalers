// app/[slug]/login/page.tsx (Next.js 14 Compatible)
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

function LoginForm() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState<any>(null);
  const [fetchingBranch, setFetchingBranch] = useState(true);
  const { login, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    if (slug) {
      fetchBranch();
    }
  }, [slug]);

  useEffect(() => {
    if (user && branch) {
      if (redirect) {
        router.push(`/${slug}/${redirect}`);
      } else {
        router.push(`/${slug}/account`);
      }
    }
  }, [user, branch, redirect, router, slug]);

  const fetchBranch = async () => {
    try {
      setFetchingBranch(true);
      const res = await fetch(`/api/branches/${slug}`);
      
      if (!res.ok) {
        toast.error('Branch not found');
        router.push('/');
        return;
      }
      
      const data = await res.json();
      setBranch(data.branch);
    } catch (error) {
      console.error('Failed to fetch branch:', error);
      toast.error('Failed to load branch information');
      router.push('/');
    } finally {
      setFetchingBranch(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, slug);
      toast.success('Welcome back!');
      
      if (redirect) {
        router.push(`/${slug}/${redirect}`);
      } else {
        router.push(`/${slug}/account`);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingBranch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-black mb-2">Branch Not Found</h1>
          <p className="text-gray-600 mb-4">The branch you're looking for doesn't exist.</p>
          <Link href="/" className="text-brand-orange hover:text-orange-600 font-semibold">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2 mt-8">Welcome Back</h1>
          <p className="text-gray-600">Sign in to {branch.name || 'TFS Wholesalers'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                
                <input
                  type="email"
                  required
                  className="input-field pl-10 pr-4"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-brand-orange rounded border-gray-300 focus:ring-brand-orange"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <Link href={`/${slug}/forgot-password`} className="text-sm text-brand-orange hover:text-orange-600">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href={`/${slug}/register`} className="text-brand-orange font-semibold hover:text-orange-600">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Store */}
        <div className="text-center mt-6">
          <Link 
            href={`/${slug}`} 
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to {branch.name || 'Store'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange rounded-2xl mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">TFS</span>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}