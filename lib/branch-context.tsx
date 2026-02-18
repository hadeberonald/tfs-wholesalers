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
  initialBranch 
}: { 
  children: ReactNode;
  initialBranch?: Branch;
}) {
  const [branch, setBranchState] = useState<Branch | null>(initialBranch || null);
  const [loading, setLoading] = useState(!initialBranch);

  useEffect(() => {
    if (!initialBranch) {
      setLoading(false);
    }
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