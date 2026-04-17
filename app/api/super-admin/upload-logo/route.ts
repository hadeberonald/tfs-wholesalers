import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

async function verifySuperAdmin(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    if (!user || user.role !== 'super-admin') return null;
    return user;
  } catch {
    return null;
  }
}

// GET /api/super-admin/branches/[id]/admin
// Returns the admin user for this branch
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const superAdmin = await verifySuperAdmin(request);
  if (!superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await context.params;
  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');

  const admin = await db.collection('users').findOne(
    { branchId: new ObjectId(id), role: 'admin' },
    { projection: { password: 0 } }
  );

  return NextResponse.json({ admin: admin ?? null });
}

// PUT /api/super-admin/branches/[id]/admin
// Update (or create) the admin user for this branch
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const superAdmin = await verifySuperAdmin(request);
  if (!superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');

  // Check if another user (not this branch's admin) already has this email
  const conflict = await db.collection('users').findOne({
    email: email.toLowerCase(),
    branchId: { $ne: new ObjectId(id) },
  });
  if (conflict) {
    return NextResponse.json({ error: 'Email already in use by another user' }, { status: 400 });
  }

  const updateFields: Record<string, any> = {
    name,
    email: email.toLowerCase(),
    updatedAt: new Date(),
  };

  if (password) {
    updateFields.password = await bcrypt.hash(password, 10);
  }

  // Try to update existing admin; if none exists, create one
  const existing = await db.collection('users').findOne({
    branchId: new ObjectId(id),
    role: 'admin',
  });

  if (existing) {
    await db.collection('users').updateOne(
      { _id: existing._id },
      { $set: updateFields }
    );
  } else {
    // Fetch branch slug to build a default password if none supplied
    const branch = await db.collection('branches').findOne({ _id: new ObjectId(id) });
    const defaultPassword = password || 'admin123';

    await db.collection('users').insertOne({
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(defaultPassword, 10),
      role: 'admin',
      branchId: new ObjectId(id),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}