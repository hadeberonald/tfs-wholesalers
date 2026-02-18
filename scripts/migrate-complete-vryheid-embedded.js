const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection
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

// Helper function to generate barcode (random 13-digit)
function generateBarcode() {
  return '600' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
}

// Helper function to generate product description based on category
function generateDescription(productName, categories, qty, uom) {
  const categoryLower = categories.join(' ').toLowerCase();
  
  const descriptions = {
    'juice': `Refreshing ${productName}. ${qty}${uom} of delicious, thirst-quenching goodness. Perfect for the whole family.`,
    'cold-drinks': `Enjoy ice-cold ${productName}. ${qty}${uom} of refreshing beverage. Great for any occasion.`,
    'beverage': `${productName} - ${qty}${uom}. A refreshing drink perfect for quenching your thirst on a hot day.`,
    'water': `Pure, clean ${productName}. ${qty}${uom} of refreshing hydration. Essential for everyday life.`,
    'energy-drink': `${productName} - ${qty}${uom}. Packed with energy to keep you going throughout the day.`,
    'butter': `${productName} - ${qty}${uom}. Creamy and delicious. Perfect for spreading, baking, or cooking.`,
    'margarine': `${productName} - ${qty}${uom}. Smooth and spreadable. Great for everyday cooking and baking.`,
    'milk': `Fresh ${productName} - ${qty}${uom}. Rich in calcium and essential nutrients. Perfect for drinking or cooking.`,
    'dairy': `${productName} - ${qty}${uom}. Quality dairy product. Fresh and delicious.`,
    'yogurt': `${productName} - ${qty}${uom}. Smooth, creamy yogurt. Packed with probiotics and great taste.`,
    'candle': `${productName} - ${qty}${uom}. Long-lasting illumination for your home. Essential for load shedding.`,
    'toothpaste': `${productName} - ${qty}${uom}. Fresh breath and healthy teeth. For the whole family.`,
    'soap': `${productName} - ${qty}${uom}. Gentle on skin, tough on dirt. Leaves you feeling fresh and clean.`,
    'deodorant': `${productName} - ${qty}${uom}. All-day freshness and protection. Stay confident all day long.`,
    'lotion': `${productName} - ${qty}${uom}. Nourishing moisturizer for soft, smooth skin. Daily hydration for your body.`,
    'cream': `${productName} - ${qty}${uom}. Rich, nourishing cream for healthy skin. Perfect for daily care.`,
    'detergent': `${productName} - ${qty}${uom}. Powerful cleaning for fresh, clean laundry. Tough on stains.`,
    'cleaner': `${productName} - ${qty}${uom}. Effective cleaning solution for a sparkling home. Multi-purpose use.`,
    'bleach': `${productName} - ${qty}${uom}. Powerful disinfectant and whitener. Kills germs and removes stains.`,
    'charcoal': `${productName} - ${qty}${uom}. Premium quality for perfect braais. Burns hot and long.`,
    'rice': `${productName} - ${qty}${uom}. Premium quality rice. Cooks to perfection every time. A staple for every kitchen.`,
    'maize-meal': `${productName} - ${qty}${uom}. Quality maize meal for authentic pap. Essential for traditional South African meals.`,
    'sugar': `${productName} - ${qty}${uom}. Pure sweetness for all your baking and cooking needs.`,
    'flour': `${productName} - ${qty}${uom}. Fine quality flour. Perfect for baking bread, cakes, and pastries.`,
    'oil': `${productName} - ${qty}${uom}. Pure cooking oil. Ideal for frying, baking, and salad dressings.`,
    'cooking': `${productName} - ${qty}${uom}. Pure cooking oil. Ideal for frying, baking, and salad dressings.`,
    'pasta': `${productName} - ${qty}${uom}. Quality pasta for delicious meals. Quick and easy to prepare.`,
    'noodles': `${productName} - ${qty}${uom}. Quick and tasty noodles. Ready in minutes for a satisfying meal.`,
    'biscuit': `${productName} - ${qty}${uom}. Delicious biscuits perfect for tea time or snacking. Great value.`,
    'crackers': `${productName} - ${qty}${uom}. Crispy crackers. Perfect for snacking or serving with cheese.`,
    'chips': `${productName} - ${qty}${uom}. Crunchy, flavorful chips. Perfect for sharing or snacking.`,
    'cereal': `${productName} - ${qty}${uom}. Nutritious breakfast cereal. Start your day right with goodness.`,
    'porridge': `${productName} - ${qty}${uom}. Wholesome porridge for a healthy breakfast. Warm and filling.`,
    'oats': `${productName} - ${qty}${uom}. Quality oats. Healthy breakfast option rich in fiber.`,
    'peanut-butter': `${productName} - ${qty}${uom}. Creamy peanut butter. Protein-rich and delicious.`,
    'peanut': `${productName} - ${qty}${uom}. Creamy peanut butter. Protein-rich and delicious.`,
    'jam': `${productName} - ${qty}${uom}. Sweet and fruity jam. Perfect for spreading on bread or toast.`,
    'sauce': `${productName} - ${qty}${uom}. Flavorful sauce to enhance your meals. Versatile condiment.`,
    'spice': `${productName} - ${qty}${uom}. Authentic spice for flavorful cooking. Essential in every kitchen.`,
    'seasoning': `${productName} - ${qty}${uom}. Authentic seasoning for flavorful cooking. Essential in every kitchen.`,
    'canned': `${productName} - ${qty}${uom}. Convenient canned food. Quick meal solution.`,
    'tea': `${productName} - ${qty}${uom}. Quality tea for your perfect cup. Refreshing and satisfying.`,
    'coffee': `${productName} - ${qty}${uom}. Rich coffee for a perfect brew. Wake up to great taste.`,
    'cheese': `${productName} - ${qty}${uom}. Delicious cheese. Perfect for sandwiches, cooking, or snacking.`,
  };
  
  // Find matching description
  for (const [key, desc] of Object.entries(descriptions)) {
    if (categoryLower.includes(key)) {
      return desc;
    }
  }
  
  // Default description
  return `${productName} - ${qty}${uom}. Quality product from a trusted brand. Great value for South African families.`;
}

// All products data embedded in script
const PRODUCTS_DATA = [
  {
    "name": "Fruiticana Juice",
    "variants": [
      "??; Pineapple; ??"
    ],
    "uom": "ml",
    "qty": 430,
    "price": 7.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Coca-cola (2.25lt)",
    "variants": [],
    "uom": "ea",
    "qty": 2,
    "price": 48,
    "special": "2 For Special",
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sparletta Granadilla Twist",
    "variants": [],
    "uom": "lt",
    "qty": 2.25,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sparletta Creme Soda",
    "variants": [],
    "uom": "lt",
    "qty": 2.25,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fanta",
    "variants": [
      "Orange"
    ],
    "uom": "lt",
    "qty": 2,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sprite",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Stoney",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Pepsi",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 14.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Coo-ee",
    "variants": [
      "??; Cola"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 5.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Coo-ee",
    "variants": [
      "??; Cola"
    ],
    "uom": "lt",
    "qty": 1.25,
    "price": 7.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Kingsley Cola",
    "variants": [],
    "uom": "lt",
    "qty": 3,
    "price": 14.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Twizza Cola",
    "variants": [],
    "uom": "lt",
    "qty": 3,
    "price": 12.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Twizza",
    "variants": [
      "Ginger Ale; Indian Tonic; Soda Water"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Krush Juice",
    "variants": [
      "Orange Flavoured Drink; Apple Flavoured Drink"
    ],
    "uom": "lt",
    "qty": 1.5,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Oros",
    "variants": [
      "Orange Squash"
    ],
    "uom": "lt",
    "qty": 2,
    "price": 34.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Aquelle 500ml Still/Sparkling Water",
    "variants": [
      "Still Water; Sparkling Water"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 33.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Pepsi Can",
    "variants": [],
    "uom": "ml",
    "qty": 500,
    "price": 7.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Rhodes 100% Juice 200ml",
    "variants": [
      "Orange"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 33.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Rhodes Nectar Juice 200ml",
    "variants": [
      "??"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 23.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Aquafria Still Water 500ml",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Aquafria Still Water",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 8.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Aquafria Still Water",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 16.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Thirsti Still Water",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fruitree",
    "variants": [
      "Mediterranean"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 23,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Orange Rtd 300ml",
    "variants": [
      "??"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 25.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Rascals Rtd",
    "variants": [
      "??"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 25.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Dalys Rtd",
    "variants": [
      "??"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 25.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Tropika Eazy 200ml",
    "variants": [
      "Orange"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunburst Juice 200ml",
    "variants": [
      "??"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Aquelle Flavoured Water 500ml",
    "variants": [
      "Granadilla"
    ],
    "uom": "ea",
    "qty": 6,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Shelford Juice",
    "variants": [
      "??"
    ],
    "uom": "lt",
    "qty": 5,
    "price": 89.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Orchard Delite Juice",
    "variants": [
      "??"
    ],
    "uom": "lt",
    "qty": 3,
    "price": 119.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Arooba Juice",
    "variants": [
      "Tropical; Mango"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 8.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Arooba Juice",
    "variants": [
      "Tropical; Mango"
    ],
    "uom": "lt",
    "qty": 5,
    "price": 32.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Caribbean Juice",
    "variants": [
      "Pineapple"
    ],
    "uom": "lt",
    "qty": 5,
    "price": 28.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Hall's Smooth",
    "variants": [
      "Fruit Punch"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 12.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fusion Juice",
    "variants": [
      "Mango; ??"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fusion Juice",
    "variants": [
      "Mango; ??"
    ],
    "uom": "lt",
    "qty": 5,
    "price": 43.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Summertime Juice Powder",
    "variants": [
      "Peach Apricot"
    ],
    "uom": "g",
    "qty": 400,
    "price": 15.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mojo Energy Drink 330ml",
    "variants": [
      "Silver Power"
    ],
    "uom": "ea",
    "qty": 12,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Brothers Mocktails",
    "variants": [
      "Pina Colada; Strawberry Lime Crisp; Mojito; Cosmo"
    ],
    "uom": "ml",
    "qty": 330,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fruiticana Smoothie",
    "variants": [
      "Red; Green; Purple; Yellow; Orange"
    ],
    "uom": "ml",
    "qty": 500,
    "price": 7.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "First Choice Butter",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 54.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Romi Tub",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 28.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunshine D Tub",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 38.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "D'lite Margarine Tub",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "D'lite Margarine Brick",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 11.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "D'lite Margarine Tub",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Romi Brick",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Wooden Spoon Margarine",
    "variants": [
      "Yellow; White"
    ],
    "uom": "g",
    "qty": 500,
    "price": 21.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Rama",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 26.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Stork Tub",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Amasi Amahle",
    "variants": [],
    "uom": "lt",
    "qty": 4,
    "price": 44.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Orange Grove Fresh Milk",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Danone Danup",
    "variants": [
      "Banana"
    ],
    "uom": "g",
    "qty": 950,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Orange Grove Amahewu Asemzansi",
    "variants": [
      "Banana Boost"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 11.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "First Choice Power Cup 150g",
    "variants": [
      "Mixed Fruit"
    ],
    "uom": "ea",
    "qty": 12,
    "price": 74.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Danone Yogurt 100ml",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Clover UHT Fresh Milk 1lt",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 93.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Lifeway Shot",
    "variants": [
      "Beetroot; Ginger; Baobab; ??; ??"
    ],
    "uom": "ml",
    "qty": 200,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Creamline UHT Milk 1lt",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 76.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Cool Salsa",
    "variants": [
      "Cherry Lemonade; Dry Lemon; Apple Mint"
    ],
    "uom": "ml",
    "qty": 350,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Newden Candle Colours",
    "variants": [
      "Orange; Red"
    ],
    "uom": "g",
    "qty": 450,
    "price": 22.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Close Up Toothpaste",
    "variants": [
      "Deep Action; ??"
    ],
    "uom": "g",
    "qty": 150,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Colgate Reg Toothpaste",
    "variants": [],
    "uom": "ml",
    "qty": 100,
    "price": 21.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Lifebouy Soap",
    "variants": [
      "Total 10"
    ],
    "uom": "g",
    "qty": 175,
    "price": 13.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Lux Soap",
    "variants": [
      "Velvet Soap"
    ],
    "uom": "g",
    "qty": 175,
    "price": 13.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Protex",
    "variants": [
      "Fresh"
    ],
    "uom": "g",
    "qty": 150,
    "price": 10.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Nivea Roll On",
    "variants": [
      "??; Invisible"
    ],
    "uom": "ml",
    "qty": 50,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Ingram's",
    "variants": [
      "Moisture Plus; Camphor Cream; Herbal; ??"
    ],
    "uom": "ml",
    "qty": 450,
    "price": 45.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Gynaguard Feminine Wash",
    "variants": [],
    "uom": "ml",
    "qty": 140,
    "price": 69.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Comfitex Panty Liners 100s",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 44.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Epimax Junior Body Cream",
    "variants": [],
    "uom": "g",
    "qty": 450,
    "price": 94.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Gynaguard Panty Liners 40s",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Vaseline Blue Seal",
    "variants": [
      "Original"
    ],
    "uom": "ml",
    "qty": 250,
    "price": 34.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Nivea Body Lotion",
    "variants": [
      "Rich Nourishing"
    ],
    "uom": "ml",
    "qty": 400,
    "price": 59.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Nivea Body Cream",
    "variants": [
      "Rich Nourishing"
    ],
    "uom": "ml",
    "qty": 400,
    "price": 59.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq Green Bar",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 14.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Rave Soap 500g",
    "variants": [],
    "uom": "ea",
    "qty": 4,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Daily Soap",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Elangeni Green Bar",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 9.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Elangeni Green Bar",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Elangeni Green Bar 500g",
    "variants": [],
    "uom": "ea",
    "qty": 4,
    "price": 36.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Miracle Mom Bleach",
    "variants": [
      "??"
    ],
    "uom": "lt",
    "qty": 1.5,
    "price": 21.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq Thick Bleach",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 18.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq Cream Liquid",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq Fab Softener",
    "variants": [
      "Floral Fresh"
    ],
    "uom": "lt",
    "qty": 2,
    "price": 34.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq Fab Softener 500ml",
    "variants": [],
    "uom": "ea",
    "qty": 2,
    "price": 39.99,
    "special": "2 For Special",
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sta Soft Refill",
    "variants": [
      "??; Paradise"
    ],
    "uom": "ml",
    "qty": 500,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Plush D/Wash Liq",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 15.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Omo W/P",
    "variants": [
      "Hand"
    ],
    "uom": "kg",
    "qty": 2,
    "price": 49.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunlight 2in1 W/P",
    "variants": [
      "Auto"
    ],
    "uom": "kg",
    "qty": 2,
    "price": 67.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Surf W/P",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 42.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Maq D/Wash Liq",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunlight Liq",
    "variants": [
      "Lemon 100"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Miracle Mom Dish Wash Liquid",
    "variants": [],
    "uom": "lt",
    "qty": 4,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Sheen D/Wash Liq Bottle",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Sheen D/Wash Liq Refill",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Sheen Pine Gel",
    "variants": [],
    "uom": "lt",
    "qty": 1,
    "price": 25.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Jik",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 500,
    "price": 12.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Jik",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Jik",
    "variants": [
      "??"
    ],
    "uom": "lt",
    "qty": 1.5,
    "price": 34.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Sheen All-Purpose Cleaner",
    "variants": [],
    "uom": "lt",
    "qty": 1,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Krisp Air Freshener",
    "variants": [
      "Lavender"
    ],
    "uom": "ml",
    "qty": 210,
    "price": 12.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Airoma",
    "variants": [
      "Floral Fusion; Summer Rose"
    ],
    "uom": "ml",
    "qty": 210,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom",
    "variants": [
      "Mosquito Spray"
    ],
    "uom": "ml",
    "qty": 180,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom",
    "variants": [
      "Mosquito Spray"
    ],
    "uom": "ml",
    "qty": 300,
    "price": 69.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 180,
    "price": 22.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 300,
    "price": 31.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom",
    "variants": [
      "??"
    ],
    "uom": "ml",
    "qty": 450,
    "price": 39.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Drakensberg Parrot Food",
    "variants": [
      "with Chillies"
    ],
    "uom": "kg",
    "qty": 2,
    "price": 42.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Super Mama Refuse Bag 10s",
    "variants": [
      "Heavy Duty"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 15.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Glade",
    "variants": [
      "Lavender Fields"
    ],
    "uom": "ml",
    "qty": 180,
    "price": 21.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom Blue Death",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 20.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Jeyes Homeguard",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Jeyes Fluid",
    "variants": [],
    "uom": "ml",
    "qty": 250,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fast Kill",
    "variants": [],
    "uom": "ml",
    "qty": 300,
    "price": 25.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Newden Madubula",
    "variants": [],
    "uom": "ml",
    "qty": 50,
    "price": 6.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Newden Madubula",
    "variants": [],
    "uom": "ml",
    "qty": 100,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Newden Madubula",
    "variants": [],
    "uom": "ml",
    "qty": 200,
    "price": 45.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Kiwi Polish",
    "variants": [
      "Black"
    ],
    "uom": "ml",
    "qty": 50,
    "price": 12.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Kiwi Polish",
    "variants": [
      "Black"
    ],
    "uom": "ml",
    "qty": 100,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Kiwi Polish",
    "variants": [
      "Black"
    ],
    "uom": "ml",
    "qty": 200,
    "price": 45.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Cobra Wax Polish",
    "variants": [],
    "uom": "ml",
    "qty": 350,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Cobra Wax Polish",
    "variants": [],
    "uom": "ml",
    "qty": 875,
    "price": 82.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunbeam Wax Polish",
    "variants": [],
    "uom": "ml",
    "qty": 350,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Sunbeam Wax Polish",
    "variants": [],
    "uom": "ml",
    "qty": 875,
    "price": 82.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Britelite Candle",
    "variants": [],
    "uom": "g",
    "qty": 450,
    "price": 19.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Doom Rattex",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Selena Steelwool",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Newden Distemper",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 24.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Ignite Firelighter",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 17.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Ignite Lumpwood Charcoal",
    "variants": [],
    "uom": "kg",
    "qty": 3,
    "price": 27.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Fresh Tile Cleaner",
    "variants": [
      "Lavender Flowers; Red Flowers"
    ],
    "uom": "lt",
    "qty": 1,
    "price": 21.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Playboy Roll On",
    "variants": [
      "Atlantis"
    ],
    "uom": "ml",
    "qty": 50,
    "price": 15.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Playgirl Roll On",
    "variants": [
      "Love Potion"
    ],
    "uom": "ml",
    "qty": 50,
    "price": 15.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mr Sheen Multi Surface 300ml",
    "variants": [
      "Lavender Vanilla"
    ],
    "uom": "ea",
    "qty": 3,
    "price": 69.99,
    "special": "2 For Special",
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Ignite Instant Light Charcoal",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 29.99,
    "special": null,
    "category": "General",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "tfs-ray"
  },
  {
    "name": "Mama's Chommi Peanut Butter",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 49.99,
    "special": "Free Sasko White Bread",
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Rice",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 85.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "rice"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tri Star Rice",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 85.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "maize-meal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Brown Sugar",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 174.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sugar"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "D'lite Cooking Oil",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 125.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "cooking-oil"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunglo Cooking Oil",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 125.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "cooking-oil"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "D'lite Cooking Oil",
    "variants": [],
    "uom": "lt",
    "qty": 4,
    "price": 99.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "cooking-oil"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Excella Sunflower Oil",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 144.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "cooking-oil"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Original Oreo (41,7g)",
    "variants": [],
    "uom": "ea",
    "qty": 24,
    "price": 79.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Maq Washing Powder",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 58.99,
    "special": null,
    "category": "Cleaning Supplies",
    "subcategories": [
      "soap-&-detergent"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Koo Baked Beans",
    "variants": [],
    "uom": "g",
    "qty": 410,
    "price": 14.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Freddy Hirsch Heroes Spice",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 8.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Legacy Spice Shisanyama",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 8.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Cremora",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nola Mayonnaise",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 32.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Coo-ee",
    "variants": [
      "Mojito; Pina Colada; Strawberry Daquiri"
    ],
    "uom": "lt",
    "qty": 2,
    "price": 10.99,
    "special": null,
    "category": "Beverages",
    "subcategories": [
      "cold-drinks"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Reboost (300ml)",
    "variants": [],
    "uom": "ea",
    "qty": 12,
    "price": 39.99,
    "special": null,
    "category": "Beverages",
    "subcategories": [
      "energy-drinks"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Rainbow IQF",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 84.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "frozen-foods",
      "chicken"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "First Choice Block Cheese",
    "variants": [],
    "uom": "g",
    "qty": 700,
    "price": 79.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "milk-&-dairy",
      "cheese"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunshine D Brick",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "margarine"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Parmalat Cheese Slices",
    "variants": [],
    "uom": "g",
    "qty": 900,
    "price": 89.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "milk-&-dairy",
      "cheese"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Oros",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 74.99,
    "special": null,
    "category": "Beverages",
    "subcategories": [
      "cordials"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Twizza Energy (500ml)",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 19.99,
    "special": null,
    "category": "Beverages",
    "subcategories": [
      "energy-drinks"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "First Choice Milk (1lt)",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 84.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "milk-&-dairy",
      "milk"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunlight Soap",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 17.99,
    "special": null,
    "category": "Cleaning Supplies; Cosmetics",
    "subcategories": [
      "soap-&-detergent",
      "soap-bars"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Maq Auto Liquid",
    "variants": [],
    "uom": "lt",
    "qty": 1.5,
    "price": 64.99,
    "special": null,
    "category": "Cleaning Supplies",
    "subcategories": [
      "soap-&-detergent"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Ignite Charcoal",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 129.99,
    "special": null,
    "category": "Braai & Camping",
    "subcategories": [
      "charcoal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunlight Washing Powder",
    "variants": [],
    "uom": "kg",
    "qty": 2,
    "price": 49.99,
    "special": null,
    "category": "Cleaning Supplies",
    "subcategories": [
      "soap-&-detergent"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Securex Spa",
    "variants": [],
    "uom": "g",
    "qty": 175,
    "price": 9.99,
    "special": null,
    "category": "Cosmetics",
    "subcategories": [
      "soap-bars"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Maize Meal",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 59.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "maize-meal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Maize Meal",
    "variants": [],
    "uom": "kg",
    "qty": 25,
    "price": 147.5,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "maize-meal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Aunt Caroline Rice",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 130,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "rice"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunshine Brown Sugar",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 178.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sugar"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Allsome Rice",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 99.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "rice"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Azam Cake Flour",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 96.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Maize Meal",
    "variants": [],
    "uom": "kg",
    "qty": 50,
    "price": 295,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "maize-meal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Maize Meal",
    "variants": [],
    "uom": "kg",
    "qty": 80,
    "price": 464,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "maize-meal"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Snowflake Flour",
    "variants": [],
    "uom": "kg",
    "qty": 2.5,
    "price": 39.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baked-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Gwk Spaghetti",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 12.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "pasta"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Gwk Macaroni",
    "variants": [],
    "uom": "kg",
    "qty": 3,
    "price": 59.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "pasta"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Pasta Joy Macaroni",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "pasta"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Pasta Joy Spaghetti",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "pasta"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Ezee Noodles (65g)",
    "variants": [],
    "uom": "ea",
    "qty": 5,
    "price": 15.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "noodles"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Noody Noodles (65g)",
    "variants": [],
    "uom": "ea",
    "qty": 5,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "noodles"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Sunfoil Pure Sunflower Oil",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 149.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "cooking-oil"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Baking Powder",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 12.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Baking Powder",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 22.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Baking Powder",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 39.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Royal Baking Powder",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 26.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Royal Baking Powder",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 45,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Golden Cloud Muffin Mix",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 28.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Bicarbonate of Soda",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 34.99,
    "special": null,
    "category": "Cleaning Supplies",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Egg Yellow",
    "variants": [],
    "uom": "ml",
    "qty": 40,
    "price": 9.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Egg Yellow",
    "variants": [],
    "uom": "ml",
    "qty": 500,
    "price": 54.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Vanilla Extract",
    "variants": [],
    "uom": "ml",
    "qty": 40,
    "price": 9.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertsons Vanilla Extract",
    "variants": [],
    "uom": "ml",
    "qty": 500,
    "price": 54.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "baking-&-flour"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "La Italiana Condensed Milk",
    "variants": [],
    "uom": "g",
    "qty": 380,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "milk-&-dairy"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Clover Condensed Milk",
    "variants": [],
    "uom": "g",
    "qty": 385,
    "price": 29.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "milk-&-dairy"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Spekko Rice",
    "variants": [],
    "uom": "kg",
    "qty": 10,
    "price": 124.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "rice"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Future Life Porridge",
    "variants": [],
    "uom": "kg",
    "qty": 1.25,
    "price": 98.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Future Life Porridge",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 38.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Early Morning Oats",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 22.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Happy Valley Rice Puffs",
    "variants": [
      "Original; Strawberry; Chocolate"
    ],
    "uom": "g",
    "qty": 400,
    "price": 25.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Pride Porridge",
    "variants": [
      "?? ; ??"
    ],
    "uom": "kg",
    "qty": 1,
    "price": 17.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Weet Bix",
    "variants": [],
    "uom": "g",
    "qty": 450,
    "price": 23.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Weet Bix",
    "variants": [],
    "uom": "g",
    "qty": 900,
    "price": 45,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nyala Instant Porridge",
    "variants": [
      "Chocolate; Banana; Original; Vanilla; Strawberry"
    ],
    "uom": "kg",
    "qty": 1,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nutrific Wholewheat Biscuits",
    "variants": [],
    "uom": "g",
    "qty": 450,
    "price": 21.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nutrific Wholewheat Biscuits",
    "variants": [],
    "uom": "g",
    "qty": 900,
    "price": 39.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Truda MyLife Instant Porridge",
    "variants": [
      "Original; ??; ??; ??"
    ],
    "uom": "kg",
    "qty": 5,
    "price": 62.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Spicy Seafood Noodles",
    "variants": [],
    "uom": "ea",
    "qty": 5,
    "price": 15.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "noodles"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Supa Choice Peanut Butter",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Hugos Mixed Fruit Jam",
    "variants": [],
    "uom": "g",
    "qty": 450,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "jams-&-syrups"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Hugos Mixed Fruit Jam",
    "variants": [],
    "uom": "g",
    "qty": 900,
    "price": 32.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "jams-&-syrups"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Yum Yum Peanut Spread",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 64.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Peanut Butter",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 27.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Black Cat Peanut Butter",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 36.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Black Cat Peanut Butter",
    "variants": [],
    "uom": "g",
    "qty": 800,
    "price": 69.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Illovo Golden Syrup",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 31.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "jams-&-syrups"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Morning Crunch Cereal",
    "variants": [],
    "uom": "g",
    "qty": 320,
    "price": 17.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "breakfast-&-cereals"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Joko Tea Bags (100s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Cream It Creamer",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 35.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Ellis Brown",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 52.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Phendula Tips Tea Bags (100s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 18.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Red Label Tea Bags (100s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 22.9,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Freshpak (40s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 29.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Glen (100s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 27.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Boston Cappuccino Sticks (10s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 34.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Boston Mmmshake",
    "variants": [],
    "uom": "g",
    "qty": 500,
    "price": 39.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nespray Sachet",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 54.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers",
      "baby-formula"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Clover Creamel",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 35.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "coffee--tea-&-creamers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "De Vries Rings",
    "variants": [
      "White; Choco"
    ],
    "uom": "g",
    "qty": 150,
    "price": 16.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Bakers Marie",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 14.89,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Bakers Eet Sum Mor",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 25.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Backers Tennis",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 19.79,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Bakers Toppers",
    "variants": [],
    "uom": "g",
    "qty": 125,
    "price": 8.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Wonder Wafers",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 9.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Galaxy Marie Biscuits",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 5.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Oreo",
    "variants": [],
    "uom": "g",
    "qty": 128,
    "price": 13.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henros My Crunchies",
    "variants": [],
    "uom": "g",
    "qty": 185,
    "price": 12.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henros My Scotties",
    "variants": [],
    "uom": "g",
    "qty": 185,
    "price": 12.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henros Choc Chip Assorted",
    "variants": [],
    "uom": "g",
    "qty": 160,
    "price": 10.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Marie Value Pack (150g)",
    "variants": [],
    "uom": "ea",
    "qty": 3,
    "price": 20,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Ginger Cookies",
    "variants": [],
    "uom": "g",
    "qty": 175,
    "price": 11.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Lemon Creams",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 6.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Marie Biscuits",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 5.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Super Cream",
    "variants": [],
    "uom": "g",
    "qty": 125,
    "price": 5.5,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Trisks",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 14.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro All Day Coconut",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 8.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Cream Cracker",
    "variants": [],
    "uom": "g",
    "qty": 1,
    "price": 13.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Saltine Snax",
    "variants": [],
    "uom": "g",
    "qty": 80,
    "price": 5,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Saltine Snax",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 8.5,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Cheezy Bites (30g)",
    "variants": [],
    "uom": "ea",
    "qty": 6,
    "price": 19.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Chappies (100s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 36.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "sweets-&-gum"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Krits",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 19.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Salty Cracks",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 17.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Tasty Treats Bites",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 19.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Henro Crispy Crave Salted Crackers",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 8.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Lemon Cream",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 10.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Shortbread",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 12.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Six Love",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 10.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Marie",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 6.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Risi Marie & Lemon Cream Multipack (475g)",
    "variants": [],
    "uom": "ea",
    "qty": 8,
    "price": 179.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Amazon Papa Blow (50s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 37.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "sweets-&-gum"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Halls Poly (72s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 16.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "sweets-&-gum"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "De Vries Ginger Biscuits",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 11.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "De Vries Ginger Lemon",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 19.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "De Vries Dbl Velvet Chocolate Yoghurt",
    "variants": [],
    "uom": "g",
    "qty": 185,
    "price": 21.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Amazon Choc Meltz",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 16.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "biscuits-&-crackers"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Simba Chips",
    "variants": [],
    "uom": "g",
    "qty": 120,
    "price": 15.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Caramel Blasts",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 4.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Truda Stylos",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 5.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Truda Pretzels",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 18.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Frimax Pops",
    "variants": [
      "Hot Pops; Fruit Pops"
    ],
    "uom": "g",
    "qty": 100,
    "price": 5.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Simba NikNaks",
    "variants": [],
    "uom": "g",
    "qty": 135,
    "price": 11.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Frimax Potato Chips",
    "variants": [],
    "uom": "g",
    "qty": 125,
    "price": 12.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Frimax Snappers",
    "variants": [],
    "uom": "g",
    "qty": 125,
    "price": 5.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Simba Chips Strip Pack (25g)",
    "variants": [],
    "uom": "ea",
    "qty": 2,
    "price": 16.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Fiesta Tortilla Chips",
    "variants": [],
    "uom": "g",
    "qty": 150,
    "price": 8.99,
    "special": null,
    "category": "Snacks, Biscuits & Confectionary",
    "subcategories": [
      "snacks-&-chips"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Cubes Jar (144s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 89.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's BBQ Sauce",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 18.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's BBQ Sauce",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 33.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chilli/Tomato Sauce",
    "variants": [
      "Chilli; Tomato"
    ],
    "uom": "ml",
    "qty": 750,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chilli/Tomato Sauce",
    "variants": [
      "Chilli; Tomato"
    ],
    "uom": "lt",
    "qty": 2,
    "price": 12.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chilli/Tomato Sauce",
    "variants": [
      "Chilli; Tomato"
    ],
    "uom": "lt",
    "qty": 5,
    "price": 31.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Peri Peri Sauce",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 36.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Peri Peri Sauce",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 65.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Smooth Peanut Butter",
    "variants": [],
    "uom": "kg",
    "qty": 1,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Peanut Butter Chommie",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 25.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "peanut-butter"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chip N Dip",
    "variants": [],
    "uom": "lt",
    "qty": 2,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chip N Dip",
    "variants": [],
    "uom": "lt",
    "qty": 5,
    "price": 115,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Chip N Dip",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Glass Tomato Sauce",
    "variants": [],
    "uom": "ml",
    "qty": 750,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Jam",
    "variants": [],
    "uom": "g",
    "qty": 900,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "jams-&-syrups"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Mayo Mzansi",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mama's Hot Shot Grill",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 9.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "general"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Crosse & Blackwell Mayonnaise",
    "variants": [],
    "uom": "g",
    "qty": 750,
    "price": 34.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Taxi Sauce",
    "variants": [],
    "uom": "ml",
    "qty": 100,
    "price": 10.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Taxi Sauce",
    "variants": [],
    "uom": "ml",
    "qty": 500,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Rhodes Tomato Paste",
    "variants": [],
    "uom": "g",
    "qty": 50,
    "price": 10,
    "special": "2 For Special",
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorr Salad Dressing",
    "variants": [],
    "uom": "ml",
    "qty": 340,
    "price": 32.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nando's Umlilo Hot Sauce",
    "variants": [],
    "uom": "ml",
    "qty": 90,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nola Mayonnaise",
    "variants": [],
    "uom": "kg",
    "qty": 3,
    "price": 149.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Clover Mayonnaise",
    "variants": [
      "Tangy; ??"
    ],
    "uom": "g",
    "qty": 750,
    "price": 29.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Excella Mayonnaise",
    "variants": [],
    "uom": "kg",
    "qty": 3,
    "price": 109.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sandwich-spreads",
      "sauces--seasoning-&-spices",
      "mayonnaise"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mrs. H.S. Balls Chutney",
    "variants": [],
    "uom": "g",
    "qty": 375,
    "price": 22.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mrs. H.S. Balls Chutney",
    "variants": [],
    "uom": "kg",
    "qty": 1.1,
    "price": 68.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Mrs. H.S. Balls Chutney",
    "variants": [],
    "uom": "kg",
    "qty": 3,
    "price": 179.9,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Uncles Spice Bowl",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 18.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Chakalaka",
    "variants": [],
    "uom": "g",
    "qty": 410,
    "price": 13.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "All Gold Tomato Sauce",
    "variants": [],
    "uom": "ml",
    "qty": 700,
    "price": 28.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Tomato Puree",
    "variants": [],
    "uom": "g",
    "qty": 410,
    "price": 15.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Baked Beans",
    "variants": [],
    "uom": "g",
    "qty": 410,
    "price": 9.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Fish",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 400,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Fish",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 215,
    "price": 15.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Lucky Star Fish",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 155,
    "price": 12.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Koo Chakalaka",
    "variants": [],
    "uom": "g",
    "qty": 410,
    "price": 16.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Koo Veg Curry",
    "variants": [],
    "uom": "g",
    "qty": 420,
    "price": 16.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "canned-food"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Koo Beetroot",
    "variants": [],
    "uom": "g",
    "qty": 780,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorrox Soup Bag",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 15.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Rajah Curry Powder",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 28.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Rajah Curry Powder",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 18.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorrox Soya Bag",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 26.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorr Soup",
    "variants": [],
    "uom": "g",
    "qty": 50,
    "price": 4.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "La Italiana Soups (12s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 49.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Nando's Seasonke All Spice",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 18.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Six Gun",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 200,
    "price": 16.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Freddy Hirsch Heroes Spice",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 5.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Legacy Spice Shisanyama",
    "variants": [],
    "uom": "g",
    "qty": 100,
    "price": 5.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorrox Cubes (48s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 39.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Knorrox Cubes (12s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Aromat Trio",
    "variants": [],
    "uom": "g",
    "qty": 200,
    "price": 22.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Robertson's Spice Bottle",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 85,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Benny (10s)",
    "variants": [],
    "uom": "ea",
    "qty": 1,
    "price": 10.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Spice Mix",
    "variants": [],
    "uom": "g",
    "qty": 400,
    "price": 24.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Spice Mix",
    "variants": [],
    "uom": "g",
    "qty": 350,
    "price": 26.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Soya Mince",
    "variants": [
      "Chilli Beef; Mutton"
    ],
    "uom": "g",
    "qty": 400,
    "price": 29.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Cubes (12s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 21.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Cubes (24s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 10.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Cubes (40x2s)",
    "variants": [
      "??; ??"
    ],
    "uom": "ea",
    "qty": 1,
    "price": 51.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Imana Supa Sheba",
    "variants": [],
    "uom": "g",
    "qty": 55,
    "price": 4.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Coating",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 200,
    "price": 11.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Curry Powder",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 400,
    "price": 32.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Soup",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 400,
    "price": 13.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Soya Mince",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 400,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  },
  {
    "name": "Top Class Spice Bowl",
    "variants": [
      "??; ??"
    ],
    "uom": "g",
    "qty": 400,
    "price": 19.99,
    "special": null,
    "category": "Groceries & Food",
    "subcategories": [
      "pantry",
      "sauces--seasoning-&-spices"
    ],
    "description": null,
    "source": "products-tfs"
  }
];

async function migrate() {
  try {
    console.log('🚀 Starting COMPLETE Vryheid Products Migration...\n');
    console.log(`📦 Processing ${PRODUCTS_DATA.length} products from BOTH Excel files\n`);
    console.log('📡 Connecting to MongoDB...');
    
    await client.connect();
    const db = client.db('tfs-wholesalers');
    console.log('✅ Connected successfully\n');

    // Get Vryheid branch
    console.log('📍 Fetching Vryheid branch...');
    const branch = await db.collection('branches').findOne({ slug: 'vryheid' });
    
    if (!branch) {
      console.error('❌ Branch "vryheid" not found.');
      return;
    }

    console.log(`✅ Using branch: ${branch.displayName} (ID: ${branch._id})\n`);

    // Create category map
    console.log('📁 Processing categories...');
    const categoryMap = new Map();
    const uniqueCategories = new Set();

    // Extract unique categories
    PRODUCTS_DATA.forEach(p => {
      p.subcategories.forEach(cat => {
        if (cat && cat !== 'nan') {
          uniqueCategories.add(cat);
        }
      });
    });

    console.log(`Found ${uniqueCategories.size} unique categories\n`);

    // Create/find categories for Vryheid
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

    console.log('\n📦 Migrating products for Vryheid...\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of PRODUCTS_DATA) {
      try {
        // Clean variants - remove ?? markers
        const cleanVariants = product.variants
          .map(v => v.replace(/\?+/g, '').trim())
          .filter(v => v.length > 0 && v !== ';');
        
        const sku = generateSKU(product.name, product.qty, product.uom);
        
        // Check if exists in Vryheid
        const existing = await db.collection('products').findOne({
          sku: sku,
          branchId: branch._id
        });

        // Get category IDs
        const categoryIds = product.subcategories
          .map(slug => categoryMap.get(slug))
          .filter(Boolean);

        // Generate description
        const description = product.description || generateDescription(
          product.name,
          product.subcategories,
          product.qty,
          product.uom
        );

        // Build product document
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
          hasVariants: cleanVariants.length > 0,
          variants: cleanVariants.length > 0 
            ? cleanVariants.map((variantName, idx) => ({
                _id: new ObjectId().toString(),
                name: variantName,
                sku: `${sku}-${idx + 1}`,
                barcode: generateBarcode(),
                stockLevel: 50,
                images: [],
                active: true
              }))
            : undefined,
          onSpecial: !!product.special,
          active: true,
          featured: false,
          unit: product.uom,
          unitQuantity: product.qty,
          branchId: branch._id,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (existing) {
          // Update existing product
          await db.collection('products').updateOne(
            { _id: existing._id },
            { 
              : {
                ...productDoc,
                createdAt: existing.createdAt,
                updatedAt: new Date()
              }
            }
          );
          
          const displayName = productDoc.hasVariants 
            ? `${product.name} (${cleanVariants.length} variants)`
            : `${product.name} (${product.qty}${product.uom})`;
          
          console.log(`  ♻️  Updated: ${displayName}`);
          updated++;
        } else {
          // Insert new product
          await db.collection('products').insertOne(productDoc);
          
          const displayName = productDoc.hasVariants 
            ? `${product.name} (${cleanVariants.length} variants)`
            : `${product.name} (${product.qty}${product.uom})`;
          
          console.log(`  ✅ Created: ${displayName}`);
          created++;
        }

      } catch (error) {
        console.error(`  ❌ Error: ${product.name} - ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPLETE VRYHEID MIGRATION FINISHED');
    console.log('='.repeat(70));
    console.log(`🏪 Branch: ${branch.displayName}`);
    console.log(`✅ Created: ${created} products`);
    console.log(`♻️  Updated: ${updated} products`);
    console.log(`⏭️  Skipped: ${skipped} products`);
    console.log(`❌ Errors: ${errors} products`);
    console.log(`📦 Total Processed: ${PRODUCTS_DATA.length} products`);
    console.log(`🎯 Success Rate: ${Math.round(((created + updated) / PRODUCTS_DATA.length) * 100)}%`);
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