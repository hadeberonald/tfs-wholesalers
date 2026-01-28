import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const product = await db.collection('products').findOne({
      _id: new ObjectId(params.id)
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const { _id, ...updateData } = body;

    // ✅ Handle barcode field properly
    if ('barcode' in updateData) {
      if (updateData.barcode === null || updateData.barcode === '') {
        // Remove barcode if null or empty
        delete updateData.barcode;
      } else {
        // Validate and trim barcode
        updateData.barcode = String(updateData.barcode).trim();

        // ✅ Check if barcode is already used by another product
        const existingProduct = await db.collection('products').findOne({
          barcode: updateData.barcode,
          _id: { $ne: new ObjectId(params.id) }
        });

        if (existingProduct) {
          return NextResponse.json({
            error: 'Barcode already in use',
            product: existingProduct.name
          }, { status: 400 });
        }
      }
    }

    updateData.updatedAt = new Date();

    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    console.log('✅ Product updated:', params.id, updateData.barcode ? `with barcode: ${updateData.barcode}` : '');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    await db.collection('products').deleteOne({ 
      _id: new ObjectId(params.id) 
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}