'use client';
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="wholesale-customers">
      <InnerPage />
    </RoleGuard>
  );
}
