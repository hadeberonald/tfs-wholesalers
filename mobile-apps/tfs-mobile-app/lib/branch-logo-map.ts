import type { ImageSourcePropType } from 'react-native';

/**
 * In-app header/splash logo per branch. This is separate from
 * branch-icon-map.ts, which only controls the OS home-screen icon —
 * this controls what renders INSIDE the app itself (Header, the initial
 * "locating your branch" screen, etc).
 *
 * React Native requires require() paths to be static string literals, so
 * this is a lookup map rather than a dynamic path build — same convention
 * as ICON_KEY_BY_SLUG in branch-icon-map.ts.
 *
 * Any slug not listed here (including the neutral/default branch) falls
 * back to the original default logo.
 *
 * NOTE: add the actual image files at the paths below before building —
 * this file only wires up the lookup, it doesn't create the assets.
 */
const LOGO_BY_SLUG: Record<string, ImageSourcePropType> = {
  dundee: require('@/assets/logos/tfs-dundee-logo.png'),
  vryheid: require('@/assets/logos/tfs-vryheid-logo.png'),
  ladysmith: require('@/assets/logos/tfs-ladysmith-logo.png'),
};

const DEFAULT_LOGO: ImageSourcePropType = require('@/assets/logo.png');

export function getLogoForBranchSlug(slug?: string | null): ImageSourcePropType {
  if (!slug) return DEFAULT_LOGO;
  return LOGO_BY_SLUG[slug] ?? DEFAULT_LOGO;
}