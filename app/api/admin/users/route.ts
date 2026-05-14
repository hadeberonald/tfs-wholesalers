import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { hashPassword } from '@/lib/utils';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('users:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const role = request.nextUrl.searchParams.get('role');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};
    if (role) query.role = role;
    if (!auth.isSuperAdmin && auth.branchId) query.$or = [{ branchId: auth.branchId }, { branchId: { $exists: false } }, { branchId: null }];
    const users = await db.collection('users').aggregate([{ $match: query }, { $lookup: { from: 'admin_roles', localField: 'adminRoleId', foreignField: '_id', as: 'adminRoleDoc' } }, { $addFields: { adminRoleName: { $arrayElemAt: ['$adminRoleDoc.name', 0] } } }, { $project: { password: 0, adminRoleDoc: 0 } }, { $sort: { createdAt: -1 } }]).toArray();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('users:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { name, email, password, role = 'customer', phone, active = true, adminRoleId } = await request.json();
    if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    if (role === 'super-admin' && !auth.isSuperAdmin) return NextResponse.json({ error: 'Not authorized to create super-admin accounts' }, { status: 403 });
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    let resolvedRoleId: ObjectId | null = null;
    if (adminRoleId) {
      const roleDoc = await db.collection('admin_roles').findOne({ _id: new ObjectId(adminRoleId) });
      if (!roleDoc) return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 });
      resolvedRoleId = roleDoc._id;
    }
    const hashedPassword = await hashPassword(password);
    const result = await db.collection('users').insertOne({ name, email: email.toLowerCase(), password: hashedPassword, role, phone: phone || null, active, adminRoleId: resolvedRoleId, branchId: auth.branchId ?? null, createdAt: new Date(), updatedAt: new Date() });
    return NextResponse.json({ id: result.insertedId, message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
