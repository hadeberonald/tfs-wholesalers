import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin || !adminInfo.branchId) {
      return NextResponse.json({ 
        error: 'Super admins must select a branch to view settings' 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({
      _id: adminInfo.branchId
    });
    
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      settings: branch.settings?.deliveryPricing || {
        local: 35,
        localRadius: 20,
        medium: 85,
        mediumRadius: 40,
        far: 105,
        farRadius: 60,
      }
    });
  } catch (error) {
    console.error('Failed to fetch delivery settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin || !adminInfo.branchId) {
      return NextResponse.json({ 
        error: 'Super admins must select a branch to update settings' 
      }, { status: 400 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    await db.collection('branches').updateOne(
      { _id: adminInfo.branchId },
      { 
        $set: { 
          'settings.deliveryPricing': body,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log('✅ Delivery settings updated for branch:', adminInfo.branchId.toString());
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update delivery settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}