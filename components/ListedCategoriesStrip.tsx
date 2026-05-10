'use client';

// tfs-wholesalers/app/components/ListedCategoriesStrip.tsx
// Compact horizontally-scrollable category nav tiles for the web storefront.
// Placed directly under the hero section — no heading, no intro copy.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';

interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  icon?: string; // dedicated icon image (square / transparent PNG works best)
}

export default function ListedCategoriesStrip() {
  const { branch } = useBranch();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories]       = useState<Category[]>([]);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!branch) return;
    fetch(`/api/categories?branchId=${branch.id}&listed=true`)
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(console.error);
  }, [branch]);

  // ── Arrow visibility ──────────────────────────────────────────────────────
  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect(); };
  }, [categories]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  if (!categories.length) return null;

  return (
    <div className="relative flex items-center w-full select-none">

      {/* ── Left chevron ─────────────────────────────────────────────────── */}
      <button
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        className={`
          absolute left-0 z-10 flex items-center justify-center
          w-8 h-8 rounded-full bg-white shadow-md border border-gray-200
          text-gray-500 hover:text-brand-orange hover:border-brand-orange
          transition-all shrink-0
          ${canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* ── Scroll track — px-10 keeps tiles clear of the chevrons ──────── */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth px-10 py-3 w-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map(cat => {
          // Prefer dedicated icon, fall back to category image
          const imgSrc = cat.icon || cat.image;

          return (
            <button
              key={cat._id}
              onClick={() => router.push(`/${branch?.slug}/shop?category=${cat._id}`)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group"
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

        {/* Trailing spacer — peek hint that more tiles exist */}
        {canScrollRight && <div className="shrink-0 w-4" aria-hidden="true" />}
      </div>

      {/* ── Right chevron ────────────────────────────────────────────────── */}
      <button
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        className={`
          absolute right-0 z-10 flex items-center justify-center
          w-8 h-8 rounded-full bg-white shadow-md border border-gray-200
          text-gray-500 hover:text-brand-orange hover:border-brand-orange
          transition-all shrink-0
          ${canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}