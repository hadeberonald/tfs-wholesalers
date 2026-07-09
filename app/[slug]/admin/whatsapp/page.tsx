// app/[slug]/admin/whatsapp/page.tsx — RoleGuard wrapper
'use client';
import RoleGuard from '@/components/RoleGuard';
import InnerPage from './_page';

export default function Page() {
  return (
    <RoleGuard routeKey="whatsapp" require="read">
      <InnerPage />
    </RoleGuard>
  );
}