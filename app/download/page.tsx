'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, X } from 'lucide-react';

export default function DownloadPage() {
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-orange-600" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Download TFS Wholesalers
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Access the TFS Wholesalers mobile application on Android and iOS.
          </p>
        </div>

        {/* Download Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Android */}
          <button
            onClick={() => setShowAndroidModal(true)}
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
          </button>

          {/* Apple */}
          <a
            href="https://apps.apple.com/za/app/tfs-wholesalers/id6759480829"
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
                iPhone & iPad
              </h2>

              <p className="text-gray-500 leading-relaxed">
                Download directly from the Apple App Store.
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Android Modal */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowAndroidModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
              <Download className="w-8 h-8 text-orange-600" />
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Coming Soon on Google Play
            </h2>

            <p className="text-gray-600 leading-relaxed mb-6">
              Download and install the Android application manually using the
              link below.
            </p>

            <a
              href="/apk/tfs-wholesalers.apk"
              download
              className="w-full inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-4 rounded-2xl transition-colors"
            >
              Download APK
            </a>
          </div>
        </div>
      )}
    </main>
  );
}