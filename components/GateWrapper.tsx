'use client';

import { useState } from 'react';
import GatePage from '@/components/GatePage';

export default function GateWrapper({ children }: { children: React.ReactNode }) {
  const [passed, setPassed] = useState(false);

  if (!passed) {
    return <GatePage onProceed={() => setPassed(true)} />;
  }

  return <>{children}</>;
}