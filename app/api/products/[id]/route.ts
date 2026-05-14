import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const product = await db.collection('products').findOne({ _id: new ObjectId(params.id) });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('products:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('products').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this product' }, { status: 403 });
    }

    const { _id, branchId, ...updateData } = body;

    if (updateData.categories && !Array.isArray(updateData.categories)) updateData.categories = [updateData.categories];

    if (Array.isArray(updateData.tags)) {
      updateData.tags = Array.from(new Set(updateData.tags.map((t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)));
    } else {
      updateData.tags = [];
    }

    if ('barcode' in updateData) {
      if (updateData.barcode === null || updateData.barcode === '') {
        delete updateData.barcode;
      } else {
        updateData.barcode = String(updateData.barcode).trim();
        const existingWithBarcode = await db.collection('products').findOne({ _id: { $ne: new ObjectId(params.id) }, branchId: existing.branchId, $or: [{ barcode: updateData.barcode }, { 'variants.barcode': updateData.barcode }] });
        if (existingWithBarcode) return NextResponse.json({ error: 'Barcode already in use in your branch', product: existingWithBarcode.name }, { status: 400 });
      }
    }

    if (updateData.hasVariants && updateData.variants?.length > 0) {
      updateData.variants = updateData.variants.map((v: any) => ({ ...v, _id: v._id || new ObjectId().toString() }));
      const variantBarcodes: string[] = updateData.variants.filter((v: any) => v.barcode && !v.linkedProductId).map((v: any) => v.barcode);
      if (variantBarcodes.length > 0) {
        const duplicates = variantBarcodes.filter((item: string, index: number) => variantBarcodes.indexOf(item) !== index);
        if (duplicates.length > 0) return NextResponse.json({ error: 'Duplicate barcode(s) in variants: ' + duplicates.join(', ') }, { status: 400 });
        const existingWithBarcode = await db.collection('products').findOne({ _id: { $ne: new ObjectId(params.id) }, branchId: existing.branchId, $or: [{ barcode: { $in: variantBarcodes } }, { 'variants.barcode': { $in: variantBarcodes } }] });
        if (existingWithBarcode) return NextResponse.json({ error: 'One or more variant barcodes already in use in your branch', product: existingWithBarcode.name }, { status: 400 });
      }
    }

    updateData.updatedAt = new Date();

    const result = await db.collection('products').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (updateData.hasVariants) {
      const parentId = new ObjectId(params.id);
      const linkedIds = (updateData.variants ?? []).filter((v: any) => v.linkedProductId).map((v: any) => new ObjectId(v.linkedProductId));
      if (linkedIds.length > 0) await db.collection('products').updateMany({ _id: { $in: linkedIds } }, { $set: { isLinkedVariant: true, linkedVariantParentId: parentId } });
      await db.collection('products').updateMany({ linkedVariantParentId: parentId, _id: { $nin: linkedIds } }, { $unset: { isLinkedVariant: '', linkedVariantParentId: '' } });
    } else {
      await db.collection('products').updateMany({ linkedVariantParentId: new ObjectId(params.id) }, { $unset: { isLinkedVariant: '', linkedVariantParentId: '' } });
    }

    console.log('✅ Product updated:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('products:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('products').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this product' }, { status: 403 });
    }

    await db.collection('products').updateMany({ linkedVariantParentId: new ObjectId(params.id) }, { $unset: { isLinkedVariant: '', linkedVariantParentId: '' } });
    await db.collection('products').deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
