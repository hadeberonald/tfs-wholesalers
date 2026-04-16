'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: `By downloading, installing, or using the TFS Wholesalers application or online platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.

These terms apply to all users of the app, whether purchasing for personal retail or wholesale business purposes.`,
  },
  {
    title: '2. About TFS Wholesalers',
    body: `TFS Wholesalers provides an online and mobile ordering platform for retail and wholesale customers to browse products, place orders, and arrange delivery. We serve both individual consumers and business customers.`,
  },
  {
    title: '3. Account Registration',
    body: `You may use the app as a guest or create a registered account. When registering, you agree to:

- Provide accurate and complete information.
- Keep your login credentials confidential.
- Notify us immediately of any unauthorised use of your account.
- Be responsible for all activity that occurs under your account.

We reserve the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '4. Ordering & Pricing',
    body: `All prices displayed in the app are in South African Rand (ZAR) and are inclusive of VAT where applicable. Prices are subject to change without notice. Your delivery fee is automatically calculated based on your distance from our store and is displayed clearly before order confirmation.

By placing an order, you confirm that you are authorised to use the payment method provided and that the information you submit is accurate.`,
  },
  {
    title: '5. Order Confirmation & Processing',
    body: `Once you place an order and payment is successfully processed, you will receive a confirmation email. You should check your spam or junk folder if you do not see it in your inbox.

We reserve the right to cancel or refuse any order if a product is out of stock, if there is an error in pricing or product description, or if we suspect fraudulent activity.`,
  },
  {
    title: '6. Delivery',
    body: `Delivery is available within our designated service area. Your exact delivery fee is calculated at checkout based on your distance from our store. Estimated delivery times are indicative only and may vary based on demand, weather, or other factors.

If we are unable to deliver your order, our driver will attempt to contact you. Undeliverable orders may be returned to the store and refunded at our discretion.`,
  },
  {
    title: '7. Returns & Refunds',
    body: `If you receive an incorrect, damaged, or missing item, please contact us within 24 hours of delivery at support@tfswholesalers.co.za or call 034 981 3210. We will investigate and, where applicable, arrange a replacement or issue a refund.

Refunds are processed within 3–5 business days through Paystack to your original payment method. We do not accept returns on perishable goods unless the item was faulty or incorrectly supplied.`,
  },
  {
    title: '8. Payments',
    body: `All payments are processed securely through Paystack, a PCI-DSS compliant payment gateway. By saving a card for future use, you authorise TFS Wholesalers to charge that card for future orders you place. You may remove saved cards at any time under Account → Payment Methods.

We do not store your full card details on our servers.`,
  },
  {
    title: '9. Prohibited Use',
    body: `You agree not to:

- Use the app for any unlawful purpose.
- Submit false, misleading, or fraudulent information.
- Attempt to reverse engineer, copy, or exploit any part of the app.
- Place bulk orders with the intention of cancellation or non-payment.
- Abuse the returns or refund process.`,
  },
  {
    title: '10. Intellectual Property',
    body: `All content within the TFS Wholesalers app, including logos, images, product descriptions, and software, is the property of TFS Wholesalers or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our prior written consent.`,
  },
  {
    title: '11. Limitation of Liability',
    body: `To the maximum extent permitted by law, TFS Wholesalers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app or our services. Our total liability for any claim shall not exceed the value of the order in dispute.`,
  },
  {
    title: '12. Changes to These Terms',
    body: `We may update these Terms of Service from time to time. You will be notified of material changes via the app or email. Continued use of the app after changes take effect constitutes acceptance of the revised terms.`,
  },
  {
    title: '13. Governing Law',
    body: `These terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the exclusive jurisdiction of the South African courts.`,
  },
  {
    title: '14. Contact Us',
    body: `For any questions about these Terms of Service, please contact:\n\n**TFS Wholesalers**\nPhone: 034 981 3210\nEmail: support@tfswholesalers.co.za\nSupport hours: Monday–Saturday, 8am–6pm`,
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/support" className="p-2 rounded-xl hover:bg-gray-100 transition-colors -ml-2">
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-orange" />
            <h1 className="text-lg font-semibold text-brand-black">Terms of Service</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* Intro card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            Please read these terms carefully before using the <span className="font-semibold text-brand-black">TFS Wholesalers</span> app. These terms govern your use of our retail and wholesale ordering platform and the services we provide.
          </p>
          <p className="text-xs text-gray-400 mt-3">Last updated: April 2026</p>
        </div>

        {/* Sections */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {sections.map((section, i) => (
            <div key={i} className="px-5 py-5 border-b border-gray-100 last:border-0">
              <h2 className="text-sm font-semibold text-brand-black mb-2">{section.title}</h2>
              <div className="text-sm text-gray-500 leading-relaxed">
                {section.body.split('\n').map((line, j) => {
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