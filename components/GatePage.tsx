'use client';

import { useState } from 'react';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

interface GatePageProps {
  onProceed: () => void;
}

export default function GatePage({ onProceed }: GatePageProps) {
  const [loading, setLoading] = useState(false);

  const handleProceed = () => {
    setLoading(true);
    setTimeout(() => {
      onProceed();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">

        {/* Status badge */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="inline-flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-mono text-amber-600 tracking-widest uppercase">
            Test Mode Active
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center">

          {/* Icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-brand-orange" />
          </div>

          <h1 className="text-3xl font-bold text-brand-black mb-3">
            Site Under Review
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            This site is currently in test mode and is not available to the
            general public. If you have authorised access, proceed below.
          </p>

          {/* Info rows */}
          <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left space-y-3">
            {[
              { label: 'Status', value: 'Maintenance mode' },
              { label: 'Access', value: 'Restricted' },
              { label: 'Environment', value: 'Staging / Test' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 font-mono">{label}</span>
                <span className="text-gray-700 font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Proceed button */}
          <button
            onClick={handleProceed}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-orange-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entering…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Proceed to Site
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          TFS Wholesalers · Internal Access Only
        </p>

      </div>
    </div>
  );
}