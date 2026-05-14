import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';
import { bustRoleCache } from '@/lib/admin-roles-db';
import { getAllPermissions } from '@/lib/route-manifest';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('roles:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const { name, description, permissions } = body;
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existing = await db.collection('admin_roles').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'Role name cannot be empty' }, { status: 400 });
      const collision = await db.collection('admin_roles').findOne({ _id: { $ne: new ObjectId(params.id) }, name: name.trim() });
      if (collision) return NextResponse.json({ error: 'A role with this name already exists' }, { status: 400 });
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description.trim();
    if (permissions !== undefined) {
      const validPermissions = new Set(getAllPermissions());
      const invalidPerms = (permissions as string[]).filter(p => !validPermissions.has(p));
      if (invalidPerms.length > 0) return NextResponse.json({ error: `Unknown permissions: ${invalidPerms.join(', ')}` }, { status: 400 });
      updateData.permissions = permissions;
    }
    await db.collection('admin_roles').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    bustRoleCache(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('roles:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existing = await db.collection('admin_roles').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    if (existing.isSystem) return NextResponse.json({ error: 'System roles cannot be deleted. You can edit their permissions.' }, { status: 400 });
    await db.collection('users').updateMany({ adminRoleId: new ObjectId(params.id) }, { $unset: { adminRoleId: '' } });
    await db.collection('admin_roles').deleteOne({ _id: new ObjectId(params.id) });
    bustRoleCache(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
