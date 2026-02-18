import { Suspense } from 'react';
import BranchSelectorPage from './BranchSelectorPage';
import { Loader2 } from 'lucide-react';

export default function SelectBranchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BranchSelectorPage />
    </Suspense>
  );
}