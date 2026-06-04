import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug     = searchParams.get('slug');
    const active   = searchParams.get('active');
    const featured = searchParams.get('featured');
    const all      = searchParams.get('all');
    const branchId = searchParams.get('branchId');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};

    if (all === 'true') {
      const auth = await requirePermission('specials:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    } else {
      query.active = true;
      if (branchId) query.branchId = new ObjectId(branchId);
    }

    if (slug)                query.slug     = slug;
    if (active   === 'true') query.active   = true;
    if (featured === 'true') query.featured = true;

    const specials = await db.collection('specials').find(query).sort({ createdAt: -1 }).toArray();

    // ── Collect all referenced product IDs ────────────────────────────────
    const rawIds: string[] = [];
    for (const s of specials) {
      if (s.productId)                 rawIds.push(s.productId.toString());
      if (Array.isArray(s.productIds)) s.productIds.forEach((id: any) => rawIds.push(id.toString()));
      if (s.conditions?.buyProductId)  rawIds.push(s.conditions.buyProductId.toString());
      if (s.conditions?.getProductId)  rawIds.push(s.conditions.getProductId.toString());
    }

    const uniqueIds = Array.from(new Set(rawIds)).filter(id => ObjectId.isValid(id));

    // ── Fetch all referenced products (children included) ─────────────────
    const allProducts = uniqueIds.length > 0
      ? await db.collection('products').find({
          _id: { $in: uniqueIds.map(id => new ObjectId(id)) },
        }).toArray()
      : [];

    const productMap: Record<string, any> = Object.fromEntries(
      allProducts.map(p => [p._id.toString(), p])
    );

    // ── For linked variant children, fetch their parents if not yet loaded ─
    const missingParentIds = allProducts
      .filter(p => p.isLinkedVariant && p.linkedVariantParentId)
      .map(p => p.linkedVariantParentId.toString())
      .filter(id => !productMap[id] && ObjectId.isValid(id));

    if (missingParentIds.length > 0) {
      const parents = await db.collection('products').find({
        _id: { $in: Array.from(new Set(missingParentIds)).map(id => new ObjectId(id)) },
      }).toArray();
      for (const p of parents) productMap[p._id.toString()] = p;
    }

    // ── Enrich each special, resolving child → parent where needed ─────────
    const enrichedSpecials = specials.map(s => {
      const primaryId =
        s.productId?.toString() ||
        s.productIds?.[0]?.toString() ||
        s.conditions?.buyProductId?.toString() ||
        null;

      if (!primaryId) return { ...s, product: null };

      const resolved = productMap[primaryId] ?? null;

      // If the special points at a linked variant child, redirect to its parent
      // and stamp variantId so SpecialCard auto-selects the right variant.
      if (resolved?.isLinkedVariant && resolved.linkedVariantParentId) {
        const parentId = resolved.linkedVariantParentId.toString();
        const parent   = productMap[parentId] ?? null;

        // Hide if the parent has no stock anywhere
        if (!parent || !hasAnyStock(parent)) return { ...s, product: null };

        return {
          ...s,
          product:   parent,
          variantId: s.variantId || resolved._id.toString(),
        };
      }

      // Hide if the resolved product has no stock anywhere
      if (!resolved || !resolved.active || !hasAnyStock(resolved)) {
        return { ...s, product: null };
      }

      return { ...s, product: resolved };
    });

    // ── Deduplicate: one card per parent product ───────────────────────────
    const seenParentIds = new Set<string>();
    const deduped = enrichedSpecials.filter(s => {
      const pid = s.product?._id?.toString();
      if (!pid) return true;
      if (seenParentIds.has(pid)) return false;
      seenParentIds.add(pid);
      return true;
    });

    return NextResponse.json({ specials: deduped });
  } catch (error) {
    console.error('Failed to fetch specials:', error);
    return NextResponse.json({ error: 'Failed to fetch specials' }, { status: 500 });
  }
}

/**
 * Returns true if a product has stock above its lowStockThreshold (defaults to
 * 0 when unset) at the parent level OR via at least one active variant.
 * Mirrors the $expr query used in the products API so hiding is consistent.
 */
function hasAnyStock(product: any): boolean {
  const threshold = product.lowStockThreshold ?? 0;
  if ((product.stockLevel ?? 0) > threshold) return true;
  if (Array.isArray(product.variants)) {
    return product.variants.some((v: any) => v.active && (v.stockLevel ?? 0) > threshold);
  }
  return false;
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('specials:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.isSuperAdmin) {
    return NextResponse.json(
      { error: 'Super admins cannot create specials directly. Please assign to a branch.' },
      { status: 403 }
    );
  }
  try {
    const body   = await request.json();
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const special = { ...body, branchId: auth.branchId, createdAt: new Date(), updatedAt: new Date() };
    const result  = await db.collection('specials').insertOne(special);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create special:', error);
    return NextResponse.json({ error: 'Failed to create special' }, { status: 500 });
  }
}