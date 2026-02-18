// Load environment variables FIRST
import { config } from 'dotenv';
config();

import { MongoClient } from 'mongodb';

async function testBranches() {
  let client: MongoClient | null = null;
  
  try {
    console.log('🔍 Testing branch database...\n');

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found');
    }

    client = new MongoClient(process.env.MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('tfs-wholesalers');

    // List all branches
    const branches = await db.collection('branches').find({}).toArray();
    
    console.log(`📊 Total branches: ${branches.length}\n`);

    if (branches.length === 0) {
      console.log('⚠️  No branches found in database!');
      console.log('Run: npx tsx scripts/migrate-super-admin-branches.ts\n');
    } else {
      console.log('📋 Branches in database:');
      console.log('═════════════════════════════════════');
      branches.forEach((branch, index) => {
        console.log(`${index + 1}. ${branch.name}`);
        console.log(`   Slug: ${branch.slug}`);
        console.log(`   Status: ${branch.status}`);
        console.log(`   URL: http://localhost:3000/${branch.slug}`);
        console.log('');
      });

      // Test specific branch
      const testSlug = 'vryheid';
      const testBranch = await db.collection('branches').findOne({ 
        slug: testSlug,
        status: 'active' 
      });

      console.log(`🔍 Testing slug: "${testSlug}"`);
      if (testBranch) {
        console.log(`✅ Found: ${testBranch.name} (${testBranch.slug})`);
      } else {
        console.log(`❌ Not found or not active`);
        
        // Check if it exists but is inactive
        const inactiveBranch = await db.collection('branches').findOne({ slug: testSlug });
        if (inactiveBranch) {
          console.log(`⚠️  Branch exists but status is: ${inactiveBranch.status}`);
        }
      }
    }

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (client) {
      await client.close();
    }
    process.exit(1);
  }
}

testBranches();