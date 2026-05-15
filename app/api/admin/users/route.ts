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

    // Scope to branch — match both field names for legacy docs
    if (!auth.isSuperAdmin && auth.branchId) {
      query.$or = [
        { activeBranchId: auth.branchId },
        { branchId: auth.branchId },
      ];
    }

    const users = await db.collection('users').aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'admin_roles',
          localField: 'adminRoleId',
          foreignField: '_id',
          as: 'adminRoleDoc',
        },
      },
      {
        $lookup: {
          from: 'branches',
          let: { bid: { $ifNull: ['$activeBranchId', '$branchId'] } },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$bid'] } } }],
          as: 'branchDoc',
        },
      },
      {
        $addFields: {
          adminRoleName:    { $arrayElemAt: ['$adminRoleDoc.name', 0] },
          activeBranchName: { $arrayElemAt: ['$branchDoc.name', 0] },
          activeBranchId:   { $ifNull: ['$activeBranchId', '$branchId'] },
        },
      },
      { $project: { password: 0, adminRoleDoc: 0, branchDoc: 0 } },
      { $sort: { createdAt: -1 } },
    ]).toArray();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('users:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const {
      name, email, password, role = 'customer',
      phone, active = true, adminRoleId, activeBranchId,
    } = await request.json();

    if (!name || !email || !password)
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    if (role === 'super-admin' && !auth.isSuperAdmin)
      return NextResponse.json({ error: 'Not authorized to create super-admin accounts' }, { status: 403 });
    if (role === 'admin' && !activeBranchId)
      return NextResponse.json({ error: 'Admin users must be assigned to a branch' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser)
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    // Validate adminRoleId
    let resolvedRoleId: ObjectId | null = null;
    if (adminRoleId) {
      const roleDoc = await db.collection('admin_roles').findOne({ _id: new ObjectId(adminRoleId) });
      if (!roleDoc)
        return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 });
      resolvedRoleId = roleDoc._id;
    }

    // Resolve branch — admin users use the form value, others inherit from auth
    let resolvedBranchId: ObjectId | null = null;
    if (role === 'admin' && activeBranchId) {
      try {
        resolvedBranchId = new ObjectId(activeBranchId);
      } catch {
        return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
      }
    } else if (!auth.isSuperAdmin && auth.branchId) {
      resolvedBranchId = auth.branchId;
    }

    const hashedPassword = await hashPassword(password);

    await db.collection('users').insertOne({
      name,
      email:          email.toLowerCase(),
      password:       hashedPassword,
      role,
      phone:          phone || null,
      active,
      adminRoleId:    resolvedRoleId,
      activeBranchId: resolvedBranchId,  // ← canonical field
      branchId:       null,              // ← always null on new docs
      createdAt:      new Date(),
      updatedAt:      new Date(),
    });

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}