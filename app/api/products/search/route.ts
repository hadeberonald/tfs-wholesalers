import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const branchId = searchParams.get('branchId');
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const fetchAll = searchParams.get('all');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        products: [],
        count: 0,
        total: 0,
        message: 'Search query must be at least 2 characters',
      });
    }

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const searchTerm = query.trim();
    const searchRegex = new RegExp(
      searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );

    console.log('🔍 Search query:', searchTerm, 'for branch:', branchId);

    const filter = {
      branchId: new ObjectId(branchId),
      active: true,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { barcode: searchRegex },
        { 'variants.name': searchRegex },
        { 'variants.barcode': searchRegex },
      ],
    };

    const total = await db.collection('products').countDocuments(filter);
    console.log('📊 Total matching products:', total);

    if (fetchAll === 'true') {
      const allProducts = await db
        .collection('products')
        .find(filter)
        .sort({ name: 1, _id: 1 }) // ✅ Stable compound sort
        .limit(10000)
        .toArray();

      console.log('✅ Fetched all products:', allProducts.length);

      return NextResponse.json({
        products: allProducts,
        count: allProducts.length,
        total,
        query: searchTerm,
        fetchedAll: true,
      });
    }

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 100;
    const skip = (pageNum - 1) * limitNum;

    const products = await db
      .collection('products')
      .find(filter)
      .sort({ name: 1, _id: 1 }) // ✅ Stable compound sort
      .skip(skip)
      .limit(limitNum)
      .toArray();

    console.log(
      `✅ Search found: ${products.length} products (page ${pageNum} of ${Math.ceil(total / limitNum)})`
    );

    return NextResponse.json({
      products,
      count: products.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      query: searchTerm,
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}