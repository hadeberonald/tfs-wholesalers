import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';

// SECURITY: No fallback — app will not start without this env var set.
const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

export async function getAdminBranch() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return { error: 'Not authenticated', status: 401 };
    }

    const decoded = jwt.verify(token, JWT_SECRET!) as any;

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    });

    if (!user) {
      return { error: 'User not found', status: 404 };
    }

    if (user.role !== 'admin' && user.role !== 'super-admin') {
      return { error: 'Not authorized - Admin access required', status: 403 };
    }

    // Super admins don't have a branchId, they manage all branches
    if (user.role === 'super-admin') {
      return {
        userId: user._id,
        email: user.email,
        role: user.role,
        branchId: null,
        isSuperAdmin: true
      };
    }

    if (!user.branchId) {
      return { error: 'Admin has no branch assigned', status: 400 };
    }

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      isSuperAdmin: false
    };
  } catch (error) {
    return { error: 'Authentication failed', status: 500 };
  }
}
