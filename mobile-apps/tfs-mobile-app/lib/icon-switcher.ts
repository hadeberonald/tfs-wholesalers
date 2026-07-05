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
 * icon API, so every call site (onboarding detection, manual branch picker)
 * goes through the same guard rails:
 *  - no-ops safely inside Expo Go (native module isn't available there)
 *  - skips the native call entirely if the icon is already correct, so we
 *    never trigger a redundant iOS alert / Android process relaunch
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
    const current = await DynamicAppIcon.getAppIcon();
    const currentNormalized = current === 'DEFAULT' ? null : current;

    if (currentNormalized === iconKey) {
      console.log('[ICON] Already set to', iconKey ?? 'default', '- skipping');
      return true;
    }

    console.log('[ICON] Switching icon to', iconKey ?? 'default');
    await DynamicAppIcon.setAppIcon(iconKey);
    return true;
  } catch (err) {
    console.error('[ICON] Failed to switch icon:', err);
    return false;
  }
}