import { api } from '../lib/api';
import type { BackendBooking } from './mappers';

export interface AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface BookingCreatePayload {
  patient_id: string;
  service_id?: string;
  package_id?: string;
  booking_type?: 'one_time' | 'recurring' | 'shift' | 'package';
  scheduled_date: string; // YYYY-MM-DD
  scheduled_start_time: string; // HH:MM:SS
  is_urgent?: boolean;
  /**
   * Reference a saved address (preferred — its stored coordinates are what the
   * dispatch radius is measured from) OR pass an inline snapshot with coords.
   */
  address_id?: string;
  address?: AddressSnapshot;
  latitude?: number;
  longitude?: number;
  special_instructions?: string;
  preferred_worker_id?: string;
  /** TEMPORARY / DEMO prescription option; recorded only, never priced client-side. */
  prescription_option?: 'yes' | 'no';
}

/** One start time from GET /bookings/slots — the backend is the single source of truth
 *  for availability (2-hour notice rule) and the off-hours surcharge. */
export interface ApiSlot {
  value: string; // "HH:MM" (IST)
  label: string; // "07:00 PM"
  surcharge: number; // INR added to the total (0 inside regular hours)
  is_off_hours: boolean;
  available: boolean;
  reason?: string | null;
}

export interface SlotsResponse {
  date: string;
  min_lead_minutes: number;
  surcharge_inr: number;
  standard_hours: string; // e.g. "9:00 AM – 6:30 PM"
  slots: ApiSlot[];
}

export type EscalationLevel = 'watch' | 'inform_family' | 'contact_doctor' | 'emergency';

export interface BookingEscalatePayload {
  level: EscalationLevel;
  trigger_type?: string; // 'manual' | 'vital_threshold' | 'symptom' | ...
  notes: string;
  trigger_details?: Record<string, any>;
}

export interface BookingHistoryEvent {
  id: string;
  action: string;
  actor_type: string;
  changes: Record<string, any> | null;
  created_at: string;
}

export const bookingsService = {
  slots: (date: string) => api.get<SlotsResponse>('/bookings/slots', { params: { date } }),
  create: (payload: BookingCreatePayload) => api.post<BackendBooking>('/bookings/', payload),
  listConsumer: (status?: string) =>
    api.get<BackendBooking[]>('/bookings/consumer', status ? { params: { status } } : undefined),
  listWorker: (status?: string) =>
    api.get<BackendBooking[]>('/bookings/worker', status ? { params: { status } } : undefined),
  /** Open bookings this worker is currently eligible to claim. */
  newRequests: () => api.get<BackendBooking[]>('/bookings/worker/new-requests'),
  get: (id: string) => api.get<BackendBooking>(`/bookings/${id}`),
  history: (id: string) => api.get<BookingHistoryEvent[]>(`/bookings/${id}/history`),
  accept: (id: string) => api.post<BackendBooking>(`/bookings/${id}/accept`),
  /**
   * Cancel. Refused with `CANCELLATION_WINDOW_CLOSED` inside 6 hours of the
   * scheduled start. When a nurse cancels outside that window the booking is
   * NOT terminated — it returns to `rematch_pending` and is re-offered to
   * other qualified nurses.
   */
  cancel: (id: string, reason: string) =>
    api.post<BackendBooking>(`/bookings/${id}/cancel`, { reason }),
  /**
   * Marks the nurse en route to the patient's address. Gated server-side on
   * a passing, declaration-confirmed Nurse Safety Check for this booking
   * (see NurseSafetyCheckModal) — expect a 403 with code
   * SAFETY_CHECK_REQUIRED / SAFETY_CHECK_WARNING / SAFETY_CHECK_FAILED if
   * that gate hasn't been cleared yet.
   */
  markEnRoute: (id: string) => api.post<BackendBooking>(`/bookings/${id}/en-route`),
  /** Nurse withdraws from an assigned/en-route visit; server finds a replacement. Idempotent. */
  cannotAttend: (id: string, reason: string, note?: string) =>
    api.post<{ status: string }>(`/bookings/${id}/cannot-attend`, { reason, note }),
  escalate: (id: string, payload: BookingEscalatePayload) =>
    api.post<{ id: string; level: string; status: string; sla_breach_at: string | null }>(
      `/bookings/${id}/escalate`,
      payload,
    ),
};
