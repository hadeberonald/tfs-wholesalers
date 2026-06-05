// app/api/nps/delivery/stats/route.ts
// Returns aggregated delivery NPS stats for the admin dashboard.
// Same pattern as /api/nps/stats but for the delivery collection.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const branchSlug   = searchParams.get('branchSlug');
    const period       = searchParams.get('period') || '30';

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // ── Date filter ───────────────────────────────────────────────────────────
    const dateFilter: any = {};
    if (period !== 'all') {
      const days = parseInt(period, 10);
      dateFilter.submittedAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const branchFilter: any = {};
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      branchFilter.branchId = adminInfo.branchId;
    } else if (branchSlug) {
      branchFilter.branchSlug = branchSlug;
    }

    const baseFilter = { ...branchFilter, ...dateFilter };

    const prevFilter: any = { ...branchFilter };
    if (period !== 'all') {
      const days = parseInt(period, 10);
      prevFilter.submittedAt = {
        $gte: new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000),
        $lt:  new Date(Date.now() - days       * 24 * 60 * 60 * 1000),
      };
    }

    const responses     = await db.collection('nps_delivery_responses').find(baseFilter).sort({ submittedAt: -1 }).toArray();
    const prevResponses = await db.collection('nps_delivery_responses').find(prevFilter).toArray();

    const n = responses.length;

    // ── NPS helpers ───────────────────────────────────────────────────────────
    const scored = responses.filter(r => r.score !== null);

    const calcNPS = (arr: any[]) => {
      const valid = arr.filter(r => r.score !== null);
      if (!valid.length) return 0;
      const promoters  = valid.filter(r => r.score >= 5).length;
      const detractors = valid.filter(r => r.score <= 2).length;
      return Math.round(((promoters - detractors) / valid.length) * 100);
    };

    const promoters  = scored.filter(r => r.score >= 5).length;
    const passives   = scored.filter(r => r.score >= 3 && r.score <= 4).length;
    const detractors = scored.filter(r => r.score <= 2).length;
    const npsScore   = calcNPS(responses);
    const prevNPS    = calcNPS(prevResponses);
    const avgScore   = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : 0;

    // ── Score distribution ────────────────────────────────────────────────────
    const scoreDistribution = Array.from({ length: 5 }, (_, i) => ({
      score: i + 1,
      count: scored.filter(r => r.score === i + 1).length,
    }));

    // ── Section aggregations ──────────────────────────────────────────────────
    const countBy = (arr: any[], path: string): Record<string, number> => {
      const map: Record<string, number> = {};
      for (const r of arr) {
        const parts = path.split('.');
        let val: any = r;
        for (const p of parts) val = val?.[p];
        if (val !== null && val !== undefined) map[String(val)] = (map[String(val)] || 0) + 1;
      }
      return map;
    };

    const sectionStats = {
      delivery: {
        speed:              countBy(responses, 'delivery.speed'),
        driverFriendliness: countBy(responses, 'delivery.driverFriendliness'),
        packagingQuality:   countBy(responses, 'delivery.packagingQuality'),
        itemsReceived:      countBy(responses, 'delivery.itemsReceived'),
        itemCondition:      countBy(responses, 'delivery.itemCondition'),
      },
      overall: {
        satisfaction: countBy(responses, 'overall.satisfaction'),
        wouldReorder: countBy(responses, 'overall.wouldReorder'),
      },
    };

    // ── Average star ratings for delivery sub-metrics ─────────────────────────
    const avgRating = (field: string) => {
      const vals = responses
        .map(r => {
          const parts = field.split('.');
          let v: any = r;
          for (const p of parts) v = v?.[p];
          return typeof v === 'number' ? v : null;
        })
        .filter(v => v !== null) as number[];
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const averageRatings = {
      deliverySpeed:      avgRating('delivery.speed'),
      driverFriendliness: avgRating('delivery.driverFriendliness'),
      packagingQuality:   avgRating('delivery.packagingQuality'),
      overallSatisfaction: avgScore,
    };

    // ── Free-text comments ────────────────────────────────────────────────────
    const comments = responses
      .filter(r => r.overall?.comments?.trim())
      .map(r => r.overall.comments.trim());

    // ── Recent responses (serialized) ─────────────────────────────────────────
    const recentResponses = responses.slice(0, 100).map(r => ({
      ...r,
      _id:      r._id.toString(),
      branchId: r.branchId?.toString(),
    }));

    return NextResponse.json({
      stats: {
        totalResponses: n,
        npsScore,
        promoters,
        passives,
        detractors,
        averageScore: avgScore,
        averageRatings,
        scoreDistribution,
        trend: npsScore - prevNPS,
        sectionStats,
        comments,
        recentResponses,
      },
    });
  } catch (error) {
    console.error('[DeliveryNPS] Failed to fetch stats:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery NPS stats' }, { status: 500 });
  }
}