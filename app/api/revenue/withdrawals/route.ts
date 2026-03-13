import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    const withdrawals = await db.collection('withdrawalRequests')
      .find(query)
      .sort({ requestedAt: -1 })
      .toArray();

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const { amount, bankDetails, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!bankDetails?.accountName || !bankDetails?.accountNumber || !bankDetails?.bankCode) {
      return NextResponse.json({ error: 'Bank details required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check for existing pending request
    const existing = await db.collection('withdrawalRequests').findOne({
      branchId: adminInfo.branchId,
      status: { $in: ['pending', 'approved', 'processing'] },
    });

    if (existing) {
      return NextResponse.json({
        error: 'You already have a pending withdrawal request. Please wait for it to be processed.',
      }, { status: 400 });
    }

    const withdrawal = {
      branchId: adminInfo.branchId,
      amount,
      bankDetails: {
        accountName: bankDetails.accountName,
        accountNumber: bankDetails.accountNumber,
        bankName: bankDetails.bankName,
        bankCode: bankDetails.bankCode,
      },
      notes: notes || '',
      status: 'pending',
      requestedBy: adminInfo.userId,
      requestedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('withdrawalRequests').insertOne(withdrawal);

    console.log(`✅ Withdrawal request created: ${adminInfo.branchId} — R${amount}`);

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create withdrawal request:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}