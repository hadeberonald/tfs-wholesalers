import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Bump the version suffix if you ever need to force something for
// everyone again - otherwise leave it alone.
const ONBOARDING_FLAG_KEY = 'tfs_onboarding_icon_detection_complete_v1';

/**
 * DEPRECATED SOURCE OF ICON SWITCHING: this hook used to do its own
 * location fetch + branch resolution + switchAppIcon() call. That is now
 * ENTIRELY handled by app/index.tsx's resolveBranch()/applyBranch(),
 * which runs on the same screen this hook is called from.
 *
 * Having both run was the actual crash cause: two independent calls to
 * the native icon-switching API firing concurrently on first launch,
 * racing against the Android process kill/relaunch that a real icon
 * change triggers. Do NOT re-add location/branch/icon logic here -
 * index.tsx is the single source of truth per its own comments ("This is
 * the ONLY way a branch gets selected").
 *
 * All this does now is write the completion flag, kept around only in
 * case anything else still reads ONBOARDING_FLAG_KEY. Safe to delete
 * entirely (and remove its call from index.tsx) once you've confirmed
 * nothing depends on that key.
 */
export function useOnboardingIconDetection() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    AsyncStorage.setItem(ONBOARDING_FLAG_KEY, 'true').catch((err) => {
      console.error('[ONBOARDING ICON] Failed to persist flag:', err);
    });
  }, []);
}