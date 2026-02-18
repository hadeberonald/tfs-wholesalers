import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const all = searchParams.get('all'); // Admin requesting all orders
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    // If admin is requesting their branch's orders
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      // Only filter by branch if not super admin
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else if (userId) {
      // Customer requesting their own orders
      query.userId = userId;
    }
    
    const orders = await db.collection('orders')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Validate branchId is provided (from customer's cart)
    if (!body.branchId) {
      return NextResponse.json({ 
        error: 'Branch ID is required' 
      }, { status: 400 });
    }

    // ✅ Enrich order items with product/variant data including barcodes
    const enrichedItems = await Promise.all(
      body.items.map(async (item: any) => {
        try {
          const product = await db.collection('products').findOne({
            _id: new ObjectId(item.productId),
            branchId: new ObjectId(body.branchId) // Ensure product belongs to branch
          });

          if (!product) {
            console.warn(`⚠️ Product not found: ${item.productId}, using cart data`);
            return item;
          }

          // Check if this is a variant order
          if (item.variantId && product.variants && product.variants.length > 0) {
            const variant = product.variants.find((v: any) => v._id === item.variantId);
            
            if (variant) {
              return {
                productId: item.productId,
                variantId: item.variantId,
                name: product.name,
                variantName: variant.name,
                sku: variant.sku || item.sku,
                price: item.price,
                quantity: item.quantity,
                image: variant.images?.[0] || product.images?.[0] || item.image || '',
                barcode: variant.barcode || undefined,
                description: `${product.description || ''} - ${variant.name}`.trim(),
              };
            }
          }

          // Return enriched base product item
          return {
            productId: item.productId,
            name: product.name || item.name,
            sku: product.sku || item.sku,
            price: item.price,
            quantity: item.quantity,
            image: product.images?.[0] || item.image || '',
            barcode: product.barcode || undefined,
            description: product.description || undefined,
          };
        } catch (error) {
          console.error(`❌ Error enriching item ${item.productId}:`, error);
          return item;
        }
      })
    );

    const order = {
      ...body,
      items: enrichedItems,
      branchId: new ObjectId(body.branchId), // From customer's selected branch
      orderNumber: `ORD-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('orders').insertOne(order);
    
    console.log('✅ Order created:', result.insertedId.toString());
    console.log(`   - Branch: ${body.branchId}`);
    console.log(`   - ${enrichedItems.filter((i: any) => i.barcode).length}/${enrichedItems.length} items have barcodes`);
    
    return NextResponse.json({ 
      success: true,
      orderId: result.insertedId.toString(),
      orderNumber: order.orderNumber,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}