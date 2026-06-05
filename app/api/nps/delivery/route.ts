// app/api/nps/delivery/route.ts
// Stores delivery-specific NPS responses in the nps_delivery_responses collection.
// Mirrors the structure of the in-store NPS route but focused on the online
// delivery experience.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

function ratingToType(score: number | null): 'promoter' | 'passive' | 'detractor' | null {
  if (score === null) return null;
  if (score >= 5) return 'promoter';
  if (score >= 3) return 'passive';
  return 'detractor';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderNumber, branchSlug, delivery, overall, submittedAt } = body;

    if (!branchSlug) {
      return NextResponse.json({ error: 'branchSlug is required' }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const branch = await db.collection('branches').findOne({ slug: branchSlug });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Prevent duplicate reviews for the same order
    const existing = await db
      .collection('nps_delivery_responses')
      .findOne({ orderId });
    if (existing) {
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }

    const overallScore = overall?.satisfaction ?? null;
    const npsType      = ratingToType(overallScore);

    const doc = {
      orderId,
      orderNumber,
      branchId:    branch._id,
      branchSlug,
      source:      'mobile_app',
      score:       overallScore,
      type:        npsType,
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      createdAt:   new Date(),

      delivery: {
        speed:              delivery?.speed              ?? null,  // 1–5
        driverFriendliness: delivery?.driverFriendliness ?? null,  // 1–5
        packagingQuality:   delivery?.packagingQuality   ?? null,  // 1–5
        itemsReceived:      delivery?.itemsReceived      ?? null,  // Yes / Partially / No
        itemCondition:      delivery?.itemCondition      ?? null,  // Good / Damaged
      },

      overall: {
        satisfaction: overallScore,                    // 1–5
        wouldReorder: overall?.wouldReorder ?? null,  // Yes / Maybe / No
        comments:     overall?.comments     || null,  // free text
      },
    };

    await db.collection('nps_delivery_responses').insertOne(doc);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[DeliveryNPS] Failed to save response:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}