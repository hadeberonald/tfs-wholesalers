import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requirePermission } from '@/lib/with-permission';

// POST /api/wholesale/payments/check-overdue
// Call this via a cron job (e.g. Vercel cron) or manually from admin
export async function POST(request: NextRequest) {
  // Allow cron secret OR admin permission
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    const auth = await requirePermission('wholesale-orders:write');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const now = new Date();

    // Find all unpaid credit orders past their due date
    const overdueOrders = await db
      .collection('wholesale_purchase_orders')
      .find({
        paymentType: 'credit',
        paymentStatus: { $in: ['pending', 'overdue'] },
        dueDate: { $lt: now },
      })
      .toArray();

    if (overdueOrders.length === 0) {
      return NextResponse.json({ message: 'No overdue orders found', blocked: 0 });
    }

    // Mark orders as overdue
    const orderIds = overdueOrders.map((o) => o._id);
    await db.collection('wholesale_purchase_orders').updateMany(
      { _id: { $in: orderIds } },
      { $set: { paymentStatus: 'overdue', updatedAt: new Date() } }
    );

    // Block customers with overdue orders
    const customerIds = [...new Set(overdueOrders.map((o) => o.customerId.toString()))];
    let blockedCount = 0;

    for (const customerId of customerIds) {
      // Recalculate outstanding balance from all unpaid credit orders
      const unpaidOrders = await db
        .collection('wholesale_purchase_orders')
        .find({
          customerId: overdueOrders.find((o) => o.customerId.toString() === customerId)?.customerId,
          paymentType: 'credit',
          paymentStatus: { $in: ['pending', 'overdue', 'pending_pop_review', 'pop_rejected'] },
        })
        .toArray();

      const totalOwing = unpaidOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);

      await db.collection('wholesale_customers').updateOne(
        { _id: overdueOrders.find((o) => o.customerId.toString() === customerId)?.customerId },
        {
          $set: {
            blockedFromOrdering: true,
            outstandingBalance: totalOwing,
            updatedAt: new Date(),
          },
        }
      );
      blockedCount++;
    }

    console.log(`✅ Overdue check: ${overdueOrders.length} orders marked overdue, ${blockedCount} customers blocked`);
    return NextResponse.json({
      message: 'Overdue check complete',
      overdueOrders: overdueOrders.length,
      blocked: blockedCount,
    });
  } catch (error) {
    console.error('❌ Overdue check failed:', error);
    return NextResponse.json({ error: 'Overdue check failed' }, { status: 500 });
  }
}