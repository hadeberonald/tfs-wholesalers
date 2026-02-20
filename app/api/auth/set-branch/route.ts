// app/api/auth/set-branch/route.ts
// Called by the picker app when a branch is selected.
// Persists activeBranchId on the user document so verifyMobileToken
// always returns the latest branch without requiring re-login.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await request.json();
    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Accept ObjectId OR slug
    let branch = null;
    if (ObjectId.isValid(branchId)) {
      branch = await db.collection('branches').findOne({ _id: new ObjectId(branchId) });
    }
    if (!branch) {
      branch = await db.collection('branches').findOne({ slug: branchId });
    }
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(mobileUser.id) },
      {
        $set: {
          activeBranchId:   branch._id,
          activeBranchName: branch.name,
          updatedAt:        new Date(),
        },
      }
    );

    console.log(`✅ Branch set: ${mobileUser.email} → ${branch.name}`);

    return NextResponse.json({
      success: true,
      branch: { id: branch._id.toString(), name: branch.name, slug: branch.slug },
    });
  } catch (error) {
    console.error('set-branch error:', error);
    return NextResponse.json({ error: 'Failed to set branch' }, { status: 500 });
  }
}