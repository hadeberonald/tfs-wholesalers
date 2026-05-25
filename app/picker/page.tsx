'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Download, Lock, AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function PickerDownloadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);

  const ALLOWED_ROLES = ['admin', 'picker'];
  const hasAccess = user && ALLOWED_ROLES.includes(user.role);

  useEffect(() => {
    if (!loading) {
      setAccessChecked(true);
    }
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
            href={`/login?redirect=picker`}
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
            <span className="font-semibold text-gray-700">pickers</span>. Your account doesn&apos;t have the required
            permissions.
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
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-orange-600" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">Picker App</h1>

          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            The TFS Wholesalers Picker App — built for warehouse pickers and admins to manage and fulfil orders on the go.
          </p>
        </div>

        {/* Download Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
              <Download className="w-8 h-8 text-orange-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">Android APK</h2>

            <p className="text-gray-500 leading-relaxed mb-8 max-w-sm">
              Download and install the Picker App directly on your Android device. Make sure to allow installation from
              unknown sources in your device settings.
            </p>

            <a
              href="/apk/picker.apk"
              download
              className="inline-flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-2xl transition-colors text-lg w-full max-w-xs"
            >
              <Download className="w-5 h-5" />
              Download APK
            </a>

            <p className="text-xs text-gray-400 mt-4">
              Signed in as <span className="font-medium text-gray-600">{user.email}</span> &middot;{' '}
              <span className="capitalize">{user.role}</span>
            </p>
          </div>
        </div>

        {/* Install instructions */}
        <div className="mt-8 bg-orange-50 border border-orange-100 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Installation Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Tap <strong>Download APK</strong> above and save the file.</li>
            <li>
              On your Android device, go to <strong>Settings → Security</strong> and enable{' '}
              <strong>Install from Unknown Sources</strong> (or <strong>Install Unknown Apps</strong>).
            </li>
            <li>Open the downloaded <code className="bg-orange-100 px-1 rounded">picker.apk</code> file and tap <strong>Install</strong>.</li>
            <li>Once installed, open the app and sign in with your TFS credentials.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}