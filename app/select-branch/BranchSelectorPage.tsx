'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Store, Loader2, ArrowRight } from 'lucide-react';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: string;
  settings: {
    storeLocation: {
      lat: number;
      lng: number;
      address: string;
    };
    contactPhone: string;
  };
}

export default function BranchSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches();
    
    const redirect = searchParams.get('redirect');
    if (redirect) {
      const savedBranch = localStorage.getItem('selectedBranch');
      if (savedBranch) {
        router.push(redirect);
      }
    }
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches.filter((b: Branch) => b.status === 'active'));
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBranch = (slug: string) => {
    setSelectedBranch(slug);
    localStorage.setItem('selectedBranch', slug);
    
    const redirect = searchParams.get('redirect');
    
    setTimeout(() => {
      if (redirect) {
        router.push(redirect);
      } else {
        router.push(`/${slug}`);
      }
    }, 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 pt-20">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
            Welcome to TFS Wholesalers
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Select your nearest branch to continue
          </p>
          <p className="text-sm text-gray-500">
            You can change this anytime from the header
          </p>
        </div>

        {branches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Branches Available</h3>
            <p className="text-gray-600">Please contact support or try again later.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <button
                key={branch._id}
                onClick={() => handleSelectBranch(branch.slug)}
                className={`bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left group relative overflow-hidden ${
                  selectedBranch === branch.slug ? 'ring-4 ring-brand-orange' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/5 to-orange-100/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative">
                  <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-orange transition-colors duration-300">
                    <Store className="w-7 h-7 text-brand-orange group-hover:text-white transition-colors duration-300" />
                  </div>

                  <h3 className="text-2xl font-bold text-brand-black mb-2 group-hover:text-brand-orange transition-colors">
                    {branch.name}
                  </h3>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{branch.settings.storeLocation.address}</span>
                    </div>
                    {branch.settings.contactPhone && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span className="font-semibold">{branch.settings.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-brand-orange group-hover:text-orange-600">
                      Shop Now
                    </span>
                    <ArrowRight className="w-5 h-5 text-brand-orange group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>

                {selectedBranch === branch.slug && (
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center animate-scale-in">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Looking for a different branch? Contact us to suggest new locations!
          </p>
        </div>
      </div>
    </div>
  );
}