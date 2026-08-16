import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/with-permission';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const VALID_KEYS = ['retail_promo', 'wholesale_promo', 'daily_specials'] as const;
type PromoKey = (typeof VALID_KEYS)[number];

// Matches the captions that used to be hardcoded in menus.js — used whenever
// the admin doesn't type a custom caption, so the delivered message looks
// the same as it always has by default.
const DEFAULT_CAPTIONS: Record<PromoKey, string> = {
  retail_promo: 'Retail Promotion',
  wholesale_promo: 'Wholesale Promotion',
  daily_specials: 'Daily Specials',
};

/**
 * Each branch's promo files live in that branch's own WhatsApp bot folder
 * and database, same mapping as app/api/admin/bot-messages/route.ts:
 *   - whatsapp-bot          → Dundee
 *   - whatsapp-bot-branch2  → Ladysmith (Render callback URL + Mongo not
 *                             configured yet — errors gracefully until
 *                             WHATSAPP_MONGODB_URI_2 is added)
 *   - whatsapp-bot-branch3  → Vryheid   (planned for later — same graceful
 *                             error until WHATSAPP_MONGODB_URI_3 is added)
 *
 * IMPORTANT: same require()-only rule as bot-messages/route.ts — never
 * `import mongoose` at the top of this file. Dundee's case reuses the bot's
 * own live connection/model via require(), which only stays live if this
 * file and whatsapp-bot's own files share the same mongoose instance. See
 * the comment in bot-messages/route.ts for the full "buffering timed out"
 * story if this ever needs touching again.
 */
const extraConnections: Record<string, any> = {};

type ModelResult = { model: any } | { error: string };

async function getPromoDocumentModel(slug: string): Promise<ModelResult> {
  try {
    if (slug === 'dundee') {
      const { connectDB } = require('../../../../whatsapp-bot/src/config/db');
      await connectDB();
      const PromoDocument = require('../../../../whatsapp-bot/src/models/PromoDocument');
      return { model: PromoDocument };
    }

    if (slug === 'ladysmith') {
      const mongoose = require('mongoose');
      const { schema } = require('../../../../whatsapp-bot-branch2/src/models/promoDocumentSchema');
      const uri = process.env.WHATSAPP_MONGODB_URI_2;
      if (!uri) return { error: 'WHATSAPP_MONGODB_URI_2 is not set' };
      if (!extraConnections.ladysmith) {
        extraConnections.ladysmith = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
        await extraConnections.ladysmith.asPromise();
      }
      const conn = extraConnections.ladysmith;
      return { model: conn.models.PromoDocument || conn.model('PromoDocument', schema) };
    }

    if (slug === 'vryheid') {
      const mongoose = require('mongoose');
      const { schema } = require('../../../../whatsapp-bot-branch3/src/models/promoDocumentSchema');
      const uri = process.env.WHATSAPP_MONGODB_URI_3;
      if (!uri) return { error: 'WHATSAPP_MONGODB_URI_3 is not set' };
      if (!extraConnections.vryheid) {
        extraConnections.vryheid = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
        await extraConnections.vryheid.asPromise();
      }
      const conn = extraConnections.vryheid;
      return { model: conn.models.PromoDocument || conn.model('PromoDocument', schema) };
    }

    return { error: `No WhatsApp bot configured for branch "${slug}"` };
  } catch (err: any) {
    // Most likely cause: whatsapp-bot-branch2 or whatsapp-bot-branch3 doesn't
    // exist/isn't configured yet, or is missing promoDocumentSchema.js.
    return { error: `Bot files for "${slug}" aren't deployed yet (${err.message})` };
  }
}

async function getBranchSlug(branchId: ObjectId | null): Promise<string | null> {
  if (!branchId) return null;
  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');
  const branch = await db.collection('branches').findOne({ _id: branchId });
  return branch?.slug ?? null;
}

// Super-admins have no branchId of their own — let them pass ?branch=<slug>
// to check/edit a specific branch's promo files.
async function resolveSlugFromRequest(
  auth: { branchId: ObjectId | null; isSuperAdmin: boolean },
  request: NextRequest
): Promise<string | null> {
  if (auth.isSuperAdmin) {
    return request.nextUrl.searchParams.get('branch');
  }
  return getBranchSlug(auth.branchId);
}

// GET /api/admin/promo-files[?branch=dundee|ladysmith|vryheid]
// Returns the currently-uploaded file (if any) for each promo/specials slot,
// scoped to the caller's own branch (or ?branch= for super-admins).
export async function GET(request: NextRequest) {
  const auth = await requirePermission('settings:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const slug = await resolveSlugFromRequest(auth, request);
  if (!slug) {
    return NextResponse.json(
      { error: auth.isSuperAdmin ? 'Pass ?branch=dundee|ladysmith|vryheid' : 'No branch found for this account' },
      { status: 400 }
    );
  }

  const result = await getPromoDocumentModel(slug);
  if ('error' in result) return NextResponse.json({ error: result.error, branch: slug }, { status: 503 });

  try {
    const docs = await result.model.find({ key: { $in: VALID_KEYS } }).lean();
    return NextResponse.json({ branch: slug, documents: docs });
  } catch (err: any) {
    return NextResponse.json({ error: `Database query failed: ${err.message}`, branch: slug }, { status: 503 });
  }
}

// POST /api/admin/promo-files[?branch=...]
// Body: { key: 'retail_promo' | 'wholesale_promo' | 'daily_specials', fileUrl, filename, caption? }
// Upload the actual file to Cloudinary client-side first (uploadToCloudinary),
// then call this route with the resulting URL to save/replace the reference
// for the caller's own branch (or ?branch= for super-admins).
export async function POST(request: NextRequest) {
  const auth = await requirePermission('settings:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const slug = await resolveSlugFromRequest(auth, request);
  if (!slug) {
    return NextResponse.json(
      { error: auth.isSuperAdmin ? 'Pass ?branch=dundee|ladysmith|vryheid' : 'No branch found for this account' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { key, fileUrl, filename, caption } = body;

  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json(
      { error: `key must be one of: ${VALID_KEYS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!fileUrl || !filename) {
    return NextResponse.json({ error: 'fileUrl and filename are required' }, { status: 400 });
  }

  const result = await getPromoDocumentModel(slug);
  if ('error' in result) return NextResponse.json({ error: result.error, branch: slug }, { status: 503 });

  try {
    const doc = await result.model
      .findOneAndUpdate(
        { key: key as PromoKey },
        {
          key,
          fileUrl,
          filename,
          caption: caption || DEFAULT_CAPTIONS[key as PromoKey],
          uploadedAt: new Date(),
        },
        { upsert: true, new: true }
      )
      .lean();

    return NextResponse.json({ success: true, branch: slug, document: doc });
  } catch (err: any) {
    return NextResponse.json({ error: `Database write failed: ${err.message}`, branch: slug }, { status: 503 });
  }
}
