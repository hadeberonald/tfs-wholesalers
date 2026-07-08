import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/with-permission';

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
 * The WhatsApp bot's Mongoose models/connection live in whatsapp-bot/src.
 * Since server.ts runs Next.js and the bot in the SAME Node process,
 * connectDB() is idempotent (it no-ops if already connected at boot), and
 * we can reuse the bot's PromoDocument model directly here — no separate
 * DB connection or internal API call needed.
 */
async function getPromoDocumentModel() {
  const { connectDB } = require('../../../../whatsapp-bot/src/config/db');
  await connectDB();
  return require('../../../../whatsapp-bot/src/models/PromoDocument');
}

// GET /api/admin/promo-files
// Returns the currently-uploaded file (if any) for each promo/specials slot.
export async function GET() {
  const auth = await requirePermission('settings:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const PromoDocument = await getPromoDocumentModel();
  const docs = await PromoDocument.find({ key: { $in: VALID_KEYS } }).lean();
  return NextResponse.json({ documents: docs });
}

// POST /api/admin/promo-files
// Body: { key: 'retail_promo' | 'wholesale_promo' | 'daily_specials', fileUrl, filename, caption? }
// Upload the actual file to Cloudinary client-side first (uploadToCloudinary),
// then call this route with the resulting URL to save/replace the reference.
export async function POST(request: NextRequest) {
  const auth = await requirePermission('settings:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  const PromoDocument = await getPromoDocumentModel();
  const doc = await PromoDocument.findOneAndUpdate(
    { key: key as PromoKey },
    {
      key,
      fileUrl,
      filename,
      caption: caption || DEFAULT_CAPTIONS[key as PromoKey],
      uploadedAt: new Date(),
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ success: true, document: doc });
}
