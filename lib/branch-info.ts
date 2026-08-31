// lib/branch-info.ts
//
// Central place to add/edit per-branch details (logo, phone, address).
// Keyed by branch `slug` (the value that shows up in the URL, e.g.
// tfswholesalers.com/vryheid -> slug === 'vryheid').
//
// To add a new branch: add an entry here with the branch's slug and
// drop the logo file in /public.

export interface BranchInfo {
  slug: string;
  name: string;
  logo: string;
  phone: string;
  addressLines: string[];
}

export const BRANCH_INFO: Record<string, BranchInfo> = {
  vryheid: {
    slug: 'vryheid',
    name: 'TFS Wholesalers Vryheid',
    logo: '/tfs-vryheid-logo.png',
    phone: '034 981 3210',
    addressLines: ['241 Utrecht St', 'Vryheid, KZN 3100'],
  },
  dundee: {
    slug: 'dundee',
    name: 'TFS Discount Warehouse Dundee',
    logo: '/tfs-dundee-logo.png',
    phone: '073 438 5879',
    addressLines: ['9 Victoria St', 'Dundee, 3000'],
  },
  ladysmith: {
    slug: 'ladysmith',
    name: 'TFS Wholesalers Ladysmith',
    logo: '/tfs-ladysmith-logo.png',
    phone: '036 637 7927',
    addressLines: ['69 Newcastle Rd', 'Ladysmith, uMnambithi, 3370'],
  },
};

// Fallback logo used when we don't know the branch yet (e.g. on
// /select-branch, /super-admin, or before the branch has loaded).
export const DEFAULT_LOGO = '/logo.png';

// Support email is the same across every branch.
export const SUPPORT_EMAIL = 'enquiries@tfswholesalers.com';

export function getBranchInfo(slug?: string | null): BranchInfo | null {
  if (!slug) return null;
  return BRANCH_INFO[slug.toLowerCase()] ?? null;
}

export function getBranchLogo(slug?: string | null): string {
  return getBranchInfo(slug)?.logo ?? DEFAULT_LOGO;
}