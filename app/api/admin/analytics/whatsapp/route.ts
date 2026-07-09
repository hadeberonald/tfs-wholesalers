// app/api/admin/analytics/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

const BOT_BASE_URL = process.env.WHATSAPP_BOT_URL;           // e.g. https://your-bot.onrender.com
const BOT_ANALYTICS_KEY = process.env.WHATSAPP_ANALYTICS_API_KEY; // must match bot's ANALYTICS_API_KEY

export async function GET(request: NextRequest) {
  const auth = await requirePermission('whatsapp:read');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!BOT_BASE_URL || !BOT_ANALYTICS_KEY) {
    return NextResponse.json(
      { error: 'WHATSAPP_BOT_URL / WHATSAPP_ANALYTICS_API_KEY not configured' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const url = new URL('/analytics/kpis', BOT_BASE_URL);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'x-analytics-key': BOT_ANALYTICS_KEY },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Bot analytics request failed', detail: await res.text() },
        { status: 502 }
      );
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('Failed to fetch WhatsApp analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}