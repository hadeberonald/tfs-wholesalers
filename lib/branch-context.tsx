'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Branch {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  settings?: {
    storeLocation: {
      lat: number;
      lng: number;
      address: string;
    };
    contactEmail: string;
    contactPhone: string;
  };
}

interface BranchContextType {
  branch: Branch | null;
  loading: boolean;
  setBranch: (branch: Branch) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({
  children,
  initialBranch,
}: {
  children: ReactNode;
  initialBranch?: Branch;
}) {
  const [branch, setBranchState] = useState<Branch | null>(initialBranch || null);
  const [loading, setLoading] = useState(!initialBranch);

  useEffect(() => {
    if (initialBranch) {
      // initialBranch comes from the server (e.g. middleware lookup by slug).
      // If the server resolved it, it's already validated — nothing more to do.
      setLoading(false);
      return;
    }

    // No server-resolved branch — check localStorage and validate it against
    // the live API before trusting it. A branch could have been deleted/paused
    // since the user last visited.
    const savedSlug = localStorage.getItem('selectedBranch');

    if (!savedSlug) {
      setLoading(false);
      return;
    }

    fetch(`/api/branches/${savedSlug}`)
      .then((res) => {
        if (res.ok) return res.json();
        // 404 or any non-OK response means the branch is gone or inactive
        throw new Error('Branch not found or inactive');
      })
      .then((data) => {
        setBranchState(data.branch);
      })
      .catch(() => {
        // Stale slug — clear it so the user is sent to the branch selector
        localStorage.removeItem('selectedBranch');
        setBranchState(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [initialBranch]);

  const setBranch = (newBranch: Branch) => {
    setBranchState(newBranch);
    setLoading(false);
  };

  return (
    <BranchContext.Provider value={{ branch, loading, setBranch }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}