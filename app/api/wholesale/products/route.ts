import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const category = searchParams.get('category');
    const page     = searchParams.get('page');
    const limit    = searchParams.get('limit');
    const all      = searchParams.get('all');

    if (!branchId && !all) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const productQuery: any = { active: true };

    if (all === 'true') {
      const auth = await requirePermission('wholesale-products:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) productQuery.branchId = auth.branchId;
    } else {
      if (branchId) productQuery.branchId = new ObjectId(branchId);
    }

    if (category) productQuery.categories = category;

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 25;
    const skip = (pageNum - 1) * limitNum;

    const products = await db.collection('products').find(productQuery).sort({ name: 1 }).skip(skip).limit(limitNum).toArray();
    const productIds = products.map(p => p._id);

    const wholesaleConfigs = await db.collection('wholesale_product_configs').find({ productId: { $in: productIds }, active: true }).toArray();
    const configMap = new Map();
    wholesaleConfigs.forEach(config => {
      const key = config.variantId ? `${config.productId}-${config.variantId}` : config.productId.toString();
      configMap.set(key, config);
    });

    const wholesaleProducts = products.map(product => {
      const baseConfig = configMap.get(product._id.toString());
      let variants = product.variants;
      if (product.hasVariants && variants) {
        variants = variants.map((v: any) => ({ ...v, wholesale: configMap.get(`${product._id}-${v._id}`) || baseConfig || null }));
      }
      return { ...product, wholesale: baseConfig || null, variants };
    });

    const total = await db.collection('products').countDocuments(productQuery);
    return NextResponse.json({ products: wholesaleProducts, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('Failed to fetch wholesale products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('wholesale-products:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const product = await db.collection('products').findOne({ _id: new ObjectId(body.productId) });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const config = { ...body, productId: new ObjectId(body.productId), branchId: auth.branchId || new ObjectId(body.branchId), active: true, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('wholesale_product_configs').insertOne(config);
    console.log('✅ Wholesale config created:', result.insertedId.toString());
    return NextResponse.json({ success: true, id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create wholesale config:', error);
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
  }
}
