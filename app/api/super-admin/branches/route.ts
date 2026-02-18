import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

// Verify user is super admin
async function verifySuperAdmin(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user || user.role !== 'super-admin') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

// GET - List all branches
export async function GET(request: NextRequest) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Super admin access required' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branches = await db.collection('branches')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

// POST - Create new branch
export async function POST(request: NextRequest) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, displayName, settings } = body;

    if (!name || !slug || !displayName) {
      return NextResponse.json({ error: 'Name, slug, and displayName are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check if slug already exists
    const existing = await db.collection('branches').findOne({ slug });
    if (existing) {
      return NextResponse.json({ error: 'Branch with this slug already exists' }, { status: 400 });
    }

    // Create new branch
    const newBranch = {
      name,
      slug,
      displayName,
      status: 'active',
      settings: {
        storeLocation: settings?.storeLocation || {
          lat: -27.763912,
          lng: 30.798969,
          address: 'Default Location'
        },
        contactEmail: settings?.contactEmail || 'info@tfswholesalers.co.za',
        contactPhone: settings?.contactPhone || '+27 82 123 4567',
        deliveryPricing: settings?.deliveryPricing || {
          local: 50,
          localRadius: 5,
          medium: 100,
          mediumRadius: 15,
          far: 150,
          farRadius: 30,
        },
        minimumOrderValue: settings?.minimumOrderValue || 0,
      },
      paymentConfig: body.paymentConfig || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user._id,
    };

    const result = await db.collection('branches').insertOne(newBranch);

    // Create default admin user for this branch
    const bcrypt = require('bcryptjs');
    const defaultPassword = await bcrypt.hash('admin123', 10);
    
    await db.collection('users').insertOne({
      email: `${slug}@tfswholesalers.co.za`,
      password: defaultPassword,
      name: `${displayName} Admin`,
      role: 'admin',
      branchId: result.insertedId,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Created branch: ${displayName} (${slug})`);
    console.log(`   Default admin: ${slug}@tfswholesalers.co.za / admin123`);

    return NextResponse.json({ 
      success: true,
      branch: { ...newBranch, _id: result.insertedId },
      defaultAdmin: {
        email: `${slug}@tfswholesalers.co.za`,
        password: 'admin123' // Send this back only on creation
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}