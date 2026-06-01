import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query    = searchParams.get('q');
    const branchId = searchParams.get('branchId');
    const page     = searchParams.get('page');
    const limit    = searchParams.get('limit');
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
    const escaped    = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex  = new RegExp('(^|\\b)' + escaped, 'i');
    const codeRegex  = new RegExp(escaped, 'i');
    const tagRegex   = new RegExp('^' + escaped + '$', 'i');

    const filter: any = {
      branchId: new ObjectId(branchId),
      active: true,
      isLinkedVariant: { $ne: true },
      // Only show products that have stock at the parent level OR have at least
      // one active variant with stock — handles both simple and variant products.
      $and: [
        {
          $or: [
            { stockLevel: { $gt: 0 } },
            { variants: { $elemMatch: { active: true, stockLevel: { $gt: 0 } } } },
          ],
        },
        {
          $or: [
            { name: nameRegex },
            { barcode: codeRegex },
            { tags: tagRegex },
            { 'variants.name': nameRegex },
            { 'variants.barcode': codeRegex },
          ],
        },
      ],
    };

    const total = await db.collection('products').countDocuments(filter);

    if (fetchAll === 'true') {
      const allProducts = await db
        .collection('products')
        .find(filter)
        .sort({ name: 1, _id: 1 })
        .limit(10000)
        .toArray();

      return NextResponse.json({
        products: allProducts,
        count: allProducts.length,
        total,
        query: searchTerm,
        fetchedAll: true,
      });
    }

    const pageNum  = page  ? parseInt(page)  : 1;
    const limitNum = limit ? parseInt(limit) : 100;
    const skip     = (pageNum - 1) * limitNum;

    const products = await db
      .collection('products')
      .find(filter)
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

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
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}