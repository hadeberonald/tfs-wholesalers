// app/[slug]/wholesale/pending/page.tsx (Next.js 14 Compatible)
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, Mail, Phone, CheckCircle } from 'lucide-react';

export default function WholesalePendingPage() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>

          <h1 className="text-3xl font-bold text-brand-black mb-4">
            Application Under Review
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Thank you for applying for a wholesale account! Your application is currently being reviewed by our team.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-brand-black mb-4">What happens next?</h2>
            <div className="space-y-4 text-left">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Our team will review your business information and documentation
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  You'll receive an email notification within 24 hours regarding your application status
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Once approved, you'll gain access to wholesale pricing and ordering
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-brand-black mb-4">Need help?</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:wholesale@tfswholesalers.co.za"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-brand-orange text-white rounded-xl hover:bg-orange-600 transition-colors"
              >
                <Mail className="w-5 h-5" />
                <span>Email Us</span>
              </a>
              <a 
                href="tel:+27123456789"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Phone className="w-5 h-5" />
                <span>Call Us</span>
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link 
              href={`/${slug}`}
              className="text-brand-orange hover:text-orange-600 font-semibold"
            >
              ← Back to Store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}