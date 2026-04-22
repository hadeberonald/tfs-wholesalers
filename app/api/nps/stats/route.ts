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

    // Previous period for trend
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

    // ── Core NPS helpers ──────────────────────────────────────────────────────
    const calcNPS = (arr: any[]) => {
      const valid = arr.filter(r => r.score !== null);
      if (!valid.length) return 0;
      const promoters  = valid.filter(r => r.score >= 9).length;
      const detractors = valid.filter(r => r.score <= 6).length;
      return Math.round(((promoters - detractors) / valid.length) * 100);
    };

    const scoredResponses  = responses.filter(r => r.score !== null);
    const totalResponses   = responses.length;
    const promoters        = scoredResponses.filter(r => r.score >= 9).length;
    const passives         = scoredResponses.filter(r => r.score >= 7 && r.score <= 8).length;
    const detractors       = scoredResponses.filter(r => r.score <= 6).length;
    const npsScore         = calcNPS(responses);
    const prevNPS          = calcNPS(prevResponses);
    const averageScore     = scoredResponses.length
      ? scoredResponses.reduce((s, r) => s + r.score, 0) / scoredResponses.length
      : 0;

    // ── Score distribution ────────────────────────────────────────────────────
    const scoreDistribution = Array.from({ length: 11 }, (_, i) => ({
      score: i,
      count: scoredResponses.filter(r => r.score === i).length,
    }));

    // ── Section aggregations ──────────────────────────────────────────────────
    const countBy = (arr: any[], path: string) => {
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
      satisfaction:        countBy(responses, 'overall.satisfaction'),
      recommendLikelihood: countBy(responses, 'overall.recommendLikelihood'),
      metExpectations:     countBy(responses, 'overall.metExpectations'),
    };

    const store = {
      easyToFind:   countBy(responses, 'store.easyToFind'),
      cleanliness:  countBy(responses, 'store.cleanliness'),
      checkoutWait: countBy(responses, 'store.checkoutWait'),
    };

    const staff = {
      greeted:            countBy(responses, 'staff.greeted'),
      friendliness:       countBy(responses, 'staff.friendliness'),
      madeRecommendation: countBy(responses, 'staff.madeRecommendation'),
    };

    const products = {
      foundAllItems:    countBy(responses, 'products.foundAllItems'),
      quality:          countBy(responses, 'products.quality'),
      promotionsDriven: countBy(responses, 'products.promotionsDriven'),
    };

    // ── Improvement & suggestion texts ────────────────────────────────────────
    const improvements = responses
      .filter(r => r.overall?.oneImprovement?.trim())
      .map(r => r.overall.oneImprovement.trim());

    const productSuggestions = responses
      .filter(r => r.products?.newProductSuggestions?.trim())
      .map(r => r.products.newProductSuggestions.trim());

    const threeWords = responses
      .filter(r => r.overall?.threeWords?.trim())
      .map(r => r.overall.threeWords.trim());

    // ── Recent responses (serialised) ─────────────────────────────────────────
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