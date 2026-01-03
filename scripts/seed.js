// Database Seed Script - Run this to populate initial data
// Usage: node scripts/seed.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tfs-wholesalers';

// Demo users
const users = [
  {
    name: 'Admin User',
    email: 'admin@tfswholesalers.co.za',
    password: 'admin123', // Will be hashed
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'John Customer',
    email: 'customer@example.com',
    password: 'customer123', // Will be hashed
    role: 'customer',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Picker Staff',
    email: 'picker@tfswholesalers.co.za',
    password: 'picker123', // Will be hashed
    role: 'picker',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const categories = [
  {
    name: 'Groceries',
    slug: 'groceries',
    description: 'Essential food items and dry goods',
    order: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Home Supplies',
    slug: 'home-supplies',
    description: 'Everything you need for your home',
    order: 2,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Appliances',
    slug: 'appliances',
    description: 'Kitchen and home appliances',
    order: 3,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Cleaning Supplies',
    slug: 'cleaning',
    description: 'Professional cleaning products',
    order: 4,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const sampleProducts = [
  {
    name: 'Rice 10kg Bag',
    slug: 'rice-10kg-bag',
    description: 'Premium long grain white rice, perfect for bulk cooking',
    category: 'groceries',
    price: 189.99,
    sku: 'RICE-10KG-001',
    stockLevel: 150,
    lowStockThreshold: 20,
    images: ['/api/placeholder/400/400'],
    onSpecial: true,
    specialPrice: 169.99,
    active: true,
    featured: true,
    unit: 'bag',
    weight: 10,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Cooking Oil 5L',
    slug: 'cooking-oil-5l',
    description: 'Pure sunflower cooking oil in bulk packaging',
    category: 'groceries',
    price: 149.99,
    sku: 'OIL-5L-001',
    stockLevel: 200,
    lowStockThreshold: 30,
    images: ['/api/placeholder/400/400'],
    onSpecial: false,
    active: true,
    featured: true,
    unit: 'bottle',
    weight: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'All-Purpose Cleaner 5L',
    slug: 'all-purpose-cleaner-5l',
    description: 'Industrial strength multi-surface cleaner',
    category: 'cleaning',
    price: 89.99,
    sku: 'CLEAN-5L-001',
    stockLevel: 100,
    lowStockThreshold: 15,
    images: ['/api/placeholder/400/400'],
    onSpecial: true,
    specialPrice: 79.99,
    active: true,
    featured: false,
    unit: 'bottle',
    weight: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Paper Towels (12 Pack)',
    slug: 'paper-towels-12pack',
    description: 'Absorbent paper towels for commercial use',
    category: 'home-supplies',
    price: 129.99,
    sku: 'PAPER-12PK-001',
    stockLevel: 75,
    lowStockThreshold: 10,
    images: ['/api/placeholder/400/400'],
    onSpecial: false,
    active: true,
    featured: true,
    unit: 'pack',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const deliverySettings = {
  type: 'delivery-pricing',
  local: 35,
  localRadius: 20,
  medium: 85,
  mediumRadius: 40,
  far: 105,
  farRadius: 60,
  updatedAt: new Date()
};

const heroBanners = [
  {
    title: 'Wholesale Excellence',
    subtitle: 'Quality products at unbeatable prices for your business',
    image: '/api/placeholder/1920/800',
    link: '/products',
    buttonText: 'Shop Now',
    active: true,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    title: 'Bulk Savings',
    subtitle: 'Save more when you buy in quantity',
    image: '/api/placeholder/1920/800',
    link: '/specials',
    buttonText: 'View Specials',
    active: true,
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('tfs-wholesalers');

    // Clear existing data (optional - comment out if you want to preserve data)
    console.log('Clearing existing data...');
    await db.collection('categories').deleteMany({});
    await db.collection('products').deleteMany({});
    await db.collection('settings').deleteMany({});
    await db.collection('hero_banners').deleteMany({});
    await db.collection('users').deleteMany({});

    // Hash passwords and insert users
    console.log('Creating demo users...');
    const hashedUsers = await Promise.all(
      users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12)
      }))
    );
    await db.collection('users').insertMany(hashedUsers);
    console.log(`✓ ${users.length} demo users created`);
    console.log('  - admin@tfswholesalers.co.za / admin123');
    console.log('  - customer@example.com / customer123');
    console.log('  - picker@tfswholesalers.co.za / picker123');

    // Insert categories
    console.log('Inserting categories...');
    await db.collection('categories').insertMany(categories);
    console.log(`✓ ${categories.length} categories inserted`);

    // Insert products
    console.log('Inserting products...');
    await db.collection('products').insertMany(sampleProducts);
    console.log(`✓ ${sampleProducts.length} products inserted`);

    // Insert delivery settings
    console.log('Inserting delivery settings...');
    await db.collection('settings').insertOne(deliverySettings);
    console.log('✓ Delivery settings inserted');

    // Insert hero banners
    console.log('Inserting hero banners...');
    await db.collection('hero_banners').insertMany(heroBanners);
    console.log(`✓ ${heroBanners.length} hero banners inserted`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Visit http://localhost:3000');
    console.log('3. Add your logo to public/logo.png');
    console.log('4. Update hero banner images');
    console.log('5. Start adding real products via admin portal');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seed function
seed();