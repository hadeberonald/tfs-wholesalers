import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const special = searchParams.get('special');
    const featured = searchParams.get('featured');
    const slug = searchParams.get('slug');
    const limit = searchParams.get('limit');
    const page = searchParams.get('page');
    const sort = searchParams.get('sort');
    const all = searchParams.get('all');
    const barcode = searchParams.get('barcode');
    const branchId = searchParams.get('branchId');
    const search = searchParams.get('search'); // ✅ NEW: admin full-text search param

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};

    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      query.active = true;
      if (branchId) {
        query.branchId = new ObjectId(branchId);
      }
    }

    // ✅ NEW: Admin full-text search across name, SKU, barcode, description
    if (search && search.trim().length >= 2) {
      const searchRegex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { description: searchRegex },
        { 'variants.name': searchRegex },
        { 'variants.sku': searchRegex },
        { 'variants.barcode': searchRegex },
      ];
    }

    // ✅ Products store categories as slugs
    if (category) {
      try {
        const categoryDoc = await db.collection('categories').findOne({
          _id: new ObjectId(category),
        });

        if (categoryDoc) {
          query.categories = {
            $in: [
              categoryDoc.slug,
              category,
              new ObjectId(category),
            ],
          };
        } else {
          query.categories = { $in: [category] };
        }
      } catch {
        query.categories = { $in: [category] };
      }
    }

    if (special === 'true') query.onSpecial = true;
    if (featured === 'true') query.featured = true;
    if (slug) query.slug = slug;

    if (barcode) {
      query.$or = [
        { barcode: barcode },
        { 'variants.barcode': barcode },
      ];
    }

    // ✅ Stable compound sort
    let sortOption: any = { createdAt: -1, _id: -1 };
    if (sort === 'name') sortOption = { name: 1, _id: 1 };
    else if (sort === 'price-asc') sortOption = { price: 1, _id: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1, _id: 1 };

    // When searching admin, return more results without strict pagination
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 25;
    const skip = search ? 0 : (pageNum - 1) * limitNum; // Don't skip on search
    const effectiveLimit = search ? Math.min(parseInt(limit || '200'), 500) : limitNum;

    const total = await db.collection('products').countDocuments(query);

    const products = await db
      .collection('products')
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(effectiveLimit)
      .toArray();

    if (barcode && products.length > 0) {
      const product = products[0];
      if (product.variants && product.variants.length > 0) {
        const variant = product.variants.find((v: any) => v.barcode === barcode);
        if (variant) {
          return NextResponse.json({ product, variant, matchType: 'variant' });
        }
      }
      return NextResponse.json({ product, matchType: 'product' });
    }

    return NextResponse.json({
      products,
      total,
      page: pageNum,
      limit: effectiveLimit,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin) {
      return NextResponse.json({
        error: 'Super admins cannot create products directly. Please assign to a branch.',
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (body.barcode) {
      const existing = await db.collection('products').findOne({
        branchId: adminInfo.branchId,
        $or: [
          { barcode: body.barcode },
          { 'variants.barcode': body.barcode },
        ],
      });
      if (existing) {
        return NextResponse.json({
          error: 'A product with this barcode already exists in your branch',
        }, { status: 400 });
      }
    }

    if (body.hasVariants && body.variants && body.variants.length > 0) {
      const variantBarcodes = body.variants
        .filter((v: any) => v.barcode)
        .map((v: any) => v.barcode);

      if (variantBarcodes.length > 0) {
        const existing = await db.collection('products').findOne({
          branchId: adminInfo.branchId,
          $or: [
            { barcode: { $in: variantBarcodes } },
            { 'variants.barcode': { $in: variantBarcodes } },
          ],
        });
        if (existing) {
          return NextResponse.json({
            error: 'One or more variant barcodes already exist in your branch',
          }, { status: 400 });
        }
      }

      const duplicates = variantBarcodes.filter((item: string, index: number) =>
        variantBarcodes.indexOf(item) !== index
      );
      if (duplicates.length > 0) {
        return NextResponse.json({
          error: `Duplicate barcode(s) in variants: ${duplicates.join(', ')}`,
        }, { status: 400 });
      }
    }

    let categories = body.categories;
    if (!Array.isArray(categories)) {
      categories = categories ? [categories] : [];
    }

    const variants =
      body.hasVariants && body.variants
        ? body.variants.map((v: any) => ({
            ...v,
            _id: v._id || new ObjectId().toString(),
          }))
        : [];

    const product = {
      ...body,
      categories,
      variants,
      hasVariants: body.hasVariants || false,
      barcode: body.barcode || null,
      branchId: adminInfo.branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);
    console.log('✅ Product created for branch:', adminInfo.branchId.toString());

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}