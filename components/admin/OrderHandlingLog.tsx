'use client';

import { useState, useEffect } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Loader2, ScanLine, Hand, PackageCheck,
  Truck, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';

type HandlingEventType =
  | 'item_picked_barcode'
  | 'item_picked_manual'
  | 'item_oos'
  | 'package_sealed'
  | 'package_collected'
  | 'delivery_started'
  | 'delivery_completed';

interface HandlingEvent {
  eventType:   HandlingEventType;
  actorId:     string;
  actorName:   string;
  actorRole:   'picker' | 'driver' | 'admin';
  itemSku?:    string;
  itemName?:   string;
  scanKey?:    string;
  packageQr?:  string;
  packageNum?: number;
  timestamp:   string;
  meta?:       Record<string, unknown>;
}

const EVENT_META: Record<HandlingEventType, {
  label:  string;
  Icon:   React.FC<LucideProps>;
  color:  string;
  bg:     string;
  border: string;
}> = {
  item_picked_barcode: {
    label:  'Scanned (barcode)',
    Icon:   ScanLine,
    color:  'text-emerald-700',
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
  },
  item_picked_manual: {
    label:  'Confirmed (manual)',
    Icon:   Hand,
    color:  'text-amber-700',
    bg:     'bg-amber-50',
    border: 'border-amber-200',
  },
  item_oos: {
    label:  'Out of Stock',
    Icon:   AlertTriangle,
    color:  'text-red-700',
    bg:     'bg-red-50',
    border: 'border-red-200',
  },
  package_sealed: {
    label:  'Package Sealed',
    Icon:   PackageCheck,
    color:  'text-violet-700',
    bg:     'bg-violet-50',
    border: 'border-violet-200',
  },
  package_collected: {
    label:  'Package Collected',
    Icon:   Truck,
    color:  'text-sky-700',
    bg:     'bg-sky-50',
    border: 'border-sky-200',
  },
  delivery_started: {
    label:  'Out for Delivery',
    Icon:   Truck,
    color:  'text-orange-700',
    bg:     'bg-orange-50',
    border: 'border-orange-200',
  },
  delivery_completed: {
    label:  'Delivered',
    Icon:   CheckCircle2,
    color:  'text-green-700',
    bg:     'bg-green-50',
    border: 'border-green-200',
  },
};

const ROLE_PILL: Record<string, string> = {
  picker: 'bg-blue-100 text-blue-700',
  driver: 'bg-purple-100 text-purple-700',
  admin:  'bg-gray-100 text-gray-600',
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-ZA', {
    day:    '2-digit',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function groupEvents(events: HandlingEvent[]) {
  const sections: { heading: string; events: HandlingEvent[] }[] = [];
  let currentHeading = '';

  for (const e of events) {
    const heading =
      e.eventType === 'item_picked_barcode' || e.eventType === 'item_picked_manual' || e.eventType === 'item_oos'
        ? `Picking — ${e.actorName}`
        : e.eventType === 'package_sealed'
        ? `Packaging — ${e.actorName}`
        : `Delivery — ${e.actorName}`;

    if (heading !== currentHeading) {
      sections.push({ heading, events: [e] });
      currentHeading = heading;
    } else {
      sections[sections.length - 1].events.push(e);
    }
  }

  return sections;
}

export default function OrderHandlingLog({ orderId }: { orderId: string }) {
  const [log, setLog]         = useState<HandlingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/orders/${orderId}/handling-log`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setLog(d.handlingLog ?? []))
      .catch(() => setError('Failed to load handling log'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading accountability log…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-red-500 text-sm">
        <XCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (log.length === 0) {
    return (
      <div className="py-6 text-center text-gray-400 text-sm">
        No handling events recorded yet.
      </div>
    );
  }

  const sections = groupEvents(log);

  const actors = Array.from(
    new Map(log.map(e => [e.actorId, { name: e.actorName, role: e.actorRole }])).values()
  );
  const barcodeCount = log.filter(e => e.eventType === 'item_picked_barcode').length;
  const manualCount  = log.filter(e => e.eventType === 'item_picked_manual').length;
  const oosCount     = log.filter(e => e.eventType === 'item_oos').length;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Accountability Log</h3>
        <span className="text-xs text-gray-400">{log.length} event{log.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {actors.map(a => (
          <span key={a.name} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_PILL[a.role]}`}>
            {a.role === 'picker' ? '🧺' : a.role === 'driver' ? '🚗' : '🛠'} {a.name}
          </span>
        ))}
        {barcodeCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ScanLine className="w-3 h-3" /> {barcodeCount} barcode
          </span>
        )}
        {manualCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Hand className="w-3 h-3" /> {manualCount} manual
          </span>
        )}
        {oosCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3 h-3" /> {oosCount} OOS
          </span>
        )}
      </div>

      <div className="space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{section.heading}</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
              {section.events.map((e, ei) => {
                const meta = EVENT_META[e.eventType] ?? EVENT_META['item_picked_manual'];
                const { Icon } = meta;
                return (
                  <div key={ei} className={`flex items-start gap-3 px-3 py-2.5 ${meta.bg}`}>
                    <div className={`mt-0.5 p-1 rounded-md border ${meta.border}`}>
                      <Icon size={13} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                        {e.itemName && (
                          <span className="text-xs text-gray-600 truncate max-w-[180px]" title={e.itemName}>
                            {e.itemName}
                          </span>
                        )}
                        {e.itemSku && (
                          <span className="text-xs text-gray-400">SKU: {e.itemSku}</span>
                        )}
                        {e.packageNum != null && (
                          <span className="text-xs text-gray-500">Pkg #{e.packageNum}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">{fmt(e.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}