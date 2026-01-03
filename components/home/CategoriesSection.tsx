'use client';

import Link from 'next/link';

const categories = [
  { 
    name: 'Groceries', 
    image: '/groceries.jpg', 
    slug: 'groceries',
    description: 'Fresh produce, pantry staples, and bulk items for your business'
  },
  { 
    name: 'Home Supplies', 
    image: '/home-supplies.jpg', 
    slug: 'home-supplies',
    description: 'Everything you need to keep your space running smoothly'
  },
  { 
    name: 'Appliances', 
    image: '/appliances.jpg', 
    slug: 'appliances',
    description: 'Professional-grade equipment and appliances for any operation'
  },
  { 
    name: 'Cleaning', 
    image: '/cleaning.jpg', 
    slug: 'cleaning',
    description: 'Industrial-strength cleaning supplies and janitorial essentials'
  },
];

export default function CategoriesSection() {
  return (
    <section className="w-full">
      <div className="text-center py-12 px-4">
        <h2 className="text-4xl md:text-5xl text-brand-black mb-4">
          Shop by Category
        </h2>
        <p className="text-gray-600 text-lg">
          Find exactly what you need for your business
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden h-96"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-300"
              style={{ 
                backgroundImage: `url(${category.image})`,
                filter: 'brightness(0.4)'
              }}
            />
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <h3 className="font-bold text-3xl text-white z-10 mb-3">
                {category.name}
              </h3>
              <p className="text-white text-lg z-10 opacity-90">
                {category.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}