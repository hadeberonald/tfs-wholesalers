'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, Lock, AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const DEFAULT_SLUG = 'vryheid';

export default function PickerDownloadPage() {
  const { user, loading } = useAuth();
  const [accessChecked, setAccessChecked] = useState(false);

  const ALLOWED_ROLES = ['admin', 'picker'];
  const hasAccess = user && ALLOWED_ROLES.includes(user.role);

  useEffect(() => {
    if (!loading) setAccessChecked(true);
  }, [loading]);

  // --- Loading state ---
  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4" />
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  // --- Not logged in ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Login Required</h1>
          <p className="text-gray-500 mb-8">
            You need to sign in to access the Picker App download.
          </p>
          <Link
            href={`/${DEFAULT_SLUG}/login?redirect=picker`}
            className="inline-flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-semibold px-6 py-4 rounded-2xl transition-colors w-full"
          >
            <LogIn className="w-5 h-5" />
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // --- Logged in but wrong role ---
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
          <p className="text-gray-500 mb-8">
            The Picker App is only available to <span className="font-semibold text-gray-700">admins</span> and{' '}
            <span className="font-semibold text-gray-700">pickers</span>. Your account doesn&apos;t have the required permissions.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-4 rounded-2xl transition-colors w-full"
          >
            ← Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // --- Authorised: show the download page ---
  return (
    <main className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-orange-600" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Download Picker App
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Access the TFS Wholesalers Picker App on Android and iOS.
          </p>
        </div>

        {/* Download Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Android */}
          <a
            href="/apk/picker.apk"
            download
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 hover:shadow-md transition-all"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative w-[220px] h-[70px] mb-8">
                <Image
                  src="/download/google-play.png"
                  alt="Google Play"
                  fill
                  className="object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Android
              </h2>

              <p className="text-gray-500 leading-relaxed">
                Download and install the Android APK.
              </p>
            </div>
          </a>

          {/* Apple */}
          <a
            href="https://apps.apple.com/za/app/tfs-picker-delivery/id6761440872"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 hover:shadow-md transition-all"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative w-[220px] h-[70px] mb-8">
                <Image
                  src="/download/app-store.png"
                  alt="App Store"
                  fill
                  className="object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                iPhone &amp; iPad
              </h2>

              <p className="text-gray-500 leading-relaxed">
                Download directly from the Apple App Store.
              </p>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}