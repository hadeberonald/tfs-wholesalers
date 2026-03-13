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

    const body = await request.json();
    const { amount, supplierAccountNumber, supplierBankCode, supplierAccountName, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!supplierAccountNumber || !supplierBankCode || !supplierAccountName) {
      return NextResponse.json({ error: 'Supplier bank details required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Verify PO belongs to branch
    const query: any = { _id: new ObjectId(params.id) };
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    const po = await db.collection('purchaseOrders').findOne(query);
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (po.settlement?.status === 'success') {
      return NextResponse.json({ error: 'This PO has already been settled' }, { status: 400 });
    }

    // ── Step 1: Create Paystack transfer recipient ──────────────────────────
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: supplierAccountName,
        account_number: supplierAccountNumber,
        bank_code: supplierBankCode,
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
    const reference = `PO-SETTLE-${params.id}-${Date.now()}`;

    // ── Step 2: Initiate transfer ───────────────────────────────────────────
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100), // kobo/cents
        recipient: recipientCode,
        reason: notes || `Settlement for ${po.orderNumber}`,
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

    const transferId = transferData.data.id;
    const transferStatus = transferData.data.status; // 'pending' | 'success' | 'failed'

    // ── Step 3: Save settlement to PO ──────────────────────────────────────
    const settlement = {
      amount,
      paystackReference: reference,
      paystackTransferId: String(transferId),
      paystackRecipientCode: recipientCode,
      supplierAccountName,
      supplierAccountNumber: `****${supplierAccountNumber.slice(-4)}`,
      supplierBankCode,
      status: transferStatus === 'success' ? 'success' : 'processing',
      notes: notes || '',
      settledBy: adminInfo.userId,
      settledAt: new Date(),
    };

    await db.collection('purchaseOrders').updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          settlement,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ PO settlement initiated: ${po.orderNumber} — ${reference}`);

    return NextResponse.json({
      success: true,
      reference,
      transferId,
      status: settlement.status,
    });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}