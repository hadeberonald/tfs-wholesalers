// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

async function setupMultiBranch() {
  let client: MongoClient | null = null;
  
  try {
    console.log('🚀 Starting multi-branch setup...\n');

    // Verify MONGODB_URI is loaded
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables. Make sure .env file exists in project root.');
    }

    console.log('✅ Environment variables loaded');
    console.log(`📦 Connecting to MongoDB...`);

    // Connect to MongoDB
    client = new MongoClient(process.env.MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('tfs-wholesalers');

    // Create branches collection if it doesn't exist
    const collections = await db.listCollections({ name: 'branches' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('branches');
      console.log('✅ Created branches collection');
    }

    // Check if branches already exist
    const existingBranches = await db.collection('branches').countDocuments();
    if (existingBranches > 0) {
      console.log(`⚠️  Found ${existingBranches} existing branch(es)`);
      console.log('Skipping branch creation to avoid duplicates.\n');
      await client.close();
      return;
    }

    // Default branches to create
    const branches = [
      {
        name: 'Pietermaritzburg',
        slug: 'pmb',
        displayName: 'Pietermaritzburg',
        status: 'active',
        settings: {
          storeLocation: {
            lat: -29.6011,
            lng: 30.3794,
            address: 'Pietermaritzburg, KZN'
          },
          contactEmail: 'pmb@tfswholesalers.co.za',
          contactPhone: '+27 33 123 4567',
          deliveryPricing: {
            local: 50,
            localRadius: 5,
            medium: 100,
            mediumRadius: 15,
            far: 150,
            farRadius: 30,
          },
          minimumOrderValue: 0,
        },
        paymentConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Durban',
        slug: 'durban',
        displayName: 'Durban',
        status: 'active',
        settings: {
          storeLocation: {
            lat: -29.8587,
            lng: 31.0218,
            address: 'Durban, KZN'
          },
          contactEmail: 'durban@tfswholesalers.co.za',
          contactPhone: '+27 31 123 4567',
          deliveryPricing: {
            local: 50,
            localRadius: 5,
            medium: 100,
            mediumRadius: 15,
            far: 150,
            farRadius: 30,
          },
          minimumOrderValue: 0,
        },
        paymentConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    // Insert branches
    const result = await db.collection('branches').insertMany(branches);
    console.log(`✅ Created ${result.insertedCount} branches\n`);

    // Create admin users for each branch
    const users = [];

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      const hashedPassword = await bcrypt.hash('admin123', 10);
      users.push({
        email: `${branch.slug}@tfswholesalers.co.za`,
        password: hashedPassword,
        name: `${branch.displayName} Admin`,
        role: 'admin',
        branchId: Object.values(result.insertedIds)[i],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.collection('users').insertMany(users);
    console.log(`✅ Created ${users.length} admin users\n`);

    console.log('📋 Branch Admin Credentials:');
    console.log('─────────────────────────────────────');
    users.forEach(user => {
      console.log(`${user.name}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: admin123\n`);
    });

    console.log('✅ Multi-branch setup complete!');
    
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    if (client) {
      await client.close();
    }
    process.exit(1);
  }
}

setupMultiBranch();