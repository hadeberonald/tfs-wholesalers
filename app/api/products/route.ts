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
    const search = searchParams.get('search');

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

    // Improved admin search:
    // - Name uses word-boundary regex so "milk" won't match "buttermilk"
    // - Description excluded — causes too many irrelevant hits on common words
    // - Tags matched as exact tokens (stored as lowercase slugs)
    // - SKU / barcode use substring match (fine for structured codes)
    if (search && search.trim().length >= 2) {
      const raw = search.trim();
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const nameRegex = new RegExp('(^|\\b)' + escaped, 'i');
      const codeRegex = new RegExp(escaped, 'i');
      const tagRegex  = new RegExp('^' + escaped + '$', 'i');

      query.$or = [
        { name: nameRegex },
        { sku: codeRegex },
        { barcode: codeRegex },
        { tags: tagRegex },
        { 'variants.name': nameRegex },
        { 'variants.sku': codeRegex },
        { 'variants.barcode': codeRegex },
      ];
    }

    if (category) {
      try {
        const categoryDoc = await db.collection('categories').findOne({
          _id: new ObjectId(category),
        });
        if (categoryDoc) {
          query.categories = {
            $in: [categoryDoc.slug, category, new ObjectId(category)],
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
      query.$or = [{ barcode }, { 'variants.barcode': barcode }];
    }

    let sortOption: any = { createdAt: -1, _id: -1 };
    if (sort === 'name') sortOption = { name: 1, _id: 1 };
    else if (sort === 'price-asc') sortOption = { price: 1, _id: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1, _id: 1 };

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 25;
    const skip = search ? 0 : (pageNum - 1) * limitNum;
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
      if (product.variants?.length > 0) {
        const variant = product.variants.find((v: any) => v.barcode === barcode);
        if (variant) return NextResponse.json({ product, variant, matchType: 'variant' });
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
        $or: [{ barcode: body.barcode }, { 'variants.barcode': body.barcode }],
      });
      if (existing) {
        return NextResponse.json({
          error: 'A product with this barcode already exists in your branch',
        }, { status: 400 });
      }
    }

    if (body.hasVariants && body.variants?.length > 0) {
      // FIX: skip linked variants — their barcode lives on their own product document,
      // so checking them here would produce a false duplicate error.
      const variantBarcodes: string[] = body.variants
        .filter((v: any) => v.barcode && !v.linkedProductId)
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

      const duplicates = variantBarcodes.filter(
        (item: string, index: number) => variantBarcodes.indexOf(item) !== index
      );
      if (duplicates.length > 0) {
        return NextResponse.json({
          error: 'Duplicate barcode(s) in variants: ' + duplicates.join(', '),
        }, { status: 400 });
      }
    }

    let categories = body.categories;
    if (!Array.isArray(categories)) categories = categories ? [categories] : [];

    // Normalise tags: lowercase, strip invalid chars, dedupe
    // Use Array.from(new Set(...)) — spread of Set requires ES2015+ target
    const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
    const tags: string[] = Array.from(
      new Set(
        rawTags
          .map((t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          .filter(Boolean)
      )
    );

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
      tags,
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