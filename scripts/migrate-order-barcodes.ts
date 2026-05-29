/**
 * Migration Script: Add Barcodes to Existing Orders
 * 
 * This script updates all existing orders in the database to include
 * barcode and description fields from the corresponding products.
 * 
 * Usage:
 * 1. Save this as: scripts/migrate-order-barcodes.ts
 * 2. Run with: npx tsx scripts/migrate-order-barcodes.ts
 * 
 * Or if you prefer JavaScript:
 * 1. Save as: scripts/migrate-order-barcodes.js
 * 2. Run with: node scripts/migrate-order-barcodes.js
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

async function migrateOrderBarcodes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🚀 Starting barcode migration...');
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('tfs-wholesalers');
    
    // Get all orders
    const orders = await db.collection('orders').find({}).toArray();
    console.log(`📦 Found ${orders.length} orders to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      try {
        let needsUpdate = false;
        const updatedItems = [];

        for (const item of order.items) {
          // If item already has barcode, keep it as is
          if (item.barcode) {
            updatedItems.push(item);
            continue;
          }

          // Fetch product to get barcode and description
          const product = await db.collection('products').findOne({
            _id: new ObjectId(item.productId)
          });

          if (product) {
            // Add barcode and description if product has them
            const updatedItem = { ...item };
            
            if (product.barcode) {
              updatedItem.barcode = product.barcode;
              needsUpdate = true;
            }
            
            if (product.description && !item.description) {
              updatedItem.description = product.description;
              needsUpdate = true;
            }
            
            updatedItems.push(updatedItem);
          } else {
            // Product not found, keep item as is
            console.warn(`   ⚠️  Product not found: ${item.productId} in order ${order.orderNumber}`);
            updatedItems.push(item);
          }
        }

        // Update order if any items were modified
        if (needsUpdate) {
          await db.collection('orders').updateOne(
            { _id: order._id },
            { 
              $set: { 
                items: updatedItems,
                updatedAt: new Date()
              } 
            }
          );
          
          const barcodesAdded = updatedItems.filter(i => i.barcode).length;
          console.log(`   ✅ Updated order ${order.orderNumber} (${barcodesAdded}/${updatedItems.length} items now have barcodes)`);
          updatedCount++;
        } else {
          console.log(`   ⏭️  Skipped order ${order.orderNumber} (no changes needed)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing order ${order.orderNumber}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   • Orders updated: ${updatedCount}`);
    console.log(`   • Orders skipped: ${skippedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log('✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrateOrderBarcodes();