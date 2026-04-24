import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const product = await db.collection('products').findOne({
      _id: new ObjectId(params.id),
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
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Verify ownership
    const existing = await db.collection('products').findOne({
      _id: new ObjectId(params.id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      !adminInfo.isSuperAdmin &&
      existing.branchId.toString() !== adminInfo.branchId.toString()
    ) {
      return NextResponse.json({ error: 'Not authorized to edit this product' }, { status: 403 });
    }

    const { _id, branchId, ...updateData } = body;

    // Normalise categories
    if (updateData.categories && !Array.isArray(updateData.categories)) {
      updateData.categories = [updateData.categories];
    }

    // Normalise tags: lowercase, strip invalid chars, dedupe
    // Use Array.from(new Set(...)) — spread of Set requires ES2015+ target
    if (Array.isArray(updateData.tags)) {
      updateData.tags = Array.from(
        new Set(
          updateData.tags
            .map((t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            .filter(Boolean)
        )
      );
    } else {
      updateData.tags = [];
    }

    // Barcode validation
    if ('barcode' in updateData) {
      if (updateData.barcode === null || updateData.barcode === '') {
        delete updateData.barcode;
      } else {
        updateData.barcode = String(updateData.barcode).trim();

        const existingWithBarcode = await db.collection('products').findOne({
          _id: { $ne: new ObjectId(params.id) },
          branchId: existing.branchId,
          $or: [
            { barcode: updateData.barcode },
            { 'variants.barcode': updateData.barcode },
          ],
        });

        if (existingWithBarcode) {
          return NextResponse.json({
            error: 'Barcode already in use in your branch',
            product: existingWithBarcode.name,
          }, { status: 400 });
        }
      }
    }

    // Variant barcode validation
    if (updateData.hasVariants && updateData.variants?.length > 0) {
      updateData.variants = updateData.variants.map((v: any) => ({
        ...v,
        _id: v._id || new ObjectId().toString(),
      }));

      // FIX: skip linked variants — their barcode lives on their own product document,
      // so checking them here would produce a false duplicate error.
      const variantBarcodes: string[] = updateData.variants
        .filter((v: any) => v.barcode && !v.linkedProductId)
        .map((v: any) => v.barcode);

      if (variantBarcodes.length > 0) {
        const duplicates = variantBarcodes.filter(
          (item: string, index: number) => variantBarcodes.indexOf(item) !== index
        );

        if (duplicates.length > 0) {
          return NextResponse.json({
            error: 'Duplicate barcode(s) in variants: ' + duplicates.join(', '),
          }, { status: 400 });
        }

        const existingWithBarcode = await db.collection('products').findOne({
          _id: { $ne: new ObjectId(params.id) },
          branchId: existing.branchId,
          $or: [
            { barcode: { $in: variantBarcodes } },
            { 'variants.barcode': { $in: variantBarcodes } },
          ],
        });

        if (existingWithBarcode) {
          return NextResponse.json({
            error: 'One or more variant barcodes already in use in your branch',
            product: existingWithBarcode.name,
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

    console.log('✅ Product updated:', params.id);
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
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('products').findOne({
      _id: new ObjectId(params.id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      !adminInfo.isSuperAdmin &&
      existing.branchId.toString() !== adminInfo.branchId.toString()
    ) {
      return NextResponse.json({ error: 'Not authorized to delete this product' }, { status: 403 });
    }

    await db.collection('products').deleteOne({ _id: new ObjectId(params.id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}