'use client';
export const dynamic = 'force-dynamic';

import ProtectedRoute from '../../components/auth/ProtectedRoute';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireRole="admin">
      {children}
    </ProtectedRoute>
  );
}