import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('orders:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    const withdrawals = await db.collection('withdrawalRequests').find(query).sort({ requestedAt: -1 }).toArray();
    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('orders:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { amount, bankDetails, notes } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    if (!bankDetails?.accountName || !bankDetails?.accountNumber || !bankDetails?.bankCode) return NextResponse.json({ error: 'Bank details required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('withdrawalRequests').findOne({ branchId: auth.branchId, status: { $in: ['pending', 'approved', 'processing'] } });
    if (existing) return NextResponse.json({ error: 'You already have a pending withdrawal request. Please wait for it to be processed.' }, { status: 400 });

    const withdrawal = {
      branchId: auth.branchId, amount,
      bankDetails: { accountName: bankDetails.accountName, accountNumber: bankDetails.accountNumber, bankName: bankDetails.bankName, bankCode: bankDetails.bankCode },
      notes: notes || '', status: 'pending', requestedBy: auth.userId, requestedAt: new Date(), updatedAt: new Date(),
    };

    const result = await db.collection('withdrawalRequests').insertOne(withdrawal);
    console.log(`✅ Withdrawal request created: ${auth.branchId} — R${amount}`);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create withdrawal request:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
