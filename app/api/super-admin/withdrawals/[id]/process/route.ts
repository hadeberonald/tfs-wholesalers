// app/api/super-admin/withdrawals/[id]/process/route.ts — execute Paystack transfer
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }
    if (!adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const withdrawal = await db.collection('withdrawalRequests').findOne({
      _id: new ObjectId(params.id),
    });

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    if (withdrawal.status !== 'approved') {
      return NextResponse.json({ error: 'Withdrawal must be approved before processing' }, { status: 400 });
    }

    if (withdrawal.paystackReference) {
      return NextResponse.json({ error: 'This withdrawal has already been processed' }, { status: 400 });
    }

    // ── Step 1: Create transfer recipient ────────────────────────────────────
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: withdrawal.bankDetails.accountName,
        account_number: withdrawal.bankDetails.accountNumber,
        bank_code: withdrawal.bankDetails.bankCode,
        currency: 'ZAR',
      }),
    });

    const recipientData = await recipientRes.json();

    if (!recipientRes.ok || !recipientData.status) {
      console.error('Paystack recipient error:', recipientData);
      return NextResponse.json({
        error: recipientData.message || 'Failed to create transfer recipient',
      }, { status: 400 });
    }

    const recipientCode = recipientData.data.recipient_code;
    const reference = `WITHDRAW-${params.id}-${Date.now()}`;

    // ── Step 2: Initiate transfer ─────────────────────────────────────────────
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(withdrawal.amount * 100),
        recipient: recipientCode,
        reason: `Branch withdrawal — ${withdrawal.branchId}`,
        reference,
        currency: 'ZAR',
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData.status) {
      console.error('Paystack transfer error:', transferData);
      return NextResponse.json({
        error: transferData.message || 'Transfer failed',
      }, { status: 400 });
    }

    // ── Step 3: Update withdrawal record ─────────────────────────────────────
    await db.collection('withdrawalRequests').updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          status: 'processing',
          paystackReference: reference,
          paystackTransferId: String(transferData.data.id),
          paystackRecipientCode: recipientCode,
          processedAt: new Date(),
          processedBy: adminInfo.userId,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Withdrawal transfer initiated: ${reference} — R${withdrawal.amount}`);

    return NextResponse.json({
      success: true,
      reference,
      transferId: transferData.data.id,
    });
  } catch (error) {
    console.error('Withdrawal process error:', error);
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 });
  }
}