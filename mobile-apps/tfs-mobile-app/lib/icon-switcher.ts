import Constants from 'expo-constants';
import { setAppIcon as _setAppIcon, getAppIcon as _getAppIcon } from '@howincodes/expo-dynamic-app-icon';
import type { IconKey } from './branch-icon-map';

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Switches the home-screen icon.
 *
 * iconKey: 'dundee' | 'vryheid' | 'ladysmith' | null (null = reset to
 * default).
 *
 * SWITCHED FROM @praneeth26/expo-dynamic-app-identity — that plugin's own
 * build logs claimed success ("Icon 'AppIcon-dundee' ready") while never
 * actually registering the generated icon files with Xcode's Copy Bundle
 * Resources build phase, so the files never made it into the shipped
 * .ipa (confirmed via App Store Connect's ITMS-90032 "Invalid Image
 * Path" errors, which persisted across two rounds of otherwise-correct
 * fixes). @howincodes/expo-dynamic-app-icon is actively maintained and
 * uses a compatible per-branch config shape, so app.json's plugin config
 * only needed the plugin name swapped.
 *
 * This is intentionally the ONLY place in the app that touches the
 * native icon API, so every call site goes through the same guard rails:
 *  - no-ops safely inside Expo Go (native module isn't available there)
 *  - skips the native call entirely if the icon is already correct, so we
 *    never trigger a redundant iOS alert / Android process relaunch
 *  - NEVER throws — an icon mismatch is cosmetic, never a reason to take
 *    down the app.
 *
 * IMPORTANT: on Android, actually changing the icon (i.e. when this does
 * NOT hit the "already correct" skip) still kills and restarts the app
 * process — that's OS behavior for activity-alias based icon switching,
 * unrelated to which plugin generates the icons. Callers should treat
 * any code after `await switchAppIcon(...)` as "might never run on this
 * process instance."
 */
export async function switchAppIcon(iconKey: IconKey): Promise<boolean> {
  if (isExpoGo) {
    console.log(
      '[ICON] Running in Expo Go - skipping native icon switch. Would set:',
      iconKey ?? 'default'
    );
    return false;
  }

  try {
    const current = await getCurrentAppIcon();

    if (current === iconKey) {
      console.log('[ICON] Already set to', iconKey ?? 'default', '- skipping');
      return true;
    }

    console.log('[ICON] Switching icon to', iconKey ?? 'default');
    // This package returns false on a genuine failure (rather than the
    // old plugin's silent "always looks fine") - surface that instead of
    // assuming success.
    const result = await _setAppIcon(iconKey);
    if (result === false) {
      console.error('[ICON] setAppIcon reported failure for', iconKey ?? 'default');
      return false;
    }
    return true;
  } catch (err) {
    // Deliberately swallowed. A failed/rejected icon switch (e.g. user
    // dismissed the iOS "change icon?" system alert, or a transient
    // native module hiccup) must never surface as an unhandled rejection
    // that could crash the app or block navigation.
    console.error('[ICON] Failed to switch icon:', err);
    return false;
  }
}

/**
 * Reads the currently-active icon, normalized to the same IconKey shape
 * used everywhere else (null = default). Never throws — returns null on
 * any failure so callers can treat "unknown" the same as "default" rather
 * than crashing on a native module error.
 */
export async function getCurrentAppIcon(): Promise<IconKey> {
  if (isExpoGo) return null;
  try {
    const current = await _getAppIcon();
    return current === 'DEFAULT' || !current ? null : (current as IconKey);
  } catch (err) {
    console.error('[ICON] Failed to read current icon:', err);
    return null;
  }
}