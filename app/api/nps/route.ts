// app/api/nps/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Extracts the leading digit from values like "5 – Excellent" or "3 – Average".
// Returns null if the value is missing or unparseable.
function extractRating(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseInt(value.charAt(0), 10);
  return isNaN(n) ? null : n;
}

// Maps a 1–5 recommend rating to the standard NPS type.
// 5 = Extremely Likely → promoter
// 3–4 = Likely / Good → passive
// 1–2 = Unlikely / Very Unlikely → detractor
function ratingToType(rating: number | null): 'promoter' | 'passive' | 'detractor' | null {
  if (rating === null) return null;
  if (rating >= 5) return 'promoter';
  if (rating >= 3) return 'passive';
  return 'detractor';
}

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

    // Derive numeric score (1–5) from the recommend likelihood rating
    const recommendRating = extractRating(overall?.recommendLikelihood);
    const npsType = ratingToType(recommendRating);

    const doc = {
      branchId:    branch._id,
      branchSlug,
      score:       recommendRating,   // 1–5, used for distribution & averages
      type:        npsType,           // promoter | passive | detractor | null
      source:      source || 'in-store',
      submittedAt: new Date(),
      createdAt:   new Date(),
      overall: {
        satisfaction:        overall?.satisfaction        || null,  // product variety rating
        recommendLikelihood: overall?.recommendLikelihood || null,  // recommend rating
        metExpectations:     overall?.metExpectations     || null,  // prices & promotions rating
        oneImprovement:      overall?.oneImprovement      || null,  // additional comments (free text)
      },
      store: {
        cleanliness: store?.cleanliness || null,  // cleanliness & appearance rating
        easyToFind:  store?.easyToFind  || null,  // ease of finding items rating
      },
      staff: {
        friendliness: staff?.friendliness || null,  // friendliness & helpfulness rating
        greeted:      staff?.greeted      || null,  // greeted yes/no
      },
      products: {
        foundAllItems:         products?.foundAllItems         || null,  // yes / partially / no
        quality:               products?.quality               || null,  // quality rating
        promotionsDriven:      products?.promotionsDriven      || null,  // yes / no
        newProductSuggestions: products?.newProductSuggestions || null,  // free text
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