const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.log('Current directory:', __dirname);
  console.log('Looking for .env at:', path.join(__dirname, '..', '.env'));
  process.exit(1);
}
const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

// Helper function to generate SKU
function generateSKU(productName, qty, uom) {
  const prefix = productName
    .split(' ')
    .slice(0, 2)
    .map(word => word.substring(0, 3).toUpperCase())
    .join('');
  
  return `${prefix}-${qty}${uom.toUpperCase()}`;
}

// Helper function to generate barcode (random 13-digit)
function generateBarcode() {
  return '600' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
}

// Helper function to parse categories from subcategory string into array
function parseCategories(subcategoryString) {
  if (!subcategoryString) return ['general'];
  
  // Split by semicolon and clean up
  const categories = subcategoryString
    .split(';')
    .map(cat => cat.trim())
    .filter(cat => cat.length > 0)
    .map(cat => cat.toLowerCase().replace(/\s+/g, '-'));
  
  return categories.length > 0 ? categories : ['general'];
}

// Helper function to generate product description
function generateDescription(productName, categories, qty, uom) {
  const descriptions = {
    'peanut-butter': `Delicious and creamy ${productName}. Perfect for sandwiches, smoothies, or as a protein-rich snack. Made with quality ingredients for that authentic taste.`,
    'rice': `Premium quality ${productName}. Perfect for everyday meals, special occasions, or traditional dishes. Cooks to a fluffy, non-sticky texture every time.`,
    'maize-meal': `High-quality ${productName} for making traditional pap and porridge. Finely milled for a smooth texture and consistent results. A staple in South African kitchens.`,
    'sugar': `Pure ${productName} perfect for baking, cooking, and sweetening. Adds the perfect touch of sweetness to your favorite recipes and beverages.`,
    'cooking-oil': `Pure and healthy ${productName}. Ideal for all your cooking needs - frying, baking, and salad dressings. Light taste that doesn't overpower your food.`,
    'biscuits': `Delicious ${productName}. The perfect treat for any time of day. Great for lunchboxes, tea time, or as a sweet indulgence.`,
    'soap': `Effective ${productName} for superior cleaning. Gentle on fabrics while tough on stains. Leaves clothes fresh and clean with a pleasant fragrance.`,
    'canned-food': `Quality ${productName} packed with flavor and nutrition. Quick and convenient for any meal. Perfect for breakfast, lunch, or as a side dish.`,
    'spices': `Authentic ${productName} to enhance your cooking. Adds rich flavor and aroma to all your favorite dishes. A must-have in every kitchen.`,
    'coffee': `Premium ${productName} for coffee lovers. Rich, smooth, and aromatic. The perfect way to start your day or enjoy a break.`,
    'mayonnaise': `Creamy ${productName} made with quality ingredients. Perfect for sandwiches, salads, and as a cooking ingredient. Adds flavor to any meal.`,
    'cold-drinks': `Refreshing ${productName}. Perfect for quenching your thirst on hot days or enjoying with meals. Great for parties and gatherings.`,
    'energy-drinks': `Energizing ${productName} to keep you going. Packed with vitamins and energy-boosting ingredients. Perfect for active lifestyles.`,
    'chicken': `Quality ${productName}. Conveniently frozen for freshness. Perfect for grilling, frying, roasting, or adding to your favorite recipes.`,
    'cheese': `Delicious ${productName} with authentic flavor. Perfect for sandwiches, cooking, or snacking. Adds richness to any dish.`,
    'margarine': `Smooth and spreadable ${productName}. Perfect for baking, cooking, and spreading on bread. Made with quality vegetable oils.`,
    'cordials': `Concentrated ${productName} for making delicious drinks. Just add water for a refreshing beverage. Great value for families.`,
    'milk': `Fresh ${productName} packed with calcium and nutrients. Perfect for drinking, cooking, baking, or adding to cereals and beverages.`,
    'soap-bars': `Gentle ${productName} for daily use. Cleanses and refreshes while being kind to your skin. Produces a rich, creamy lather.`,
    'charcoal': `Quality ${productName} for braais and outdoor cooking. Burns hot and long for perfect grilling. Essential for any braai master.`,
    'general': `Quality ${productName}. A trusted choice for South African households. Excellent value and reliable quality you can depend on.`
  };

  // Find matching description based on categories
  for (const category of categories) {
    if (descriptions[category]) {
      return descriptions[category];
    }
  }

  return descriptions['general'];
}

// Product data from Excel - EXCLUDING PRODUCTS WITH SPECIALS
const products = [
  {
    name: "Supa Choice Rice",
    category: "Groceries & Food",
    subcategories: ["pantry", "rice"],
    uom: "kg",
    qty: 10,
    price: 85.99
  },
  {
    name: "Tri Star Rice",
    category: "Groceries & Food",
    subcategories: ["pantry", "maize-meal"],
    uom: "kg",
    qty: 10,
    price: 85.99
  },
  {
    name: "Supa Choice Brown Sugar",
    category: "Groceries & Food",
    subcategories: ["pantry", "sugar"],
    uom: "kg",
    qty: 10,
    price: 174.99
  },
  {
    name: "D'lite Cooking Oil",
    category: "Groceries & Food",
    subcategories: ["pantry", "cooking-oil"],
    uom: "L",
    qty: 5,
    price: 125.99
  },
  {
    name: "Sunglo Cooking Oil",
    category: "Groceries & Food",
    subcategories: ["pantry", "cooking-oil"],
    uom: "L",
    qty: 5,
    price: 125.99
  },
  {
    name: "D'lite Cooking Oil 4L",
    category: "Groceries & Food",
    subcategories: ["pantry", "cooking-oil"],
    uom: "L",
    qty: 4,
    price: 99.99
  },
  {
    name: "Excella Sunflower Oil",
    category: "Groceries & Food",
    subcategories: ["pantry", "cooking-oil"],
    uom: "L",
    qty: 5,
    price: 144.99
  },
  {
    name: "Original Oreo",
    category: "Snacks, Biscuits & Confectionary",
    subcategories: ["biscuits"],
    uom: "g",
    qty: 41.7,
    price: 79.99,
    packSize: 24,
    note: "Price for 24-pack"
  },
  {
    name: "Maq Washing Powder",
    category: "Cleaning Supplies",
    subcategories: ["soap", "detergent"],
    uom: "kg",
    qty: 2,
    price: 58.99
  },
  {
    name: "Koo Baked Beans",
    category: "Groceries & Food",
    subcategories: ["pantry", "canned-food"],
    uom: "g",
    qty: 410,
    price: 14.99
  },
  {
    name: "Freddy Hirsch Heroes Spice",
    category: "Groceries & Food",
    subcategories: ["sauces", "seasoning", "spices"],
    uom: "g",
    qty: 200,
    price: 8.99
  },
  {
    name: "Legacy Spice Shisanyama",
    category: "Groceries & Food",
    subcategories: ["sauces", "seasoning", "spices"],
    uom: "g",
    qty: 200,
    price: 8.99
  },
  {
    name: "Cremora",
    category: "Groceries & Food",
    subcategories: ["pantry", "coffee", "tea", "creamers"],
    uom: "g",
    qty: 750,
    price: 49.99
  },
  {
    name: "Nola Mayonnaise",
    category: "Groceries & Food",
    subcategories: ["pantry", "sandwich-spreads", "sauces", "mayonnaise"],
    uom: "ml",
    qty: 750,
    price: 32.99
  },
  {
    name: "Coo-ee",
    category: "Beverages",
    subcategories: ["cold-drinks"],
    uom: "L",
    qty: 2,
    price: 10.99,
    variants: ["Mojito", "Pina Colada", "Strawberry Daquiri"]
  },
  {
    name: "Reboost",
    category: "Beverages",
    subcategories: ["energy-drinks"],
    uom: "ml",
    qty: 300,
    price: 39.99,
    packSize: 12,
    note: "Price for 12-pack"
  },
  {
    name: "Rainbow IQF",
    category: "Groceries & Food",
    subcategories: ["frozen-foods", "chicken"],
    uom: "kg",
    qty: 2,
    price: 84.99
  },
  {
    name: "First Choice Block Cheese",
    category: "Groceries & Food",
    subcategories: ["milk-dairy", "cheese"],
    uom: "g",
    qty: 700,
    price: 79.99
  },
  {
    name: "Sunshine D Brick",
    category: "Groceries & Food",
    subcategories: ["pantry", "sandwich-spreads", "margarine"],
    uom: "g",
    qty: 500,
    price: 19.99
  },
  {
    name: "Parmalat Cheese Slices",
    category: "Groceries & Food",
    subcategories: ["milk-dairy", "cheese"],
    uom: "g",
    qty: 900,
    price: 89.99
  },
  {
    name: "Oros",
    category: "Beverages",
    subcategories: ["cordials"],
    uom: "L",
    qty: 5,
    price: 74.99
  },
  {
    name: "Twizza Energy",
    category: "Beverages",
    subcategories: ["energy-drinks"],
    uom: "ml",
    qty: 500,
    price: 19.99,
    packSize: 6,
    note: "Price for 6-pack"
  },
  {
    name: "First Choice Milk",
    category: "Groceries & Food",
    subcategories: ["milk-dairy", "milk"],
    uom: "L",
    qty: 1,
    price: 84.99,
    packSize: 6,
    note: "Price for 6-pack"
  },
  {
    name: "Sunlight Soap",
    category: "Cleaning Supplies",
    subcategories: ["soap", "detergent", "soap-bars"],
    uom: "g",
    qty: 500,
    price: 17.99
  },
  {
    name: "Maq Auto Liquid",
    category: "Cleaning Supplies",
    subcategories: ["soap", "detergent"],
    uom: "L",
    qty: 1.5,
    price: 64.99
  },
  {
    name: "Ignite Charcoal",
    category: "Braai & Camping",
    subcategories: ["charcoal"],
    uom: "kg",
    qty: 10,
    price: 129.99
  },
  {
    name: "Sunlight Washing Powder",
    category: "Cleaning Supplies",
    subcategories: ["soap", "detergent"],
    uom: "kg",
    qty: 2,
    price: 49.99
  },
  {
    name: "Securex Spa",
    category: "Cosmetics",
    subcategories: ["soap-bars"],
    uom: "g",
    qty: 175,
    price: 9.99
  },
  {
    name: "Supa Choice Maize Meal",
    category: "Groceries & Food",
    subcategories: ["pantry", "maize-meal"],
    uom: "kg",
    qty: 10,
    price: 59.99
  }
];

async function migrate() {
  try {
    console.log('🚀 Starting Vryheid Products Migration...\n');
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    const db = client.db('tfs-wholesalers');
    console.log('✅ Connected successfully\n');

    // Get Vryheid branch
    console.log('📍 Fetching Vryheid branch...');
    const branch = await db.collection('branches').findOne({ slug: 'vryheid' });
    
    if (!branch) {
      console.error('❌ Branch "vryheid" not found.');
      console.log('\n💡 Available branches:');
      const branches = await db.collection('branches').find({}).toArray();
      branches.forEach(b => console.log(`  - ${b.slug} (${b.displayName})`));
      return;
    }

    console.log(`✅ Using branch: ${branch.displayName} (ID: ${branch._id})\n`);

    // Create category map
    console.log('📁 Processing categories...');
    const categoryMap = new Map();
    const uniqueCategories = new Set();

    // Extract unique categories from products
    products.forEach(p => {
      p.subcategories.forEach(cat => uniqueCategories.add(cat));
    });

    console.log(`Found ${uniqueCategories.size} unique categories\n`);

    // Create/find categories for Vryheid branch
    for (const catSlug of uniqueCategories) {
      const catName = catSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      let category = await db.collection('categories').findOne({
        slug: catSlug,
        branchId: branch._id
      });

      if (!category) {
        const result = await db.collection('categories').insertOne({
          name: catName,
          slug: catSlug,
          branchId: branch._id,
          parentId: null,
          level: 0,
          order: 0,
          active: true,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        categoryMap.set(catSlug, result.insertedId.toString());
        console.log(`  ✓ Created: ${catName}`);
      } else {
        categoryMap.set(catSlug, category._id.toString());
        console.log(`  ✓ Found: ${catName}`);
      }
    }

    console.log('\n📦 Migrating products for Vryheid...\n');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const sku = generateSKU(product.name, product.qty, product.uom);
        
        // Check if exists in Vryheid branch
        const exists = await db.collection('products').findOne({
          sku: sku,
          branchId: branch._id
        });

        if (exists) {
          console.log(`  ⏭️  Skipped: ${product.name} (already exists in Vryheid)`);
          skipped++;
          continue;
        }

        // Get category IDs (slugs stored as strings in categories array)
        const categoryIds = product.subcategories
          .map(slug => categoryMap.get(slug))
          .filter(Boolean);

        // Generate description
        const description = generateDescription(
          product.name, 
          product.subcategories, 
          product.qty, 
          product.uom
        );

        // Build product with or without variants
        let productDoc;

        if (product.variants && product.variants.length > 0) {
          // Product has variants
          productDoc = {
            name: product.name,
            slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: description,
            categories: categoryIds,
            price: product.price,
            sku: sku,
            barcode: generateBarcode(),
            stockLevel: 100,
            lowStockThreshold: 20,
            images: [],
            hasVariants: true,
            variants: product.variants.map((variantName, idx) => ({
              _id: new ObjectId().toString(),
              name: variantName,
              sku: `${sku}-${idx + 1}`,
              barcode: generateBarcode(),
              stockLevel: 50,
              images: [],
              active: true
            })),
            onSpecial: false,
            active: true,
            featured: false,
            unit: product.uom,
            unitQuantity: product.qty,
            branchId: branch._id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } else {
          // Regular product
          productDoc = {
            name: product.name,
            slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: description,
            categories: categoryIds,
            price: product.price,
            sku: sku,
            barcode: generateBarcode(),
            stockLevel: 100,
            lowStockThreshold: 20,
            images: [],
            hasVariants: false,
            onSpecial: false,
            active: true,
            featured: false,
            unit: product.uom,
            unitQuantity: product.qty,
            branchId: branch._id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }

        // Add note if exists
        if (product.note) {
          productDoc.description += ` Note: ${product.note}`;
        }

        await db.collection('products').insertOne(productDoc);
        
        const displayName = productDoc.hasVariants 
          ? `${product.name} (${product.variants.length} variants)`
          : `${product.name} (${product.qty}${product.uom})`;
        
        console.log(`  ✅ ${displayName}`);
        created++;

      } catch (error) {
        console.error(`  ❌ Error: ${product.name} - ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 VRYHEID MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`🏪 Branch: ${branch.displayName}`);
    console.log(`✅ Created: ${created} products`);
    console.log(`⏭️  Skipped: ${skipped} products (already exist)`);
    console.log(`❌ Errors: ${errors} products`);
    console.log(`📦 Total: ${products.length} products processed`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

// Run migration
migrate().catch(console.error);