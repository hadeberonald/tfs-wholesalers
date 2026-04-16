'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Phone, Mail, Clock, Calendar, ChevronDown, Shield, FileText, Trash2, ChevronRight } from 'lucide-react';

const faqs = [
  {
    q: 'How do I track my order?',
    a: 'The app shows the live status of your order in real time. Go to Account → My Orders to see where your order is at any stage of the process.',
  },
  {
    q: 'What is the delivery fee?',
    a: 'Your delivery fee is automatically calculated based on how far you are from our store. You will see the exact fee displayed on the map before you confirm your order.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept all major credit and debit cards securely processed through Paystack (Visa, Mastercard). Simply enter your card details at checkout.',
  },
  {
    q: "I didn't receive my order confirmation email.",
    a: "Please check your spam or junk folder first. If it's not there, confirm your email address is correct under Account → Profile. You can also contact our support team for escalation.",
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200 px-4 py-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange rounded-2xl mb-4">
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-brand-black mb-2">TFS Wholesalers</h1>
        <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
          Support Centre — we're here to help with your orders, account, and delivery.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <span className="text-brand-orange font-bold text-sm">?</span>
            </div>
            <h2 className="text-base font-semibold text-brand-black">Frequently Asked Questions</h2>
          </div>

          {faqs.map((item, i) => (
            <div
              key={i}
              className="border-b border-gray-100 last:border-0 cursor-pointer"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="text-sm font-medium text-brand-black leading-snug">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                />
              </div>
              {openIndex === i && (
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed -mt-1">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">Contact Us</h2>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-brand-black">034 981 3210</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Email Support</p>
                <p className="text-sm font-medium text-brand-black">support@tfswholesalers.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Response Time</p>
                <p className="text-sm font-medium text-brand-black">Within 24 hours</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Support Hours</p>
                <p className="text-sm font-medium text-brand-black">Mon–Sat, 8am–5pm</p>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">Delivery Information</h2>
          </div>
          {[
            ['Delivery fee', 'Automatically calculated at checkout based on your distance from the store.'],
            ['Live tracking', 'The mobile app shows the live status of your order throughout the entire process.'],
            ['Delivery notes', 'Add gate codes or directions in the notes field to help our driver find you.'],
            ['Failed delivery', 'Our driver will attempt to contact you before returning an undelivered order.'],
            ['Refunds', 'Refunds for failed or incorrect orders are processed within 3–5 business days via Paystack.'],
          ].map(([title, text], i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-100 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-500 leading-relaxed">
                <span className="font-medium text-brand-black">{title}: </span>{text}
              </p>
            </div>
          ))}
        </div>

        {/* Legal Links */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="text-base font-semibold text-brand-black">Legal & Privacy</h2>
          </div>
          {[
            { label: 'Privacy Policy', href: '/privacy', icon: Shield },
            { label: 'Terms of Service', href: '/terms', icon: FileText },
            { label: 'Data Deletion Request', href: '/deletion', icon: Trash2 },
          ].map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-brand-orange" />
                <span className="text-sm font-medium text-brand-black">{label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          ))}
        </div>

        {/* Version */}
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">App Version</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-brand-black">1.0.0</span>
            <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Latest</span>
          </div>
        </div>

      </div>
    </div>
  );
}