import Constants from 'expo-constants';
import * as DynamicAppIcon from '@praneeth26/expo-dynamic-app-identity';
import type { IconKey } from './branch-icon-map';

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Switches the home-screen icon.
 *
 * iconKey: 'dundee' | 'vryheid' | null (null = reset to the default/main
 * icon, via this library's dedicated MainActivityDEFAULT alias).
 *
 * This is intentionally the ONLY place in the app that touches the native
 * icon API, so every call site (onboarding detection, automatic
 * location-based branch resolution on launch, and the "Refresh My
 * Location" action in the menu) goes through the same guard rails:
 *  - no-ops safely inside Expo Go (native module isn't available there)
 *  - skips the native call entirely if the icon is already correct, so we
 *    never trigger a redundant iOS alert / Android process relaunch
 *  - NEVER throws — an icon mismatch is cosmetic, never a reason to take
 *    down the app. Callers can still inspect the boolean return value if
 *    they care whether it actually happened.
 *
 * IMPORTANT: on Android, actually changing the icon (i.e. when this does
 * NOT hit the "already correct" skip) kills and restarts the app process.
 * That's OS behavior for activity-alias based icon switching, not
 * something this function can prevent. Callers should treat any code
 * after `await switchAppIcon(...)` as "might never run on this process
 * instance" — see app/index.tsx for how navigation is sequenced around
 * this.
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
    await DynamicAppIcon.setAppIcon(iconKey);
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
    const current = await DynamicAppIcon.getAppIcon();
    return current === 'DEFAULT' ? null : (current as IconKey);
  } catch (err) {
    console.error('[ICON] Failed to read current icon:', err);
    return null;
  }
}