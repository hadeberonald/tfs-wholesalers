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
    const barcode = searchParams.get('barcode'); // For barcode lookup
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Build query
    const query: any = all === 'true' ? {} : { active: true };
    
    if (category) query.category = category;
    if (special === 'true') query.onSpecial = true;
    if (featured === 'true') query.featured = true;
    if (slug) query.slug = slug;
    if (barcode) query.barcode = barcode;
    
    let cursor = db.collection('products').find(query).sort({ createdAt: -1 });
    
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }
    
    const products = await cursor.toArray();

    // If searching by barcode, return single product or null
    if (barcode) {
      return NextResponse.json({ 
        product: products.length > 0 ? products[0] : null 
      });
    }

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

    // Check if barcode already exists (if provided)
    if (body.barcode) {
      const existing = await db.collection('products').findOne({ 
        barcode: body.barcode 
      });
      if (existing) {
        return NextResponse.json({ 
          error: 'A product with this barcode already exists' 
        }, { status: 400 });
      }
    }

    const product = {
      ...body,
      barcode: body.barcode || null, // Optional barcode field
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