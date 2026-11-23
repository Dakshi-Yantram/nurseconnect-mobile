import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from '../store';
import { registerAuthFailureHandler } from '../lib/api';
import { CallOverlay } from '../components/CallOverlay';
import { registerBackgroundCallHandler } from '../lib/call-push';

// Patient health data is shown across the whole app, so screenshots and screen
// recordings are blocked everywhere (Android FLAG_SECURE; iOS blocks recording
// and blanks the app-switcher preview). Needs a native rebuild after
// `npx expo install expo-screen-capture`. Wrapped so a build that lacks the
// native module (e.g. an old dev client) degrades to "no protection" instead of crashing.
let ScreenCapture: typeof import('expo-screen-capture') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ScreenCapture = require('expo-screen-capture');
} catch {
  ScreenCapture = null;
}

// Registered at module scope, before React mounts. Firebase requires the
// background handler to exist at that point: when a data push cold-starts a
// killed app there is no component tree yet to register it from.
registerBackgroundCallHandler();

export default function RootLayout() {
  const router = useRouter();
  const bootstrapSession = useStore((s) => s.bootstrapSession);

  useEffect(() => {
    // Test/internal builds (BrowserStack, emulators) set this so the remote
    // screen stream isn't blanked by FLAG_SECURE. Never set it on production builds.
    //if (process.env.EXPO_PUBLIC_ALLOW_SCREEN_CAPTURE === 'true') return;
    //ScreenCapture?.preventScreenCaptureAsync('app-global').catch(() => {});
    //return () => {
      //ScreenCapture?.allowScreenCaptureAsync('app-global').catch(() => {});
    //};
  }, []);

  useEffect(() => {
    // Restore the session from secure storage on launch.
    bootstrapSession();
    // When a refresh fails there is no recoverable session left, so send the
    // user back to the entry screen rather than leaving them on a screen that
    // will keep 401-ing.
    registerAuthFailureHandler(() => {
      router.replace('/explore');
    });
  }, [bootstrapSession, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {/* Entry + auth */}
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="about" />
          <Stack.Screen name="contact" />
          <Stack.Screen name="public-package/[id]" />
          <Stack.Screen name="public-service/[id]" />
          <Stack.Screen name="role-select" />
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" />

          {/* Role portals */}
          <Stack.Screen name="(family)" />
          <Stack.Screen name="(nurse)" />
          <Stack.Screen name="(trainer)" />
          <Stack.Screen name="(lead)" />

          {/* Consumer flows */}
          <Stack.Screen name="care-types" />
          <Stack.Screen name="nurses" />
          <Stack.Screen name="nurse/[id]" />
          <Stack.Screen name="booking" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="payment-success" options={{ animation: 'fade' }} />
          <Stack.Screen name="addresses" />
          <Stack.Screen name="patients" />
          <Stack.Screen name="consents" />
          <Stack.Screen name="family-members" />
          <Stack.Screen name="visit/[id]" />
          <Stack.Screen name="visit/rate/[id]" />
          <Stack.Screen name="tracking/[id]" />
          <Stack.Screen name="chat/[bookingId]" />

          {/* Nurse flows */}
          <Stack.Screen name="nurse-visit/[id]" />
          <Stack.Screen name="clinical/[id]" />
          <Stack.Screen name="visit-success/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="escalation/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="availability" />
          <Stack.Screen name="service-preferences" />
          <Stack.Screen name="earnings" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="onboarding-status" />
          <Stack.Screen name="assessments" />
          <Stack.Screen name="assessment/[id]" options={{ gestureEnabled: false }} />

          {/* Shared */}
          <Stack.Screen name="abha" />
          <Stack.Screen name="abha/[id]" />
          <Stack.Screen name="abha/link" />
          <Stack.Screen name="support" />
          <Stack.Screen name="support-chat" />
          <Stack.Screen name="emergency-contacts" />
          <Stack.Screen name="support/raise" />
          <Stack.Screen name="support/ticket/[id]" />
          <Stack.Screen name="training" />
          <Stack.Screen name="training/[id]" />
          <Stack.Screen name="certificates" />
          <Stack.Screen name="certificates/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="privacy" />
        </Stack>
        {/* Sits above every route so a call can arrive on any screen. */}
        <CallOverlay />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}