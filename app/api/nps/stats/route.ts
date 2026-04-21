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
    const branchSlug = searchParams.get('branchSlug');
    const period = searchParams.get('period') || '30'; // days, or 'all'

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Build date filter
    const dateFilter: any = {};
    if (period !== 'all') {
      const days = parseInt(period, 10);
      dateFilter.submittedAt = {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      };
    }

    // Branch filter
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
        $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      };
    }

    // Fetch current responses
    const responses = await db
      .collection('nps_responses')
      .find(baseFilter)
      .sort({ submittedAt: -1 })
      .toArray();

    // Fetch previous period for trend
    const prevResponses = await db
      .collection('nps_responses')
      .find(prevFilter)
      .toArray();

    const calcNPS = (arr: any[]) => {
      if (!arr.length) return 0;
      const promoters = arr.filter(r => r.score >= 9).length;
      const detractors = arr.filter(r => r.score <= 6).length;
      return Math.round(((promoters - detractors) / arr.length) * 100);
    };

    const totalResponses = responses.length;
    const promoters = responses.filter(r => r.score >= 9).length;
    const passives = responses.filter(r => r.score >= 7 && r.score <= 8).length;
    const detractors = responses.filter(r => r.score <= 6).length;
    const npsScore = calcNPS(responses);
    const prevNPS = calcNPS(prevResponses);
    const averageScore =
      totalResponses > 0
        ? responses.reduce((sum, r) => sum + r.score, 0) / totalResponses
        : 0;

    // Score distribution
    const scoreDistribution = Array.from({ length: 11 }, (_, i) => ({
      score: i,
      count: responses.filter(r => r.score === i).length,
    }));

    // Tag frequency
    const tagMap: Record<string, number> = {};
    for (const r of responses) {
      for (const tag of r.tags || []) {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Serialize recent responses
    const recentResponses = responses.slice(0, 50).map(r => ({
      ...r,
      _id: r._id.toString(),
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
        topTags,
        recentResponses,
        trend: npsScore - prevNPS,
      },
    });
  } catch (error) {
    console.error('Failed to fetch NPS stats:', error);
    return NextResponse.json({ error: 'Failed to fetch NPS stats' }, { status: 500 });
  }
}