import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requirePermission } from '@/lib/with-permission';
import { bustRoleCache, getAllRoles } from '@/lib/admin-roles-db';
import { getAllPermissions } from '@/lib/route-manifest';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('roles:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const roles = await getAllRoles();
    const allPermissions = getAllPermissions();
    return NextResponse.json({ roles, allPermissions });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('roles:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const { name, description = '', permissions = [] } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Role name is required' }, { status: 400 });

    const validPermissions = new Set(getAllPermissions());
    const invalidPerms = (permissions as string[]).filter(p => !validPermissions.has(p));
    if (invalidPerms.length > 0) return NextResponse.json({ error: `Unknown permissions: ${invalidPerms.join(', ')}` }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existing = await db.collection('admin_roles').findOne({ name: name.trim() });
    if (existing) return NextResponse.json({ error: 'A role with this name already exists' }, { status: 400 });

    const result = await db.collection('admin_roles').insertOne({ name: name.trim(), description: description.trim(), permissions, isSystem: false, createdAt: new Date(), updatedAt: new Date() });
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
