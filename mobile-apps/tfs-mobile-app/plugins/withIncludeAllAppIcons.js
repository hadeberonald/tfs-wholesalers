const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Fixes ITMS-90032 ("Invalid Image Path ... 'CFBundleAlternateIcons':
 * 'AppIcon-<slug>'") on App Store submission.
 *
 * @praneeth26/expo-dynamic-app-identity adds AppIcon-dundee, AppIcon-vryheid,
 * and AppIcon-ladysmith icon sets to Images.xcassets and writes matching
 * CFBundleAlternateIcons entries into Info.plist. Because those icons are
 * only ever selected dynamically at runtime (DynamicAppIcon.setAppIcon()),
 * Xcode's asset catalog compiler can't statically detect a reference to
 * them, so by default it strips them out of the compiled Assets.car during
 * optimization. The Info.plist entries are left pointing at asset names
 * that no longer exist in the bundle, which App Store Connect rejects with
 * ITMS-90032.
 *
 * Works fine on the Android .apk and in local/dev iOS builds because
 * neither goes through this optimization step the same way — it only
 * surfaces on the optimized archive built for App Store submission.
 *
 * Setting ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES on every
 * build configuration tells the compiler to keep every icon set regardless
 * of whether it detects a static reference.
 *
 * Must be listed in app.json's "plugins" array AFTER
 * @praneeth26/expo-dynamic-app-identity, so the icon sets already exist in
 * the Xcode project by the time this plugin's mod runs.
 */
module.exports = function withIncludeAllAppIcons(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in configurations) {
      const buildSettings = configurations[key]?.buildSettings;
      // Only real build configuration entries have buildSettings with a
      // PRODUCT_NAME — the section also contains comment/meta entries
      // that must be skipped.
      if (buildSettings && buildSettings.PRODUCT_NAME) {
        buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
      }
    }

    return config;
  });
};