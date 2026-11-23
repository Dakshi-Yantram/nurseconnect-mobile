/**
 * Dynamic Expo config.
 *
 * This is a .js config rather than app.json because two of the plugins are
 * credential-dependent and *throw at prebuild time* when their files are
 * absent:
 *
 *   - @react-native-firebase/app requires google-services.json (Android) and
 *     GoogleService-Info.plist (iOS). Its plugin raises
 *     "Path to GoogleService-Info.plist is not defined" and the build dies.
 *
 * Rather than forcing every developer to hold a full set of production
 * credentials just to compile, the Firebase plugin is added only when the
 * files are actually on disk. Drop them in and Android call ringing lights up
 * on the next build with no config edit.
 *
 * CallKeep and the PushKit plugin need no credentials and are always applied,
 * so CallKit/ConnectionService and the `voip` background mode are present in
 * every build.
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = 'in.co.nurseconnect.partner';
const EAS_PROJECT_ID = 'da0cbe47-ab8e-43f9-966f-d4b83bb90e3b';

const GOOGLE_SERVICES_ANDROID = './google-services.json';
const GOOGLE_SERVICES_IOS = './GoogleService-Info.plist';

const exists = (p) => fs.existsSync(path.resolve(__dirname, p));

// A credential file can sit next to this config (as before) OR be supplied as an
// EAS "file" environment variable (GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST),
// which EAS materialises on the build machine and exposes as a path.
const resolveCredential = (localPath, envVar) => {
  const fromEnv = process.env[envVar];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return exists(localPath) ? localPath : null;
};

const androidServicesFile = resolveCredential(GOOGLE_SERVICES_ANDROID, 'GOOGLE_SERVICES_JSON');
const iosServicesFile = resolveCredential(GOOGLE_SERVICES_IOS, 'GOOGLE_SERVICES_PLIST');

// Firebase needs BOTH files: its plugin configures each platform and throws on
// whichever is missing, so a half-configured project must not enable it.
const firebaseReady = Boolean(androidServicesFile && iosServicesFile);

if (!firebaseReady) {
  // @react-native-firebase is linked into the iOS binary whether or not it is
  // configured, and an unconfigured Firebase on iOS can abort at launch. So an
  // iOS cloud build without the plist is refused here instead of shipping a
  // build that may crash on start-up.
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && !iosServicesFile) {
    throw new Error(
      '[app.config] iOS build needs GoogleService-Info.plist (Firebase console -> ' +
      'Project settings -> your iOS app, bundle id ' + BUNDLE_ID + '). Put it in the ' +
      'project root, or set an EAS file variable named GOOGLE_SERVICES_PLIST.',
    );
  }
  console.warn(
    '[app.config] Firebase credentials not found - call ringing via FCM will be ' +
    'disabled in this build. Add google-services.json and GoogleService-Info.plist ' +
    'to the project root (or EAS file vars GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST).',
  );
}

module.exports = () => ({
  expo: {
    name: 'NurseConnect',
    slug: 'frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'nurseconnect',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    ios: {
      // iPhone-only: the UI is portrait-only phone layouts. Apple rejects iPad
      // builds that are not fully multitasking-ready, and would also require iPad
      // screenshots. The app still installs on iPad in compatibility mode.
      supportsTablet: false,
      bundleIdentifier: BUNDLE_ID,
      ...(firebaseReady ? { googleServicesFile: iosServicesFile } : {}),
      infoPlist: {
        NSMicrophoneUsageDescription:
          'NurseConnect uses your microphone for voice calls between families and their care professional.',
        NSLocationWhenInUseUsageDescription:
          'NurseConnect uses your location to match you with nearby care and to confirm visit check-in.',
        NSPhotoLibraryUsageDescription:
          'NurseConnect needs photo access so you can upload verification documents and clinical photos.',
        NSCameraUsageDescription:
          'NurseConnect uses the camera to capture clinical documentation during a visit, and - if you choose to turn it on - for video during in-app calls.',
        // `voip` is what makes iOS issue a PushKit token at all; `audio` keeps
        // a call alive when the screen locks.
        UIBackgroundModes: ['voip', 'audio', 'remote-notification'],
        // The app only uses standard HTTPS/TLS, which is exempt. Declaring it
        // here stops App Store Connect asking the export-compliance question on
        // every TestFlight/App Store upload.
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: {
        // APS_ENVIRONMENT is set to "production" by the production profile in
        // eas.json (TestFlight / App Store). Keep APNS_USE_SANDBOX on the backend
        // in step: sandbox for Xcode/dev-signed builds, production for TestFlight
        // and the App Store - a token minted for one is rejected by the other.
        'aps-environment': process.env.APS_ENVIRONMENT === 'production' ? 'production' : 'development',
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      edgeToEdgeEnabled: true,
      package: BUNDLE_ID,
      versionCode: 55,
      // Patient-related app data must not be copied into device/cloud backups.
      allowBackup: false,
      ...(firebaseReady ? { googleServicesFile: androidServicesFile } : {}),
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
        'android.permission.WAKE_LOCK',
        // Clinical photo capture/upload (Assessment/Visit Details screen),
        // and - since this same permission gates it - the optional video
        // toggle on in-app calls (see lib/call-manager.ts toggleVideo()).
        // Without CAMERA declared here, requestCameraPermissionsAsync()
        // resolves granted=false unconditionally and the camera can never
        // open, even if the user taps "Allow" - the OS never shows a
        // prompt because the app never declared the permission.
        'android.permission.CAMERA',
      ],
      // Google Play rejected USE_FULL_SCREEN_INTENT (version code 18).
      // Removed from `permissions` above and blocked here so no library or
      // prebuild can re-add it. The legacy storage permissions are obsolete
      // on current Android versions. Re-introduce full-screen intent later
      // only together with the Play Console full-screen intent declaration.
      blockedPermissions: [
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        // Google Play policy: use the system photo picker instead of broad
        // photo/video access. expo-image-picker's launchImageLibraryAsync uses
        // the system picker and needs no storage/media permission.
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
      ],
    },

    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-image.png',
          imageWidth: 240,
          resizeMode: 'contain',
          backgroundColor: '#FFFFFF',
        },
      ],
      'expo-font',
      [
        'expo-image-picker',
        {
          photosPermission:
            'NurseConnect needs photo library access so you can attach clinical photos during a visit.',
          cameraPermission:
            'NurseConnect uses the camera to capture clinical documentation during a visit, and - if you choose to turn it on - for video during in-app calls.',
        },
      ],
      // Only when credentials are present - see the note at the top.
      ...(firebaseReady ? ['@react-native-firebase/app'] : []),
      // CallKit (iOS) + ConnectionService (Android). No credentials needed.
      '@config-plugins/react-native-callkeep',
      // iOS PushKit wiring - see plugins/withVoipPush.js.
      './plugins/withVoipPush',
      // Android: portrait + telephony are optional hardware (Play availability) - see plugins/withOptionalHardware.js.
      './plugins/withOptionalHardware',
      [
        'expo-build-properties',
        {
          // react-native-firebase requires static frameworks on iOS.
          ios: { useFrameworks: 'static' },
          // CallKeep's ConnectionService needs API 24+.
          android: { minSdkVersion: 24 },
        },
      ],
    ],

    experiments: { typedRoutes: true },
    owner: 'dakshi123',

    // ---- EAS Update (OTA) ----
    // Bare workflow: runtimeVersion must be a plain string (no policy).
    // Keep it equal to EXPO_RUNTIME_VERSION in android/app/src/main/AndroidManifest.xml.
    // Change both whenever native code changes; OTA updates only reach builds
    // with the same runtimeVersion.
    runtimeVersion: '1.0.0',
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    },

    extra: {
      router: {},
      eas: { projectId: EAS_PROJECT_ID },
      firebaseConfigured: firebaseReady,
    },
  },
});
