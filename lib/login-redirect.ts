/**
 * lib/login-redirect.ts
 *
 * Single source of truth for where to send a user after a successful login.
 * Import this in your login page's onSuccess callback.
 *
 * Usage in your login page:
 *
 *   import { getPostLoginUrl } from '@/lib/login-redirect';
 *
 *   // after successful auth response:
 *   const url = getPostLoginUrl(user, slug);
 *   router.push(url);
 */

interface MinimalUser {
  role: string;
  permissions?: string[];
}

/**
 * Returns the URL the user should land on immediately after logging in.
 *
 * Priority:
 *  1. super-admin  → /super-admin
 *  2. admin/staff  → /{slug}/admin  (the dashboard, which RoleGuard always allows)
 *  3. customer     → /{slug}  (the storefront)
 */
export function getPostLoginUrl(user: MinimalUser, slug?: string | null): string {
  if (user.role === 'super-admin') return '/super-admin';
  if (user.role === 'admin' || user.role === 'staff') {
    return slug ? `/${slug}/admin` : '/admin';
  }
  // customer / unknown
  return slug ? `/${slug}` : '/select-branch';
}
