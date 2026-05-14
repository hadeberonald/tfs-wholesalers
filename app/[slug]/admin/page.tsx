'use client';

/**
 * app/[slug]/admin/page.tsx  (the dashboard landing page)
 *
 * The dashboard is the entry point for all admin roles, so we do NOT wrap it
 * with RoleGuard — RoleGuard already special-cases routeKey="dashboard" to
 * allow any authenticated user through, but skipping it entirely avoids even
 * the momentary loading flicker on the page admins land on most often.
 *
 * If you previously had a separate dashboard/page.tsx with a RoleGuard wrapper,
 * delete that file and use this one instead.
 */

import InnerPage from './dashboard/_page';

export default function AdminHomePage() {
  return <InnerPage />;
}
