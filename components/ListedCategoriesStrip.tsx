'use client';

// tfs-wholesalers/app/components/ListedCategoriesStrip.tsx
// Shows up to 8 listed categories as centred inline tiles — no scroll, no chevrons.
// Placed directly under the hero section with no heading or intro copy.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';

interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  icon?: string;
}

export default function ListedCategoriesStrip() {
  const { branch } = useBranch();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!branch) return;
    fetch(`/api/categories?branchId=${branch.id}&listed=true`)
      .then(r => r.json())
      // Hard cap at 8
      .then(d => setCategories((d.categories || []).slice(0, 8)))
      .catch(console.error);
  }, [branch]);

  if (!categories.length) return null;

  return (
    <div className="flex items-center justify-center gap-4 flex-wrap py-4 w-full">
      {categories.map(cat => {
        const imgSrc = cat.icon || cat.image;
        return (
          <button
            key={cat._id}
            onClick={() => router.push(`/${branch?.slug}/shop?category=${cat._id}`)}
            className="flex flex-col items-center gap-1.5 w-[72px] group"
          >
            {/* Circle */}
            <div className="
              w-14 h-14 rounded-full overflow-hidden
              bg-orange-50 border-2 border-transparent
              group-hover:border-brand-orange group-hover:scale-105
              transition-all duration-200 flex items-center justify-center
            ">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-xl font-bold text-brand-orange">
                  {cat.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Label */}
            <span className="
              text-[11px] font-medium text-center leading-tight text-gray-700
              group-hover:text-brand-orange transition-colors
              line-clamp-2 w-full
            ">
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}