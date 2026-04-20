// lib/verify-mobile-token.ts
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// SECURITY: Consolidated to single env var. No fallback to empty string.
const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

export interface MobileUser {
  id:              string;
  email:           string;
  role:            string;
  activeBranchId?: string;
}

export async function verifyMobileToken(token: string): Promise<MobileUser | null> {
  if (!token) return null;

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET!);
  } catch {
    return null;
  }

  if (!decoded?.id) return null;

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.id) },
      { projection: { role: 1, email: 1, activeBranchId: 1 } }
    );

    if (!user) return null;

    return {
      id:             decoded.id,
      email:          user.email           || decoded.email,
      role:           user.role            || decoded.role,
      activeBranchId: user.activeBranchId?.toString() || decoded.activeBranchId || undefined,
    };
  } catch {
    return null;
  }
}
