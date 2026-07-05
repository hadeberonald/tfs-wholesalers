/**
 * The only thing that still needs to live in app code: which icon each
 * branch maps to. Coordinates and radius come live from
 * /api/mobile/branches (settings.storeLocation.lat / .lng), not from here.
 *
 * iconKey: null means "use the default/neutral icon" - this is the
 * library's own real, documented reset mechanism (setAppIcon(null) /
 * setAppIcon('DEFAULT') are equivalent). @praneeth26/expo-dynamic-app-identity
 * generates a dedicated MainActivityDEFAULT alias specifically so this
 * always has somewhere valid to reset to - unlike the previous fork we
 * tried, which had no reset-capable component in its generated manifest.
 */

export type IconKey = 'dundee' | 'vryheid' | null;

export const DEFAULT_ICON_KEY: IconKey = null;

export const DEFAULT_RADIUS_KM = 30;

const ICON_KEY_BY_SLUG: Record<string, IconKey> = {
  'wholesalers': null, // TODO: CONFIRM against actual Mongo doc - treated as default/neutral
  'dundee': 'dundee', // confirmed from Mongo document (status: "paused" - see chat notes)
  'vryheid': 'vryheid', // confirmed from Mongo document
};

export function getIconKeyForBranchSlug(slug: string): IconKey {
  return ICON_KEY_BY_SLUG[slug] ?? DEFAULT_ICON_KEY;
}