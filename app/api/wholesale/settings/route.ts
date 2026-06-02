import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

// GET /api/wholesale/settings?branchId=xxx
export async function GET(request: NextRequest) {
  try {
    const branchId = request.nextUrl.searchParams.get('branchId');
    if (!branchId) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const settings = await db.collection('wholesale_settings').findOne({
      branchId: new ObjectId(branchId),
    });

    // Return defaults if not configured yet
    return NextResponse.json({
      settings: settings ?? {
        branchId,
        creditThreshold: 50000,      // annual spend to qualify for credit
        defaultNetTerms: 30,
        defaultCreditLimit: 10000,
        paystackPublicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? '',
        allowPop: true,              // allow proof of payment uploads
        createdAt: null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch wholesale settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/wholesale/settings
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission('wholesale-settings:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const branchId = body.branchId ?? auth.branchId;
    if (!branchId) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const updateData = {
      branchId: new ObjectId(branchId),
      creditThreshold: Number(body.creditThreshold ?? 50000),
      defaultNetTerms: Number(body.defaultNetTerms ?? 30),
      defaultCreditLimit: Number(body.defaultCreditLimit ?? 10000),
      allowPop: body.allowPop ?? true,
      updatedAt: new Date(),
    };

    await db.collection('wholesale_settings').updateOne(
      { branchId: new ObjectId(branchId) },
      { $set: updateData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    console.log('✅ Wholesale settings updated for branch:', branchId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to update wholesale settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}