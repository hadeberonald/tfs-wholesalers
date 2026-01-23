'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroBanner {
  _id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  buttonText: string;
  showOverlay?: boolean;
  active: boolean;
  order: number;
}

export default function HeroSection() {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/hero-banners');
      if (res.ok) {
        const data = await res.json();
        const activeBanners = (data.banners || [])
          .filter((b: HeroBanner) => b.active)
          .sort((a: HeroBanner, b: HeroBanner) => a.order - b.order);
        setBanners(activeBanners);
      }
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (loading) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] bg-gray-200 animate-pulse" />
    );
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full h-[300px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 md:mb-4 leading-tight">
                Welcome to TFS Wholesalers
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 mb-4 md:mb-6">
                Quality products at unbeatable wholesale prices
              </p>
              <Link
                href="/products"
                className="inline-block bg-brand-orange text-white px-6 md:px-8 py-3 md:py-4 rounded-lg text-sm md:text-base font-semibold hover:bg-orange-600 transition-colors"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentBanner = banners[currentIndex];
  const showOverlay = currentBanner.showOverlay !== false;

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] overflow-hidden bg-gray-900">
      {/* Banners */}
      {banners.map((banner, index) => (
        <Link
          key={banner._id}
          href={banner.link || '#'}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Background Image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${banner.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          
          {/* Overlay Content */}
          {showOverlay && (
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-2xl">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 md:mb-4 leading-tight">
                    {banner.title}
                  </h1>
                  {banner.subtitle && (
                    <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 mb-4 md:mb-6 max-w-xl">
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.buttonText && (
                    <span className="inline-block bg-brand-orange text-white px-6 md:px-8 py-3 md:py-4 rounded-lg text-sm md:text-base font-semibold hover:bg-orange-600 transition-colors shadow-lg">
                      {banner.buttonText}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Link>
      ))}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              goToPrevious();
            }}
            className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-all z-10 group"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              goToNext();
            }}
            className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-all z-10 group"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 md:space-x-3 z-10">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentIndex(index);
                }}
                className={`h-2 md:h-2.5 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-brand-orange w-6 md:w-8' 
                    : 'bg-white/50 hover:bg-white/75 w-2 md:w-2.5'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}