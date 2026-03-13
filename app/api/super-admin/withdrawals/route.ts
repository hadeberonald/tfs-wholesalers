// app/api/super-admin/withdrawals/route.ts — GET all withdrawals (super admin only)
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }
    if (!adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Join with branches to get branch names
    const withdrawals = await db.collection('withdrawalRequests').aggregate([
      { $sort: { requestedAt: -1 } },
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branch',
        },
      },
      {
        $addFields: {
          branchName: { $arrayElemAt: ['$branch.displayName', 0] },
        },
      },
      { $project: { branch: 0 } },
    ]).toArray();

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 });
  }
}