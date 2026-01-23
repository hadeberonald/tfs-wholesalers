import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Force dynamic rendering - prevents static generation issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        products: [],
        message: 'Search query must be at least 2 characters'
      });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Search products using regex for better results
    const searchRegex = new RegExp(query.trim(), 'i');
    
    const products = await db
      .collection('products')
      .find({
        active: true,
        stockLevel: { $gt: 0 },
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { tags: searchRegex },
        ]
      })
      .limit(50)
      .toArray();

    return NextResponse.json({ 
      products,
      count: products.length,
      query: query.trim()
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', products: [] },
      { status: 500 }
    );
  }
}