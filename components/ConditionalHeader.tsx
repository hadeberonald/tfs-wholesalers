'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AdminHeader from './AdminHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Match pattern: /{anything}/admin or /admin
  // This will match both /durban/admin and /admin routes
  const isAdminRoute = pathname.includes('/admin');
  
  return isAdminRoute ? <AdminHeader /> : <Header />;
}