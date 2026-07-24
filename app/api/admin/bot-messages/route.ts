import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/with-permission';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const VALID_KEYS = [
  'welcome_text',
  'main_menu_body',
  'promotions_menu_body',
  'location_text',
  'support_text',
  'specials_text',
  'retail_promo_fallback_text',
  'wholesale_promo_fallback_text',
  'order_text',
  'fallback_text',
] as const;
type MessageKey = (typeof VALID_KEYS)[number];

/**
 * Each branch's WhatsApp bot lives in its own folder (whatsapp-bot,
 * whatsapp-bot-2, whatsapp-bot-3 for Vryheid / Dundee / Ladysmith) and
 * connects to its own database on the same Mongo cluster.
 *
 * IMPORTANT: this file intentionally never does `import mongoose from
 * 'mongoose'` at the top. Next.js's bundler can treat an `import` of a
 * package as a different module instance than a `require()` of the same
 * package elsewhere in the same route bundle. whatsapp-bot's own files
 * (config/db.js, models/BotMessage.js) load mongoose via `require(...)` — if
 * this file ALSO imported mongoose via `import`, connectDB() would connect
 * one mongoose instance while a model compiled against this file's own
 * import would stay disconnected forever, and every query on it would sit in
 * Mongoose's command buffer until it times out (this is exactly what caused
 * the "botmessages.find() buffering timed out" errors). Always reach
 * mongoose and the models through the same require() chain as the bot's own
 * files, never through a separate import.
 */
const extraConnections: Record<string, any> = {};

type ModelResult = { model: any } | { error: string };

async function getBotMessageModel(slug: string): Promise<ModelResult> {
  try {
    if (slug === 'vryheid') {
      const { connectDB } = require('../../../../whatsapp-bot/src/config/db');
      await connectDB();
      // Reuse the model already compiled in whatsapp-bot/src/models/BotMessage.js
      // (same require() chain, same mongoose instance, same live connection)
      // rather than recompiling it here against a separately-imported mongoose.
      const BotMessage = require('../../../../whatsapp-bot/src/models/BotMessage');
      return { model: BotMessage };
    }

    if (slug === 'dundee') {
      const mongoose = require('mongoose');
      const { schema } = require('../../../../whatsapp-bot-2/src/models/botMessageSchema');
      const uri = process.env.WHATSAPP_MONGODB_URI_2;
      if (!uri) return { error: 'WHATSAPP_MONGODB_URI_2 is not set' };
      if (!extraConnections.dundee) {
        extraConnections.dundee = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
        await extraConnections.dundee.asPromise();
      }
      const conn = extraConnections.dundee;
      return { model: conn.models.BotMessage || conn.model('BotMessage', schema) };
    }

    if (slug === 'ladysmith') {
      const mongoose = require('mongoose');
      const { schema } = require('../../../../whatsapp-bot-3/src/models/botMessageSchema');
      const uri = process.env.WHATSAPP_MONGODB_URI_3;
      if (!uri) return { error: 'WHATSAPP_MONGODB_URI_3 is not set' };
      if (!extraConnections.ladysmith) {
        extraConnections.ladysmith = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
        await extraConnections.ladysmith.asPromise();
      }
      const conn = extraConnections.ladysmith;
      return { model: conn.models.BotMessage || conn.model('BotMessage', schema) };
    }

    return { error: `No WhatsApp bot configured for branch "${slug}"` };
  } catch (err: any) {
    // Most likely cause: whatsapp-bot-2 / whatsapp-bot-3 don't exist in this
    // deployment yet.
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
// to check/edit a specific branch's bot messages.
async function resolveSlugFromRequest(
  auth: { branchId: ObjectId | null; isSuperAdmin: boolean },
  request: NextRequest
): Promise<string | null> {
  if (auth.isSuperAdmin) {
    return request.nextUrl.searchParams.get('branch');
  }
  return getBranchSlug(auth.branchId);
}

// GET /api/admin/bot-messages[?branch=vryheid|dundee|ladysmith]
// Returns the current overrides for the caller's branch's bot (or the
// branch given in ?branch= for super-admins).
export async function GET(request: NextRequest) {
  const auth = await requirePermission('settings:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const slug = await resolveSlugFromRequest(auth, request);
  if (!slug) {
    return NextResponse.json(
      { error: auth.isSuperAdmin ? 'Pass ?branch=vryheid|dundee|ladysmith' : 'No branch found for this account' },
      { status: 400 }
    );
  }

  const result = await getBotMessageModel(slug);
  if ('error' in result) return NextResponse.json({ error: result.error, branch: slug }, { status: 503 });

  try {
    const docs = await result.model.find({ key: { $in: VALID_KEYS } }).lean();
    return NextResponse.json({ branch: slug, messages: docs });
  } catch (err: any) {
    return NextResponse.json({ error: `Database query failed: ${err.message}`, branch: slug }, { status: 503 });
  }
}

// POST /api/admin/bot-messages[?branch=...]
// Body: { key: MessageKey, value: string }
export async function POST(request: NextRequest) {
  const auth = await requirePermission('settings:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const slug = await resolveSlugFromRequest(auth, request);
  if (!slug) {
    return NextResponse.json(
      { error: auth.isSuperAdmin ? 'Pass ?branch=vryheid|dundee|ladysmith' : 'No branch found for this account' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { key, value } = body as { key: MessageKey; value: string };

  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: `key must be one of: ${VALID_KEYS.join(', ')}` }, { status: 400 });
  }
  if (typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 });
  }

  const result = await getBotMessageModel(slug);
  if ('error' in result) return NextResponse.json({ error: result.error, branch: slug }, { status: 503 });

  try {
    const doc = await result.model
      .findOneAndUpdate(
        { key },
        { key, value: value.trim(), updatedAt: new Date() },
        { upsert: true, new: true }
      )
      .lean();

    return NextResponse.json({ success: true, branch: slug, message: doc });
  } catch (err: any) {
    return NextResponse.json({ error: `Database write failed: ${err.message}`, branch: slug }, { status: 503 });
  }
}

// DELETE /api/admin/bot-messages?key=...[&branch=...]
// Removes the override so the bot goes back to its built-in default text.
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission('settings:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const slug = await resolveSlugFromRequest(auth, request);
  if (!slug) {
    return NextResponse.json(
      { error: auth.isSuperAdmin ? 'Pass ?branch=vryheid|dundee|ladysmith' : 'No branch found for this account' },
      { status: 400 }
    );
  }

  const key = request.nextUrl.searchParams.get('key') as MessageKey | null;
  if (!key || !VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: `key must be one of: ${VALID_KEYS.join(', ')}` }, { status: 400 });
  }

  const result = await getBotMessageModel(slug);
  if ('error' in result) return NextResponse.json({ error: result.error, branch: slug }, { status: 503 });

  try {
    await result.model.deleteOne({ key });
    return NextResponse.json({ success: true, branch: slug });
  } catch (err: any) {
    return NextResponse.json({ error: `Database delete failed: ${err.message}`, branch: slug }, { status: 503 });
  }
}
