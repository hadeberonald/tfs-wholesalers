'use client';
/**
 * app/[slug]/admin/refunds/page.tsx
 * RoleGuard wrapper — matches the pattern used on orders/page.tsx
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="refunds">
      <InnerPage />
    </RoleGuard>
  );
}