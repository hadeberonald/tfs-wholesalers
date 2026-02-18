const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in environment variables');
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
  
  const qtyStr = qty.toString().replace('.', '');
  return `${prefix}-${qtyStr}${uom.toUpperCase()}`;
}

// Helper function to generate barcode
function generateBarcode() {
  return '600' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
}

// Parse variants from string
function parseVariants(variantStr) {
  if (!variantStr || variantStr === 'nan' || variantStr === '') return [];
  
  const variants = variantStr.split(/[;,]/).map(v => v.trim()).filter(v => v && v !== '??' && v !== '?');
  return variants.length > 0 ? variants : [];
}

// Categorize products intelligently
function categorizeProduct(name, category, subcategory) {
  const nameLower = name.toLowerCase();
  const categories = [];
  
  // BEVERAGES
  if (nameLower.match(/juice|smoothie|nectar|rtd|fruitree|tropika|rhodes/)) {
    categories.push('beverages', 'juice');
  }
  else if (nameLower.match(/cola|sprite|fanta|stoney|pepsi|sparletta|kingsley|twizza cola/)) {
    categories.push('beverages', 'cold-drinks', 'soft-drinks');
  }
  else if (nameLower.match(/\bwater\b|aquelle|aquafria|thirsti/)) {
    categories.push('beverages', 'water');
  }
  else if (nameLower.match(/energy|mojo|reboost/)) {
    categories.push('beverages', 'energy-drinks');
  }
  else if (nameLower.match(/oros|cordial|squash|summertime/)) {
    categories.push('beverages', 'cordials');
  }
  else if (nameLower.match(/mocktail|brothers|cool salsa/)) {
    categories.push('beverages', 'mocktails');
  }
  
  // DAIRY & MILK
  else if (nameLower.match(/\bmilk\b|uht|clover|orange grove milk|creamline/)) {
    categories.push('groceries-food', 'milk-dairy', 'milk');
  }
  else if (nameLower.match(/\bbutter\b|first choice butter/) && !nameLower.match(/peanut/)) {
    categories.push('groceries-food', 'milk-dairy', 'butter');
  }
  else if (nameLower.match(/cheese|parmalat/)) {
    categories.push('groceries-food', 'milk-dairy', 'cheese');
  }
  else if (nameLower.match(/yogurt|yoghurt|danone|danup|power cup/)) {
    categories.push('groceries-food', 'milk-dairy', 'yogurt');
  }
  else if (nameLower.match(/amasi|amahewu|lifeway/)) {
    categories.push('groceries-food', 'milk-dairy', 'cultured-milk');
  }
  else if (nameLower.match(/margarine|rama|romi|sunshine d|d'lite|dlite|stork|wooden spoon/)) {
    categories.push('groceries-food', 'pantry', 'sandwich-spreads', 'margarine');
  }
  
  // PANTRY & STAPLES
  else if (nameLower.match(/\brice\b|supa choice rice|tri star/)) {
    categories.push('groceries-food', 'pantry', 'rice');
  }
  else if (nameLower.match(/maize|pap|iwisa|ace/)) {
    categories.push('groceries-food', 'pantry', 'maize-meal');
  }
  else if (nameLower.match(/\bsugar\b|brown sugar|white sugar/)) {
    categories.push('groceries-food', 'pantry', 'sugar');
  }
  else if (nameLower.match(/\bflour\b|cake flour|bread flour/)) {
    categories.push('groceries-food', 'pantry', 'flour');
  }
  else if (nameLower.match(/cooking oil|sunflower|vegetable oil|excella|sunglo/)) {
    categories.push('groceries-food', 'pantry', 'cooking-oil');
  }
  else if (nameLower.match(/peanut butter|peanut spread/)) {
    categories.push('groceries-food', 'pantry', 'sandwich-spreads', 'peanut-butter');
  }
  else if (nameLower.match(/mayonnaise|nola|mayo/)) {
    categories.push('groceries-food', 'pantry', 'sandwich-spreads', 'mayonnaise');
  }
  else if (nameLower.match(/jam|jelly|marmalade/)) {
    categories.push('groceries-food', 'pantry', 'sandwich-spreads', 'jam');
  }
  else if (nameLower.match(/coffee|cremora|ricoffy|frisco/)) {
    categories.push('groceries-food', 'pantry', 'coffee-tea', 'coffee');
  }
  else if (nameLower.match(/\btea\b|rooibos|five roses|joko/)) {
    categories.push('groceries-food', 'pantry', 'coffee-tea', 'tea');
  }
  else if (nameLower.match(/beans|koo|canned|tin|pilchards|chakalaka/)) {
    categories.push('groceries-food', 'pantry', 'canned-food');
  }
  else if (nameLower.match(/pasta|spaghetti|macaroni/)) {
    categories.push('groceries-food', 'pantry', 'pasta');
  }
  else if (nameLower.match(/spice|seasoning|aromat|royco|knorr|stock|curry|paprika/)) {
    categories.push('groceries-food', 'sauces-seasoning', 'spices');
  }
  else if (nameLower.match(/sauce|tomato sauce|chutney|atchar/)) {
    categories.push('groceries-food', 'sauces-seasoning', 'sauces');
  }
  
  // FROZEN & MEAT
  else if (nameLower.match(/chicken|iqf|polony|viennas|sausage|meat/)) {
    categories.push('groceries-food', 'frozen-foods', 'meat');
  }
  
  // SNACKS & TREATS
  else if (nameLower.match(/biscuit|oreo|baker|tennis|marie/)) {
    categories.push('snacks', 'biscuits');
  }
  else if (nameLower.match(/chip|crisp|nik nak|simba|lays/)) {
    categories.push('snacks', 'chips');
  }
  else if (nameLower.match(/chocolate|candy|sweet/)) {
    categories.push('snacks', 'confectionery');
  }
  
  // BREAKFAST
  else if (nameLower.match(/cereal|corn flakes|oats|jungle|pronutro/)) {
    categories.push('groceries-food', 'breakfast', 'cereal');
  }
  
  // CLEANING SUPPLIES
  else if (nameLower.match(/washing powder|washing liquid|auto|hand wash|omo|skip|surf|sunlight 2in1/)) {
    categories.push('cleaning-supplies', 'laundry', 'detergent');
  }
  else if (nameLower.match(/bleach|jik|miracle mom bleach/)) {
    categories.push('cleaning-supplies', 'bleach');
  }
  else if (nameLower.match(/softener|sta soft|comfort/)) {
    categories.push('cleaning-supplies', 'fabric-softener');
  }
  else if (nameLower.match(/dish.*wash|d\/wash|sunlight liq|plush/)) {
    categories.push('cleaning-supplies', 'dishwashing');
  }
  else if (nameLower.match(/cleaner|pine gel|jeyes|mr sheen|tile cleaner/)) {
    categories.push('cleaning-supplies', 'cleaners');
  }
  else if (nameLower.match(/green bar|maq.*bar|rave soap|daily soap|elangeni/) && nameLower.match(/soap/)) {
    categories.push('cleaning-supplies', 'laundry', 'bar-soap');
  }
  
  // PERSONAL CARE / COSMETICS
  else if (nameLower.match(/toothpaste|colgate|close up|aquafresh/)) {
    categories.push('cosmetics', 'oral-care', 'toothpaste');
  }
  else if (nameLower.match(/soap.*bar|lifebuoy|lux|protex|dettol|dove/) || (nameLower.match(/soap/) && nameLower.match(/\d{2,3}\s*g/))) {
    categories.push('cosmetics', 'bath-soap');
  }
  else if (nameLower.match(/roll on|deodorant|nivea roll|shield|rexona|playboy roll|playgirl roll/)) {
    categories.push('cosmetics', 'deodorant');
  }
  else if (nameLower.match(/lotion|cream|vaseline|ingram|nivea.*lotion|epimax/)) {
    categories.push('cosmetics', 'skin-care', 'lotion');
  }
  else if (nameLower.match(/body.*cream|face.*cream|hand.*cream/)) {
    categories.push('cosmetics', 'skin-care', 'cream');
  }
  else if (nameLower.match(/shampoo|conditioner/)) {
    categories.push('cosmetics', 'hair-care');
  }
  else if (nameLower.match(/panty liner|pad|feminine|gynaguard|comfitex/)) {
    categories.push('cosmetics', 'feminine-hygiene');
  }
  
  // HOUSEHOLD
  else if (nameLower.match(/candle|newden.*candle|britelite/)) {
    categories.push('household', 'candles');
  }
  else if (nameLower.match(/charcoal|ignite|lumpwood/)) {
    categories.push('braai-camping', 'charcoal');
  }
  else if (nameLower.match(/firelighter|fire.*lighter/)) {
    categories.push('braai-camping', 'firelighters');
  }
  else if (nameLower.match(/air freshener|airoma|glade|krisp/)) {
    categories.push('household', 'air-fresheners');
  }
  else if (nameLower.match(/refuse bag|bin liner|garbage bag/)) {
    categories.push('household', 'refuse-bags');
  }
  else if (nameLower.match(/polish|wax|kiwi|cobra.*wax|sunbeam.*wax/)) {
    categories.push('household', 'polish');
  }
  else if (nameLower.match(/insect|pest|doom|rattex|fast kill|blue death/)) {
    categories.push('household', 'pest-control');
  }
  else if (nameLower.match(/steel.*wool|steelwool|scourer/)) {
    categories.push('household', 'cleaning-accessories');
  }
  else if (nameLower.match(/distemper|paint/)) {
    categories.push('household', 'diy');
  }
  
  // PET SUPPLIES
  else if (nameLower.match(/parrot food|bird food|pet food/)) {
    categories.push('pet-supplies', 'bird-food');
  }
  
  // DEFAULT - use provided category
  else {
    if (category && category.toLowerCase().includes('beverage')) {
      categories.push('beverages');
    } else if (category && (category.toLowerCase().includes('groceries') || category.toLowerCase().includes('food'))) {
      categories.push('groceries-food', 'pantry');
    } else if (category && category.toLowerCase().includes('cleaning')) {
      categories.push('cleaning-supplies');
    } else if (category && category.toLowerCase().includes('cosmetic')) {
      categories.push('cosmetics');
    } else {
      categories.push('general');
    }
  }
  
  return categories;
}

// Generate descriptive product description
function generateDescription(name, categories, qty, uom) {
  const nameLower = name.toLowerCase();
  const catStr = categories.join(' ');
  
  // Beverages
  if (catStr.includes('juice')) {
    return `Refreshing ${name}. ${qty}${uom} of delicious, thirst-quenching goodness. Perfect for the whole family.`;
  }
  if (catStr.includes('cold-drinks')) {
    return `Enjoy ice-cold ${name}. ${qty}${uom} of refreshing beverage. Great for any occasion.`;
  }
  if (catStr.includes('water')) {
    return `Pure, clean ${name}. ${qty}${uom} of refreshing hydration. Essential for everyday living.`;
  }
  if (catStr.includes('energy-drinks')) {
    return `${name} - ${qty}${uom}. Packed with energy to keep you going throughout the day.`;
  }
  if (catStr.includes('cordials')) {
    return `${name} - ${qty}${uom}. Concentrated drink mix. Just add water for a refreshing beverage.`;
  }
  
  // Dairy
  if (catStr.includes('milk')) {
    return `Fresh ${name} - ${qty}${uom}. Rich in calcium and essential nutrients. Perfect for drinking or cooking.`;
  }
  if (catStr.includes('butter')) {
    return `${name} - ${qty}${uom}. Creamy and delicious. Perfect for spreading, baking, or cooking.`;
  }
  if (catStr.includes('cheese')) {
    return `${name} - ${qty}${uom}. Delicious cheese. Perfect for sandwiches, cooking, or snacking.`;
  }
  if (catStr.includes('yogurt')) {
    return `${name} - ${qty}${uom}. Smooth, creamy yogurt. Packed with probiotics and great taste.`;
  }
  if (catStr.includes('margarine')) {
    return `${name} - ${qty}${uom}. Smooth and spreadable. Great for everyday cooking and baking.`;
  }
  
  // Pantry
  if (catStr.includes('rice')) {
    return `${name} - ${qty}${uom}. Premium quality rice. Cooks to perfection every time. A staple for every kitchen.`;
  }
  if (catStr.includes('maize-meal')) {
    return `${name} - ${qty}${uom}. Quality maize meal for authentic pap. Essential for traditional South African meals.`;
  }
  if (catStr.includes('sugar')) {
    return `${name} - ${qty}${uom}. Pure sweetness for all your baking and cooking needs.`;
  }
  if (catStr.includes('flour')) {
    return `${name} - ${qty}${uom}. Fine quality flour. Perfect for baking bread, cakes, and pastries.`;
  }
  if (catStr.includes('cooking-oil')) {
    return `${name} - ${qty}${uom}. Pure cooking oil. Ideal for frying, baking, and salad dressings.`;
  }
  if (catStr.includes('peanut-butter')) {
    return `${name} - ${qty}${uom}. Creamy peanut butter. Protein-rich and delicious. Perfect for sandwiches.`;
  }
  if (catStr.includes('coffee')) {
    return `${name} - ${qty}${uom}. Rich coffee for a perfect brew. Wake up to great taste.`;
  }
  if (catStr.includes('canned-food')) {
    return `${name} - ${qty}${uom}. Quality canned food. Quick and convenient meal solution.`;
  }
  if (catStr.includes('spices')) {
    return `${name} - ${qty}${uom}. Authentic spice for flavorful cooking. Essential in every kitchen.`;
  }
  
  // Frozen
  if (catStr.includes('meat') || catStr.includes('chicken')) {
    return `${name} - ${qty}${uom}. Quality meat product. Perfect for grilling, frying, or roasting.`;
  }
  
  // Snacks
  if (catStr.includes('biscuits')) {
    return `${name} - ${qty}${uom}. Delicious biscuits perfect for tea time or snacking. Great value.`;
  }
  if (catStr.includes('chips')) {
    return `${name} - ${qty}${uom}. Crunchy, flavorful chips. Perfect for sharing or snacking.`;
  }
  
  // Cleaning
  if (catStr.includes('detergent') || catStr.includes('laundry')) {
    return `${name} - ${qty}${uom}. Powerful cleaning for fresh, clean laundry. Tough on stains.`;
  }
  if (catStr.includes('bleach')) {
    return `${name} - ${qty}${uom}. Powerful disinfectant and whitener. Kills germs and removes stains.`;
  }
  if (catStr.includes('dishwashing')) {
    return `${name} - ${qty}${uom}. Effective dishwashing liquid. Cuts through grease for sparkling dishes.`;
  }
  if (catStr.includes('cleaners')) {
    return `${name} - ${qty}${uom}. Multi-purpose cleaner for a sparkling clean home.`;
  }
  
  // Personal Care
  if (catStr.includes('toothpaste')) {
    return `${name} - ${qty}${uom}. Fresh breath and healthy teeth. For the whole family.`;
  }
  if (catStr.includes('bath-soap')) {
    return `${name} - ${qty}${uom}. Gentle on skin, tough on dirt. Leaves you feeling fresh and clean.`;
  }
  if (catStr.includes('deodorant')) {
    return `${name} - ${qty}${uom}. All-day freshness and protection. Stay confident all day long.`;
  }
  if (catStr.includes('lotion') || catStr.includes('cream')) {
    return `${name} - ${qty}${uom}. Nourishing moisturizer for soft, smooth skin.`;
  }
  
  // Household
  if (catStr.includes('candles')) {
    return `${name} - ${qty}${uom}. Long-lasting illumination. Essential for load shedding.`;
  }
  if (catStr.includes('charcoal')) {
    return `${name} - ${qty}${uom}. Premium quality charcoal for perfect braais. Burns hot and long.`;
  }
  
  // Default
  return `${name} - ${qty}${uom}. Quality product from a trusted brand. Great value for South African families.`;
}

async function migrate() {
  try {
    console.log('🚀 Starting Complete Vryheid Products Migration...\n');
    console.log('📡 Connecting to MongoDB...');
    
    await client.connect();
    const db = client.db('tfs-wholesalers');
    console.log('✅ Connected successfully\n');

    // Get Vryheid branch
    const branch = await db.collection('branches').findOne({ slug: 'vryheid' });
    
    if (!branch) {
      console.error('❌ Branch "vryheid" not found.');
      return;
    }

    console.log(`✅ Using branch: ${branch.displayName}\n`);

    // Read products from JSON file
    const fs = require('fs');
    const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'products_no_specials.json'), 'utf8'));
    
    // Filter out already migrated products
    const MIGRATED = ['Supa Choice Rice', 'Tri Star Rice', 'Supa Choice Brown Sugar', "D'lite Cooking Oil", 
                      'Sunglo Cooking Oil', 'Excella Sunflower Oil', 'Original Oreo', 'Maq Washing Powder',
                      'Koo Baked Beans', 'Freddy Hirsch Heroes Spice', 'Legacy Spice Shisanyama', 'Cremora',
                      'Nola Mayonnaise', 'Coo-ee', 'Reboost', 'Rainbow IQF', 'First Choice Block Cheese',
                      'Sunshine D Brick', 'Parmalat Cheese Slices', 'Oros', 'Twizza Energy', 'First Choice Milk',
                      'Sunlight Soap', 'Maq Auto Liquid', 'Ignite Charcoal', 'Sunlight Washing Powder',
                      'Securex Spa', 'Supa Choice Maize Meal'];
    
    const products = productsData.filter(p => 
      !MIGRATED.some(name => p.name.includes(name) || name.includes(p.name))
    );

    console.log(`📦 Processing ${products.length} unmigrated products\n`);

    // Create category map
    const categoryMap = new Map();
    const uniqueCategories = new Set();

    // Extract all unique categories
    products.forEach(p => {
      const cats = categorizeProduct(p.name, p.category, p.subcategory);
      cats.forEach(cat => uniqueCategories.add(cat));
    });

    console.log(`📁 Found ${uniqueCategories.size} unique categories\n`);

    // Create/find categories
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
      }
    }

    console.log('\n📦 Migrating products...\n');

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const sku = generateSKU(product.name, product.qty, product.uom);
        
        // Get categories
        const categoryHierarchy = categorizeProduct(product.name, product.category, product.subcategory);
        const categoryIds = categoryHierarchy
          .map(slug => categoryMap.get(slug))
          .filter(Boolean);

        // Parse variants
        const variants = parseVariants(product.variants);
        const hasVariants = variants.length > 0;

        // Generate description
        const description = generateDescription(product.name, categoryHierarchy, product.qty, product.uom);

        // Check if exists
        const existing = await db.collection('products').findOne({
          sku: sku,
          branchId: branch._id
        });

        const productDoc = {
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
          hasVariants: hasVariants,
          variants: hasVariants ? variants.map((v, idx) => ({
            _id: new ObjectId().toString(),
            name: v,
            sku: `${sku}-${idx + 1}`,
            barcode: generateBarcode(),
            stockLevel: 50,
            images: [],
            active: true
          })) : undefined,
          onSpecial: false,
          active: true,
          featured: false,
          unit: product.uom,
          unitQuantity: product.qty,
          branchId: branch._id,
          createdAt: existing ? existing.createdAt : new Date(),
          updatedAt: new Date()
        };

        if (existing) {
          await db.collection('products').updateOne(
            { _id: existing._id },
            { $set: productDoc }
          );
          console.log(`  ♻️  Updated: ${product.name}${hasVariants ? ` (${variants.length} variants)` : ''}`);
          updated++;
        } else {
          await db.collection('products').insertOne(productDoc);
          console.log(`  ✅ Created: ${product.name}${hasVariants ? ` (${variants.length} variants)` : ''}`);
          created++;
        }

      } catch (error) {
        console.error(`  ❌ Error: ${product.name} - ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`🏪 Branch: ${branch.displayName}`);
    console.log(`✅ Created: ${created} products`);
    console.log(`♻️  Updated: ${updated} products`);
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

migrate().catch(console.error);