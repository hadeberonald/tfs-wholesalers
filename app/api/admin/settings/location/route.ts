import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/utils';

function getAdminUser(request: NextRequest) {
  const token =
    request.cookies.get('admin-token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  if (decoded.role !== 'admin' && decoded.role !== 'super-admin') return null;

  return decoded;
}

// GET /api/admin/settings/location?branchId=xxx
export async function GET(request: NextRequest) {
  try {
    const admin = getAdminUser(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (branchId) {
      const branch = await db.collection('branches').findOne(
        { _id: new ObjectId(branchId) },
        { projection: { 'settings.storeLocation': 1 } }
      );

      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }

      return NextResponse.json({ location: branch.settings?.storeLocation ?? null });
    }

    // Fallback: global location document (legacy / single-branch setups)
    const settings = await db
      .collection('settings')
      .findOne({ type: 'store-location' });

    return NextResponse.json({ location: settings?.storeLocation ?? null });
  } catch (error) {
    console.error('Failed to fetch location settings:', error);
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}

// PUT /api/admin/settings/location
// Body: { branchId?: string, lat, lng, address }
export async function PUT(request: NextRequest) {
  try {
    const admin = getAdminUser(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { branchId, lat, lng, address } = body;

    if (lat === undefined || lng === undefined || !address) {
      return NextResponse.json(
        { error: 'lat, lng, and address are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (branchId) {
      const result = await db.collection('branches').updateOne(
        { _id: new ObjectId(branchId) },
        {
          $set: {
            'settings.storeLocation': { lat, lng, address },
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Fallback: upsert global store location document
    await db.collection('settings').updateOne(
      { type: 'store-location' },
      {
        $set: {
          storeLocation: { lat, lng, address },
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update location settings:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}