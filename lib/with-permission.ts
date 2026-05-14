/**
 * lib/with-permission.ts  — Centralized permission guard
 *
 * Single function used by every API route to:
 *   1. Authenticate the request (via getAdminBranch)
 *   2. Check the required permission
 *   3. Return a typed result the route can act on
 *
 * Permission model:
 *   - Super-admins always pass.
 *   - :write implicitly grants :read (handled in getAdminBranch).
 *   - No role-name checks anywhere — only permission strings.
 *
 * Usage in a route:
 *
 *   const auth = await requirePermission('products:read');
 *   if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   // auth is now AdminBranchSuccess | SuperAdminSuccess
 */

import {
  getAdminBranch,
  AdminBranchSuccess,
  SuperAdminSuccess,
  AdminBranchError,
} from '@/lib/get-admin-branch';

export type PermissionCheckSuccess = AdminBranchSuccess | SuperAdminSuccess;
export type PermissionCheckResult = PermissionCheckSuccess | AdminBranchError;

/**
 * Authenticates the caller and verifies they have the given permission.
 *
 * @param permission  A string like "products:read" or "specials:write".
 *                    Pass null to skip the permission check (auth only).
 */
export async function requirePermission(
  permission: string | null
): Promise<PermissionCheckResult> {
  const auth = await getAdminBranch();

  // Propagate auth errors immediately
  if ('error' in auth) return auth;

  // Super-admins bypass all permission checks
  if (auth.isSuperAdmin) return auth;

  // No specific permission required — auth alone is enough
  if (permission === null) return auth;

  const { permissions } = auth;

  const granted =
    permissions.includes(permission) ||
    // :write implicitly grants :read (belt-and-suspenders; also done in getAdminBranch)
    (permission.endsWith(':read') &&
      permissions.includes(permission.replace(':read', ':write')));

  if (!granted) {
    return {
      error: `Forbidden: missing permission "${permission}"`,
      status: 403,
    };
  }

  return auth;
}

/**
 * Type-guard: narrows a PermissionCheckResult to the success variants.
 * Use when you need to branch on the result without an early return.
 *
 * Example:
 *   const result = await requirePermission('products:read');
 *   if (isPermissionError(result)) { ... }
 */
export function isPermissionError(
  result: PermissionCheckResult
): result is AdminBranchError {
  return 'error' in result;
}