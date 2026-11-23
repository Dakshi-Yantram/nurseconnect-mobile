/**
 * Marks hardware features as NOT required, so Google Play does not hide the app from devices without them.
 *
 * Play infers two required features from the manifest:
 *   - android.hardware.screen.portrait  (from the portrait-only screenOrientation)
 *   - android.hardware.telephony        (from CALL_PHONE / READ_PHONE_STATE)
 * Declaring them with required="false" keeps the app installable on tablets, desktops, Android XR and
 * Wi-Fi-only devices. The app still works without them: calls go over the internet (and CALL_PHONE only
 * opens the dialer where a phone exists).
 */
const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.telephony'];

const withOptionalHardware = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return c;
  });

module.exports = createRunOncePlugin(withOptionalHardware, 'withOptionalHardware', '1.0.0');
