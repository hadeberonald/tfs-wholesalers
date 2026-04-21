// app/api/nps/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchSlug, score, tags, comment, source } = body;

    if (!branchSlug || score === undefined || score === null) {
      return NextResponse.json({ error: 'branchSlug and score are required' }, { status: 400 });
    }

    if (typeof score !== 'number' || score < 0 || score > 10) {
      return NextResponse.json({ error: 'Score must be a number between 0 and 10' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Resolve branchId from slug
    const branch = await db.collection('branches').findOne({ slug: branchSlug });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const type =
      score >= 9 ? 'promoter' :
      score >= 7 ? 'passive' :
      'detractor';

    const response = {
      branchId: branch._id,
      branchSlug,
      score,
      type,
      tags: tags || [],
      comment: comment?.trim() || '',
      source: source || 'in-store',
      submittedAt: new Date(),
      createdAt: new Date(),
    };

    await db.collection('nps_responses').insertOne(response);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save NPS response:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}