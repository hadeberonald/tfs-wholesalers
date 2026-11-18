// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: app/api/cron/reconcile-payments/route.ts   (NEW FILE)
// ═══════════════════════════════════════════════════════════════════════════
//
// Called every 3 minutes by a small timer in server.ts (see CHANGES.md, edit 3),
// with the header:  Authorization: Bearer <CRON_SECRET>
// Any external scheduler (e.g. a Render Cron Job) can call it the same way.

import { NextRequest, NextResponse } from 'next/server';
import { reconcilePendingPayments } from '@/lib/order-payment';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const stats = await reconcilePendingPayments();
  return NextResponse.json({ ok: true, ...stats });
}

export const GET = POST;