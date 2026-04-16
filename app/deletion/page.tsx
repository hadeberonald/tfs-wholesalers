'use client';

import Link from 'next/link';
import { ArrowLeft, Trash2, UserX, Mail, Phone, CheckCircle } from 'lucide-react';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/support" className="p-2 rounded-xl hover:bg-gray-100 transition-colors -ml-2">
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-brand-orange" />
            <h1 className="text-lg font-semibold text-brand-black">Data Deletion Request</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* Intro */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            At <span className="font-semibold text-brand-black">TFS Wholesalers</span>, you have the right to request deletion of your personal data at any time. You can do this directly in the app or by contacting our support team.
          </p>
        </div>

        {/* Delete via App */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <UserX className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">Delete Your Account In-App</h2>
          </div>

          <div className="px-5 py-4">
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              The quickest way to delete your account and all associated data is directly through the app:
            </p>

            {[
              { step: '1', label: 'Open the TFS Wholesalers app' },
              { step: '2', label: 'Tap the Profile tab from the menu' },
              { step: '3', label: 'Navigate to your Profile' },
              { step: '4', label: 'Scroll down and tap Delete Account' },
              { step: '5', label: 'Confirm your decision when prompted' },
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center gap-3 mb-3 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{step}</span>
                </div>
                <p className="text-sm text-brand-black">{label}</p>
              </div>
            ))}
          </div>

          <div className="mx-5 mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs text-orange-700 leading-relaxed">
              <span className="font-semibold">Please note:</span> Deleting your account is permanent and cannot be undone. Your order history, saved addresses, and payment methods will all be removed.
            </p>
          </div>
        </div>

        {/* What gets deleted */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">What Gets Deleted</h2>
          </div>
          {[
            ['Your account & profile', 'Name, email address, and phone number.'],
            ['Order history', 'All past orders associated with your account.'],
            ['Saved addresses', 'Any delivery addresses you have stored.'],
            ['Payment methods', 'Saved card tokens are revoked via Paystack.'],
            ['App preferences', 'Any in-app settings linked to your account.'],
          ].map(([title, text], i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-100 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-500 leading-relaxed">
                <span className="font-medium text-brand-black">{title}: </span>{text}
              </p>
            </div>
          ))}
        </div>

        {/* Retention note */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-brand-black mb-2">Data Retention After Deletion</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Upon deletion, your personal data is removed from our systems within <span className="font-medium text-brand-black">30 days</span>. Some data may be retained for a limited period where required by law, such as financial transaction records for tax and audit purposes. This data is stored securely and not used for any other purpose.
          </p>
        </div>

        {/* Request via contact */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">Request via Support</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              If you are unable to delete your account in the app, or if you wish to request deletion of specific data only, please contact our support team directly:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Mail className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-brand-black">support@tfswholesalers.co.za</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Phone className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-medium text-brand-black">034 981 3210</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Please include your registered email address and full name in your request. We will process your request within 7 business days and confirm via email once complete.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}