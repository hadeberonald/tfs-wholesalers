import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const all = searchParams.get('all'); // For admin
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    if (userId && !all) {
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

    // ✅ CRITICAL: Enrich order items with product data including barcodes
    const enrichedItems = await Promise.all(
      body.items.map(async (item: any) => {
        try {
          // Fetch full product details from database
          const product = await db.collection('products').findOne({
            _id: new ObjectId(item.productId)
          });

          if (!product) {
            console.warn(`⚠️ Product not found: ${item.productId}, using cart data`);
            return item; // Fallback to cart data if product not found
          }

          // Return enriched item with barcode and description from product
          return {
            productId: item.productId,
            name: product.name || item.name,
            sku: product.sku || item.sku,
            price: item.price, // Use price from cart (may be special price)
            quantity: item.quantity,
            image: product.images?.[0] || item.image || '',
            barcode: product.barcode || undefined, // ✅ Include barcode from product
            description: product.description || undefined, // ✅ Include description for pickers
          };
        } catch (error) {
          console.error(`❌ Error enriching item ${item.productId}:`, error);
          return item; // Fallback to original item on error
        }
      })
    );

    const order = {
      ...body,
      items: enrichedItems, // ✅ Use enriched items instead of cart items
      orderNumber: `ORD-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('orders').insertOne(order);
    
    console.log('✅ Order created with barcodes:', result.insertedId.toString());
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