/**
 * lib/get-admin-branch.ts  (UPDATED — Dynamic RBAC version)
 *
 * Decodes the auth-token, resolves the user's branch, and fetches their
 * full permissions array from the admin_roles collection.
 *
 * DROP-IN REPLACEMENT — all existing callers continue to work because
 * the returned shape is additive. New fields: `permissions`, `adminRoleId`.
 */

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissions } from '@/lib/admin-roles-db';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET is not set.');

// ─── Return types ─────────────────────────────────────────────────────────────

export interface AdminBranchSuccess {
  userId: string;
  branchId: ObjectId;
  isSuperAdmin: false;
  /** ObjectId of the admin_roles document assigned to this user */
  adminRoleId: ObjectId | null;
  /** Resolved permission strings, e.g. ["specials:read","specials:write"] */
  permissions: string[];
}

export interface SuperAdminSuccess {
  userId: string;
  branchId: null;
  isSuperAdmin: true;
  adminRoleId: null;
  /** Super-admins get a sentinel value — check isSuperAdmin instead */
  permissions: ['*'];
}

export interface AdminBranchError {
  error: string;
  status: number;
}

export type AdminBranchResult =
  | AdminBranchSuccess
  | SuperAdminSuccess
  | AdminBranchError;

// ─── Main function ────────────────────────────────────────────────────────────

export async function getAdminBranch(): Promise<AdminBranchResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) return { error: 'Unauthorized', status: 401 };

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET!);
    } catch {
      return { error: 'Invalid token', status: 401 };
    }

    const { userId, role } = decoded;

    // Super-admins bypass all role/permission checks
    if (role === 'super-admin') {
      return {
        userId,
        branchId: null,
        isSuperAdmin: true,
        adminRoleId: null,
        permissions: ['*'],
      };
    }

    if (role !== 'admin') return { error: 'Forbidden', status: 403 };

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { branchId: 1, adminRoleId: 1 } }
    );

    if (!user?.branchId) {
      return { error: 'Admin account has no branch assigned', status: 403 };
    }

    const adminRoleId: ObjectId | null = user.adminRoleId
      ? new ObjectId(user.adminRoleId)
      : null;

    // Resolve permissions from the role document (cached for 60s)
    const permissions = await getUserPermissions(adminRoleId);

    // If no role is assigned yet, treat them as having no permissions
    // (the super-admin can fix this from the Users page)
    return {
      userId,
      branchId: user.branchId,
      isSuperAdmin: false,
      adminRoleId,
      permissions: permissions ?? [],
    };
  } catch (error) {
    console.error('getAdminBranch error:', error);
    return { error: 'Internal server error', status: 500 };
  }
}
