// app/[slug]/admin/promo-files/page.tsx — old route, now redirects for old bookmarks/links
'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  useEffect(() => {
    router.replace(`/${slug}/admin/whatsapp?tab=files`);
  }, [router, slug]);
  return null;
}