'use client';
/**
 * app/[slug]/admin/purchase-orders/page.tsx  — RoleGuard wrapper
 * Rename your existing page component file to _page.tsx, then this wraps it.
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="purchase-orders">
      <InnerPage />
    </RoleGuard>
  );
}
