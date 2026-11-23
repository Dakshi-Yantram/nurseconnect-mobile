/**
 * Foreground journey location sharing for a nurse who is EN ROUTE.
 *
 * - Starts only after the nurse has pressed En Route and (once) been told why
 *   location is needed; stops on arrival / cancel / reassign / app logout.
 * - Foreground only (expo-location watch). Background tracking would need
 *   TaskManager + extra OS permissions and is intentionally NOT implemented.
 * - Server authorises each ping (current assignee + active booking only).
 */
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { trackingService } from '../services/tracking.service';

export type TrackingState = 'idle' | 'active' | 'denied' | 'stale';

let sub: Location.LocationSubscription | null = null;
let activeBooking: string | null = null;
let lastOk = 0;
let state: TrackingState = 'idle';
let staleTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(s: TrackingState) => void>();
const STALE_MS = 90_000;

const set = (s: TrackingState) => { state = s; listeners.forEach((l) => l(s)); };
export const getTrackingState = () => state;
export const onTrackingState = (l: (s: TrackingState) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function explain(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      'Share your location during the trip',
      'NurseConnect shares your live location with the family and our support team only while you are on your way to this visit. Sharing stops when you arrive or the visit is cancelled.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    ),
  );
}

export async function startJourneyTracking(bookingId: string): Promise<void> {
  if (activeBooking === bookingId && sub) return;
  await stopJourneyTracking();
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      if (!(await explain())) { set('denied'); return; }
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (perm.status !== 'granted') { set('denied'); return; }
    activeBooking = bookingId;
    lastOk = Date.now();
    sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 20_000, distanceInterval: 25 },
      async (pos) => {
        if (activeBooking !== bookingId) return;
        try {
          await trackingService.ping({
            booking_id: bookingId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
          });
          lastOk = Date.now();
          if (state !== 'active') set('active');
        } catch (e: any) {
          // 403/409 = no longer the active assignee / journey over -> stop quietly.
          const code = e?.status ?? e?.response?.status;
          if (code === 403 || code === 409) await stopJourneyTracking();
        }
      },
    );
    set('active');
    staleTimer = setInterval(() => { if (state === 'active' && Date.now() - lastOk > STALE_MS) set('stale'); }, 15_000);
  } catch {
    set('denied');
  }
}

export async function stopJourneyTracking(): Promise<void> {
  try { sub?.remove(); } catch { /* ignore */ }
  sub = null;
  activeBooking = null;
  if (staleTimer) { clearInterval(staleTimer); staleTimer = null; }
  set('idle');
}
