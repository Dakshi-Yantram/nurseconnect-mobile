/**
 * Where to go after a successful sign-in / registration / OTP.
 *
 * A visitor who tapped "Book Now" while logged out has a saved draft with
 * `resume: true`: send them back into the booking flow (package, date and time
 * preserved) instead of the dashboard. Only customers (family role) can book,
 * so every other role keeps its normal portal home.
 */
import { portalHome, type AppRole } from './roles';
import { loadDraft } from './booking-draft';

export async function postAuthRoute(
  role: AppRole | null,
): Promise<{ pathname: string; params?: Record<string, string> } | string> {
  if (role === 'family') {
    try {
      const d = await loadDraft();
      if (d.resume && d.packageId) {
        return { pathname: '/booking', params: { packageId: d.packageId } };
      }
    } catch {
      /* fall through to the dashboard */
    }
  }
  return portalHome(role);
}
