'use client';

// hooks/useWebPush.ts
// Drop this hook into your web store layout or account page to auto-register
// web push notifications after the user logs in.
//
// Usage in a client component (e.g. app/[branch]/layout.tsx or account page):
//
//   import { useWebPush } from '@/hooks/useWebPush';
//   import { useAuth } from '@/lib/auth-context';
//
//   export default function Layout({ children }) {
//     const { user } = useAuth();
//     useWebPush(user?.id);          // ← one line, that's it
//     return <>{children}</>;
//   }

import { useEffect, useRef } from 'react';
import { registerWebPush, isWebPushSupported } from '@/lib/webPush';

export function useWebPush(userId?: string | null) {
  const registeredRef = useRef(false);

  useEffect(() => {
    // Only register once per session, only on supported browsers
    if (registeredRef.current) return;
    if (!isWebPushSupported()) return;

    // Don't ask for permission on first page load if not logged in —
    // wait until user is actually logged in to avoid the browser permission
    // prompt appearing to unauthenticated visitors.
    // If you want to register guests too, remove this check.
    if (userId === undefined) return; // still loading auth state
    if (userId === null) return;      // not logged in

    registeredRef.current = true;

    registerWebPush(userId).then((success) => {
      if (success) {
        console.log('[useWebPush] Registered for web push — userId:', userId);
      }
    });
  }, [userId]);
}