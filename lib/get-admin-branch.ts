/**
 * lib/get-admin-branch.ts  — Consolidated RBAC version
 *
 * Fixes:
 *  - Supports BOTH branchId and activeBranchId on user documents
 *  - Handles branchId stored as string OR ObjectId
 *  - Single source of truth for auth → branch → permissions resolution
 *  - Reads role from DB on every request (never trusts the JWT role claim)
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
  adminRoleId: ObjectId | null;
  permissions: string[];
}

export interface SuperAdminSuccess {
  userId: string;
  branchId: null;
  isSuperAdmin: true;
  adminRoleId: null;
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

// ─── Helper: resolve branchId from user doc ───────────────────────────────────

function resolveBranchId(user: Record<string, any>): ObjectId | null {
  const raw = user.activeBranchId ?? user.branchId ?? null;
  if (!raw) return null;
  try {
    return raw instanceof ObjectId ? raw : new ObjectId(raw.toString());
  } catch {
    console.error('[getAdminBranch] Could not parse branchId:', raw);
    return null;
  }
}

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

    const { userId } = decoded;

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Always read role fresh from DB — never trust the JWT role claim,
    // which is stale from login time and won't reflect role changes.
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { role: 1, branchId: 1, activeBranchId: 1, adminRoleId: 1 } }
    );

    if (!user) return { error: 'User not found', status: 404 };

    const role = user.role as string;

    // ── Super-admin: bypass all branch/role checks ────────────────────────────
    if (role === 'super-admin') {
      return {
        userId,
        branchId: null,
        isSuperAdmin: true,
        adminRoleId: null,
        permissions: ['*'],
      };
    }

    // ── Non-admin roles (customers, pickers, etc.) ────────────────────────────
    if (role !== 'admin') return { error: 'Forbidden', status: 403 };

    const branchId = resolveBranchId(user);

    if (!branchId) {
      return { error: 'Admin account has no branch assigned', status: 403 };
    }

    const adminRoleId: ObjectId | null = user.adminRoleId
      ? (() => {
          try {
            return user.adminRoleId instanceof ObjectId
              ? user.adminRoleId
              : new ObjectId(user.adminRoleId.toString());
          } catch {
            return null;
          }
        })()
      : null;

    // Resolve permissions fresh from DB on every request
    const rawPermissions = await getUserPermissions(adminRoleId);

    // Expand write permissions to implicitly include read.
    const permissionsSet = new Set<string>(rawPermissions ?? []);
    (rawPermissions ?? []).forEach((perm) => {
      if (perm.endsWith(':write')) {
        permissionsSet.add(perm.replace(':write', ':read'));
      }
    });
    const permissions = Array.from(permissionsSet);

    return {
      userId,
      branchId,
      isSuperAdmin: false,
      adminRoleId,
      permissions,
    };
  } catch (error) {
    console.error('[getAdminBranch] Unexpected error:', error);
    return { error: 'Internal server error', status: 500 };
  }
}