const { withAndroidManifest } = require('expo/config-plugins');

/**
 * The alarm opens Couchy over the lock screen and wakes the screen, like a phone alarm clock.
 * Those two flags live on the main activity.
 */
module.exports = function withAlarmActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};
