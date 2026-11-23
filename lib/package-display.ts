import type { PublicPackage } from '../services/public.service';
import { classifyPackage } from './package-kinds';

/**
 * DISPLAY-ONLY presentation rules (same as the website). Stored names, ids, prices,
 * booking records and availability are never changed; prices always come from the live record.
 */
type Textual = Pick<PublicPackage, 'name' | 'tagline' | 'description' | 'target_condition'>;
type Override = { test: RegExp; name: string; description: string };

const OVERRIDES: Override[] = [
  {
    test: /^companion(ship)? visit\s*[—–-]\s*2\s*hours?/i,
    name: 'Elderly Companionship at Home — 2 Hours',
    description: 'A non-medical visit for conversation, reading, light mobility support and supervision within caregiver scope.',
  },
  {
    test: /^annual health check-?up (coordination|assistance)/i,
    name: 'Annual Health Checkup Assistance',
    description: "We help arrange your annual health checkup, coordinate a doctor's review of the results, and share the reports with your designated family members.",
  },
  {
    test: /^acute illness (home )?consultation/i,
    name: 'Doctor Home Visit — General Physician',
    description: 'Consult an MBBS-qualified doctor at home for fever, infections, sudden illness and other non-emergency health concerns.',
  },
];

function override(p: Pick<PublicPackage, 'name' | 'description' | 'tagline'>): Override | undefined {
  const o = OVERRIDES.find((x) => x.test.test(p.name.trim()));
  if (!o) return undefined;
  // Only a visit whose own text says it happens at home is shown as an in-person home visit.
  if (o.name.startsWith('Doctor Home Visit') && !/\bat home\b|home visit/i.test(`${p.name} ${p.description ?? ''} ${p.tagline ?? ''}`)) return undefined;
  return o;
}

export const displayName = (p: Pick<PublicPackage, 'name' | 'description' | 'tagline'>) => override(p)?.name ?? p.name;
export const displayDescription = (p: Pick<PublicPackage, 'name' | 'description' | 'tagline'>) =>
  override(p)?.description ?? (p.tagline || p.description || '');

/** The professional who delivers the service; null hides the badge (e.g. coordination services with no nurse). */
export function professionBadge(p: Textual): string | null {
  if (/^annual health check-?up/i.test(p.name.trim())) return null;
  const cat = classifyPackage(p);
  if (cat === 'doctor') return 'Qualified Doctors';
  if (cat === 'dental') return 'Qualified Dentists';
  if (cat === 'physio') return 'Qualified Physiotherapists';
  if (cat === 'elder') return /nurs/i.test(p.name) ? 'Trained Nurses' : 'Trained Caregivers';
  if (cat === 'mother') return 'Trained Care Professionals';
  return 'Trained Nurses';
}

/** Only nursing bookings are open: doctor, dental, physio and baby massage/bath show "Enquire now". */
const BABY_CARE = /\b(baby|newborn|infant)\b.*\b(massage|bath)|\b(massage|bath)\b.*\b(baby|newborn|infant)/i;
export const isEnquiryOnly = (p: Textual) => {
  if (BABY_CARE.test(p.name)) return true;
  if (/accompan/i.test(p.name)) return false;
  const c = classifyPackage(p);
  return c === 'doctor' || c === 'dental' || c === 'physio';
};

/** The public API only returns sellable packages today; this lights up if it starts sending an explicit flag. */
export const isComingSoon = (p: PublicPackage & { is_bookable?: boolean; coming_soon?: boolean }) =>
  p.coming_soon === true || p.is_bookable === false;

export const COMING_SOON_MESSAGE = "Oops! This service isn't available at the moment. We'll be offering it soon!";
