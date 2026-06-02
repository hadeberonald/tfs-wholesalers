'use client';

import { useState, useEffect } from 'react';
import {
  Check, X, Building2, Mail, Phone, MapPin, CreditCard,
  TrendingUp, AlertCircle, DollarSign, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WholesaleCustomer {
  _id: string;
  businessName: string;
  businessType: string;
  registrationNumber?: string;
  vatNumber?: string;
  contactPerson: string;
  email: string;
  phone: string;
  businessAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  verificationStatus: 'pending' | 'approved' | 'rejected';
  expectedAnnualSpend?: number;
  creditApproved?: boolean;
  creditLimit?: number;
  netTerms?: number;
  outstandingBalance?: number;
  blockedFromOrdering?: boolean;
}

interface Props {
  customer: WholesaleCustomer;
  creditThreshold: number; // from branch settings
  onClose: () => void;
  onSuccess: () => void;
}

const NET_TERMS_OPTIONS = [7, 14, 30, 60, 90];

export default function AdminVerifyCustomerModal({ customer, creditThreshold, onClose, onSuccess }: Props) {
  const [creditApproved, setCreditApproved] = useState(false);
  const [creditLimit, setCreditLimit] = useState(10000);
  const [netTerms, setNetTerms] = useState(30);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'details' | 'reject'>('details');

  // Auto-suggest credit based on expected spend vs threshold
  const qualifiesForCredit =
    customer.expectedAnnualSpend != null &&
    customer.expectedAnnualSpend >= creditThreshold;

  useEffect(() => {
    if (qualifiesForCredit) {
      setCreditApproved(true);
      // Suggest credit limit as ~20% of expected annual spend
      const suggested = Math.floor((customer.expectedAnnualSpend! * 0.2) / 1000) * 1000;
      setCreditLimit(Math.max(suggested, 5000));
    }
  }, [qualifiesForCredit, customer.expectedAnnualSpend]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wholesale/customers/${customer._id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus: 'approved',
          creditApproved,
          creditLimit: creditApproved ? creditLimit : 0,
          netTerms: creditApproved ? netTerms : null,
        }),
      });

      if (res.ok) {
        toast.success(`Customer approved${creditApproved ? ' with credit' : ''}`);
        onSuccess();
      } else {
        toast.error('Failed to approve customer');
      }
    } catch {
      toast.error('Failed to approve customer');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/wholesale/customers/${customer._id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus: 'rejected',
          rejectionReason,
        }),
      });

      if (res.ok) {
        toast.success('Customer rejected');
        onSuccess();
      } else {
        toast.error('Failed to reject customer');
      }
    } catch {
      toast.error('Failed to reject customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-brand-black">Customer Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Business Info */}
          <section>
            <h3 className="font-semibold text-brand-black mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Business Information
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <Row label="Business Name" value={customer.businessName} />
              <Row label="Type" value={customer.businessType} />
              {customer.registrationNumber && (
                <Row label="Registration" value={customer.registrationNumber} />
              )}
              {customer.vatNumber && <Row label="VAT Number" value={customer.vatNumber} />}
              {customer.expectedAnnualSpend != null && (
                <Row
                  label="Expected Annual Spend"
                  value={`R${customer.expectedAnnualSpend.toLocaleString()}`}
                  highlight
                />
              )}
            </div>
          </section>

          {/* Contact Info */}
          <section>
            <h3 className="font-semibold text-brand-black mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5" /> Contact Information
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <Row label="Contact Person" value={customer.contactPerson} />
              <Row label="Email" value={customer.email} />
              <Row label="Phone" value={customer.phone} />
            </div>
          </section>

          {/* Address */}
          <section>
            <h3 className="font-semibold text-brand-black mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Business Address
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm">
              <p>{customer.businessAddress.street}</p>
              <p>
                {customer.businessAddress.city}, {customer.businessAddress.province}{' '}
                {customer.businessAddress.postalCode}
              </p>
            </div>
          </section>

          {/* ── Credit Eligibility (only shown when pending or re-reviewing) ── */}
          {customer.verificationStatus === 'pending' && view === 'details' && (
            <section className="border-2 border-brand-orange rounded-xl p-5">
              <h3 className="font-semibold text-brand-black mb-1 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-orange" /> Credit Eligibility
              </h3>

              {/* Auto-suggest notice */}
              {customer.expectedAnnualSpend != null && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                    qualifiesForCredit
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}
                >
                  {qualifiesForCredit ? (
                    <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {qualifiesForCredit
                      ? `Expected spend R${customer.expectedAnnualSpend.toLocaleString()} meets the R${creditThreshold.toLocaleString()} threshold — credit pre-selected.`
                      : `Expected spend R${customer.expectedAnnualSpend.toLocaleString()} is below the R${creditThreshold.toLocaleString()} threshold. Credit not recommended.`}
                  </span>
                </div>
              )}

              {/* Toggle */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-brand-black">Approve for Credit</p>
                  <p className="text-xs text-gray-500">
                    Customer can order on account with net terms
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creditApproved}
                    onChange={(e) => setCreditApproved(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-orange rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange" />
                </label>
              </div>

              {creditApproved && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <DollarSign className="w-4 h-4 inline" /> Credit Limit (R)
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="w-4 h-4 inline" /> Net Terms (days)
                    </label>
                    <select
                      value={netTerms}
                      onChange={(e) => setNetTerms(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange focus:outline-none"
                    >
                      {NET_TERMS_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          Net {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {!creditApproved && (
                <p className="text-sm text-gray-500 mt-2">
                  Customer will pay via Paystack or EFT (proof of payment) only.
                </p>
              )}
            </section>
          )}

          {/* Rejection reason input */}
          {view === 'reject' && (
            <section className="border-2 border-red-300 rounded-xl p-5">
              <h3 className="font-semibold text-red-700 mb-3">Rejection Reason</h3>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this application is being rejected..."
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </section>
          )}

          {/* Actions */}
          {customer.verificationStatus === 'pending' && (
            <>
              {view === 'details' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {creditApproved ? 'Approve with Credit' : 'Approve (Cash/EFT only)'}
                  </button>
                  <button
                    onClick={() => setView('reject')}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Reject
                  </button>
                </div>
              )}

              {view === 'reject' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setView('details')}
                    className="flex-1 border border-gray-300 py-3 rounded-xl hover:bg-gray-50 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loading || !rejectionReason.trim()}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
                  >
                    Confirm Rejection
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-semibold ${highlight ? 'text-brand-orange' : 'text-brand-black'}`}>
        {value}
      </span>
    </div>
  );
}