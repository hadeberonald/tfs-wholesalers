/**
 * The only thing that still needs to live in app code: which icon each
 * branch maps to. Coordinates and radius come live from
 * /api/mobile/branches/nearest (which now does the distance computation
 * server-side and returns distanceKm / withinRadius), not from here.
 *
 * iconKey: null means "use the default/neutral icon" - this is the
 * library's own real, documented reset mechanism (setAppIcon(null) /
 * setAppIcon('DEFAULT') are equivalent). @praneeth26/expo-dynamic-app-identity
 * generates a dedicated MainActivityDEFAULT alias specifically so this
 * always has somewhere valid to reset to - unlike the previous fork we
 * tried, which had no reset-capable component in its generated manifest.
 */

export type IconKey = 'dundee' | 'vryheid' | 'ladysmith' | null;

export const DEFAULT_ICON_KEY: IconKey = null;

// Widened from 30km -> 45km after reports of users near Vryheid falling
// just outside the old boundary. This value is passed to the server as
// ?radiusKm= and only affects the `withinRadius` flag returned alongside
// the assignment — the server always assigns the nearest branch
// regardless of this value (see route.ts notes). It exists so the UI can
// flag "you're a bit far from your nearest branch" without blocking
// assignment.
export const DEFAULT_RADIUS_KM = 45;

const ICON_KEY_BY_SLUG: Record<string, IconKey> = {
  'wholesalers': null, // TODO: CONFIRM against actual Mongo doc - treated as default/neutral
  'dundee': 'dundee', // confirmed from Mongo document (status: "paused" - see chat notes)
  'vryheid': 'vryheid', // confirmed from Mongo document
  'ladysmith': 'ladysmith', // TODO: CONFIRM this slug matches the Mongo document exactly
};

export function getIconKeyForBranchSlug(slug: string): IconKey {
  return ICON_KEY_BY_SLUG[slug] ?? DEFAULT_ICON_KEY;
}