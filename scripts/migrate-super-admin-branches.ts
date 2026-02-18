// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

async function migrate() {
  let client: MongoClient | null = null;
  
  try {
    console.log('🚀 Starting migration: Super Admin + Multi-Branch Setup...\n');

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

    // ============================================
    // STEP 1: Create Super Admin User
    // ============================================
    console.log('👤 Creating Super Admin...');
    
    const superAdminEmail = 'superadmin@tfswholesalers.co.za';
    const existingSuperAdmin = await db.collection('users').findOne({ email: superAdminEmail });
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super admin already exists, skipping creation');
    } else {
      const hashedPassword = await bcrypt.hash('super123', 10);
      await db.collection('users').insertOne({
        email: superAdminEmail,
        password: hashedPassword,
        name: 'Super Administrator',
        role: 'super-admin',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Super admin created');
      console.log(`   Email: ${superAdminEmail}`);
      console.log(`   Password: super123\n`);
    }

    // ============================================
    // STEP 2: Create Branches Collection
    // ============================================
    console.log('🏢 Setting up branches...');
    
    const collections = await db.listCollections({ name: 'branches' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('branches');
      console.log('✅ Created branches collection');
    }

    // Check if branches already exist
    const existingBranches = await db.collection('branches').countDocuments();
    if (existingBranches > 0) {
      console.log(`⚠️  Found ${existingBranches} existing branch(es), skipping branch creation\n`);
    } else {
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
          paymentConfig: {
            paystack: {
              enabled: true,
              publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
              secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            }
          },
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
          paymentConfig: {
            paystack: {
              enabled: true,
              publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
              secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            }
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Richards Bay',
          slug: 'richardsbay',
          displayName: 'Richards Bay',
          status: 'active',
          settings: {
            storeLocation: {
              lat: -28.7833,
              lng: 32.0377,
              address: 'Richards Bay, KZN'
            },
            contactEmail: 'richardsbay@tfswholesalers.co.za',
            contactPhone: '+27 35 123 4567',
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
          paymentConfig: {
            paystack: {
              enabled: true,
              publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
              secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            }
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      // Insert branches
      const result = await db.collection('branches').insertMany(branches);
      console.log(`✅ Created ${result.insertedCount} branches\n`);

      // ============================================
      // STEP 3: Create Branch Admin Users
      // ============================================
      console.log('👥 Creating branch admin users...');
      
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
      console.log(`✅ Created ${users.length} branch admin users\n`);

      console.log('📋 Branch Admin Credentials:');
      console.log('═════════════════════════════════════');
      users.forEach(user => {
        console.log(`${user.name}:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Password: admin123\n`);
      });
    }

    // ============================================
    // STEP 4: Summary
    // ============================================
    console.log('═════════════════════════════════════');
    console.log('✅ Migration Complete!\n');
    console.log('🔑 Login Credentials:');
    console.log('─────────────────────────────────────');
    console.log('Super Admin:');
    console.log(`  Email: ${superAdminEmail}`);
    console.log(`  Password: super123`);
    console.log('─────────────────────────────────────');
    
    const branchCount = await db.collection('branches').countDocuments();
    const adminCount = await db.collection('users').countDocuments({ role: 'admin' });
    
    console.log(`\n📊 Database Status:`);
    console.log(`  Branches: ${branchCount}`);
    console.log(`  Branch Admins: ${adminCount}`);
    console.log(`  Super Admins: 1\n`);

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (client) {
      await client.close();
    }
    process.exit(1);
  }
}

migrate();