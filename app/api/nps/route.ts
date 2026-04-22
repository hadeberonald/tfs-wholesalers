// app/api/nps/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchSlug, overall, store, staff, products, contact, source } = body;

    if (!branchSlug) {
      return NextResponse.json({ error: 'branchSlug is required' }, { status: 400 });
    }
    if (!overall?.satisfaction) {
      return NextResponse.json({ error: 'Overall satisfaction is required' }, { status: 400 });
    }

    if (contact) {
      if (!contact.name?.trim() || !contact.phone?.trim()) {
        return NextResponse.json(
          { error: 'Name and phone are required when submitting contact details' },
          { status: 400 }
        );
      }
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const branch = await db.collection('branches').findOne({ slug: branchSlug });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Derive a numeric NPS score from recommendLikelihood for backward compatibility
    const likelihoodToScore: Record<string, number> = {
      'Extremely Likely': 10,
      'Very Likely': 9,
      'Likely': 7,
      'Unlikely': 4,
      'Very Unlikely': 1,
    };
    const npsScore = likelihoodToScore[overall?.recommendLikelihood ?? ''] ?? null;
    const npsType  =
      npsScore === null ? null :
      npsScore >= 9     ? 'promoter' :
      npsScore >= 7     ? 'passive'  : 'detractor';

    const doc = {
      branchId:   branch._id,
      branchSlug,
      // Keep top-level score for stats aggregation
      score:      npsScore,
      type:       npsType,
      source:     source || 'in-store',
      submittedAt: new Date(),
      createdAt:  new Date(),
      // Structured survey sections
      overall: {
        satisfaction:        overall?.satisfaction        || null,
        recommendLikelihood: overall?.recommendLikelihood || null,
        metExpectations:     overall?.metExpectations     || null,
        oneImprovement:      overall?.oneImprovement      || null,
        threeWords:          overall?.threeWords          || null,
      },
      store: {
        easyToFind:   store?.easyToFind   || null,
        cleanliness:  store?.cleanliness  || null,
        checkoutWait: store?.checkoutWait || null,
      },
      staff: {
        greeted:               staff?.greeted               || null,
        friendliness:          staff?.friendliness          || null,
        madeRecommendation:    staff?.madeRecommendation    || null,
        recommendationDetails: staff?.recommendationDetails || null,
      },
      products: {
        foundAllItems:        products?.foundAllItems        || null,
        quality:              products?.quality              || null,
        promotionsDriven:     products?.promotionsDriven     || null,
        newProductSuggestions: products?.newProductSuggestions || null,
      },
      contact: contact
        ? {
            name:  contact.name.trim(),
            phone: contact.phone.trim(),
            email: contact.email?.trim() || null,
          }
        : null,
    };

    await db.collection('nps_responses').insertOne(doc);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save NPS response:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}