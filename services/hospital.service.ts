import { api } from '../lib/api';

/** Hospital Visit Companion API (backend staging feature; every call 404s while the flag is off). */
export interface HospitalStatus {
  hospital: string;
  hospital_address: string | null;
  hospital_latitude: number;
  hospital_longitude: number;
  distance_km: string;
  transport_option: 'cab_by_nurseconnect' | 'own_transport';
  advance_inr: string;
  advance_status: 'not_applicable' | 'pending' | 'due' | 'paid';
  visit_started_at: string | null;
  ended_at: string | null;
  overtime_minutes: number;
  your_earning_inr: string | null;
  summary_submitted: boolean;
  receipts: { leg: 'to_hospital' | 'return'; amount: string }[];
  journey: { stage: string; at: string; note: string | null }[];
  terms: { included_minutes: number; base_inr: number; overtime_per_min_inr: number };
}

export type JourneyStage =
  | 'left_patient_home' | 'reached_hospital' | 'at_registration' | 'waiting_consultation'
  | 'consultation_in_progress' | 'tests' | 'collecting_reports' | 'returning_home';

export interface HospitalSummaryInput {
  doctor_name?: string;
  department?: string;
  purpose?: string;
  helped_with: string[];
  experience?: 'smooth' | 'some_waiting' | 'long_waiting';
  notes_for_family?: string;
}

export const hospitalService = {
  /** Resolves null when the booking is not a hospital booking (or the feature is off). */
  status: (bookingId: string) =>
    api.get<HospitalStatus>(`/bookings/${bookingId}/hospital/status`).catch((e: any) => {
      if (e?.status === 404 || e?.status === 409) return null;
      throw e;
    }),
  journey: (bookingId: string, stage: JourneyStage, note?: string) =>
    api.post(`/bookings/${bookingId}/hospital/journey`, { stage, note: note?.trim() || undefined }),
  end: (bookingId: string, otp: string) =>
    api.post<{ ended_at: string; total_minutes: number; overtime_minutes: number; your_earning_inr: string }>(
      `/bookings/${bookingId}/hospital/end`, { otp: otp.trim() }),
  uploadReceipt: (bookingId: string, leg: 'to_hospital' | 'return', amount: string, file: { uri: string; name: string; type: string }) =>
    api.upload<{ ok: boolean; fares_above_advance_inr: string }>(`/bookings/${bookingId}/hospital/receipts`, file, { leg, amount }),
  submitSummary: (bookingId: string, body: HospitalSummaryInput) => api.post(`/bookings/${bookingId}/hospital/summary`, body),

  // customer side
  distanceCheck: (b: { patient_latitude: number; patient_longitude: number; hospital_latitude: number; hospital_longitude: number }) =>
    api.post<{ distance_km: number; max_km: number; within_limit: boolean }>('/hospital-companion/distance-check', b),
  setDetails: (bookingId: string, b: {
    hospital_name: string; hospital_address?: string; hospital_latitude: number; hospital_longitude: number;
    transport_option: 'cab_by_nurseconnect' | 'own_transport';
  }) => api.post(`/bookings/${bookingId}/hospital-details`, b),
  endCode: (bookingId: string) => api.get<{ end_code: string }>(`/bookings/${bookingId}/hospital/end-code`),
  report: (bookingId: string) => api.get<any>(`/bookings/${bookingId}/hospital/report`),
  // extra (overtime) charge: its own Razorpay order, separate from the booking payment
  extraOrder: (bookingId: string) =>
    api.post<{ razorpay_order_id: string; razorpay_key_id: string; amount: number; currency: string; booking_id: string }>(
      `/bookings/${bookingId}/hospital/extra/order`, {}),
  extraVerify: (bookingId: string, r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post<{ status: string }>(`/bookings/${bookingId}/hospital/extra/verify`, r),
};

/** FastAPI nests our {code,message} under detail.detail. */
export function hospitalError(e: any): { code?: string; message: string } {
  const body = e?.detail?.detail ?? e?.detail ?? {};
  return { code: body?.code, message: (typeof body === 'string' ? body : body?.message) || e?.message || 'Something went wrong. Please try again.' };
}

/** A booking for the Hospital Visit Companion package (code from the catalogue, or its name). */
export const isHospitalPackage = (p?: { package_code?: string; name?: string } | null) =>
  !!p && (p.package_code === 'FM-B2-11' || /(hospital|doctor).*(accompan|companion)/i.test(p.name ?? ''));
