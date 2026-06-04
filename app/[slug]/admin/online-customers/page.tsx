'use client';
/**
 * app/[slug]/admin/online-customers/page.tsx — RoleGuard wrapper
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="online-customers">
      <InnerPage />
    </RoleGuard>
  );
}