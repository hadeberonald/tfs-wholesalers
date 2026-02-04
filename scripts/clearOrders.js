/**
 * Clear All Orders Script
 * 
 * This script removes all orders from the database to start fresh.
 * Use with caution - this cannot be undone!
 * 
 * Usage: node clearOrders.js
 */

const { MongoClient } = require('mongodb');
const readline = require('readline');

// MongoDB connection string - update this with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ronaldvhadebe_db_user:RFWWUNVb2F0C6ysm@cluster0.xovcymo.mongodb.net/?appName=Cluster0';

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify the question function
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function clearOrders() {
  let client = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();

    // Get counts before deletion
    const ordersCount = await db.collection('orders').countDocuments();
    const packagesCount = await db.collection('packages').countDocuments();

    console.log('📊 Current Database Stats:');
    console.log(`   Orders: ${ordersCount}`);
    console.log(`   Packages: ${packagesCount}\n`);

    if (ordersCount === 0 && packagesCount === 0) {
      console.log('ℹ️  No orders or packages found. Database is already clean.');
      rl.close();
      await client.close();
      return;
    }

    // Ask for confirmation
    const answer = await question(
      '⚠️  WARNING: This will permanently delete ALL orders and packages!\n' +
      '   Type "DELETE" to confirm: '
    );

    if (answer.trim() !== 'DELETE') {
      console.log('\n❌ Operation cancelled. No data was deleted.');
      rl.close();
      await client.close();
      return;
    }

    console.log('\n🗑️  Deleting data...');

    // Delete all packages
    const packagesResult = await db.collection('packages').deleteMany({});
    console.log(`   ✓ Deleted ${packagesResult.deletedCount} packages`);

    // Delete all orders
    const ordersResult = await db.collection('orders').deleteMany({});
    console.log(`   ✓ Deleted ${ordersResult.deletedCount} orders`);

    console.log('\n✨ Database cleared successfully!');
    console.log('📊 Final counts:');
    console.log(`   Orders: ${await db.collection('orders').countDocuments()}`);
    console.log(`   Packages: ${await db.collection('packages').countDocuments()}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    rl.close();
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Run the script
clearOrders()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });