import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store';
import { saveDraft } from '../../lib/booking-draft';

/**
 * "Book Now". Saves the visitor's choices first, then:
 *  - signed-in customer  -> straight into the existing booking flow;
 *  - signed-in other role -> explain (only customers place bookings);
 *  - signed-out           -> existing login / register / OTP screen, flagged so
 *                            the app returns to booking afterwards.
 * Authentication is checked from the real session (`user`), never from `role`,
 * because role-select sets `role` before anyone has signed in.
 */
export function useStartBooking() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const role = useStore((s) => s.role);
  const bootstrapping = useStore((s) => s.authBootstrapping);
  const setRole = useStore((s) => s.setRole);

  return useCallback(
    async (packageId: string) => {
      if (bootstrapping) return; // session restore still running - avoid a false "logged out"
      if (user) {
        if (role !== 'family') {
          Alert.alert(
            'Customer account needed',
            'Bookings are made from a customer account. Sign out and sign in as a customer to book.',
          );
          return;
        }
        await saveDraft({ packageId, resume: false });
        router.push({ pathname: '/booking', params: { packageId } });
        return;
      }
      await saveDraft({ packageId, resume: true });
      setRole('family');
      router.push({ pathname: '/login', params: { role: 'family', reason: 'book' } });
    },
    [bootstrapping, user, role, router, setRole],
  );
}
