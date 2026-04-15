// app/api/debug/push-test/route.ts
//
// Diagnostic endpoint to verify push notifications will work BEFORE any order arrives.
// Hit this after deploy to see exactly what's broken.
//
// GET  /api/debug/push-test              → full system check (no push sent)
// POST /api/debug/push-test              → body: { branchId?, userId?, token? }
//                                          sends a real test push and returns result
//
// ⚠️  REMOVE THIS ENDPOINT OR ADD AUTH BEFORE GOING TO PRODUCTION
//     It exposes internal token counts — fine for debugging, not for public use.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushNotification } from '@/lib/sendPushNotification';

// ─── GET: diagnostic report ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const report: Record<string, any> = {
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks:      {},
  };

  // 1. DB connectivity
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const count  = await db.collection('push_tokens').countDocuments();
    report.checks.database = { ok: true, push_tokens_total: count };
  } catch (err: any) {
    report.checks.database = { ok: false, error: err.message };
  }

  // 2. Token breakdown by platform and userId presence
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const tokens = await db.collection('push_tokens').find({}).toArray();

    const withUserId    = tokens.filter(t => !!t.userId);
    const withoutUserId = tokens.filter(t => !t.userId);
    const android       = tokens.filter(t => t.platform === 'android');
    const ios           = tokens.filter(t => t.platform === 'ios');
    const invalid       = tokens.filter(t => !t.pushToken?.startsWith('ExponentPushToken'));

    report.checks.tokens = {
      total:           tokens.length,
      linked_to_user:  withUserId.length,
      guest_tokens:    withoutUserId.length,
      android:         android.length,
      ios:             ios.length,
      invalid_format:  invalid.length,
      sample_tokens:   tokens.slice(0, 3).map(t => ({
        userId:    t.userId ?? 'guest',
        platform:  t.platform,
        token_end: t.pushToken?.slice(-12) ?? 'MISSING',
        updatedAt: t.updatedAt,
      })),
    };
  } catch (err: any) {
    report.checks.tokens = { ok: false, error: err.message };
  }

  // 3. Branch staff check
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const branches = await db.collection('branches').find({ status: 'active' }, { projection: { _id: 1, displayName: 1 } }).toArray();

    const branchDetails = await Promise.all(branches.map(async (branch) => {
      const branchId     = branch._id.toString();
      let branchObjId: ObjectId | null = null;
      try { branchObjId = new ObjectId(branchId); } catch { /* */ }

      const branchQuery = branchObjId
        ? { $or: [{ activeBranchId: branchObjId }, { activeBranchId: branchId }] }
        : { activeBranchId: branchId };

      const staff = await db.collection('users').find(
        { ...branchQuery, role: { $in: ['picker', 'delivery', 'admin'] } },
        { projection: { _id: 1, name: 1, role: 1 } }
      ).toArray();

      const staffIds     = staff.map(s => s._id.toString());
      const tokenDocs    = await db.collection('push_tokens').find({ userId: { $in: staffIds } }).toArray();

      return {
        branchId,
        displayName: branch.displayName,
        staff_count:  staff.length,
        tokens_found: tokenDocs.length,
        staff_without_tokens: staff.filter(s => !tokenDocs.find(t => t.userId === s._id.toString())).map(s => ({
          id:   s._id.toString(),
          name: s.name,
          role: s.role,
        })),
        ready_to_notify: tokenDocs.length > 0,
      };
    }));

    report.checks.branches = branchDetails;
  } catch (err: any) {
    report.checks.branches = { ok: false, error: err.message };
  }

  // 4. SMTP check
  report.checks.smtp = {
    SMTP_HOST:  process.env.SMTP_HOST  ? '✅ set' : '❌ MISSING',
    SMTP_PORT:  process.env.SMTP_PORT  ? '✅ set' : '⚠️ not set (defaults to 587)',
    SMTP_USER:  process.env.SMTP_USER  ? '✅ set' : '❌ MISSING',
    SMTP_PASS:  process.env.SMTP_PASS  ? '✅ set' : '❌ MISSING',
  };

  // 5. JWT secret check
  report.checks.jwt = {
    JWT_SECRET:      process.env.JWT_SECRET      ? `✅ set (${process.env.JWT_SECRET.length} chars)` : '❌ MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? `✅ set (${process.env.NEXTAUTH_SECRET.length} chars)` : '⚠️ not set',
    note: 'JWT_SECRET must match between web server and mobile-login route',
  };

  // Overall status
  const dbOk     = report.checks.database?.ok === true;
  const hasTokens = (report.checks.tokens?.total ?? 0) > 0;
  const hasJwt   = !!process.env.JWT_SECRET || !!process.env.NEXTAUTH_SECRET;

  report.overall = {
    ready_to_send_push: dbOk && hasTokens,
    ready_to_send_email: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    auth_configured: hasJwt,
    issues: [
      !dbOk      && '❌ DB connection failed',
      !hasTokens && '⚠️ No push tokens in DB — pickers/customers haven\'t logged in yet or tokens not saving',
      !hasJwt    && '❌ No JWT secret configured',
      !process.env.SMTP_HOST && '❌ SMTP_HOST missing — emails will not send',
    ].filter(Boolean),
  };

  return NextResponse.json(report, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── POST: send a real test push ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const result: Record<string, any> = { timestamp: new Date().toISOString() };

  try {
    const body = await request.json().catch(() => ({}));
    const { branchId, userId, token } = body;

    // Option 1: send to a specific raw Expo token
    if (token) {
      result.method = 'direct_token';
      result.token_end = token.slice(-12);
      await sendPushNotification(token, {
        title: '🔔 TFS Push Test',
        body:  'Push notifications are working correctly!',
        data:  { type: 'test', timestamp: Date.now() },
      });
      result.sent = true;
      return NextResponse.json(result);
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Option 2: send to all tokens for a specific userId
    if (userId) {
      result.method   = 'by_userId';
      result.userId   = userId;

      const tokenDocs = await db.collection('push_tokens').find({ userId }).toArray();
      result.tokens_found = tokenDocs.length;

      if (!tokenDocs.length) {
        result.sent  = false;
        result.error = `No push tokens found for userId: ${userId}`;
        return NextResponse.json(result, { status: 404 });
      }

      await Promise.allSettled(
        tokenDocs.map(doc => sendPushNotification(doc.pushToken, {
          title: '🔔 TFS Push Test',
          body:  `Test for userId ${userId} — push notifications working!`,
          data:  { type: 'test', userId, timestamp: Date.now() },
        }))
      );
      result.sent = true;
      return NextResponse.json(result);
    }

    // Option 3: send to all staff at a branch
    if (branchId) {
      result.method   = 'by_branchId';
      result.branchId = branchId;

      let branchObjId: ObjectId | null = null;
      try { branchObjId = new ObjectId(branchId); } catch { /* */ }

      const branchQuery = branchObjId
        ? { $or: [{ activeBranchId: branchObjId }, { activeBranchId: branchId }] }
        : { activeBranchId: branchId };

      const staff = await db.collection('users').find(
        { ...branchQuery, role: { $in: ['picker', 'delivery', 'admin'] } },
        { projection: { _id: 1, name: 1, role: 1 } }
      ).toArray();

      result.staff_found = staff.length;

      const staffIds  = staff.map(s => s._id.toString());
      const tokenDocs = await db.collection('push_tokens').find({ userId: { $in: staffIds } }).toArray();
      result.tokens_found = tokenDocs.length;

      if (!tokenDocs.length) {
        result.sent  = false;
        result.error = 'No push tokens found for this branch\'s staff. Have they logged into the picker app?';
        result.staff = staff.map(s => ({ id: s._id.toString(), name: s.name, role: s.role }));
        return NextResponse.json(result, { status: 404 });
      }

      const sendResults = await Promise.allSettled(
        tokenDocs.map(doc => sendPushNotification(doc.pushToken, {
          title: '🔔 TFS Branch Push Test',
          body:  `Test notification for branch ${branchId} — push notifications working!`,
          data:  { type: 'test', branchId, timestamp: Date.now() },
        }))
      );

      result.sent    = true;
      result.results = sendResults.map((r, i) => ({
        token_end: tokenDocs[i].pushToken.slice(-12),
        status:    r.status,
      }));

      return NextResponse.json(result);
    }

    // Option 4: no params — send to first available token as smoke test
    const firstToken = await db.collection('push_tokens').findOne({});
    if (!firstToken) {
      result.sent  = false;
      result.error = 'No push tokens in database at all. No one has logged in with a device yet.';
      return NextResponse.json(result, { status: 404 });
    }

    result.method    = 'first_available_token';
    result.userId    = firstToken.userId ?? 'guest';
    result.token_end = firstToken.pushToken.slice(-12);

    await sendPushNotification(firstToken.pushToken, {
      title: '🔔 TFS Smoke Test',
      body:  'First available token — push notifications working!',
      data:  { type: 'smoke_test', timestamp: Date.now() },
    });

    result.sent = true;
    return NextResponse.json(result);

  } catch (err: any) {
    result.sent  = false;
    result.error = err.message;
    return NextResponse.json(result, { status: 500 });
  }
}