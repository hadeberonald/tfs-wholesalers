import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const special = searchParams.get('special');
    const featured = searchParams.get('featured');
    const slug = searchParams.get('slug');
    const limit = searchParams.get('limit');
    const all = searchParams.get('all'); // For admin
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Build query
    const query: any = all === 'true' ? {} : { active: true };
    
    if (category) query.category = category;
    if (special === 'true') query.onSpecial = true;
    if (featured === 'true') query.featured = true;
    if (slug) query.slug = slug;
    
    let cursor = db.collection('products').find(query).sort({ createdAt: -1 });
    
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }
    
    const products = await cursor.toArray();

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const product = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}