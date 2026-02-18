// app/api/branches/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Get a specific branch by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Find branch by slug
    const branch = await db.collection('branches').findOne({ 
      slug,
      status: 'active' 
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Get branch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch' },
      { status: 500 }
    );
  }
}