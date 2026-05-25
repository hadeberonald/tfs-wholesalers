'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, X } from 'lucide-react';

export default function DownloadPage() {
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10 mb-8 backdrop-blur-xl">
            <Download className="w-10 h-10 text-orange-400" />
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            Download the
            <span className="block text-orange-400">
              TFS Wholesalers App
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Access your wholesale ordering platform directly from your mobile
            device with the official TFS Wholesalers mobile application.
          </p>
        </div>

        {/* Download Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Android */}
          <button
            onClick={() => setShowAndroidModal(true)}
            className="group bg-white/[0.03] border border-white/10 hover:border-orange-400/40 rounded-[32px] p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative w-[220px] h-[72px] mb-8">
                <Image
                  src="/download/google-play.png"
                  alt="Google Play"
                  fill
                  className="object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold mb-3">
                Android Download
              </h2>

              <p className="text-white/60 leading-relaxed">
                Install the Android application.
              </p>
            </div>
          </button>

          {/* Apple */}
          <a
            href="https://apps.apple.com/za/app/tfs-wholesalers/id6759480829"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white/[0.03] border border-white/10 hover:border-orange-400/40 rounded-[32px] p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative w-[220px] h-[72px] mb-8">
                <Image
                  src="/download/app-store.png"
                  alt="App Store"
                  fill
                  className="object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold mb-3">
                iPhone & iPad
              </h2>

              <p className="text-white/60 leading-relaxed">
                Download the official TFS Wholesalers app directly from the
                Apple App Store.
              </p>
            </div>
          </a>
        </div>

        {/* APK Direct Download */}
        <div className="mt-20 text-center">
          <div className="inline-flex flex-col items-center bg-white/[0.03] border border-white/10 rounded-3xl px-8 py-6 backdrop-blur-xl">
            <p className="text-white/50 text-sm uppercase tracking-[0.2em] mb-3">
              Manual Android Installation
            </p>

            <a
              href="/apk/tfs-wholesalers.apk"
              download
              className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-black font-bold px-8 py-4 rounded-2xl transition-all duration-300"
            >
              Download APK
            </a>

            <p className="text-white/40 text-sm mt-4">
              Android 8.0 and above supported
            </p>
          </div>
        </div>
      </div>

      {/* Android Modal */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-lg bg-[#111111] border border-white/10 rounded-[32px] p-8 relative">
            <button
              onClick={() => setShowAndroidModal(false)}
              className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-6">
                <Download className="w-8 h-8 text-orange-400" />
              </div>

              <h2 className="text-3xl font-bold mb-4">
                Coming Soon on Google Play
              </h2>

        

              <p className="text-white/60 leading-relaxed mt-4">
                You can still install the app manually using the APK download
                link below.
              </p>
            </div>

            <a
              href="/apk/tfs-wholesalers.apk"
              download
              className="w-full inline-flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-black font-bold px-6 py-4 rounded-2xl transition-all duration-300"
            >
              Download APK
            </a>

            <p className="text-xs text-white/40 mt-4 text-center">
              You may need to enable “Install Unknown Apps” in Android settings.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}