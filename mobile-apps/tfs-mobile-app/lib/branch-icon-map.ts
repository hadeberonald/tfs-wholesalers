/**
 * The only thing that still needs to live in app code: which icon each
 * branch maps to. Coordinates and radius no longer need to be duplicated
 * here - they come straight from /api/mobile/branches at detection time
 * (see settings.storeLocation.lat / .lng on the branch object), so this
 * file can't go stale relative to the backend.
 *
 * `iconKey` must match a key registered in the expo-dynamic-app-icon
 * plugin config in app.json. `null` means "use the default app icon"
 * (tfs-main.png) - that branch doesn't need a plugin entry at all.
 */

export type IconKey = 'dundee' | 'vryheid' | null;

export const DEFAULT_RADIUS_KM = 30;

const ICON_KEY_BY_SLUG: Record<string, IconKey> = {
  'wholesalers': null, // TODO: CONFIRM against actual Mongo doc - treated as default/neutral
  'dundee': 'dundee', // confirmed from Mongo document (status: "paused" - see note)
  'vryheid': 'vryheid', // confirmed from Mongo document
};

export function getIconKeyForBranchSlug(slug: string): IconKey {
  return ICON_KEY_BY_SLUG[slug] ?? null;
}