'use client';

// tfs-wholesalers/app/components/FeaturedCategoriesCarousel.tsx
// The listed-categories strip lives directly below the carousel slide inside
// this same section — no separate component needed on the web side.

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
}

interface ListedCategory {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  icon?: string;
}

export default function FeaturedCategoriesCarousel() {
  const { branch } = useBranch();
  const router = useRouter();

  const [categories,      setCategories]      = useState<Category[]>([]);
  const [listedCategories, setListedCategories] = useState<ListedCategory[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [isAutoPlaying,   setIsAutoPlaying]   = useState(true);
  const [touchStart,      setTouchStart]      = useState(0);
  const [touchEnd,        setTouchEnd]        = useState(0);

  useEffect(() => {
    if (branch) fetchData();
  }, [branch]);

  useEffect(() => {
    if (!isAutoPlaying || categories.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % categories.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, categories.length]);

  const fetchData = async () => {
    if (!branch) return;
    try {
      setLoading(true);
      const [featuredRes, listedRes] = await Promise.all([
        fetch(`/api/categories?branchId=${branch.id}&featured=true`),
        fetch(`/api/categories?branchId=${branch.id}&listed=true`),
      ]);
      if (featuredRes.ok) {
        const data = await featuredRes.json();
        setCategories(data.categories || []);
      }
      if (listedRes.ok) {
        const data = await listedRes.json();
        setListedCategories((data.categories || []).slice(0, 8));
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToSlide = (index: number) => { setCurrentIndex(index); setIsAutoPlaying(false); };
  const nextSlide = () => { setCurrentIndex(prev => (prev + 1) % categories.length); setIsAutoPlaying(false); };
  const prevSlide = () => { setCurrentIndex(prev => (prev - 1 + categories.length) % categories.length); setIsAutoPlaying(false); };

  const handleTouchStart = (e: React.TouchEvent) => { setTouchStart(e.targetTouches[0].clientX); setIsAutoPlaying(false); };
  const handleTouchMove  = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd   = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance >  50) nextSlide();
    if (distance < -50) prevSlide();
    setTouchStart(0);
    setTouchEnd(0);
  };

  // Nothing to show at all
  if (!branch || (!loading && categories.length === 0 && listedCategories.length === 0)) return null;

  if (loading) {
    return (
      <section className="w-full py-8 md:py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="overflow-hidden rounded-2xl md:rounded-3xl">
            <div className="block md:hidden w-full aspect-[16/7] bg-gray-200 animate-pulse" />
            <div className="hidden md:block w-full aspect-[16/5] bg-gray-200 animate-pulse" />
          </div>
          {/* Strip skeleton */}
          <div className="flex justify-center gap-4 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse" />
                <div className="w-12 h-2.5 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-8 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">

        {/* ── Section heading ─────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-brand-black mb-2">
              Featured Categories
            </h2>
            <p className="text-gray-600 text-sm md:text-lg">
              Explore our most popular product categories
            </p>
          </div>
        )}

        {/* ── Carousel ────────────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="relative">
            {/* Slides */}
            <div
              className="overflow-hidden rounded-2xl md:rounded-3xl"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {categories.map(category => (
                  <div key={category._id} className="min-w-full px-1 md:px-2">
                    <Link
                      href={`/${branch.slug}/shop?category=${category._id}`}
                      className="group block relative overflow-hidden rounded-2xl md:rounded-3xl shadow-lg md:shadow-2xl aspect-[16/7] md:aspect-[16/5]"
                    >
                      {/* Background */}
                      <div className="absolute inset-0">
                        {category.banner || category.image ? (
                          <Image
                            src={category.banner || category.image || '/placeholder.png'}
                            alt={category.name}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                            priority={currentIndex === 0}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200" />
                        )}
                      </div>

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                      {/* Content */}
                      <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-12">
                        <div className="transform transition-transform duration-500 group-hover:translate-y-[-10px]">
                          <h3 className="text-xl md:text-5xl font-bold text-white mb-1.5 md:mb-4">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="text-xs md:text-xl text-white/90 mb-2.5 md:mb-6 max-w-2xl line-clamp-1 md:line-clamp-none">
                              {category.description}
                            </p>
                          )}
                          <span className="inline-flex items-center px-3 md:px-8 py-1.5 md:py-3 bg-brand-orange text-white text-xs md:text-base font-semibold rounded-full hover:bg-orange-600 transition-colors">
                            Shop Now
                            <ChevronRight className="ml-1.5 w-3.5 h-3.5 md:w-5 md:h-5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Nav arrows — desktop only */}
            {categories.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="hidden md:flex absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 lg:p-4 rounded-full shadow-xl transition-all hover:scale-110 items-center justify-center"
                  aria-label="Previous category"
                >
                  <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6 text-brand-black" />
                </button>
                <button
                  onClick={nextSlide}
                  className="hidden md:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 lg:p-4 rounded-full shadow-xl transition-all hover:scale-110 items-center justify-center"
                  aria-label="Next category"
                >
                  <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6 text-brand-black" />
                </button>
              </>
            )}

            {/* Dot indicators */}
            {categories.length > 1 && (
              <div className="flex justify-center mt-3 md:mt-8 space-x-1.5 md:space-x-3">
                {categories.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`transition-all duration-300 rounded-full ${
                      index === currentIndex
                        ? 'w-6 md:w-12 h-1.5 md:h-3 bg-brand-orange'
                        : 'w-1.5 md:w-3 h-1.5 md:h-3 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to category ${index + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Peek previews — xl only */}
            {categories.length > 2 && (
              <div className="hidden xl:block absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none">
                <div className="max-w-7xl mx-auto px-4 relative">
                  <div className="absolute left-[-100px] top-0 w-32 h-64 rounded-2xl overflow-hidden opacity-50">
                    {categories[(currentIndex - 1 + categories.length) % categories.length].banner ||
                     categories[(currentIndex - 1 + categories.length) % categories.length].image ? (
                      <Image
                        src={
                          categories[(currentIndex - 1 + categories.length) % categories.length].banner ||
                          categories[(currentIndex - 1 + categories.length) % categories.length].image ||
                          '/placeholder.png'
                        }
                        alt="Previous category preview"
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200" />
                    )}
                  </div>
                  <div className="absolute right-[-100px] top-0 w-32 h-64 rounded-2xl overflow-hidden opacity-50">
                    {categories[(currentIndex + 1) % categories.length].banner ||
                     categories[(currentIndex + 1) % categories.length].image ? (
                      <Image
                        src={
                          categories[(currentIndex + 1) % categories.length].banner ||
                          categories[(currentIndex + 1) % categories.length].image ||
                          '/placeholder.png'
                        }
                        alt="Next category preview"
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Listed categories strip — sits directly below the slide ─────── */}
        {listedCategories.length > 0 && (
          <div className="flex items-center justify-center gap-4 flex-wrap mt-6 md:mt-8">
            {listedCategories.map(cat => {
              const imgSrc = cat.icon || cat.image;
              return (
                <button
                  key={cat._id}
                  onClick={() => router.push(`/${branch.slug}/shop?category=${cat._id}`)}
                  className="flex flex-col items-center gap-1.5 w-[72px] group"
                >
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
        )}

      </div>
    </section>
  );
}