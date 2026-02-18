const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found');
  process.exit(1);
}

const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

function generateSKU(name, qty, uom) {
  const prefix = name.split(' ').slice(0, 2).map(w => w.substring(0, 3).toUpperCase()).join('');
  return `${prefix}-${qty.toString().replace('.', '')}${uom.toUpperCase()}`;
}

function generateBarcode() {
  return '600' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
}

function parseVariants(str) {
  if (!str) return [];
  return str.split(/[;,]/).map(v => v.trim()).filter(v => v && v !== '??' && v !== '?');
}

function categorizeProduct(name) {
  const n = name.toLowerCase();
  
  // Beverages
  if (n.match(/juice|smoothie|nectar|rtd|fruitree|tropika|rhodes/)) return ['beverages', 'juice'];
  if (n.match(/cola|sprite|fanta|stoney|pepsi|sparletta/)) return ['beverages', 'cold-drinks'];
  if (n.match(/\bwater\b|aquelle|aquafria|thirsti/)) return ['beverages', 'water'];
  if (n.match(/energy|mojo/)) return ['beverages', 'energy-drinks'];
  if (n.match(/oros|cordial|squash|summertime/)) return ['beverages', 'cordials'];
  if (n.match(/mocktail|brothers|cool salsa/)) return ['beverages', 'mocktails'];
  
  // Dairy
  if (n.match(/\bmilk\b|uht|clover.*milk|orange grove milk|creamline/)) return ['groceries-food', 'milk-dairy', 'milk'];
  if (n.match(/\bbutter\b|first choice butter/) && !n.match(/peanut/)) return ['groceries-food', 'milk-dairy', 'butter'];
  if (n.match(/cheese|parmalat/)) return ['groceries-food', 'milk-dairy', 'cheese'];
  if (n.match(/yogurt|yoghurt|danone|danup|power cup/)) return ['groceries-food', 'milk-dairy', 'yogurt'];
  if (n.match(/amasi|amahewu|lifeway/)) return ['groceries-food', 'milk-dairy'];
  if (n.match(/margarine|rama|romi|sunshine d|dlite|stork|wooden spoon/)) return ['groceries-food', 'pantry', 'margarine'];
  
  // Pantry
  if (n.match(/peanut butter|peanut spread|chommie/)) return ['groceries-food', 'pantry', 'peanut-butter'];
  if (n.match(/mayonnaise|nola|mayo.*mzansi/)) return ['groceries-food', 'pantry', 'mayonnaise'];
  if (n.match(/jam|jelly|marmalade/)) return ['groceries-food', 'pantry', 'jam'];
  if (n.match(/coffee|cremora|ricoffy|frisco/)) return ['groceries-food', 'pantry', 'coffee'];
  if (n.match(/\btea\b|rooibos|five roses|joko/)) return ['groceries-food', 'pantry', 'tea'];
  if (n.match(/beans|koo|canned|pilchards|chakalaka|tomato puree/)) return ['groceries-food', 'pantry', 'canned-food'];
  if (n.match(/pasta|spaghetti|macaroni/)) return ['groceries-food', 'pantry', 'pasta'];
  if (n.match(/spice|seasoning|aromat|royco|knorr|stock|curry|paprika|six gun|robertson|benny/)) return ['groceries-food', 'sauces-seasoning'];
  if (n.match(/sauce|tomato sauce|chutney|atchar|chip.*dip|peri peri|taxi sauce/)) return ['groceries-food', 'sauces-seasoning'];
  if (n.match(/soup|knorrox.*soup|la italiana/)) return ['groceries-food', 'pantry', 'soup'];
  
  // Frozen
  if (n.match(/chicken|iqf|polony|viennas|sausage|eskort|fatti/)) return ['groceries-food', 'frozen-foods', 'meat'];
  
  // Snacks
  if (n.match(/biscuit|oreo|baker|tennis|marie/)) return ['snacks', 'biscuits'];
  if (n.match(/chip|crisp|nik nak|simba|lays/)) return ['snacks', 'chips'];
  
  // Cleaning
  if (n.match(/washing powder|washing liquid|omo|skip|surf|sunlight 2in1/)) return ['cleaning-supplies', 'laundry'];
  if (n.match(/bleach|jik|miracle mom bleach/)) return ['cleaning-supplies', 'bleach'];
  if (n.match(/softener|sta soft/)) return ['cleaning-supplies', 'fabric-softener'];
  if (n.match(/dish.*wash|d\/wash|sunlight liq|plush/)) return ['cleaning-supplies', 'dishwashing'];
  if (n.match(/cleaner|pine gel|jeyes|mr sheen|tile cleaner/)) return ['cleaning-supplies', 'cleaners'];
  if (n.match(/green bar|maq.*bar|rave soap|daily soap|elangeni/) && n.match(/soap/)) return ['cleaning-supplies', 'bar-soap'];
  
  // Personal Care
  if (n.match(/toothpaste|colgate|close up/)) return ['cosmetics', 'oral-care'];
  if (n.match(/soap.*bar|lifebuoy|lux|protex|dettol|dove/) || (n.match(/soap/) && n.match(/\d{2,3}/))) return ['cosmetics', 'bath-soap'];
  if (n.match(/roll on|deodorant|nivea roll|shield|playboy|playgirl/)) return ['cosmetics', 'deodorant'];
  if (n.match(/lotion|cream|vaseline|ingram|nivea.*lotion|epimax/)) return ['cosmetics', 'skin-care'];
  if (n.match(/panty liner|pad|feminine|gynaguard|comfitex/)) return ['cosmetics', 'feminine-hygiene'];
  
  // Household
  if (n.match(/candle|newden.*candle|britelite/)) return ['household', 'candles'];
  if (n.match(/charcoal|ignite|lumpwood/)) return ['braai-camping', 'charcoal'];
  if (n.match(/firelighter|fire.*lighter/)) return ['braai-camping', 'firelighters'];
  if (n.match(/air freshener|airoma|glade|krisp/)) return ['household', 'air-fresheners'];
  if (n.match(/refuse bag|bin liner/)) return ['household', 'refuse-bags'];
  if (n.match(/polish|wax|kiwi|cobra|sunbeam.*wax/)) return ['household', 'polish'];
  if (n.match(/insect|doom|rattex|fast kill/)) return ['household', 'pest-control'];
  if (n.match(/steel.*wool|scourer/)) return ['household', 'cleaning-accessories'];
  if (n.match(/parrot food|bird food/)) return ['pet-supplies', 'bird-food'];
  
  return ['general'];
}

function generateDescription(name, cats, qty, uom) {
  const c = cats.join(' ');
  if (c.includes('juice')) return `Refreshing ${name}. ${qty}${uom} of delicious goodness. Perfect for the family.`;
  if (c.includes('cold-drinks')) return `Ice-cold ${name}. ${qty}${uom} of refreshing beverage.`;
  if (c.includes('water')) return `Pure ${name}. ${qty}${uom} of refreshing hydration.`;
  if (c.includes('energy-drinks')) return `${name} - ${qty}${uom}. Energy to keep you going.`;
  if (c.includes('milk')) return `Fresh ${name} - ${qty}${uom}. Rich in calcium and nutrients.`;
  if (c.includes('butter')) return `${name} - ${qty}${uom}. Creamy and delicious.`;
  if (c.includes('cheese')) return `${name} - ${qty}${uom}. Perfect for sandwiches or snacking.`;
  if (c.includes('yogurt')) return `${name} - ${qty}${uom}. Smooth, creamy yogurt.`;
  if (c.includes('margarine')) return `${name} - ${qty}${uom}. Smooth and spreadable.`;
  if (c.includes('peanut-butter')) return `${name} - ${qty}${uom}. Protein-rich and delicious.`;
  if (c.includes('coffee')) return `${name} - ${qty}${uom}. Rich coffee for a perfect brew.`;
  if (c.includes('canned-food')) return `${name} - ${qty}${uom}. Quick and convenient.`;
  if (c.includes('spices') || c.includes('sauces-seasoning')) return `${name} - ${qty}${uom}. Flavorful seasoning.`;
  if (c.includes('meat')) return `${name} - ${qty}${uom}. Quality meat product.`;
  if (c.includes('biscuits')) return `${name} - ${qty}${uom}. Delicious biscuits.`;
  if (c.includes('chips')) return `${name} - ${qty}${uom}. Crunchy, flavorful chips.`;
  if (c.includes('laundry')) return `${name} - ${qty}${uom}. Powerful cleaning for fresh laundry.`;
  if (c.includes('bleach')) return `${name} - ${qty}${uom}. Disinfectant and whitener.`;
  if (c.includes('dishwashing')) return `${name} - ${qty}${uom}. Cuts through grease.`;
  if (c.includes('toothpaste')) return `${name} - ${qty}${uom}. Fresh breath and healthy teeth.`;
  if (c.includes('bath-soap')) return `${name} - ${qty}${uom}. Fresh and clean.`;
  if (c.includes('deodorant')) return `${name} - ${qty}${uom}. All-day freshness.`;
  if (c.includes('skin-care')) return `${name} - ${qty}${uom}. Nourishing moisturizer.`;
  if (c.includes('candles')) return `${name} - ${qty}${uom}. Essential for load shedding.`;
  if (c.includes('charcoal')) return `${name} - ${qty}${uom}. Perfect for braais.`;
  return `${name} - ${qty}${uom}. Quality product from a trusted brand.`;
}

// Compact products data - decodes to full products
const PRODUCTS = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'products_no_specials.json'), 'utf8'));

async function migrate() {
  try {
    console.log('🚀 Starting Migration...\n');
    await client.connect();
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({ slug: 'vryheid' });
    if (!branch) {
      console.error('❌ Branch not found');
      return;
    }
    
    console.log(`✅ Branch: ${branch.displayName}\n`);
    
    // Filter already migrated
    const MIGRATED = ['Supa Choice Rice', 'Tri Star Rice', 'Supa Choice Brown Sugar', "D'lite Cooking Oil", 
                      'Sunglo Cooking Oil', 'Excella Sunflower Oil', 'Original Oreo', 'Maq Washing Powder',
                      'Koo Baked Beans', 'Freddy Hirsch Heroes Spice', 'Legacy Spice Shisanyama', 'Cremora',
                      'Nola Mayonnaise', 'Coo-ee', 'Reboost', 'Rainbow IQF', 'First Choice Block Cheese',
                      'Sunshine D Brick', 'Parmalat Cheese Slices', 'Oros', 'Twizza Energy', 'First Choice Milk',
                      'Sunlight Soap', 'Maq Auto Liquid', 'Ignite Charcoal', 'Sunlight Washing Powder',
                      'Securex Spa', 'Supa Choice Maize Meal'];
    
    const products = PRODUCTS.filter(p => !MIGRATED.some(m => p.name.includes(m) || m.includes(p.name)));
    
    console.log(`📦 Processing ${products.length} products\n`);
    
    // Get categories
    const categoryMap = new Map();
    const uniqueCats = new Set();
    
    products.forEach(p => {
      categorizeProduct(p.name).forEach(c => uniqueCats.add(c));
    });
    
    for (const slug of uniqueCats) {
      const name = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      let cat = await db.collection('categories').findOne({ slug, branchId: branch._id });
      
      if (!cat) {
        const r = await db.collection('categories').insertOne({
          name, slug, branchId: branch._id, parentId: null, level: 0, order: 0,
          active: true, featured: false, createdAt: new Date(), updatedAt: new Date()
        });
        categoryMap.set(slug, r.insertedId.toString());
        console.log(`  ✓ ${name}`);
      } else {
        categoryMap.set(slug, cat._id.toString());
      }
    }
    
    console.log('\n📦 Migrating...\n');
    
    let created = 0, updated = 0, errors = 0;
    
    for (const p of products) {
      try {
        const sku = generateSKU(p.name, p.qty, p.uom);
        const cats = categorizeProduct(p.name);
        const catIds = cats.map(s => categoryMap.get(s)).filter(Boolean);
        const variants = parseVariants(p.variants);
        const hasVariants = variants.length > 0;
        const desc = generateDescription(p.name, cats, p.qty, p.uom);
        
        const existing = await db.collection('products').findOne({ sku, branchId: branch._id });
        
        const doc = {
          name: p.name,
          slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: desc,
          categories: catIds,
          price: p.price,
          sku,
          barcode: generateBarcode(),
          stockLevel: 100,
          lowStockThreshold: 20,
          images: [],
          hasVariants,
          variants: hasVariants ? variants.map((v, i) => ({
            _id: new ObjectId().toString(),
            name: v,
            sku: `${sku}-${i + 1}`,
            barcode: generateBarcode(),
            stockLevel: 50,
            images: [],
            active: true
          })) : undefined,
          onSpecial: false,
          active: true,
          featured: false,
          unit: p.uom,
          unitQuantity: p.qty,
          branchId: branch._id,
          createdAt: existing ? existing.createdAt : new Date(),
          updatedAt: new Date()
        };
        
        if (existing) {
          await db.collection('products').updateOne({ _id: existing._id }, { $set: doc });
          console.log(`  ♻️  ${p.name}${hasVariants ? ` (${variants.length})` : ''}`);
          updated++;
        } else {
          await db.collection('products').insertOne(doc);
          console.log(`  ✅ ${p.name}${hasVariants ? ` (${variants.length})` : ''}`);
          created++;
        }
      } catch (err) {
        console.error(`  ❌ ${p.name} - ${err.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Created:', created);
    console.log('♻️  Updated:', updated);
    console.log('❌ Errors:', errors);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await client.close();
  }
}

migrate();