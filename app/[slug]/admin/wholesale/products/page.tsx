'use client';
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="wholesale-products">
      <InnerPage />
    </RoleGuard>
  );
}
