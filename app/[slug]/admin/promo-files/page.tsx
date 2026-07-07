'use client';
/**
 * app/[slug]/admin/promo-files/page.tsx — RoleGuard wrapper
 * Uses the existing "settings" permission — no new role/permission needed.
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="settings" require="write">
      <InnerPage />
    </RoleGuard>
  );
}
