/**
 * lib/admin-roles-db.ts
 *
 * Server-side helpers for resolving a user's permissions from the DB.
 *
 * COLLECTION SHAPE — admin_roles:
 * {
 *   _id        : ObjectId
 *   name       : string          // e.g. "Marketing"
 *   description: string
 *   permissions: string[]        // e.g. ["specials:read","specials:write","combos:read"]
 *   isSystem   : boolean         // true = cannot be deleted (built-in roles)
 *   createdAt  : Date
 *   updatedAt  : Date
 * }
 *
 * USER DOCUMENT — new field:
 *   adminRoleId: ObjectId | null  // points to admin_roles._id
 *
 * CACHING:
 *   Role documents rarely change. We keep an in-process Map cache with a
 *   60-second TTL so each API request doesn't hit MongoDB for every auth check.
 *   The cache is busted by the role update/delete endpoints.
 */

import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminRoleDoc {
  _id: ObjectId;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── In-process cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  role: AdminRoleDoc;
  expiresAt: number;
}

const roleCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function cacheSet(id: string, role: AdminRoleDoc) {
  roleCache.set(id, { role, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheGet(id: string): AdminRoleDoc | null {
  const entry = roleCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    roleCache.delete(id);
    return null;
  }
  return entry.role;
}

/** Call this from role update/delete API routes to force a fresh DB read */
export function bustRoleCache(id?: string) {
  if (id) {
    roleCache.delete(id);
  } else {
    roleCache.clear();
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getRoleById(roleId: ObjectId | string): Promise<AdminRoleDoc | null> {
  const id = roleId.toString();
  const cached = cacheGet(id);
  if (cached) return cached;

  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');

  const role = await db.collection('admin_roles').findOne({
    _id: new ObjectId(id),
  }) as AdminRoleDoc | null;

  if (role) cacheSet(id, role);
  return role;
}

export async function getAllRoles(): Promise<AdminRoleDoc[]> {
  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');
  return db.collection('admin_roles')
    .find({})
    .sort({ name: 1 })
    .toArray() as Promise<AdminRoleDoc[]>;
}

/**
 * Resolves the full permissions array for a user.
 * Returns null if the user has no adminRoleId assigned.
 */
export async function getUserPermissions(
  adminRoleId: ObjectId | string | null | undefined
): Promise<string[] | null> {
  if (!adminRoleId) return null;
  try {
    const role = await getRoleById(adminRoleId);
    return role?.permissions ?? null;
  } catch {
    return null;
  }
}

/**
 * Seeds the default system roles if they don't exist yet.
 * Call this from a startup script or a /api/admin/seed endpoint.
 */
export async function seedDefaultRoles() {
  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');

  const defaultRoles = [
    {
      name: 'Admin',
      description: 'Full branch access — all pages and operations.',
      isSystem: true,
      permissions: [
        'dashboard:read',
        'orders:read', 'orders:write',
        'products:read', 'products:write',
        'wholesale-customers:read', 'wholesale-customers:write',
        'wholesale-products:read', 'wholesale-products:write',
        'wholesale-orders:read', 'wholesale-orders:write',
        'purchase-orders:read', 'purchase-orders:write',
        'suppliers:read', 'suppliers:write',
        'stock-takes:read', 'stock-takes:write',
        'resolutions:read', 'resolutions:write',
        'revenue:read',
        'specials:read', 'specials:write',
        'combos:read', 'combos:write',
        'nps:read',
        'categories:read', 'categories:write',
        'hero-banners:read', 'hero-banners:write',
        'users:read', 'users:write',
        'roles:read', 'roles:write',
        'settings:read', 'settings:write',
      ],
    },
    {
      name: 'Marketing',
      description: 'Specials, combos, NPS and read-only access to products & categories.',
      isSystem: true,
      permissions: [
        'dashboard:read',
        'specials:read', 'specials:write',
        'combos:read', 'combos:write',
        'nps:read',
        'products:read',
        'categories:read',
      ],
    },
    {
      name: 'Buying',
      description: 'Products, categories, purchase orders, suppliers and stock takes.',
      isSystem: true,
      permissions: [
        'dashboard:read',
        'products:read', 'products:write',
        'categories:read', 'categories:write',
        'purchase-orders:read', 'purchase-orders:write',
        'suppliers:read', 'suppliers:write',
        'stock-takes:read', 'stock-takes:write',
      ],
    },
    {
      name: 'Site Management',
      description: 'Products, categories and hero banners.',
      isSystem: true,
      permissions: [
        'dashboard:read',
        'products:read', 'products:write',
        'categories:read', 'categories:write',
        'hero-banners:read', 'hero-banners:write',
      ],
    },
    {
      name: 'Customer Support',
      description: 'Orders, wholesale orders, customers and resolutions.',
      isSystem: true,
      permissions: [
        'dashboard:read',
        'orders:read', 'orders:write',
        'wholesale-orders:read', 'wholesale-orders:write',
        'wholesale-customers:read', 'wholesale-customers:write',
        'resolutions:read', 'resolutions:write',
        'products:read',
      ],
    },
  ];

  for (const role of defaultRoles) {
    const existing = await db.collection('admin_roles').findOne({ name: role.name });
    if (!existing) {
      await db.collection('admin_roles').insertOne({
        ...role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Seeded role: ${role.name}`);
    }
  }
}
