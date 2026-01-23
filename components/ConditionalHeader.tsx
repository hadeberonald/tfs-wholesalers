'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AdminHeader from './AdminHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Show AdminHeader for all /admin routes
  const isAdminRoute = pathname.startsWith('/admin');
  
  return isAdminRoute ? <AdminHeader /> : <Header />;
}