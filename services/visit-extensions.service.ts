import { api } from '../lib/api';
import type { BackendPaymentOrder } from './payments.service';

/**
 * Paid visit extension, extension/end OTPs, payment-gated report and booking
 * preferences. Every endpoint 404s while the backend flag
 * FEATURE_VISIT_EXTENSIONS is off, so callers treat a 404 as "feature off".
 */
export interface ExtensionOut {
  id: string;
  minutes: number;
  amount: number;
  status: 'pending_payment' | 'paid' | 'otp_verified' | 'cancelled';
  paid_at: string | null;
  otp_verified_at: string | null;
}

export interface ExtensionConfig {
  enabled: boolean;
  extension_minutes: number;
  extension_price_inr: number;
  prompt_minutes: number;
  follow_up_window_days: number;
}

export interface ExtensionState {
  booking_id: string;
  visit_in_progress: boolean;
  scheduled_minutes: number;
  extended_minutes: number;
  total_minutes: number;
  end_time: string | null;
  remaining_seconds: number | null;
  prompt_extension: boolean;
  offer: { minutes: number; amount: number };
  pending_extension: ExtensionOut | null;
  extension_otp: string | null;
  extension_otp_for: ExtensionOut | null;
}

export interface CompletionState {
  booking_id: string;
  service_name: string | null;
  completed: boolean;
  scheduled_minutes: number;
  extended_minutes: number;
  actual_minutes: number;
  summary_ready: boolean;
  report_unlocked: boolean;
  due_amount: number;
  extension_payment_due: boolean;
  visit_payment_due: boolean;
  end_otp: string | null;
  end_otp_used: boolean;
  follow_up: {
    available: boolean;
    window_days: number;
    package_id: string | null;
    patient_id: string;
    follow_up_of_booking_id: string;
  };
}

export interface BookingPreferences {
  plan_type: 'single' | 'two_visit';
  same_nurse_preference: boolean;
  ask_before_sharing: boolean;
  trusted_contact_name: string | null;
  trusted_contact_relation: string | null;
  trusted_contact_phone: string | null;
  follow_up_of_booking_id: string | null;
}

export interface WorkerExtensionStatus {
  booking_id: string;
  extended_minutes: number;
  total_minutes: number;
  end_time: string | null;
  extension_payment_pending: boolean;
  extension_otp_required: boolean;
  end_otp_verified: boolean;
}

export type ExtensionOrder = BackendPaymentOrder & { extension_id: string; minutes: number };

const base = (id: string) => `/visit-extensions/${id}`;

export const visitExtensionsService = {
  /** Resolves to null when the feature is off (404). */
  config: async (): Promise<ExtensionConfig | null> => {
    try {
      return await api.get<ExtensionConfig>('/visit-extensions/config');
    } catch (e: any) {
      if (e?.status === 404 || e?.response?.status === 404) return null;
      throw e;
    }
  },
  state: (bookingId: string) => api.get<ExtensionState>(base(bookingId)),
  request: (bookingId: string) => api.post<ExtensionOrder>(`${base(bookingId)}/request`),
  verifyPayment: (
    bookingId: string,
    body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) =>
    api.post<{ status: string; extension_otp: string | null }>(
      `${base(bookingId)}/verify-payment`,
      body,
    ),
  cancel: (bookingId: string) => api.post<{ cancelled: boolean }>(`${base(bookingId)}/cancel`),
  completion: (bookingId: string) => api.get<CompletionState>(`${base(bookingId)}/completion`),
  getPreferences: (bookingId: string) => api.get<BookingPreferences>(`${base(bookingId)}/preferences`),
  savePreferences: (bookingId: string, body: Partial<BookingPreferences>) =>
    api.put<BookingPreferences>(`${base(bookingId)}/preferences`, body),

  // Nurse side
  workerStatus: (bookingId: string) =>
    api.get<WorkerExtensionStatus>(`${base(bookingId)}/worker-status`),
  verifyExtensionOtp: (bookingId: string, otp: string) =>
    api.post<{ verified: boolean; added_minutes: number }>(
      `${base(bookingId)}/verify-extension-otp`,
      { otp },
    ),
  verifyEndOtp: (bookingId: string, otp: string) =>
    api.post<{ verified: boolean; message: string }>(`${base(bookingId)}/verify-end-otp`, { otp }),
};

/** Human message from a thrown API error. */
export function extErr(e: any, fallback = 'Please try again.'): string {
  const d = e?.detail?.detail ?? e?.detail;
  return (typeof d === 'string' ? d : d?.message) || e?.message || fallback;
}
