import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { orderId, qrCode, items, packageNumber, totalPackages } = await request.json();
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('packages').findOne({ qrCode });
    if (existing) {
      return NextResponse.json({ error: 'QR code already in use' }, { status: 400 });
    }

    const packageDoc = {
      orderId,
      qrCode,
      items,
      packageNumber,
      totalPackages,
      status: 'pending',
      createdAt: new Date(),
      scannedForDelivery: false,
      deliveredAt: null,
    };

    const result = await db.collection('packages').insertOne(packageDoc);
    
    await db.collection('orders').updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $push: { 
          packages: {
            _id: result.insertedId,
            qrCode,
            packageNumber,
            totalPackages,
          }
        } as any
      }
    );
    
    return NextResponse.json({ 
      success: true,
      packageId: result.insertedId.toString()
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create package:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    const qrCode = searchParams.get('qrCode');
    const readyForDelivery = searchParams.get('readyForDelivery');
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    if (orderId) {
      query.orderId = orderId;
    }
    
    if (qrCode) {
      query.qrCode = qrCode;
    }
    
    if (readyForDelivery === 'true') {
      query.status = 'ready';
      query.scannedForDelivery = false;
    }
    
    const packages = await db.collection('packages')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { qrCode, scannedForDelivery, deliveredAt, driverId } = await request.json();
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const updates: any = {};
    
    if (scannedForDelivery !== undefined) {
      updates.scannedForDelivery = scannedForDelivery;
      if (scannedForDelivery) {
        updates.scannedForDeliveryAt = new Date();
        updates.scannedByDriver = driverId;
      }
    }
    
    if (deliveredAt) {
      updates.deliveredAt = new Date(deliveredAt);
      updates.status = 'delivered';
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
      package: result
    });
  } catch (error) {
    console.error('Failed to update package:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}