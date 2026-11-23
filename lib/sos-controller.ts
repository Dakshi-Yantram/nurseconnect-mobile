/**
 * The SOS press flow with every side effect injected, so each branch is testable without a phone:
 * confirm -> location permission -> GPS (optional) -> send. A missing permission or GPS NEVER blocks the SOS.
 */
import type { SosView } from './nurse-safety';

export interface SosDeps {
  confirm: () => Promise<boolean>;
  requestLocationPermission: () => Promise<'granted' | 'denied'>;
  getPosition: () => Promise<{ latitude: number; longitude: number; accuracy_metres?: number } | null>;
  send: (p: { latitude?: number; longitude?: number; accuracy_metres?: number; booking_id?: string }) => Promise<SosView>;
}
export type SosOutcome =
  | { kind: 'cancelled' }
  | { kind: 'sent'; sos: SosView; location: 'shared' | 'permission_denied' | 'gps_unavailable'; duplicate: boolean }
  | { kind: 'network_error'; message: string }
  | { kind: 'error'; message: string };

export async function runSos(deps: SosDeps, bookingId?: string): Promise<SosOutcome> {
  if (!(await deps.confirm())) return { kind: 'cancelled' };
  let location: 'shared' | 'permission_denied' | 'gps_unavailable' = 'shared';
  let pos: Awaited<ReturnType<SosDeps['getPosition']>> = null;
  try {
    if ((await deps.requestLocationPermission()) !== 'granted') location = 'permission_denied';
    else {
      pos = await deps.getPosition().catch(() => null);
      if (!pos) location = 'gps_unavailable';
    }
  } catch {
    location = 'gps_unavailable';
  }
  try {
    const sos = await deps.send({ ...(pos ?? {}), ...(bookingId ? { booking_id: bookingId } : {}) });
    return { kind: 'sent', sos, location, duplicate: !!sos.duplicate };
  } catch (e: any) {
    const noResponse = !e?.response && (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error' || e?.isNetworkError === true || e?.name === 'TypeError');
    if (noResponse) return { kind: 'network_error', message: 'No connection. Your SOS was not sent. Call 108 now.' };
    const d = e?.response?.data?.detail;
    return { kind: 'error', message: (typeof d === 'string' ? d : d?.message) || 'SOS could not be sent. Call 108 now and try again.' };
  }
}
