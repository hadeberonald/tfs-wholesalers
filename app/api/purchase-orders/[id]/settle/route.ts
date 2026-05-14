import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('purchase-orders:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { amount, supplierAccountNumber, supplierBankCode, supplierAccountName, notes } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    if (!supplierAccountNumber || !supplierBankCode || !supplierAccountName) return NextResponse.json({ error: 'Supplier bank details required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = { _id: new ObjectId(params.id) };
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;

    const po = await db.collection('purchaseOrders').findOne(query);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (po.settlement?.status === 'success') return NextResponse.json({ error: 'This PO has already been settled' }, { status: 400 });

    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nuban', name: supplierAccountName, account_number: supplierAccountNumber, bank_code: supplierBankCode, currency: 'ZAR' }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientRes.ok || !recipientData.status) return NextResponse.json({ error: recipientData.message || 'Failed to create transfer recipient' }, { status: 400 });

    const recipientCode = recipientData.data.recipient_code;
    const reference = `PO-SETTLE-${params.id}-${Date.now()}`;

    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'balance', amount: Math.round(amount * 100), recipient: recipientCode, reason: notes || `Settlement for ${po.orderNumber}`, reference, currency: 'ZAR' }),
    });
    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.status) return NextResponse.json({ error: transferData.message || 'Transfer failed' }, { status: 400 });

    const transferId = transferData.data.id;
    const transferStatus = transferData.data.status;

    const settlement = {
      amount, paystackReference: reference, paystackTransferId: String(transferId),
      paystackRecipientCode: recipientCode, supplierAccountName,
      supplierAccountNumber: `****${supplierAccountNumber.slice(-4)}`,
      supplierBankCode, status: transferStatus === 'success' ? 'success' : 'processing',
      notes: notes || '', settledBy: auth.userId, settledAt: new Date(),
    };

    await db.collection('purchaseOrders').updateOne({ _id: new ObjectId(params.id) }, { $set: { settlement, updatedAt: new Date() } });
    console.log(`✅ PO settlement initiated: ${po.orderNumber} — ${reference}`);
    return NextResponse.json({ success: true, reference, transferId, status: settlement.status });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}
