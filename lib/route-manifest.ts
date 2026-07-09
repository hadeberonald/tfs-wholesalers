/**
 * lib/route-manifest.ts
 *
 * THE ONLY FILE YOU EVER TOUCH WHEN ADDING A NEW ADMIN PAGE.
 *
 * Each entry here automatically:
 *  - Appears in the AdminHeader nav (grouped + labelled)
 *  - Becomes an assignable permission in the Role Editor UI
 *  - Is enforceable via <RoleGuard> and requirePermission()
 *
 * HOW TO ADD A NEW PAGE:
 *  1. Add an entry to ROUTE_MANIFEST below.
 *  2. Wrap your new page with <RoleGuard routeKey="your-key" />.
 *  3. Protect your API route with requirePermission('your-key').
 *  Done — it will appear in the Role Editor immediately.
 *
 * PERMISSION MODEL:
 *  Each route has a single key (e.g. "specials").
 *  From that key two permissions are derived automatically:
 *    "specials:read"  — can visit the page / call GET endpoints
 *    "specials:write" — can create/edit/delete via POST/PUT/DELETE
 *
 *  The `writeEnabled` flag controls whether write access is separately
 *  assignable (most pages yes; a pure dashboard/report may be false).
 */

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  Settings,
  Tag,
  Gift,
  FileText,
  ClipboardCheck,
  Truck,
  Store,
  UserCheck,
  BoxIcon,
  AlertTriangle,
  DollarSign,
  Image,
  BarChart2,
  ShieldCheck,
  Receipt,
  Contact2,
  BookOpen,
  Percent,
  type LucideIcon,
} from 'lucide-react';

export interface RouteManifestEntry {
  /** Unique stable key — used as permission id, never changes once set */
  key: string;
  /** Display label in nav + role editor */
  label: string;
  /** Nav group heading */
  group: string;
  /** Icon component (Lucide) */
  icon: LucideIcon;
  /**
   * href relative to the branch prefix, e.g. "/admin/products"
   * The AdminHeader prepends /{slug} automatically.
   */
  href: string;
  /**
   * Whether this page has write operations (create/edit/delete).
   * If false only a single :read permission is generated.
   * Default: true
   */
  writeEnabled?: boolean;
  /**
   * If true this route is always visible regardless of role
   * (e.g. the Dashboard). Default: false
   */
  alwaysVisible?: boolean;
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  // ── Main ──────────────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Dashboard',
    group: 'Main',
    icon: LayoutDashboard,
    href: '/admin',
    writeEnabled: false,
    alwaysVisible: true,
  },
  {
    key: 'orders',
    label: 'Orders',
    group: 'Main',
    icon: ShoppingBag,
    href: '/admin/orders',
  },
  {
    key: 'products',
    label: 'Products',
    group: 'Main',
    icon: Package,
    href: '/admin/products',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Bot',
    group: 'Marketing',
    icon: BarChart2, // already imported in this file
    href: '/admin/whatsapp',
  },

  // ── Wholesale ─────────────────────────────────────────────────────────────
  {
    key: 'wholesale-customers',
    label: 'W. Customers',
    group: 'Wholesale',
    icon: UserCheck,
    href: '/admin/wholesale/customers',
  },
  {
    key: 'wholesale-products',
    label: 'W. Products',
    group: 'Wholesale',
    icon: BoxIcon,
    href: '/admin/wholesale/products',
  },
  {
    key: 'wholesale-orders',
    label: 'W. Orders',
    group: 'Wholesale',
    icon: FileText,
    href: '/admin/wholesale/orders',
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  {
    key: 'purchase-orders',
    label: 'Purchase Orders',
    group: 'Inventory',
    icon: FileText,
    href: '/admin/purchase-orders',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    group: 'Inventory',
    icon: Truck,
    href: '/admin/suppliers',
  },
  {
    key: 'stock-takes',
    label: 'Stock Takes',
    group: 'Inventory',
    icon: ClipboardCheck,
    href: '/admin/stock-takes',
  },
  {
    key: 'resolutions',
    label: 'Resolutions',
    group: 'Inventory',
    icon: AlertTriangle,
    href: '/admin/resolutions',
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    key: 'revenue',
    label: 'Revenue',
    group: 'Finance',
    icon: DollarSign,
    href: '/admin/revenue',
    writeEnabled: false,
  },
  {
    key: 'refunds',
    label: 'Refunds',
    group: 'Finance',
    icon: Receipt,
    href: '/admin/refunds',
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    key: 'specials',
    label: 'Specials',
    group: 'Marketing',
    icon: Tag,
    href: '/admin/specials',
  },
  {
    key: 'combos',
    label: 'Combos',
    group: 'Marketing',
    icon: Gift,
    href: '/admin/combos',
  },
  {
    key: 'catalogues',
    label: 'Catalogues',
    group: 'Marketing',
    icon: BookOpen,
    href: '/admin/catalogues',
  },
  {
    key: 'promo-codes',
    label: 'Promo Codes',
    group: 'Marketing',
    icon: Percent,
    href: '/admin/promo-codes',
  },
  {
    key: 'nps',
    label: 'NPS',
    group: 'Marketing',
    icon: BarChart2,
    href: '/admin/nps',
    writeEnabled: false,
  },

  // ── Site Management ───────────────────────────────────────────────────────
  {
    key: 'categories',
    label: 'Categories',
    group: 'Site Management',
    icon: FolderTree,
    href: '/admin/categories',
  },
  {
    key: 'hero-banners',
    label: 'Hero Banners',
    group: 'Site Management',
    icon: Image,
    href: '/admin/hero-banners',
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    key: 'online-customers',
    label: 'Online Customers',
    group: 'System',
    icon: Contact2,
    href: '/admin/online-customers',
  },
  {
    key: 'users',
    label: 'Users',
    group: 'System',
    icon: Users,
    href: '/admin/users',
  },
  {
    key: 'roles',
    label: 'Roles',
    group: 'System',
    icon: ShieldCheck,
    href: '/admin/roles',
  },
  {
    key: 'settings',
    label: 'Settings',
    group: 'System',
    icon: Settings,
    href: '/admin/settings',
  },
];

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** All unique group names in display order */
export const MANIFEST_GROUPS = Array.from(
  new Set(ROUTE_MANIFEST.map((r) => r.group))
);

/** Quick lookup by key */
export const MANIFEST_BY_KEY = Object.fromEntries(
  ROUTE_MANIFEST.map((r) => [r.key, r])
) as Record<string, RouteManifestEntry>;

/**
 * All permission strings derived from the manifest.
 * e.g. "specials:read", "specials:write", "revenue:read"
 */
export function getAllPermissions(): string[] {
  const perms: string[] = [];
  for (const route of ROUTE_MANIFEST) {
    perms.push(`${route.key}:read`);
    if (route.writeEnabled !== false) {
      perms.push(`${route.key}:write`);
    }
  }
  return perms;
}

/**
 * Given a set of granted permissions, returns the manifest entries
 * the user is allowed to see (always-visible routes are always included).
 */
export function getVisibleRoutes(
  permissions: string[],
  isSuperAdmin: boolean
): RouteManifestEntry[] {
  if (isSuperAdmin) return ROUTE_MANIFEST;
  const permSet = new Set(permissions);
  return ROUTE_MANIFEST.filter(
    (r) => r.alwaysVisible || permSet.has(`${r.key}:read`)
  );
}

/**
 * Groups visible routes by their group label.
 */
export function groupRoutes(
  routes: RouteManifestEntry[]
): Record<string, RouteManifestEntry[]> {
  return routes.reduce(
    (acc, route) => {
      if (!acc[route.group]) acc[route.group] = [];
      acc[route.group].push(route);
      return acc;
    },
    {} as Record<string, RouteManifestEntry[]>
  );
}