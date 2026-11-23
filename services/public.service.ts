/**
 * Client for the PUBLIC (no-login) catalogue API: GET /api/public/*.
 *
 * Every call passes `skipAuth`, so no Authorization header is attached and a
 * stale/expired token can never trigger the refresh-and-logout path while a
 * visitor is merely browsing. The backend exposes only allow-listed catalogue
 * fields here; booking, payment and patient data stay behind authentication.
 */
import { api } from '../lib/api';
import { brandPackageName } from '../lib/package-name';

const brandPub = (p: PublicPackage): PublicPackage => ({ ...p, name: brandPackageName(p.name) });

export interface PublicService {
  id: string;
  service_code: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  base_price: number | string;
  max_price: number | string | null;
  requires_prescription: boolean;
  insurance_covered: boolean;
  icon: string | null;
}

export interface PublicPackage {
  id: string;
  package_code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  whats_included: string[] | null;
  service_details_text: string | null;
  important_information: string | null;
  target_condition: string | null;
  visit_frequency: string | null;
  visits_per_cycle: number | null;
  cycle_duration_days: number | null;
  shift_hours: number | null;
  package_price: number | string | null;
  per_visit_price: number | string | null;
  subsidy_eligible: boolean;
  insurance_covered: boolean;
  insurance_exclusions: string[] | null;
  requires_prescription: boolean;
  material_included: boolean;
  available_cities: string[] | null;
  provider_types: string[] | null;
  primary_service_id: string | null;
  services: { id: string; name: string }[];
  included_scope: string | null;
  scope_boundary: string | null;
  /** Structured patient copy; present only for packages that have it. */
  patient_details?: PackagePatientDetails | null;
}

export interface PackagePatientDetails {
  whats_included?: string[];
  whats_not_included?: string[];
  what_to_have_ready?: string;
  medical_follow_up?: string;
  visit_duration_and_extension?: {
    summary: string;
    price_inr: number;
    minutes: number;
    rules: string[];
  };
}

export interface Serviceability {
  city: string;
  package_id: string | null;
  serviceable: boolean;
  reason: string;
  message: string;
}

export interface PublicSlot {
  value: string; // "HH:MM" 24h
  label: string;
  surcharge: number;
  is_off_hours: boolean;
  available: boolean;
  reason: string | null;
}

export interface PublicSlots {
  date: string;
  min_lead_minutes: number;
  surcharge_inr: number;
  standard_hours?: string;
  slots: PublicSlot[];
}

const opt = { skipAuth: true } as const;
const clean = (p: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => !!v));

export interface BookingOptions {
  prescription_demo: { enabled: boolean; fee_inr: number; demo: boolean };
}

export interface EnquiryInput {
  name: string;
  phone: string;
  topic: string;
  message: string;
}

export const publicService = {
  sendEnquiry: (e: EnquiryInput) => api.post<{ ok: boolean }>('/public/enquiries', { ...e, website: '' }, opt),
  bookingOptions: () => api.get<BookingOptions>('/public/booking-options', opt),
  services: (category?: string) =>
    api.get<PublicService[]>('/public/services', { ...opt, params: clean({ category }) }),
  service: (id: string) =>
    api.get<PublicService>(`/public/services/${encodeURIComponent(id)}`, opt),
  packages: (city?: string) =>
    api.get<PublicPackage[]>('/public/care-packages', { ...opt, params: clean({ city }) }).then((l) => l.map(brandPub)),
  package: (id: string) =>
    api.get<PublicPackage>(`/public/care-packages/${encodeURIComponent(id)}`, opt).then(brandPub),
  cities: () => api.get<{ cities: string[] }>('/public/cities', opt),
  serviceability: (city: string, packageId?: string, pincode?: string) =>
    api.get<Serviceability>('/public/serviceability', {
      ...opt,
      params: clean({ city, package_id: packageId, pincode }),
    }),
  slots: (date: string) => api.get<PublicSlots>('/public/slots', { ...opt, params: { date } }),
};

// ------------------------------------------------------------- formatting
export const toNum = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** What the customer pays for a package (falls back to per-visit price). */
export function packagePrice(
  p: Pick<PublicPackage, 'package_price' | 'per_visit_price'>,
): number | null {
  return toNum(p.package_price) ?? toNum(p.per_visit_price);
}

export function packageDuration(p: PublicPackage): string | null {
  const parts: string[] = [];
  if (p.shift_hours) parts.push(`${p.shift_hours}-hour shift`);
  if (p.visits_per_cycle) parts.push(`${p.visits_per_cycle} visit${p.visits_per_cycle === 1 ? '' : 's'}`);
  if (p.cycle_duration_days) parts.push(`${p.cycle_duration_days} day${p.cycle_duration_days === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : null;
}

export function serviceDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

const CATEGORY_LABEL: Record<string, string> = {
  micro_visit: 'Home visits',
  shift: 'Nursing shifts',
  live_in: 'Live-in care',
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, ' ');
