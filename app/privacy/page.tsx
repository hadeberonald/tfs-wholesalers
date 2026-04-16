'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

const sections = [
  {
    title: '1. Information We Collect',
    body: `When you use the TFS Wholesalers app, we may collect the following information:

- **Personal details**: Your full name, email address, and phone number when you register or place an order.
- **Delivery information**: Your delivery address and GPS coordinates to calculate delivery fees and dispatch your order.
- **Payment information**: We do not store your full card details. Payments are processed securely via Paystack, which handles and encrypts all card data in accordance with PCI-DSS standards.
- **Order history**: Records of past purchases to help you track orders and manage your account.
- **Device information**: Basic device identifiers and app usage data to improve performance and fix issues.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use your information solely to provide and improve our retail and wholesale ordering service. This includes:

- Processing and fulfilling your orders.
- Calculating and displaying your delivery fee based on your location.
- Sending order confirmations and status updates via email.
- Responding to customer support queries.
- Improving app functionality and user experience.

We do not sell, rent, or share your personal information with third parties for marketing purposes.`,
  },
  {
    title: '3. Payment Processing',
    body: `All payments are processed by Paystack, a PCI-DSS compliant payment provider. When you save a card for future use, only a secure authorization token is stored — your full card number is never held on our servers. You can manage or remove saved payment methods at any time under Account → Payment Methods.`,
  },
  {
    title: '4. Location Data',
    body: `We request access to your device location solely to pin your delivery address on the map and calculate your delivery fee. Location data is used only at the time of checkout and is not stored beyond your delivery address. You may deny location access and enter your address manually instead.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your account and order data for as long as your account is active or as required to fulfil legal and business obligations. If you delete your account, your personal information is removed from our systems within 30 days, subject to any legal retention requirements.`,
  },
  {
    title: '6. Your Rights',
    body: `You have the right to:

- Access the personal data we hold about you.
- Request correction of inaccurate information.
- Request deletion of your account and associated data.
- Object to or restrict certain types of processing.

To exercise any of these rights, please contact us at support@tfswholesalers.co.za or call 034 981 3210.`,
  },
  {
    title: '7. Security',
    body: `We take reasonable technical and organisational measures to protect your data from unauthorised access, loss, or disclosure. All data is transmitted over encrypted HTTPS connections. However, no method of electronic transmission is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '8. Children\'s Privacy',
    body: `Our services are intended for business and personal retail and wholesale purchasing by adults. We do not knowingly collect data from children under the age of 13. If you believe a child has provided us with personal information, please contact us and we will promptly delete it.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of the app after any changes constitutes your acceptance of the updated policy.`,
  },
  {
    title: '10. Contact Us',
    body: `If you have any questions or concerns about this Privacy Policy, please contact:\n\n**TFS Wholesalers**\nPhone: 034 981 3210\nEmail: support@tfswholesalers.com\nSupport hours: Monday–Saturday, 8am–5pm`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/support" className="p-2 rounded-xl hover:bg-gray-100 transition-colors -ml-2">
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-orange" />
            <h1 className="text-lg font-semibold text-brand-black">Privacy Policy</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* Intro card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            <span className="font-semibold text-brand-black">TFS Wholesalers</span> is committed to protecting your privacy. This policy explains what information we collect, why we collect it, and how it is used when you use our retail and wholesale ordering platform.
          </p>
          <p className="text-xs text-gray-400 mt-3">Last updated: January 2025</p>
        </div>

        {/* Sections */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {sections.map((section, i) => (
            <div key={i} className="px-5 py-5 border-b border-gray-100 last:border-0">
              <h2 className="text-sm font-semibold text-brand-black mb-2">{section.title}</h2>
              <div className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                {section.body.split('\n').map((line, j) => {
                  if (line.startsWith('- **')) {
                    const match = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
                    if (match) {
                      return (
                        <p key={j} className="flex items-start gap-2 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 flex-shrink-0" />
                          <span><span className="font-medium text-brand-black">{match[1]}</span>: {match[2]}</span>
                        </p>
                      );
                    }
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <p key={j} className="flex items-start gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 flex-shrink-0" />
                        <span>{line.replace('- ', '')}</span>
                      </p>
                    );
                  }
                  if (line.includes('**')) {
                    const parts = line.split(/\*\*(.+?)\*\*/g);
                    return (
                      <p key={j} className="mb-1">
                        {parts.map((part, k) => k % 2 === 1 ? <span key={k} className="font-medium text-brand-black">{part}</span> : part)}
                      </p>
                    );
                  }
                  if (line.trim() === '') return <div key={j} className="h-2" />;
                  return <p key={j} className="mb-1">{line}</p>;
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}