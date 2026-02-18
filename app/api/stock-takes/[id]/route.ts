import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

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

    const updateData: any = {
      updatedAt: new Date()
    };

    if (body.countedStock !== undefined) {
      updateData.countedStock = body.countedStock;
      updateData.status = 'completed';
      updateData.completedDate = new Date();
      updateData.completedBy = adminInfo.userId;
      
      const stockTake = await db.collection('stockTakes').findOne({
        _id: new ObjectId(params.id)
      });
      
      if (stockTake) {
        updateData.variance = body.countedStock - stockTake.expectedStock;
        
        if (updateData.variance !== 0) {
          if (stockTake.variantId) {
            await db.collection('products').updateOne(
              { 
                _id: new ObjectId(stockTake.productId),
                'variants._id': stockTake.variantId 
              },
              { 
                $set: { 
                  'variants.$.stockLevel': body.countedStock,
                  updatedAt: new Date()
                }
              }
            );
          } else {
            await db.collection('products').updateOne(
              { _id: new ObjectId(stockTake.productId) },
              { 
                $set: { 
                  stockLevel: body.countedStock,
                  updatedAt: new Date()
                }
              }
            );
          }
        }
      }
    }

    if (body.notes) {
      updateData.notes = body.notes;
    }

    await db.collection('stockTakes').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update stock take:', error);
    return NextResponse.json({ error: 'Failed to update stock take' }, { status: 500 });
  }
}