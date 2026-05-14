'use client';

/**
 * components/RoleGuard.tsx
 *
 * Wraps admin pages with a client-side permission check.
 * The API routes are ALSO protected server-side — this is purely a UX layer.
 *
 * Special case: routeKey === "dashboard" is always allowed for any authenticated
 * admin user so the landing page never shows "Access Denied" on first load.
 */

import { useAuth } from '@/lib/auth-context';
import { MANIFEST_BY_KEY } from '@/lib/route-manifest';
import { ShieldOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

interface RoleGuardProps {
  /** The route manifest key, e.g. "specials" */
  routeKey: string;
  /** Which level of access to require. Defaults to "read". */
  require?: 'read' | 'write';
  children: React.ReactNode;
}

export default function RoleGuard({
  routeKey,
  require: level = 'read',
  children,
}: RoleGuardProps) {
  const { user, loading, can } = useAuth();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  const permission = `${routeKey}:${level}`;
  const route = MANIFEST_BY_KEY[routeKey];

  const hasAccess = useMemo(() => {
    if (!user) return false;
    // Super-admins always pass
    if (user.role === 'super-admin') return true;
    // Dashboard is the admin home — any authenticated admin/staff can see it
    if (routeKey === 'dashboard') return true;
    return can(permission);
  }, [user, routeKey, permission, can]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Not signed in</h2>
          <p className="text-gray-500 text-sm">Please sign in to access this page.</p>
          {slug && (
            <Link
              href={`/${slug}/login`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm mb-1">
            Your role{' '}
            {user.adminRoleName && (
              <span className="font-semibold text-gray-700">({user.adminRoleName})</span>
            )}{' '}
            doesn&apos;t have permission to access{' '}
            <span className="font-semibold">{route?.label ?? routeKey}</span>.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Required:{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">{permission}</code>
          </p>
          <Link
            href={slug ? `/${slug}/admin` : '/admin'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
