import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({ 
      slug: params.slug,
      status: 'active' 
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404, headers: {
          'Access-Control-Allow-Origin': '*',
        }}
      );
    }

    return NextResponse.json({ 
      success: true,
      branch 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branch' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
      }}
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}