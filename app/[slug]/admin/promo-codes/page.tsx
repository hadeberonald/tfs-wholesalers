'use client';
/**
 * app/[slug]/admin/promo-codes/page.tsx — RoleGuard wrapper
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="promo-codes">
      <InnerPage />
    </RoleGuard>
  );
}