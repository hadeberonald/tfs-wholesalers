import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const category = searchParams.get('category');
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const all = searchParams.get('all'); // Admin
    
    if (!branchId && !all) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Build query for products
    const productQuery: any = { active: true };
    
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        productQuery.branchId = adminInfo.branchId;
      }
    } else {
      // FIX: branchId is guaranteed non-null here due to the check above,
      // but TypeScript can't infer it, so we guard explicitly.
      if (branchId) {
        productQuery.branchId = new ObjectId(branchId);
      }
    }
    
    if (category) {
      productQuery.categories = category;
    }
    
    // Pagination
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 25;
    const skip = (pageNum - 1) * limitNum;
    
    // Get products
    const products = await db.collection('products')
      .find(productQuery)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();
    
    // Get wholesale configs for these products
    const productIds = products.map(p => p._id);
    
    const wholesaleConfigs = await db.collection('wholesale_product_configs')
      .find({
        productId: { $in: productIds },
        active: true
      })
      .toArray();
    
    // Create a map for quick lookup
    const configMap = new Map();
    wholesaleConfigs.forEach(config => {
      const key = config.variantId 
        ? `${config.productId}-${config.variantId}`
        : config.productId.toString();
      configMap.set(key, config);
    });
    
    // Enrich products with wholesale info
    const wholesaleProducts = products.map(product => {
      const baseConfig = configMap.get(product._id.toString());
      
      let variants = product.variants;
      if (product.hasVariants && variants) {
        variants = variants.map((v: any) => {
          const variantConfig = configMap.get(`${product._id}-${v._id}`);
          return {
            ...v,
            wholesale: variantConfig || baseConfig || null
          };
        });
      }
      
      return {
        ...product,
        wholesale: baseConfig || null,
        variants
      };
    });
    
    const total = await db.collection('products').countDocuments(productQuery);
    
    return NextResponse.json({
      products: wholesaleProducts,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Failed to fetch wholesale products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Validate product exists
    const product = await db.collection('products').findOne({
      _id: new ObjectId(body.productId)
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const config = {
      ...body,
      productId: new ObjectId(body.productId),
      branchId: adminInfo.branchId || new ObjectId(body.branchId),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('wholesale_product_configs').insertOne(config);
    
    console.log('✅ Wholesale config created:', result.insertedId.toString());
    
    return NextResponse.json({ 
      success: true,
      id: result.insertedId.toString()
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create wholesale config:', error);
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
  }
}