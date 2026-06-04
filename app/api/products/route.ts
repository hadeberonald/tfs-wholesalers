import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category    = searchParams.get('category');
    const special     = searchParams.get('special');
    const featured    = searchParams.get('featured');
    const slug        = searchParams.get('slug');
    const limit       = searchParams.get('limit');
    const page        = searchParams.get('page');
    const sort        = searchParams.get('sort');
    const all         = searchParams.get('all');
    const barcode     = searchParams.get('barcode');
    const branchId    = searchParams.get('branchId');
    const search      = searchParams.get('search');
    const excludeId   = searchParams.get('excludeId');
    const excludeLinked = searchParams.get('excludeLinked');
    const excludeIds  = searchParams.get('excludeIds');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};

    if (all === 'true') {
      const auth = await requirePermission('products:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    } else {
      query.active = true;
      query.isLinkedVariant = { $ne: true };
      // Hide products at or below their lowStockThreshold (defaults to 0) so
      // the storefront self-hides before the API sync catches up with reality.
      // A product is visible only if stockLevel > lowStockThreshold (or > 0
      // when no threshold is set), and the same logic applies to variants.
      query.$expr = {
        $or: [
          // Simple product: stockLevel > (lowStockThreshold ?? 0)
          {
            $gt: [
              '$stockLevel',
              { $ifNull: ['$lowStockThreshold', 0] },
            ],
          },
          // Variant product: at least one active variant above its threshold
          // (variants don't carry their own threshold, so use the parent's)
          {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$variants', []] },
                    as: 'v',
                    cond: {
                      $and: [
                        { $eq: ['$$v.active', true] },
                        {
                          $gt: [
                            '$$v.stockLevel',
                            { $ifNull: ['$lowStockThreshold', 0] },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
        ],
      };
      if (branchId) query.branchId = new ObjectId(branchId);
    }

    if (excludeId) {
      try { query._id = { $ne: new ObjectId(excludeId) }; } catch { /* ignore */ }
    }

    if (excludeLinked === 'true') {
      query.isLinkedVariant = { $ne: true };
    }

    if (excludeIds) {
      const ids = excludeIds
        .split(',')
        .filter(Boolean)
        .map(id => { try { return new ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      if (ids.length > 0) {
        query._id = { ...(query._id || {}), $nin: ids };
      }
    }

    if (search && search.trim().length >= 2) {
      const raw = search.trim();
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: new RegExp('(^|\\b)' + escaped, 'i') },
        { sku: new RegExp(escaped, 'i') },
        { barcode: new RegExp(escaped, 'i') },
        { tags: new RegExp('^' + escaped + '$', 'i') },
        { 'variants.name': new RegExp('(^|\\b)' + escaped, 'i') },
        { 'variants.sku': new RegExp(escaped, 'i') },
        { 'variants.barcode': new RegExp(escaped, 'i') },
      ];
    }

    if (category) {
      try {
        const categoryDoc = await db.collection('categories').findOne({ _id: new ObjectId(category) });
        query.categories = categoryDoc
          ? { $in: [categoryDoc.slug, category, new ObjectId(category)] }
          : { $in: [category] };
      } catch {
        query.categories = { $in: [category] };
      }
    }

    if (special  === 'true') query.onSpecial  = true;
    if (featured === 'true') query.featured   = true;
    if (slug)    query.slug    = slug;
    if (barcode) query.$or     = [{ barcode }, { 'variants.barcode': barcode }];

    const pageNum        = page  ? parseInt(page)  : 1;
    const limitNum       = limit ? parseInt(limit) : 25;
    const effectiveLimit = search ? Math.min(parseInt(limit || '200'), 500) : limitNum;

    // ── Random sort ────────────────────────────────────────────────────────
    if (sort === 'random' && !search && !barcode) {
      const total = await db.collection('products').countDocuments(query);

      const pipeline: any[] = [
        { $match: query },
        { $sample: { size: effectiveLimit } },
      ];

      const products = await db.collection('products').aggregate(pipeline).toArray();
      const hasMore = total > products.length;

      return NextResponse.json({
        products,
        total,
        page: pageNum,
        limit: effectiveLimit,
        totalPages: Math.ceil(total / limitNum),
        hasMore,
      });
    }

    // ── Standard sorts ─────────────────────────────────────────────────────
    let sortOption: any = { createdAt: -1, _id: -1 };
    if      (sort === 'name')       sortOption = { name:  1, _id:  1 };
    else if (sort === 'price-asc')  sortOption = { price: 1, _id:  1 };
    else if (sort === 'price-desc') sortOption = { price: -1, _id: 1 };

    const skip = search ? 0 : (pageNum - 1) * limitNum;

    const total    = await db.collection('products').countDocuments(query);
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
  const auth = await requirePermission('products:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.isSuperAdmin) {
    return NextResponse.json(
      { error: 'Super admins cannot create products directly. Please assign to a branch.' },
      { status: 403 }
    );
  }

  try {
    const body   = await request.json();
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    if (body.barcode) {
      const existing = await db.collection('products').findOne({
        branchId: auth.branchId,
        $or: [{ barcode: body.barcode }, { 'variants.barcode': body.barcode }],
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A product with this barcode already exists in your branch' },
          { status: 400 }
        );
      }
    }

    if (body.hasVariants && body.variants?.length > 0) {
      const variantBarcodes: string[] = body.variants
        .filter((v: any) => v.barcode && !v.linkedProductId)
        .map((v: any) => v.barcode);

      if (variantBarcodes.length > 0) {
        const existing = await db.collection('products').findOne({
          branchId: auth.branchId,
          $or: [
            { barcode: { $in: variantBarcodes } },
            { 'variants.barcode': { $in: variantBarcodes } },
          ],
        });
        if (existing) {
          return NextResponse.json(
            { error: 'One or more variant barcodes already exist in your branch' },
            { status: 400 }
          );
        }
        const duplicates = variantBarcodes.filter(
          (item: string, index: number) => variantBarcodes.indexOf(item) !== index
        );
        if (duplicates.length > 0) {
          return NextResponse.json(
            { error: 'Duplicate barcode(s) in variants: ' + duplicates.join(', ') },
            { status: 400 }
          );
        }
      }
    }

    let categories = body.categories;
    if (!Array.isArray(categories)) categories = categories ? [categories] : [];

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
        ? body.variants.map((v: any) => ({ ...v, _id: v._id || new ObjectId().toString() }))
        : [];

    const product = {
      ...body,
      categories,
      tags,
      variants,
      hasVariants: body.hasVariants || false,
      barcode: body.barcode || null,
      branchId: auth.branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);

    if (product.hasVariants && variants.length > 0) {
      const linkedIds = variants
        .filter((v: any) => v.linkedProductId)
        .map((v: any) => new ObjectId(v.linkedProductId));

      if (linkedIds.length > 0) {
        await db.collection('products').updateMany(
          { _id: { $in: linkedIds } },
          { $set: { isLinkedVariant: true, linkedVariantParentId: result.insertedId } }
        );
      }
    }

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}