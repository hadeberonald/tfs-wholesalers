'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      router.replace(`/${savedBranch}`);
    } else {
      router.replace('/select-branch');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}