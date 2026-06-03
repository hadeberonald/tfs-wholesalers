// app/api/nps/stats/route.ts
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

    // Previous period for trend comparison
    const prevFilter: any = { ...branchFilter };
    if (period !== 'all') {
      const days = parseInt(period, 10);
      prevFilter.submittedAt = {
        $gte: new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000),
        $lt:  new Date(Date.now() - days       * 24 * 60 * 60 * 1000),
      };
    }

    // ── Fetch responses ───────────────────────────────────────────────────────
    const responses = await db
      .collection('nps_responses')
      .find(baseFilter)
      .sort({ submittedAt: -1 })
      .toArray();

    const prevResponses = await db
      .collection('nps_responses')
      .find(prevFilter)
      .toArray();

    // ── Score helpers (1–5 scale) ─────────────────────────────────────────────
    // Promoter  = 5  (Extremely Likely)
    // Passive   = 3–4
    // Detractor = 1–2
    const scoredResponses = responses.filter(r => r.score !== null);

    const calcNPS = (arr: any[]) => {
      const valid = arr.filter(r => r.score !== null);
      if (!valid.length) return 0;
      const promoters  = valid.filter(r => r.score >= 5).length;
      const detractors = valid.filter(r => r.score <= 2).length;
      return Math.round(((promoters - detractors) / valid.length) * 100);
    };

    const totalResponses = responses.length;
    const promoters      = scoredResponses.filter(r => r.score >= 5).length;
    const passives       = scoredResponses.filter(r => r.score >= 3 && r.score <= 4).length;
    const detractors     = scoredResponses.filter(r => r.score <= 2).length;
    const npsScore       = calcNPS(responses);
    const prevNPS        = calcNPS(prevResponses);
    const averageScore   = scoredResponses.length
      ? scoredResponses.reduce((s, r) => s + r.score, 0) / scoredResponses.length
      : 0;

    // ── Score distribution (1–5 only) ─────────────────────────────────────────
    const scoreDistribution = Array.from({ length: 5 }, (_, i) => ({
      score: i + 1,
      count: scoredResponses.filter(r => r.score === i + 1).length,
    }));

    // ── Section aggregations ──────────────────────────────────────────────────
    const countBy = (arr: any[], path: string): Record<string, number> => {
      const map: Record<string, number> = {};
      for (const r of arr) {
        const parts = path.split('.');
        let val: any = r;
        for (const p of parts) val = val?.[p];
        if (val) map[val] = (map[val] || 0) + 1;
      }
      return map;
    };

    const overall = {
      satisfaction:        countBy(responses, 'overall.satisfaction'),        // product variety
      recommendLikelihood: countBy(responses, 'overall.recommendLikelihood'), // recommend rating
      metExpectations:     countBy(responses, 'overall.metExpectations'),     // prices & promotions
    };

    const store = {
      cleanliness: countBy(responses, 'store.cleanliness'),  // cleanliness & appearance
      easyToFind:  countBy(responses, 'store.easyToFind'),   // ease of finding items
    };

    const staff = {
      friendliness: countBy(responses, 'staff.friendliness'), // friendliness & helpfulness
      greeted:      countBy(responses, 'staff.greeted'),      // greeted yes/no
    };

    const products = {
      foundAllItems:    countBy(responses, 'products.foundAllItems'),
      quality:          countBy(responses, 'products.quality'),
      promotionsDriven: countBy(responses, 'products.promotionsDriven'),
    };

    // ── Free-text fields ──────────────────────────────────────────────────────
    // "improvements" = Additional Comments (overall.oneImprovement)
    const improvements = responses
      .filter(r => r.overall?.oneImprovement?.trim())
      .map(r => r.overall.oneImprovement.trim());

    // "productSuggestions" = new product / feature requests
    const productSuggestions = responses
      .filter(r => r.products?.newProductSuggestions?.trim())
      .map(r => r.products.newProductSuggestions.trim());

    // threeWords repurposed as additional comments for the overview cloud
    // (kept as alias so the results page component doesn't need changes)
    const threeWords = improvements;

    // ── Serialize recent responses ────────────────────────────────────────────
    const recentResponses = responses.slice(0, 100).map(r => ({
      ...r,
      _id:      r._id.toString(),
      branchId: r.branchId?.toString(),
    }));

    return NextResponse.json({
      stats: {
        totalResponses,
        npsScore,
        promoters,
        passives,
        detractors,
        averageScore,
        scoreDistribution,
        trend: npsScore - prevNPS,
        sectionStats: { overall, store, staff, products },
        improvements,
        productSuggestions,
        threeWords,
        recentResponses,
      },
    });
  } catch (error) {
    console.error('Failed to fetch NPS stats:', error);
    return NextResponse.json({ error: 'Failed to fetch NPS stats' }, { status: 500 });
  }
}