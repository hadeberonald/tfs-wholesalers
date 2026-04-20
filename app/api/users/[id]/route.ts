import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { hashPassword } from '@/lib/utils';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: admin access required to update users
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
  }

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const { password, ...updateData } = body;

    // SECURITY: only super-admins may change a user's role
    if (updateData.role !== undefined && !adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Not authorized to change user roles' }, { status: 403 });
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updateData.password = await hashPassword(password);
    }

    updateData.updatedAt = new Date();

    await db.collection('users').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: admin access required to delete users
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
  }

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // SECURITY: non-super-admins cannot delete other admin accounts
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(params.id) });
    if (targetUser && (targetUser.role === 'admin' || targetUser.role === 'super-admin') && !adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete admin accounts' }, { status: 403 });
    }

    await db.collection('users').deleteOne({
      _id: new ObjectId(params.id)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
