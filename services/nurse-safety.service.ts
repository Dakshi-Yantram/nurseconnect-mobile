/** Nurse emergency contacts + SOS API. Server routes: /api/workers/me/emergency-contacts and /api/sos */
import { api } from '../lib/api';
import type { ContactForm, ContactsPayload, Slot, SosView } from '../lib/nurse-safety';

export const nurseSafetyService = {
  contacts: () => api.get<ContactsPayload>('/workers/me/emergency-contacts'),
  saveContact: (slot: Slot, f: ContactForm) =>
    api.put<ContactsPayload>(`/workers/me/emergency-contacts/${slot}`, {
      full_name: f.full_name.trim(),
      relationship: f.relationship.trim(),
      country_code: f.country_code.trim(),
      phone: f.phone.trim(),
    }),
  deleteContact: (slot: Slot) => api.delete<ContactsPayload>(`/workers/me/emergency-contacts/${slot}`),

  trigger: (p: { latitude?: number; longitude?: number; accuracy_metres?: number; booking_id?: string }) =>
    api.post<SosView>('/sos', p),
  cancel: (id: string, reason: 'pressed_by_mistake' | 'no_longer_needed') =>
    api.post<SosView>(`/sos/${encodeURIComponent(id)}/cancel`, { reason }),
  active: () => api.get<SosView | null>('/sos/active'),
  postLocation: (id: string, p: { latitude: number; longitude: number; accuracy_metres?: number }) =>
    api.post<{ ok: boolean }>(`/sos/${encodeURIComponent(id)}/location`, p),
};
