/**
 * lib/with-permission.ts
 *
 * Thin wrapper around getAdminBranch that enforces a specific permission.
 *
 * USAGE IN AN API ROUTE:
 *
 *   import { requirePermission } from '@/lib/with-permission';
 *
 *   export async function POST(request: NextRequest) {
 *     const auth = await requirePermission('specials:write');
 *     if ('error' in auth) {
 *       return NextResponse.json({ error: auth.error }, { status: auth.status });
 *     }
 *     // auth.branchId, auth.permissions etc. are available here
 *   }
 */

import { getAdminBranch } from '@/lib/get-admin-branch';

export async function requirePermission(permission: string) {
  const adminInfo = await getAdminBranch();

  if ('error' in adminInfo) return adminInfo;

  // Super-admins have universal access
  if (adminInfo.isSuperAdmin) return adminInfo;

  const granted =
    adminInfo.permissions.includes(permission) ||
    // If a user has :write they implicitly have :read too
    (permission.endsWith(':read') &&
      adminInfo.permissions.includes(permission.replace(':read', ':write')));

  if (!granted) {
    return {
      error: `You do not have permission to perform this action (required: ${permission})`,
      status: 403 as const,
    };
  }

  return adminInfo;
}
