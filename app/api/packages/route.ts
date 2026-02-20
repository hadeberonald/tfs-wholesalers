// app/api/packages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

// ─── POST — picker creates a package after scanning QR label ─────────────────
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, qrCode, items, packageNumber, totalPackages } = await request.json();

    if (!orderId || !qrCode) {
      return NextResponse.json({ error: 'orderId and qrCode are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // QR uniqueness check
    const existing = await db.collection('packages').findOne({ qrCode });
    if (existing) {
      return NextResponse.json({ error: 'QR code already in use' }, { status: 400 });
    }

    // Verify order exists and belongs to picker's branch
    let order = null;
    if (ObjectId.isValid(orderId)) {
      order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (mobileUser.activeBranchId) {
      const orderBranch = order.branchId?.toString();
      if (orderBranch && orderBranch !== mobileUser.activeBranchId.toString()) {
        return NextResponse.json({ error: 'Order does not belong to your branch' }, { status: 403 });
      }
    }

    // Create standalone package document
    const packageDoc = {
      orderId,
      qrCode,
      items:            items || [],
      packageNumber,
      totalPackages,
      status:           'pending',
      createdAt:        new Date(),
      createdBy:        mobileUser.id,
      scannedForDelivery: false,
      deliveredAt:      null,
    };

    const result = await db.collection('packages').insertOne(packageDoc);

    // Push a summary onto the order — this is what DeliveryCollectionScreen
    // reads when the driver scans packages before pickup
    await db.collection('orders').updateOne(
      { _id: new ObjectId(orderId) },
      {
        $push: {
          packages: {
            _id:           result.insertedId,
            qrCode,
            packageNumber,
            totalPackages,
            items:         items || [],
          },
        } as any,
        $set: { updatedAt: new Date() },
      }
    );

    console.log(`✅ Package ${packageNumber}/${totalPackages} — order ${orderId} — QR: ${qrCode}`);

    return NextResponse.json({
      success:   true,
      packageId: result.insertedId.toString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create package:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}

// ─── GET — fetch packages by orderId / qrCode / readyForDelivery ─────────────
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp               = request.nextUrl.searchParams;
    const orderId          = sp.get('orderId');
    const qrCode           = sp.get('qrCode');
    const readyForDelivery = sp.get('readyForDelivery');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};
    if (orderId)                     query.orderId = orderId;
    if (qrCode)                      query.qrCode  = qrCode;
    if (readyForDelivery === 'true') {
      query.status             = 'ready';
      query.scannedForDelivery = false;
    }

    const packages = await db.collection('packages')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      packages: packages.map(p => ({ ...p, _id: p._id.toString() })),
    });
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

// ─── PATCH — driver scans a package / marks delivered ────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { qrCode, scannedForDelivery, deliveredAt, driverId } = await request.json();

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const updates: any = {};

    if (scannedForDelivery !== undefined) {
      updates.scannedForDelivery = scannedForDelivery;
      if (scannedForDelivery) {
        updates.scannedForDeliveryAt = new Date();
        updates.scannedByDriver      = driverId || mobileUser.id;
      }
    }

    if (deliveredAt) {
      updates.deliveredAt = new Date(deliveredAt);
      updates.status      = 'delivered';
    }

    const result = await db.collection('packages').findOneAndUpdate(
      { qrCode },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      package: { ...result, _id: result._id.toString() },
    });
  } catch (error) {
    console.error('Failed to update package:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}