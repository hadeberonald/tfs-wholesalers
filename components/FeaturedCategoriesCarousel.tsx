'use client'
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
}

export default function FeaturedCategoriesCarousel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchEnd, setTouchEnd] = useState<number>(0);

  useEffect(() => {
    fetchFeaturedCategories();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || categories.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % categories.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, categories.length]);

  const fetchFeaturedCategories = async () => {
    try {
      const res = await fetch('/api/categories?featured=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch featured categories:', error);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % categories.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + categories.length) % categories.length);
    setIsAutoPlaying(false);
  };

  // Touch handlers for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsAutoPlaying(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  if (categories.length === 0) return null;

  return (
    <section className="w-full py-8 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-4xl font-bold text-brand-black mb-2">
            Featured Categories
          </h2>
          <p className="text-gray-600 text-sm md:text-lg">
            Explore our most popular product categories
          </p>
        </div>

        <div className="relative">
          {/* Main Carousel */}
          <div 
            className="overflow-hidden rounded-2xl md:rounded-3xl"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{
                transform: `translateX(-${currentIndex * 100}%)`
              }}
            >
              {categories.map((category, index) => (
                <div
                  key={category._id}
                  className="min-w-full px-1 md:px-2"
                >
                  <Link
                    href={`/shop?category=${category.slug}`}
                    className="group block relative overflow-hidden rounded-2xl md:rounded-3xl shadow-lg md:shadow-2xl"
                    style={{ height: '280px' }}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{
                        backgroundImage: `url(${category.banner || category.image || '/placeholder.png'})`,
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    
                    <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
                      <div className="transform transition-transform duration-500 group-hover:translate-y-[-10px]">
                        <h3 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm md:text-xl text-white/90 mb-3 md:mb-6 max-w-2xl line-clamp-2 md:line-clamp-none">
                            {category.description}
                          </p>
                        )}
                        <span className="inline-flex items-center px-4 md:px-8 py-2 md:py-3 bg-brand-orange text-white text-sm md:text-base font-semibold rounded-full hover:bg-orange-600 transition-colors">
                          Shop Now
                          <ChevronRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows - Hidden on Mobile */}
          {categories.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="hidden md:flex absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 lg:p-4 rounded-full shadow-xl transition-all hover:scale-110 items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6 text-brand-black" />
              </button>
              <button
                onClick={nextSlide}
                className="hidden md:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 lg:p-4 rounded-full shadow-xl transition-all hover:scale-110 items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6 text-brand-black" />
              </button>
            </>
          )}

          {/* Dots Indicator */}
          {categories.length > 1 && (
            <div className="flex justify-center mt-4 md:mt-8 space-x-2 md:space-x-3">
              {categories.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentIndex
                      ? 'w-8 md:w-12 h-2 md:h-3 bg-brand-orange'
                      : 'w-2 md:w-3 h-2 md:h-3 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Preview Cards - Hidden on Mobile and Tablet */}
          {categories.length > 2 && (
            <div className="hidden xl:block absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none">
              <div className="max-w-7xl mx-auto px-4 relative">
                {/* Previous Preview */}
                <div
                  className="absolute left-[-100px] top-0 w-32 h-64 rounded-2xl overflow-hidden opacity-50 transition-opacity duration-300 hover:opacity-70"
                  style={{
                    backgroundImage: `url(${categories[(currentIndex - 1 + categories.length) % categories.length].banner || '/placeholder.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                
                {/* Next Preview */}
                <div
                  className="absolute right-[-100px] top-0 w-32 h-64 rounded-2xl overflow-hidden opacity-50 transition-opacity duration-300 hover:opacity-70"
                  style={{
                    backgroundImage: `url(${categories[(currentIndex + 1) % categories.length].banner || '/placeholder.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}