import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const all    = searchParams.get('all');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};

    if (all === 'true') {
      const auth = await requirePermission('wholesale-customers:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) {
        query.$or = [{ branchId: auth.branchId }, { branchId: null }, { branchId: { $exists: false } }];
      }
    } else if (userId) {
      try { query.userId = new ObjectId(userId); } catch { return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 }); }
    }

    console.log('🔍 Fetching wholesale customers with query:', JSON.stringify(query));
    const customers = await db.collection('wholesale_customers').find(query).sort({ createdAt: -1 }).toArray();
    console.log(`✅ Found ${customers.length} wholesale customers`);
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('❌ Failed to fetch wholesale customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    console.log('📝 Creating wholesale customer for userId:', body.userId);
    const existing = await db.collection('wholesale_customers').findOne({ userId: new ObjectId(body.userId) });
    if (existing) return NextResponse.json({ error: 'Wholesale account already exists for this user' }, { status: 400 });

    const customer = {
      userId: new ObjectId(body.userId), businessName: body.businessName, businessType: body.businessType,
      registrationNumber: body.registrationNumber || null, vatNumber: body.vatNumber || null,
      taxClearanceCertificate: body.taxClearanceCertificate || null, contactPerson: body.contactPerson,
      email: body.email, phone: body.phone, businessAddress: body.businessAddress,
      verificationStatus: 'pending', currentBalance: 0, hasStandingOrders: false, active: false,
      creditTerms: null, branchId: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await db.collection('wholesale_customers').insertOne(customer);
    console.log('✅ Wholesale customer created:', result.insertedId.toString());
    return NextResponse.json({ success: true, customerId: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create wholesale customer:', error);
    return NextResponse.json({ error: 'Failed to create customer', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
