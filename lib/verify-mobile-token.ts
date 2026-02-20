// lib/verify-mobile-token.ts
// Verifies a JWT issued by /api/auth/mobile-login.
// Always re-fetches the user from DB so activeBranchId changes
// (from POST /api/auth/set-branch) take effect immediately without re-login.

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
  if (!token || !JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded?.id) return null;

    // Re-fetch from DB to get the latest activeBranchId
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
    return null; // JWT expired or invalid
  }
}