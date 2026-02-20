// lib/verify-mobile-token.ts
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

export interface MobileUser {
  id:              string;
  email:           string;
  role:            string;
  activeBranchId?: string;
}

export async function verifyMobileToken(token: string): Promise<MobileUser | null> {
  console.log('[verifyMobileToken] called, token length:', token?.length ?? 0);
  console.log('[verifyMobileToken] JWT_SECRET length:', JWT_SECRET.length);

  if (!token) {
    console.warn('[verifyMobileToken] No token provided');
    return null;
  }

  if (!JWT_SECRET) {
    console.error('[verifyMobileToken] JWT_SECRET is empty — check Render env vars');
    return null;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
    console.log('[verifyMobileToken] JWT decoded ok, id:', decoded?.id);
  } catch (err: any) {
    console.error('[verifyMobileToken] JWT verify failed:', err.name, err.message);
    return null;
  }

  if (!decoded?.id) {
    console.warn('[verifyMobileToken] No id in decoded token');
    return null;
  }

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.id) },
      { projection: { role: 1, email: 1, activeBranchId: 1 } }
    );

    if (!user) {
      console.warn('[verifyMobileToken] User not found in DB:', decoded.id);
      return null;
    }

    console.log('[verifyMobileToken] Success:', user.email, '| activeBranchId:', user.activeBranchId?.toString() ?? 'none');

    return {
      id:             decoded.id,
      email:          user.email           || decoded.email,
      role:           user.role            || decoded.role,
      activeBranchId: user.activeBranchId?.toString() || decoded.activeBranchId || undefined,
    };
  } catch (err: any) {
    console.error('[verifyMobileToken] DB lookup failed:', err.message);
    return null;
  }
}