// lib/sendPushNotification.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body:  string;
  data?: Record<string, any>;
}

export interface EmailPayload {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
}

// ─── Nodemailer transport ─────────────────────────────────────────────────────
// Required env vars in Render dashboard:
//   SMTP_HOST  → e.g. mail.tfswholesalers.com (cPanel) or smtp.sendgrid.net
//   SMTP_PORT  → 587 for STARTTLS, 465 for SSL
//   SMTP_USER  → noreply@tfswholesalers.com
//   SMTP_PASS  → mailbox password or API key
//
// To find cPanel values: cPanel → Email Accounts → your address → Connect Devices

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true = SSL, false = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Email sender ─────────────────────────────────────────────────────────────

export async function sendTransactionalEmail(payload: EmailPayload): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from:    '"TFS Wholesalers" <noreply@tfswholesalers.com>',
      to:      Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    });
    console.log('[Email] Sent:', info.messageId, '→', payload.to);
  } catch (err) {
    // Never throws — email failure must NEVER crash the order flow
    console.error('[Email] Failed to send:', err);
  }
}

// ─── Shared email wrapper ─────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a;background:#ffffff">
    <div style="background:#FF6B35;padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">
        TFS Wholesalers
      </h1>
    </div>
    <div style="padding:32px">
      ${content}
    </div>
    <div style="background:#f5f5f5;padding:20px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee">
      © ${new Date().getFullYear()} TFS Wholesalers &nbsp;·&nbsp;
      <a href="mailto:support@tfswholesalers.com" style="color:#999">support@tfswholesalers.com</a>
    </div>
  </div>`;
}

// ─── Template: order confirmed ────────────────────────────────────────────────

export function buildOrderConfirmationEmail(order: {
  orderNumber:     string;
  customerName:    string;
  customerEmail:   string;
  items:           { name: string; variantName?: string; quantity: number; price: number }[];
  total:           number;
  deliveryAddress?: string;
}): EmailPayload {
  const rows = order.items.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0">
        ${i.name}${i.variantName
          ? ` <span style="color:#888;font-size:13px">(${i.variantName})</span>`
          : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:#555">
        ${i.quantity}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right">
        R${(i.price * i.quantity).toFixed(2)}
      </td>
    </tr>`).join('');

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px">Order Confirmed</h2>
    <p style="color:#555;margin:0 0 24px">
      Hi ${order.customerName}, we've received your order and it's being prepared.
    </p>

    <div style="background:#fff8f5;border:1px solid #ffe0d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#FF6B35">${order.orderNumber}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#f9f9f9">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Item</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 8px;font-weight:700;text-align:right;font-size:15px">Total</td>
          <td style="padding:12px 8px;font-weight:700;text-align:right;font-size:15px;color:#FF6B35">
            R${order.total.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>

    ${order.deliveryAddress ? `
    <p style="margin:16px 0 4px;font-size:13px;color:#888">Delivering to</p>
    <p style="margin:0;color:#333">${order.deliveryAddress}</p>
    ` : ''}

    <p style="margin:24px 0 0;color:#888;font-size:13px">
      You'll receive an update each time your order status changes.
      Open the TFS app to track in real time.
    </p>
  `);

  return {
    to:      order.customerEmail,
    subject: `Order Confirmed — ${order.orderNumber}`,
    html,
    text: `Hi ${order.customerName}, your order ${order.orderNumber} has been confirmed. Total: R${order.total.toFixed(2)}.`,
  };
}

// ─── Template: status update ──────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; colour: string; message: string }> = {
  packaging: {
    label:   'Being Packaged ',
    colour:  '#f59e0b',
    message: 'Your order is being carefully packed and will be ready for delivery soon.',
  },
  ready_for_delivery: {
    label:   'Ready for Delivery',
    colour:  '#3b82f6',
    message: 'Your order is packed and waiting for a driver.',
  },
  out_for_delivery: {
    label:   'Out for Delivery',
    colour:  '#8b5cf6',
    message: 'Your order is on its way — keep an eye out for your delivery.',
  },
  collecting: {
    label:   'Driver Collecting',
    colour:  '#6366f1',
    message: 'A driver is on their way to collect your order from our branch.',
  },
  delivered: {
    label:   'Delivered',
    colour:  '#22c55e',
    message: 'Your order has been delivered. Enjoy!',
  },
  cancelled: {
    label:   'Order Cancelled',
    colour:  '#ef4444',
    message: 'Your order has been cancelled. Contact us if you have any questions.',
  },
};

// Returns null for internal-only statuses (pending, confirmed, picking) — no email sent
export function buildOrderStatusEmail(order: {
  orderNumber:   string;
  customerName:  string;
  customerEmail: string;
  status:        string;
}): EmailPayload | null {
  const meta = STATUS_MAP[order.status];
  if (!meta) return null;

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px">Order Update</h2>
    <p style="color:#555;margin:0 0 24px">
      Hi ${order.customerName}, here's the latest on your order.
    </p>

    <div style="background:#fff8f5;border:1px solid #ffe0d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#FF6B35">${order.orderNumber}</p>
    </div>

    <div style="text-align:center;margin:32px 0">
      <div style="display:inline-block;background:${meta.colour};color:#fff;padding:14px 32px;border-radius:32px;font-size:17px;font-weight:700">
        ${meta.label}
      </div>
    </div>

    <p style="text-align:center;color:#555;margin:0 0 24px">${meta.message}</p>
    <p style="text-align:center;color:#aaa;font-size:13px">
      Open the TFS app to track your order in real time.
    </p>
  `);

  return {
    to:      order.customerEmail,
    subject: `Your Order is ${meta.label} — ${order.orderNumber}`,
    html,
    text: `Hi ${order.customerName}, your order ${order.orderNumber} is now: ${meta.label}. ${meta.message}`,
  };
}

// ─── Push: single Expo token ──────────────────────────────────────────────────

export async function sendPushNotification(
  expoPushToken: string,
  payload: PushPayload
): Promise<void> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to:       expoPushToken,
        title:    payload.title,
        body:     payload.body,
        data:     payload.data ?? {},
        sound:    'default',
        priority: 'high',
      }),
    });

    const json = await res.json().catch(() => null);
    // Expo wraps single-send responses in { data: { status, message, details } }
    const result = json?.data;
    if (result?.status === 'error') {
      console.error(
        `[Push] Expo error (token …${expoPushToken.slice(-8)}):`,
        result.message,
        result.details ?? ''
      );
    }
  } catch (err) {
    console.error('[Push] sendPushNotification network error:', err);
  }
}

// ─── Push: all pickers/delivery/admin at a branch ────────────────────────────

export async function notifyBranchPickers(
  branchId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // activeBranchId may be stored as ObjectId OR plain string — handle both
    let branchObjId: ObjectId | null = null;
    try { branchObjId = new ObjectId(branchId); } catch { /* non-ObjectId string */ }

    const branchQuery = branchObjId
      ? { $or: [{ activeBranchId: branchObjId }, { activeBranchId: branchId }] }
      : { activeBranchId: branchId };

    const branchUsers = await db.collection('users').find(
      { ...branchQuery, role: { $in: ['picker', 'delivery', 'admin'] } },
      { projection: { _id: 1 } }
    ).toArray();

    if (!branchUsers.length) {
      console.warn(`[Push] notifyBranchPickers: no staff found for branch ${branchId}`);
      return;
    }

    // push_tokens.userId is always stored as a plain string (set by push-token route)
    const userIds = branchUsers.map(u => u._id.toString());

    const tokenDocs = await db.collection('push_tokens').find(
      { userId: { $in: userIds } }
    ).toArray();

    if (!tokenDocs.length) {
      console.warn(`[Push] notifyBranchPickers: staff found but no tokens registered for branch ${branchId}`);
      return;
    }

    await Promise.allSettled(
      tokenDocs.map(doc => sendPushNotification(doc.pushToken, payload))
    );

    console.log(`[Push] Notified ${tokenDocs.length} staff at branch ${branchId}`);
  } catch (err) {
    console.error('[Push] notifyBranchPickers failed:', err);
  }
}

// ─── Push: specific user by userId ───────────────────────────────────────────

export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // userId in push_tokens is always a plain string
    const tokenDoc = await db.collection('push_tokens').findOne({ userId });
    if (!tokenDoc?.pushToken) {
      console.warn(`[Push] notifyUser: no token for userId ${userId}`);
      return;
    }

    await sendPushNotification(tokenDoc.pushToken, payload);
    console.log(`[Push] Notified user ${userId}`);
  } catch (err) {
    console.error('[Push] notifyUser failed:', err);
  }
}