#!/usr/bin/env node

/**
 * TFS Wholesalers - Wholesale System Database Migration
 * 
 * This script creates the necessary collections and indexes for the wholesale system.
 * 
 * Usage:
 *   node scripts/migrate-wholesale-db.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'tfs-wholesalers';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 Starting wholesale database migration...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // 1. Create wholesale_customers collection
    console.log('\n📦 Creating wholesale_customers collection...');
    try {
      await db.createCollection('wholesale_customers');
      console.log('✅ wholesale_customers collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  wholesale_customers collection already exists');
      } else {
        throw error;
      }
    }
    
    // Create indexes for wholesale_customers
    console.log('📑 Creating indexes for wholesale_customers...');
    await db.collection('wholesale_customers').createIndex({ userId: 1 }, { unique: true });
    await db.collection('wholesale_customers').createIndex({ verificationStatus: 1 });
    await db.collection('wholesale_customers').createIndex({ branchId: 1 });
    await db.collection('wholesale_customers').createIndex({ email: 1 });
    console.log('✅ Indexes created for wholesale_customers');
    
    // 2. Create wholesale_product_configs collection
    console.log('\n📦 Creating wholesale_product_configs collection...');
    try {
      await db.createCollection('wholesale_product_configs');
      console.log('✅ wholesale_product_configs collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  wholesale_product_configs collection already exists');
      } else {
        throw error;
      }
    }
    
    // Create indexes for wholesale_product_configs
    console.log('📑 Creating indexes for wholesale_product_configs...');
    await db.collection('wholesale_product_configs').createIndex({ productId: 1 });
    await db.collection('wholesale_product_configs').createIndex({ productId: 1, variantId: 1 });
    await db.collection('wholesale_product_configs').createIndex({ active: 1 });
    await db.collection('wholesale_product_configs').createIndex({ branchId: 1 });
    console.log('✅ Indexes created for wholesale_product_configs');
    
    // 3. Create wholesale_purchase_orders collection
    console.log('\n📦 Creating wholesale_purchase_orders collection...');
    try {
      await db.createCollection('wholesale_purchase_orders');
      console.log('✅ wholesale_purchase_orders collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  wholesale_purchase_orders collection already exists');
      } else {
        throw error;
      }
    }
    
    // Create indexes for wholesale_purchase_orders
    console.log('📑 Creating indexes for wholesale_purchase_orders...');
    await db.collection('wholesale_purchase_orders').createIndex({ poNumber: 1 }, { unique: true });
    await db.collection('wholesale_purchase_orders').createIndex({ customerId: 1 });
    await db.collection('wholesale_purchase_orders').createIndex({ branchId: 1 });
    await db.collection('wholesale_purchase_orders').createIndex({ orderStatus: 1 });
    await db.collection('wholesale_purchase_orders').createIndex({ paymentStatus: 1 });
    await db.collection('wholesale_purchase_orders').createIndex({ createdAt: -1 });
    console.log('✅ Indexes created for wholesale_purchase_orders');
    
    // 4. Get collection stats
    console.log('\n📊 Collection Statistics:');
    
    const customersCount = await db.collection('wholesale_customers').countDocuments();
    console.log(`   wholesale_customers: ${customersCount} documents`);
    
    const configsCount = await db.collection('wholesale_product_configs').countDocuments();
    console.log(`   wholesale_product_configs: ${configsCount} documents`);
    
    const ordersCount = await db.collection('wholesale_purchase_orders').countDocuments();
    console.log(`   wholesale_purchase_orders: ${ordersCount} documents`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure wholesale pricing for products via admin panel');
    console.log('   2. Verify wholesale customers who register');
    console.log('   3. Test the complete wholesale flow');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrate().catch(console.error);