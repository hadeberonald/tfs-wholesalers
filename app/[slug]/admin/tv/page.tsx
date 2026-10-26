'use client';
/**
 * app/[slug]/admin/tv/page.tsx
 *
 * Live order board for a wall-mounted TV.
 *  - Real-time via the existing Socket.IO server (join:branch / order:updated)
 *  - Polls /api/orders every 15s as a safety net (new orders from POST
 *    /api/orders don't emit a socket event, so polling is what picks those up)
 *  - Covers the whole admin layout with a fixed overlay, so no sidebar/header
 *  - Shows first name + last initial only: no phone, email or address on a
 *    screen customers may be able to see
 *
 * Requires `socket.io-client` in the web app (npm i socket.io-client).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import RoleGuard from '@/components/RoleGuard';

// ── Tweakables ───────────────────────────────────────────────────────────────
const POLL_MS             = 15_000;  // refetch interval
const TICK_MS             = 20_000;  // how often the "waiting for" timers refresh
const MAX_PER_COLUMN      = 6;       // cards shown per column before "+N more"
const DELIVERED_WINDOW_MIN = 60;     // how long delivered orders stay on the board
const BRAND               = '#FF6B35';

// ── Types ────────────────────────────────────────────────────────────────────
interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  branchId?: string;
  customerInfo?: { name?: string };
  customerName?: string;
  items?: unknown[];
  packages?: unknown[];
  collectedPackages?: string[];
  assignedPickerName?: string;
  assignedDriverName?: string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
}

interface Column {
  key: string;
  title: string;
  statuses: string[];
  accent: string;
  /** Turn the timer amber/red when orders sit here too long */
  escalate?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'pick',      title: 'To pick',            statuses: ['pending', 'confirmed'],               accent: '#f59e0b', escalate: true },
  { key: 'packing',   title: 'Picking & packing',  statuses: ['picking', 'packaging'],               accent: '#38bdf8', escalate: true },
  { key: 'collect',   title: 'Ready for driver',   statuses: ['collecting', 'ready_for_delivery'],   accent: '#a78bfa' },
  { key: 'out',       title: 'Out for delivery',   statuses: ['out_for_delivery'],                   accent: BRAND },
  { key: 'delivered', title: 'Delivered',          statuses: ['delivered'],                          accent: '#34d399' },
];

const STATUS_TAG: Record<string, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  picking: 'Picking',
  packaging: 'Packing',
  collecting: 'Collecting',
  ready_for_delivery: 'Ready',
  out_for_delivery: 'On the road',
  delivered: 'Delivered',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// Last 6 digits of ORD-<timestamp> — readable from across the room.
const shortNumber = (n: string) => '#' + n.replace(/\D/g, '').slice(-6);

function displayName(o: Order): string {
  const full = (o.customerInfo?.name || o.customerName || '').trim();
  if (!full) return 'Customer';
  const parts = full.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

const doneTime = (o: Order) => o.deliveredAt || o.updatedAt || o.createdAt;

const minutesSince = (iso: string | undefined, now: number) =>
  iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000)) : 0;

const fmtAge = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

// ── Small components ─────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!t) return null;
  return (
    <div className="text-right leading-tight">
      <div className="text-3xl font-bold tabular-nums">
        {t.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-sm text-slate-400">
        {t.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    </div>
  );
}

function OrderCard({ order, col, now }: { order: Order; col: Column; now: number }) {
  const isDelivered = col.key === 'delivered';
  const age    = minutesSince(isDelivered ? doneTime(order) : order.createdAt, now);
  const urgent = !!col.escalate && age >= 30;
  const ageColor =
    col.escalate && age >= 30 ? 'text-red-400'
    : col.escalate && age >= 15 ? 'text-amber-300'
    : 'text-slate-300';

  const staff =
    order.status === 'picking' || order.status === 'packaging'
      ? order.assignedPickerName
      : order.assignedDriverName;

  const pkgTotal = order.packages?.length ?? 0;
  const pkgDone  = order.collectedPackages?.length ?? 0;
  const itemCount = order.items?.length ?? 0;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        urgent ? 'border-red-500/70 bg-red-950/40' : 'border-slate-700/80 bg-slate-800/70'
      }`}
      style={{ borderLeftColor: col.accent, borderLeftWidth: '0.4rem' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-extrabold tracking-tight text-white">{shortNumber(order.orderNumber)}</span>
        <span className={`text-xl font-bold tabular-nums ${ageColor}`}>
          {fmtAge(age)}{isDelivered ? ' ago' : ''}
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-slate-400">
        <span className="truncate">{displayName(order)}</span>
        <span className="shrink-0">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: col.accent + '33', color: col.accent }}
        >
          {STATUS_TAG[order.status] ?? order.status}
        </span>
        {staff && <span className="truncate text-slate-300">{staff}</span>}
        {order.status === 'collecting' && pkgTotal > 0 && (
          <span className="ml-auto shrink-0 tabular-nums text-slate-300">{pkgDone}/{pkgTotal} packages</span>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function TvDisplay() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string | undefined);

  const [orders, setOrders]             = useState<Order[]>([]);
  const [branch, setBranch]             = useState<{ _id: string; name: string } | null>(null);
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [now, setNow]                   = useState(() => Date.now());
  const [socketUp, setSocketUp]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [synced, setSynced]             = useState(false);

  // Scale the whole UI with screen width so it reads from across a room on
  // 1080p and 4K alike. Restored when leaving the page.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.fontSize;
    root.style.fontSize = 'clamp(14px, 1.1vw, 44px)';
    return () => { root.style.fontSize = prev; };
  }, []);

  // Keep the TV awake.
  useEffect(() => {
    let lock: any = null;
    const request = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* unsupported */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, []);

  // Fullscreen on "F"
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'f') toggleFullscreen(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  // Resolve the branch from the URL slug
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/branches');
        if (res.ok) {
          const data = await res.json();
          const match = (data.branches || []).find((b: any) => b.slug === slug);
          if (match && !cancelled) {
            setBranch({ _id: String(match._id), name: match.displayName || match.name || String(slug) });
          }
        }
      } catch { /* fall through to "all branches" */ }
      finally { if (!cancelled) setBranchLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const fetchOrders = useCallback(async () => {
    try {
      // `tv=true` is optional: ignored by the API until you add the small
      // filter from the notes, at which point only live orders are returned.
      const res = await fetch('/api/orders?all=true&tv=true', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setError('Signed out or no access. Log in again on this screen.');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setOrders(data.orders || []);
      setError(null);
      setSynced(true);
    } catch {
      setError('Connection problem. Retrying…');
    }
  }, []);

  // Polling + timer refresh
  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchOrders]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // Real-time updates
  useEffect(() => {
    const branchId = branch?._id;
    if (!branchId) return;

    const socket: Socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setSocketUp(true);
      socket.emit('join:branch', { branchId });
      fetchOrders(); // catch anything missed while disconnected
    });
    socket.on('disconnect', () => setSocketUp(false));

    socket.on('order:updated', ({ order }: { order: Order }) => {
      if (!order?._id) return;
      setNow(Date.now());
      setOrders(prev => {
        // Moved to another branch → drop it
        if (order.branchId && String(order.branchId) !== branchId) {
          return prev.filter(o => o._id !== order._id);
        }
        const i = prev.findIndex(o => o._id === order._id);
        if (i === -1) return [order, ...prev];
        const next = prev.slice();
        next[i] = { ...prev[i], ...order };
        return next;
      });
    });

    return () => { socket.disconnect(); };
  }, [branch?._id, fetchOrders]);

  const grouped = useMemo(() => {
    const mine = orders.filter(o => !branch || !o.branchId || String(o.branchId) === branch._id);
    const cutoff = now - DELIVERED_WINDOW_MIN * 60_000;

    return COLUMNS.map(col => {
      let list = mine.filter(o => col.statuses.includes(o.status));
      if (col.key === 'delivered') {
        list = list
          .filter(o => new Date(doneTime(o)).getTime() >= cutoff)
          .sort((a, b) => new Date(doneTime(b)).getTime() - new Date(doneTime(a)).getTime());
      } else {
        // Oldest first — whoever has waited longest is at the top
        list = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      return { col, list };
    });
  }, [orders, branch, now]);

  const activeCount = grouped
    .filter(g => g.col.key !== 'delivered')
    .reduce((sum, g) => sum + g.list.length, 0);

  const ready = branchLoaded && synced;

  const pill = error
    ? { label: 'Offline', cls: 'bg-red-500/20 text-red-300', dot: 'bg-red-400' }
    : socketUp
      ? { label: 'Live', cls: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400' }
      : { label: 'Refreshing every 15s', cls: 'bg-amber-500/20 text-amber-300', dot: 'bg-amber-400' };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-extrabold">{branch?.name ?? 'All branches'}</h1>
          <span className="text-lg text-slate-400">{activeCount} active {activeCount === 1 ? 'order' : 'orders'}</span>
        </div>
        <div className="flex items-center gap-6">
          <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${pill.cls}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${pill.dot}`} />
            {pill.label}
          </span>
          <Clock />
          <button
            onClick={toggleFullscreen}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 opacity-40 hover:opacity-100"
            title="Toggle fullscreen (F)"
          >
            Fullscreen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/90 px-6 py-2 text-center text-lg font-semibold">{error}</div>
      )}

      {/* Board */}
      {!ready ? (
        <div className="flex flex-1 items-center justify-center text-2xl text-slate-500">
          {error ?? 'Loading orders…'}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-4 p-4">
          {grouped.map(({ col, list }) => {
            const visible = list.slice(0, MAX_PER_COLUMN);
            const hidden  = list.length - visible.length;
            return (
              <section key={col.key} className="flex min-h-0 flex-col rounded-2xl bg-slate-900/60 ring-1 ring-slate-800">
                <header
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `0.2rem solid ${col.accent}` }}
                >
                  <h2 className="text-xl font-bold">{col.title}</h2>
                  <span
                    className="rounded-full px-3 py-0.5 text-xl font-extrabold text-slate-950"
                    style={{ backgroundColor: col.accent }}
                  >
                    {list.length}
                  </span>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3">
                  {list.length === 0 ? (
                    <p className="m-auto text-lg text-slate-600">Nothing here</p>
                  ) : (
                    visible.map(o => <OrderCard key={o._id} order={o} col={col} now={now} />)
                  )}
                  {hidden > 0 && (
                    <p className="pt-1 text-center text-base font-semibold text-slate-400">+{hidden} more</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard routeKey="orders">
      <TvDisplay />
    </RoleGuard>
  );
}