// lib/sendPushNotification.ts
//
// ⚠️  BUILD FIX: Changed `@/lib/mongodb` → `./mongodb`
// When Render compiles this file via tsc directly (not through Next.js),
// the `@/` path alias is NOT resolved, causing:
//   error TS2307: Cannot find module '@/lib/mongodb'
// Using a relative import works in both contexts.

import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

// ─── Internal POS receipt address ────────────────────────────────────────────

const INTERNAL_ORDERS_EMAIL = 'salesnv@tfswholesalers.com';

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

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      '[Email] Missing SMTP env vars. Required: SMTP_HOST, SMTP_USER, SMTP_PASS'
    );
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

export async function verifyEmailTransport(): Promise<void> {
  try {
    const t = getTransporter();
    await t.verify();
    console.log('[Email] SMTP connection verified OK');
  } catch (err) {
    console.error('[Email] SMTP verification FAILED:', err);
  }
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<void> {
  try {
    const t    = getTransporter();
    const info = await t.sendMail({
      from:    '"TFS Wholesalers" <noreply@tfswholesalers.com>',
      to:      Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    });
    console.log('[Email] Sent OK — messageId:', info.messageId, '→', payload.to);
  } catch (err) {
    console.error('[Email] sendMail FAILED:', err);
  }
}

// ─── Email wrapper ────────────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a;background:#ffffff">
    <div style="background:#FF6B35;padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">TFS Wholesalers</h1>
    </div>
    <div style="padding:32px">${content}</div>
    <div style="background:#f5f5f5;padding:20px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee">
      © ${new Date().getFullYear()} TFS Wholesalers &nbsp;·&nbsp;
      <a href="mailto:enquiries@tfswholesalers.com" style="color:#999">enquiries@tfswholesalers.com</a>
    </div>
  </div>`;
}

// ─── Customer order confirmation email ───────────────────────────────────────

export function buildOrderConfirmationEmail(order: {
  orderNumber:       string;
  customerName:      string;
  customerEmail:     string;
  items:             { name: string; variantName?: string; quantity: number; price: number }[];
  total:             number;
  /** Delivery fee shown as its own line item. Pass 0 or omit to hide. */
  deliveryFee?:      number;
  deliveryAddress?:  string;
  phone?:            string;
  /** Till account number from the online_customers collection. */
  tillAccountNumber?: string;
}): EmailPayload {
  const fee      = order.deliveryFee ?? 0;
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const rows = order.items.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0">
        ${i.name}${i.variantName ? ` <span style="color:#888;font-size:13px">(${i.variantName})</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:#555">${i.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right">R${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('');

  // Subtotal + delivery rows — only rendered when there is a delivery fee to break out
  const subtotalRow = fee > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px 8px;text-align:right;font-size:13px;color:#888">Subtotal</td>
      <td style="padding:8px 8px;text-align:right;font-size:13px;color:#555">R${subtotal.toFixed(2)}</td>
    </tr>` : '';

  const deliveryRow = fee > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px 8px;text-align:right;font-size:13px;color:#888">Delivery Fee</td>
      <td style="padding:8px 8px;text-align:right;font-size:13px;color:#555">R${fee.toFixed(2)}</td>
    </tr>` : '';

  // Till account banner — only shown when the customer has a linked account
  const tillBanner = order.tillAccountNumber ? `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">🏷️ Your Till Account Number</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#15803d;font-family:monospace">${order.tillAccountNumber}</p>
    </div>` : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px">Order Confirmed ✅</h2>
    <p style="color:#555;margin:0 0 24px">Hi ${order.customerName}, we've received your order and it's being prepared.</p>
    <div style="background:#fff8f5;border:1px solid #ffe0d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#FF6B35">${order.orderNumber}</p>
    </div>
    ${tillBanner}
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
        ${subtotalRow}
        ${deliveryRow}
        <tr>
          <td colspan="2" style="padding:12px 8px;font-weight:700;text-align:right;font-size:15px">Total</td>
          <td style="padding:12px 8px;font-weight:700;text-align:right;font-size:15px;color:#FF6B35">R${order.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    ${order.deliveryAddress ? `<p style="margin:16px 0 4px;font-size:13px;color:#888">Delivering to</p><p style="margin:0;color:#333">${order.deliveryAddress}</p>` : ''}
    <p style="margin:24px 0 0;color:#888;font-size:13px">You'll receive an update each time your order status changes. Open the TFS app to track in real time.</p>
  `);

  return {
    to:      order.customerEmail,
    subject: `Order Confirmed — ${order.orderNumber}`,
    html,
    text: `Hi ${order.customerName}, your order ${order.orderNumber} has been confirmed. Total: R${order.total.toFixed(2)}.`,
  };
}

// ─── Internal POS receipt email ───────────────────────────────────────────────
// Sent to the store's online-orders inbox so staff can ring the order up on the
// POS system. Formatted for quick scanning: till account prominent at top,
// itemised list with quantities, delivery fee line item, customer contact details.

export function buildInternalReceiptEmail(order: {
  orderNumber:       string;
  customerName:      string;
  customerEmail:     string;
  phone?:            string;
  items:             { name: string; variantName?: string; quantity: number; price: number; sku?: string }[];
  total:             number;
  /** Delivery fee shown as its own line item. Pass 0 or omit to hide. */
  deliveryFee?:      number;
  deliveryAddress?:  string;
  branchName?:       string;
  /** Till account number from the online_customers collection. */
  tillAccountNumber?: string;
}): EmailPayload {
  const fee      = order.deliveryFee ?? 0;
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const rows = order.items.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px">
        <strong>${i.name}</strong>${i.variantName ? `<br><span style="color:#888;font-size:12px">${i.variantName}</span>` : ''}
        ${i.sku ? `<br><span style="color:#bbb;font-size:11px;font-family:monospace">SKU: ${i.sku}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:16px;font-weight:700;color:#FF6B35">×${i.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px">R${(i.price).toFixed(2)}<br><span style="color:#aaa;font-size:11px">each</span></td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600">R${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('');

  // Subtotal + delivery footer rows — only rendered when there is a delivery fee
  const deliveryFooterRows = fee > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 8px;text-align:right;font-size:13px;color:#888">Subtotal</td>
      <td style="padding:8px 8px;text-align:right;font-size:13px;color:#555">R${subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:8px 8px;text-align:right;font-size:13px;color:#888">Delivery Fee</td>
      <td style="padding:8px 8px;text-align:right;font-size:13px;color:#555">R${fee.toFixed(2)}</td>
    </tr>` : '';

  // Till account banner — large and prominent for quick POS lookup.
  // Shows a yellow warning if no account is linked yet.
  const tillBanner = order.tillAccountNumber
    ? `<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:11px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:1px">🏷️ Till Account Number — Use this on POS</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#15803d;font-family:'Courier New',monospace;letter-spacing:2px">${order.tillAccountNumber}</p>
       </div>`
    : `<div style="background:#fef9c3;border:1.5px solid #fde047;border-radius:10px;padding:14px 18px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#854d0e">
          ⚠️ <strong>No till account linked</strong> — visit the Online Customers page to add one for
          <strong>${order.customerEmail}</strong>.
        </p>
       </div>`;

  const html = emailWrapper(`
    <div style="background:#1a1a1a;color:#fff;border-radius:10px;padding:20px 24px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px">🛒 New Online Order — Ring Up on POS</p>
      <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:-1px;color:#FF6B35">${order.orderNumber}</p>
      ${order.branchName ? `<p style="margin:6px 0 0;font-size:12px;color:#888">Branch: ${order.branchName}</p>` : ''}
    </div>

    ${tillBanner}

    <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Customer Details</h3>
    <table style="width:100%;margin-bottom:24px;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;width:120px">Name</td>
        <td style="padding:6px 0;font-size:14px;font-weight:600">${order.customerName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888">Email</td>
        <td style="padding:6px 0;font-size:14px"><a href="mailto:${order.customerEmail}" style="color:#FF6B35">${order.customerEmail}</a></td>
      </tr>
      ${order.phone ? `<tr><td style="padding:6px 0;font-size:13px;color:#888">Phone</td><td style="padding:6px 0;font-size:14px">${order.phone}</td></tr>` : ''}
      ${order.deliveryAddress ? `<tr><td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top">Deliver to</td><td style="padding:6px 0;font-size:14px">${order.deliveryAddress}</td></tr>` : ''}
    </table>

    <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Items to Ring Up</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#f9f9f9">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Product</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Unit Price</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        ${deliveryFooterRows}
        <tr style="background:#fff8f5">
          <td colspan="3" style="padding:14px 8px;font-weight:700;text-align:right;font-size:16px">ORDER TOTAL</td>
          <td style="padding:14px 8px;font-weight:700;text-align:right;font-size:18px;color:#FF6B35">R${order.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="background:#fff8f5;border:2px solid #FF6B35;border-radius:8px;padding:14px 18px;margin-top:20px">
      <p style="margin:0;font-size:13px;color:#333">
        <strong>Action required:</strong> Ring up this order on the POS system using order reference
        <strong style="color:#FF6B35">${order.orderNumber}</strong>,
        then confirm in the admin portal so picking can begin.
      </p>
    </div>
  `);

  return {
    to:      INTERNAL_ORDERS_EMAIL,
    subject: `[POS] ${order.orderNumber}${order.tillAccountNumber ? ` | Acc: ${order.tillAccountNumber}` : ''} — ${order.customerName} — R${order.total.toFixed(2)}`,
    html,
    text: `NEW ONLINE ORDER: ${order.orderNumber}\n${order.tillAccountNumber ? `TILL ACCOUNT: ${order.tillAccountNumber}\n` : 'NO TILL ACCOUNT LINKED\n'}\nCustomer: ${order.customerName} <${order.customerEmail}>${order.phone ? ` | ${order.phone}` : ''}\n${order.deliveryAddress ? `Deliver to: ${order.deliveryAddress}\n` : ''}\nItems:\n${order.items.map(i => `  ${i.name}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity} @ R${i.price.toFixed(2)} = R${(i.price * i.quantity).toFixed(2)}`).join('\n')}\n${fee > 0 ? `\nDelivery Fee: R${fee.toFixed(2)}` : ''}\n\nTOTAL: R${order.total.toFixed(2)}\n\nPlease ring up on POS and confirm in the admin portal.`,
  };
}

// ─── Order status email (customer-facing) ────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; colour: string; message: string }> = {
  packaging:          { label: 'Being Packaged 📦',      colour: '#f59e0b', message: 'Your order is being carefully packed and will be ready for delivery soon.' },
  ready_for_delivery: { label: 'Ready for Delivery 🚀',  colour: '#3b82f6', message: 'Your order is packed and waiting for a driver.' },
  out_for_delivery:   { label: 'Out for Delivery 🚚',    colour: '#8b5cf6', message: 'Your order is on its way — keep an eye out for your delivery.' },
  collecting:         { label: 'Driver Collecting 🏃',   colour: '#6366f1', message: 'A driver is on their way to collect your order from our branch.' },
  delivered:          { label: 'Delivered ✅',            colour: '#22c55e', message: 'Your order has been delivered. Enjoy!' },
  cancelled:          { label: 'Order Cancelled ❌',      colour: '#ef4444', message: 'Your order has been cancelled. Contact us if you have any questions.' },
};

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
    <p style="color:#555;margin:0 0 24px">Hi ${order.customerName}, here's the latest on your order.</p>
    <div style="background:#fff8f5;border:1px solid #ffe0d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#FF6B35">${order.orderNumber}</p>
    </div>
    <div style="text-align:center;margin:32px 0">
      <div style="display:inline-block;background:${meta.colour};color:#fff;padding:14px 32px;border-radius:32px;font-size:17px;font-weight:700">${meta.label}</div>
    </div>
    <p style="text-align:center;color:#555;margin:0 0 24px">${meta.message}</p>
    <p style="text-align:center;color:#aaa;font-size:13px">Open the TFS app to track your order in real time.</p>
  `);

  return {
    to:      order.customerEmail,
    subject: `Your Order is ${meta.label} — ${order.orderNumber}`,
    html,
    text: `Hi ${order.customerName}, your order ${order.orderNumber} is now: ${meta.label}. ${meta.message}`,
  };
}

// ─── OOS Refund: customer-facing consolidated email ───────────────────────────
// Sent once when the picker advances to packaging, covering all OOS items
// in a single email rather than one per item.

export function buildOosRefundCustomerEmail(order: {
  orderNumber:   string;
  customerName:  string;
  customerEmail: string;
  oosItems:      { name: string; variantName?: string; quantity: number; price: number }[];
  refundTotal:   number;
}): EmailPayload {
  const itemCount = order.oosItems.length;

  const itemList = order.oosItems.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #fde8e8;font-size:14px">
        <strong>${i.name}</strong>${i.variantName ? `<br><span style="color:#999;font-size:12px">${i.variantName}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #fde8e8;text-align:center;font-size:14px;color:#888">×${i.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #fde8e8;text-align:right;font-size:14px;font-weight:600;color:#ef4444">R${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px">Oops&hellip; 😕</h2>
    <p style="color:#555;margin:0 0 24px">
      Hi ${order.customerName}, unfortunately we couldn't find the following
      product${itemCount > 1 ? 's' : ''} in stock for your order
      <strong style="color:#FF6B35">${order.orderNumber}</strong>:
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fff5f5;border-radius:8px;overflow:hidden;border:1px solid #fecaca">
      <thead>
        <tr style="background:#fee2e2">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Product</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Amount</th>
        </tr>
      </thead>
      <tbody>${itemList}</tbody>
    </table>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Refund Amount</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:#15803d">R${order.refundTotal.toFixed(2)}</p>
    </div>

    <p style="color:#444;margin:0 0 12px;font-size:15px;line-height:1.6">
      But don't worry — a refund of <strong>R${order.refundTotal.toFixed(2)}</strong> is being processed
      and will reflect in your account once it's been finalised.
    </p>
    <p style="color:#888;font-size:13px;margin:0 0 24px;line-height:1.6">
      The rest of your order is being prepared as normal and will be on its way to you shortly.
      You'll receive another update when it's out for delivery.
    </p>
    <p style="color:#aaa;font-size:13px;margin:0">Open the TFS app to track your order in real time.</p>
  `);

  return {
    to:      order.customerEmail,
    subject: `Refund Processing — ${order.orderNumber}`,
    html,
    text: `Hi ${order.customerName},\n\nUnfortunately we couldn't find the following product${itemCount > 1 ? 's' : ''} in stock for order ${order.orderNumber}:\n\n${order.oosItems.map(i => `  - ${i.name}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity} = R${(i.price * i.quantity).toFixed(2)}`).join('\n')}\n\nA refund of R${order.refundTotal.toFixed(2)} is being processed and will reflect in your account once finalised. The rest of your order is on its way.`,
  };
}

// ─── OOS Refund: internal staff consolidated email ────────────────────────────
// Sent to the internal orders inbox when picking advances to packaging.
// Mirrors the POS receipt style so staff can quickly identify and action it.

export function buildOosRefundInternalEmail(order: {
  orderNumber:    string;
  customerName:   string;
  customerEmail:  string;
  phone?:         string;
  oosItems:       { name: string; variantName?: string; sku?: string; quantity: number; price: number }[];
  refundTotal:    number;
  branchName?:    string;
  paymentMethod?: string;
  paymentRef?:    string;
}): EmailPayload {
  const rows = order.oosItems.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px">
        <strong>${i.name}</strong>${i.variantName ? `<br><span style="color:#888;font-size:12px">${i.variantName}</span>` : ''}
        ${i.sku ? `<br><span style="color:#bbb;font-size:11px;font-family:monospace">SKU: ${i.sku}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:16px;font-weight:700;color:#ef4444">×${i.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px">R${i.price.toFixed(2)}<br><span style="color:#aaa;font-size:11px">each</span></td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600">R${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const html = emailWrapper(`
    <div style="background:#1a1a1a;color:#fff;border-radius:10px;padding:20px 24px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px">⚠️ OOS Refund — ${order.orderNumber}</p>
      <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:-1px;color:#ef4444">R${order.refundTotal.toFixed(2)}</p>
      ${order.branchName ? `<p style="margin:6px 0 0;font-size:12px;color:#888">Branch: ${order.branchName}</p>` : ''}
    </div>

    <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Customer</h3>
    <table style="width:100%;margin-bottom:24px;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;width:120px">Name</td>
        <td style="padding:6px 0;font-size:14px;font-weight:600">${order.customerName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888">Email</td>
        <td style="padding:6px 0;font-size:14px"><a href="mailto:${order.customerEmail}" style="color:#FF6B35">${order.customerEmail}</a></td>
      </tr>
      ${order.phone ? `<tr><td style="padding:6px 0;font-size:13px;color:#888">Phone</td><td style="padding:6px 0;font-size:14px">${order.phone}</td></tr>` : ''}
      ${order.paymentMethod ? `<tr><td style="padding:6px 0;font-size:13px;color:#888">Payment</td><td style="padding:6px 0;font-size:14px;text-transform:capitalize">${order.paymentMethod}</td></tr>` : ''}
      ${order.paymentRef ? `<tr><td style="padding:6px 0;font-size:13px;color:#888">Ref</td><td style="padding:6px 0;font-size:12px;font-family:monospace;color:#555">${order.paymentRef}</td></tr>` : ''}
    </table>

    <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Out-of-Stock Items</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#fff1f1">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Product</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Unit Price</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase">Refund</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#fff1f1">
          <td colspan="3" style="padding:14px 8px;font-weight:700;text-align:right;font-size:16px">REFUND TOTAL</td>
          <td style="padding:14px 8px;font-weight:700;text-align:right;font-size:18px;color:#ef4444">R${order.refundTotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="background:#fff1f1;border:2px solid #ef4444;border-radius:8px;padding:14px 18px;margin-top:20px">
      <p style="margin:0;font-size:13px;color:#333">
        <strong>Action required:</strong> Verify the Paystack refund of
        <strong style="color:#ef4444">R${order.refundTotal.toFixed(2)}</strong>
        has been issued successfully. Update the refund status${order.paymentRef ? ` for ref <strong>${order.paymentRef}</strong>` : ''} in the admin portal once confirmed.
      </p>
    </div>
  `);

  return {
    to:      INTERNAL_ORDERS_EMAIL,
    subject: `[Refund] OOS — ${order.orderNumber} — R${order.refundTotal.toFixed(2)}`,
    html,
    text: `OOS REFUND — ${order.orderNumber}\n\nCustomer: ${order.customerName} <${order.customerEmail}>${order.phone ? ` | ${order.phone}` : ''}\nPayment: ${order.paymentMethod ?? 'unknown'}${order.paymentRef ? ` | Ref: ${order.paymentRef}` : ''}\n\nOut-of-stock items:\n${order.oosItems.map(i => `  - ${i.name}${i.variantName ? ` (${i.variantName})` : ''}${i.sku ? ` [${i.sku}]` : ''} x${i.quantity} @ R${i.price.toFixed(2)} = R${(i.price * i.quantity).toFixed(2)}`).join('\n')}\n\nREFUND TOTAL: R${order.refundTotal.toFixed(2)}\n\nVerify Paystack refund and update admin portal.`,
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
    const result = json?.data;
    if (result?.status === 'error') {
      console.error(`[Push] Expo error (token …${expoPushToken.slice(-8)}):`, result.message, result.details ?? '');
    } else {
      console.log(`[Push] Sent OK to …${expoPushToken.slice(-8)}`);
    }
  } catch (err) {
    console.error('[Push] sendPushNotification network error:', err);
  }
}

// ─── Push: all staff (pickers/delivery/admin) at a branch ────────────────────
//
// FIX: now filters push_tokens by appType: 'staff' so customer-app tokens
// registered by the same userId are never targeted by branch/staff notifications.

export async function notifyBranchPickers(
  branchId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

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

    const userIds = branchUsers.map(u => u._id.toString());
    console.log(`[Push] Found ${userIds.length} staff for branch ${branchId}:`, userIds);

    const tokenDocs = await db.collection('push_tokens').find(
      { userId: { $in: userIds }, appType: 'staff' }
    ).toArray();

    console.log(`[Push] Found ${tokenDocs.length} staff push tokens for branch ${branchId}`);

    if (!tokenDocs.length) {
      console.warn(
        `[Push] notifyBranchPickers: no staff-app tokens found. ` +
        `Make sure the picker app sends appType:'staff' when registering. Staff IDs:`, userIds
      );
      return;
    }

    await Promise.allSettled(
      tokenDocs.map(doc => sendPushNotification(doc.pushToken, payload))
    );

    console.log(`[Push] Notified ${tokenDocs.length} staff devices at branch ${branchId}`);
  } catch (err) {
    console.error('[Push] notifyBranchPickers failed:', err);
  }
}

// ─── Push: specific user by userId — customer-app devices only ───────────────
//
// FIX: was using findOne — only one device notified.
// Now uses find() AND filters by appType: 'customer' so staff-app tokens
// registered by the same userId are never targeted by customer notifications.
// Also skips "guest" tokens that were never linked to a real userId.

export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!userId || userId === 'guest') {
    console.warn(`[Push] notifyUser: skipping invalid userId "${userId}"`);
    return;
  }

  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const tokenDocs = await db.collection('push_tokens').find(
      { userId, appType: 'customer' }
    ).toArray();

    if (!tokenDocs.length) {
      console.warn(`[Push] notifyUser: no customer-app tokens for userId ${userId}`);
      return;
    }

    console.log(`[Push] notifyUser: found ${tokenDocs.length} customer token(s) for userId ${userId}`);

    await Promise.allSettled(
      tokenDocs.map(doc => sendPushNotification(doc.pushToken, payload))
    );

    console.log(`[Push] Notified user ${userId} on ${tokenDocs.length} device(s)`);
  } catch (err) {
    console.error('[Push] notifyUser failed:', err);
  }
}