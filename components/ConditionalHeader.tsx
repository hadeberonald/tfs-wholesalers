'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function ConditionalHeader() {
  const pathname = usePathname();

  // Admin routes render their own AdminHeader via the admin layout.
  // Rendering Header here too causes the double-header bug — so we bail out.
  if (pathname.includes('/admin')) return null;

  return <Header />;
}
