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
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    // Build query
    const query: any = {};
    
    // Admin requesting their products
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      // Customer browsing - only show active products
      query.active = true;
      
      if (branchId) {
        query.branchId = new ObjectId(branchId);
      }
    }
    
    // Category filter
    if (category) {
      // Category parameter is the category ID
      query.categories = category;
    }
    
    if (special === 'true') query.onSpecial = true;
    if (featured === 'true') query.featured = true;
    if (slug) query.slug = slug;
    
    // Barcode lookup
    if (barcode) {
      query.$or = [
        { barcode: barcode },
        { 'variants.barcode': barcode }
      ];
    }
    
    // Determine sort order
    let sortOption: any = { createdAt: -1 }; // Default: newest first
    
    if (sort === 'name') {
      sortOption = { name: 1 };
    } else if (sort === 'price-asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price-desc') {
      sortOption = { price: -1 };
    }
    
    // Pagination
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 25;
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count for pagination
    const total = await db.collection('products').countDocuments(query);
    
    let cursor = db.collection('products')
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
    
    const products = await cursor.toArray();

    // If searching by barcode, return single product or variant
    if (barcode && products.length > 0) {
      const product = products[0];
      
      if (product.variants && product.variants.length > 0) {
        const variant = product.variants.find((v: any) => v.barcode === barcode);
        if (variant) {
          return NextResponse.json({ 
            product,
            variant,
            matchType: 'variant'
          });
        }
      }
      
      return NextResponse.json({ 
        product,
        matchType: 'product'
      });
    }

    return NextResponse.json({ 
      products,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
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
        error: 'Super admins cannot create products directly. Please assign to a branch.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Validate barcode uniqueness
    if (body.barcode) {
      const existing = await db.collection('products').findOne({ 
        branchId: adminInfo.branchId,
        $or: [
          { barcode: body.barcode },
          { 'variants.barcode': body.barcode }
        ]
      });
      if (existing) {
        return NextResponse.json({ 
          error: 'A product with this barcode already exists in your branch' 
        }, { status: 400 });
      }
    }

    // Validate variant barcodes
    if (body.hasVariants && body.variants && body.variants.length > 0) {
      const variantBarcodes = body.variants
        .filter((v: any) => v.barcode)
        .map((v: any) => v.barcode);
      
      if (variantBarcodes.length > 0) {
        const existing = await db.collection('products').findOne({
          branchId: adminInfo.branchId,
          $or: [
            { barcode: { $in: variantBarcodes } },
            { 'variants.barcode': { $in: variantBarcodes } }
          ]
        });
        
        if (existing) {
          return NextResponse.json({ 
            error: 'One or more variant barcodes already exist in your branch' 
          }, { status: 400 });
        }
      }

      // Check for duplicates within variants
      const duplicates = variantBarcodes.filter((item: string, index: number) => 
        variantBarcodes.indexOf(item) !== index
      );
      
      if (duplicates.length > 0) {
        return NextResponse.json({ 
          error: `Duplicate barcode(s) in variants: ${duplicates.join(', ')}` 
        }, { status: 400 });
      }
    }

    // Convert categories to array if needed
    let categories = body.categories;
    if (!Array.isArray(categories)) {
      categories = categories ? [categories] : [];
    }

    // Generate variant IDs
    const variants = body.hasVariants && body.variants 
      ? body.variants.map((v: any) => ({
          ...v,
          _id: v._id || new ObjectId().toString()
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