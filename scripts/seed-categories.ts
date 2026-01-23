// scripts/seed-categories.ts
// Run this with: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-categories.ts

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb+srv://ronaldvhadebe_db_user:RFWWUNVb2F0C6ysm@cluster0.xovcymo.mongodb.net/?appName=Cluster0';

const categories = [
  {
    name: 'Groceries & Food',
    description: 'Fresh produce, pantry staples, and bulk food items for your business',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 1,
    active: true,
    featured: true,
    subcategories: [
      { name: 'Pantry & Dry Goods', description: 'Rice, pasta, canned foods, and more' },
      { name: 'Fresh Produce, Meat & Dairy', description: 'Fresh quality ingredients' },
      { name: 'Frozen Foods', description: 'Frozen vegetables, meats, and ready meals' },
      { name: 'Snacks & Confectionery', description: 'Sweet and savory treats' },
      { name: 'Bakery Items', description: 'Fresh bread, pastries, and baked goods' },
      { name: 'Health & Organic Foods', description: 'Healthy and organic options' },
    ]
  },
  {
    name: 'Beverages',
    description: 'Wide selection of drinks from juices to energy drinks',
    image: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800',
    banner: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 2,
    active: true,
    featured: true,
    subcategories: [
      { name: 'Non-Alcoholic Drinks', description: 'Juices, soft drinks, water, energy drinks' },
      { name: 'Bulk Beverages', description: 'Large quantity drink supplies' },
    ]
  },
  {
    name: 'Electronics & Technology',
    description: 'Latest tech and electronic devices for your needs',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
    banner: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 3,
    active: true,
    featured: true,
    subcategories: [
      { name: 'Audio Gear & Speakers', description: 'Premium sound equipment' },
    ]
  },
  {
    name: 'Appliances',
    description: 'Quality appliances for home and business use',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800',
    banner: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 4,
    active: true,
    featured: true,
    subcategories: [
      { name: 'Small Kitchen Appliances', description: 'Microwaves, kettles, irons, and more' },
      { name: 'Heating & Cooling Devices', description: 'Heaters, fans, and climate control' },
    ]
  },
  {
    name: 'Health & Beauty',
    description: 'Personal care and beauty products for everyone',
    image: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800',
    banner: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 5,
    active: true,
    featured: false,
    subcategories: [
      { name: 'Toiletries & Personal Care', description: 'For women, men, and kids' },
      { name: 'Skincare & Cosmetics', description: 'Beauty products for all' },
      { name: 'Baby & Kids Personal Care', description: 'Gentle care for little ones' },
    ]
  },
  {
    name: 'DIY, Tools & Hardware',
    description: 'Everything you need for your DIY projects',
    image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800',
    banner: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 6,
    active: true,
    featured: false,
    subcategories: [
      { name: 'Electrical', description: 'Electrical supplies and components' },
      { name: 'Accessories', description: 'Hardware accessories and supplies' },
      { name: 'DIY Equipment', description: 'Tools and equipment for projects' },
    ]
  },
  {
    name: 'Automotive & Transport',
    description: 'Car care and automotive supplies',
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
    banner: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 7,
    active: true,
    featured: false,
    subcategories: [
      { name: 'Car Accessories', description: 'Interior and exterior accessories' },
      { name: 'Automotive Tools & Maintenance', description: 'Keep your vehicle running' },
      { name: 'Car Washing & Detailing', description: 'Professional car care products' },
    ]
  },
  {
    name: 'Pets',
    description: 'Everything for your furry, feathered, and scaly friends',
    image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800',
    banner: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 8,
    active: true,
    featured: false,
    subcategories: [
      { name: 'Pet Food', description: 'Nutritious food for all pets' },
      { name: 'Pet Supplies & Accessories', description: 'Toys, beds, and more' },
    ]
  },
  {
    name: 'Office & Stationery',
    description: 'Professional office supplies and stationery',
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800',
    banner: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 9,
    active: true,
    featured: false,
    subcategories: [
      { name: 'Office Supplies', description: 'Essential office equipment' },
      { name: 'Printing Paper & Stationery', description: 'Paper products and supplies' },
      { name: 'School Stationery', description: 'Back to school essentials' },
    ]
  },
  {
    name: 'Seasonal & Promotional Deals',
    description: 'Special offers and seasonal promotions',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
    banner: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&h=500&fit=crop',
    parentId: null,
    level: 0,
    order: 10,
    active: true,
    featured: false,
    subcategories: [
      { name: 'School Supplies', description: 'Back-to-school specials' },
      { name: 'Festive Gifting Deals', description: 'Holiday gift options' },
      { name: 'Tool Packages & Combo Deals', description: 'Discounted bundles' },
    ]
  },
];

async function seedCategories() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('tfs-wholesalers');
    const categoriesCollection = db.collection('categories');
    
    // Clear existing categories
    await categoriesCollection.deleteMany({});
    console.log('Cleared existing categories');
    
    // Insert main categories and subcategories
    for (const category of categories) {
      const { subcategories, ...mainCategory } = category;
      
      // Create slug
      const slug = mainCategory.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Insert main category
      const result = await categoriesCollection.insertOne({
        ...mainCategory,
        slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`Created category: ${mainCategory.name}`);
      
      // Insert subcategories
      if (subcategories && subcategories.length > 0) {
        for (let i = 0; i < subcategories.length; i++) {
          const subcat = subcategories[i];
          const subSlug = subcat.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          await categoriesCollection.insertOne({
            name: subcat.name,
            slug: subSlug,
            description: subcat.description,
            image: mainCategory.image, // Use parent image
            banner: '',
            parentId: result.insertedId,
            level: 1,
            order: i + 1,
            active: true,
            featured: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          
          console.log(`  - Created subcategory: ${subcat.name}`);
        }
      }
    }
    
    console.log('\n✅ Categories seeded successfully!');
    console.log(`Total main categories: ${categories.length}`);
    
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await client.close();
  }
}

seedCategories();