'use client';
/**
 * app/[slug]/admin/catalogues/page.tsx — RoleGuard wrapper
 */
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="catalogues">
      <InnerPage />
    </RoleGuard>
  );
}