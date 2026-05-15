import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { hashPassword } from '@/lib/utils';
import { requirePermission } from '@/lib/with-permission';
import { bustRoleCache } from '@/lib/admin-roles-db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('users:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const { password, adminRoleId, activeBranchId, branchId, ...updateData } = body;

    if (updateData.role !== undefined && !auth.isSuperAdmin)
      return NextResponse.json({ error: 'Not authorized to change user roles' }, { status: 403 });

    if (password) {
      if (password.length < 6)
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      updateData.password = await hashPassword(password);
    }

    if (adminRoleId !== undefined) {
      if (!adminRoleId) {
        updateData.adminRoleId = null;
      } else {
        const roleDoc = await db.collection('admin_roles').findOne({ _id: new ObjectId(adminRoleId) });
        if (!roleDoc)
          return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 });
        updateData.adminRoleId = roleDoc._id;
      }
    }

    // Resolve branch — always write activeBranchId, always null branchId
    // This migrates legacy docs on first edit automatically
    const rawBranch = activeBranchId ?? branchId ?? undefined;
    if (rawBranch !== undefined) {
      if (!rawBranch) {
        updateData.activeBranchId = null;
      } else {
        try {
          updateData.activeBranchId = new ObjectId(rawBranch);
        } catch {
          return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
        }
      }
      updateData.branchId = null;
    }

    updateData.updatedAt = new Date();

    await db.collection('users').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (adminRoleId !== undefined) bustRoleCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('users:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(params.id) });
    if (targetUser?.role === 'super-admin' && !auth.isSuperAdmin)
      return NextResponse.json({ error: 'Not authorized to delete super-admin accounts' }, { status: 403 });

    await db.collection('users').deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}