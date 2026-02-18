import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - List all active branches (public endpoint)
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Only return active branches
    const branches = await db.collection('branches')
      .find({ status: 'active' })
      .sort({ name: 1 })
      .project({
        name: 1,
        slug: 1,
        displayName: 1,
        status: 1,
        'settings.storeLocation': 1,
        'settings.contactPhone': 1,
      })
      .toArray();

    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}