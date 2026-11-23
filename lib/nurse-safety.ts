/**
 * Nurse emergency contacts + SOS: types and PURE helpers (no React Native, no network), so they run under plain Node
 * (`npm run test:nurse-safety`). The server is the authority for every rule; these are friendly pre-checks and display text.
 */
export type Slot = 1 | 2;
export const SLOTS: Slot[] = [1, 2];

export interface ContactOut {
  slot: Slot;
  full_name: string;
  relationship: string;
  country_code: string;
  phone: string; // national digits (the nurse's own data, shown to her)
  phone_masked: string;
}
export interface ContactsPayload {
  contacts: ContactOut[];
  missing_slots: Slot[];
  reminder: boolean;
}
export interface ContactForm {
  full_name: string;
  relationship: string;
  country_code: string;
  phone: string;
}
export type DeliveryStatus = 'blocked' | 'mock_sent' | 'sent' | 'failed' | 'no_contact' | 'pending';
export interface Delivery {
  slot: number | null;
  channel: 'sms' | 'whatsapp' | 'ops_in_app' | string;
  status: DeliveryStatus | string;
}
export interface SosView {
  id: string;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'closed' | string;
  duplicate: boolean;
  created_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  tracking_active: boolean;
  deliveries: Delivery[];
}

export const LOCATION_INTERVAL_MS = 15_000;

// ---- contact form pre-checks (mirror of the server rules; server still decides) ----------------
export function normalizeCountryCode(v: string): string {
  const t = (v || '').trim();
  return t && !t.startsWith('+') && /^\d+$/.test(t) ? `+${t}` : t;
}

export function e164(countryCode: string, phone: string): string | null {
  const cc = normalizeCountryCode(countryCode);
  if (!/^\+[1-9]\d{0,2}$/.test(cc)) return null;
  let d = (phone || '').replace(/[\s\-()]/g, '');
  if (!/^\d+$/.test(d)) return null;
  if (cc === '+91') {
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? cc + d : null;
  }
  d = d.replace(/^0+/, '');
  return d.length >= 6 && d.length <= 14 && cc.length - 1 + d.length <= 15 ? cc + d : null;
}

export type FormErrors = Partial<Record<keyof ContactForm, string>>;

export function validateContactForm(f: ContactForm, otherNumber?: string | null, ownNumber?: string | null): FormErrors {
  const err: FormErrors = {};
  const name = (f.full_name || '').trim().replace(/\s+/g, ' ');
  const rel = (f.relationship || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100 || /[<>\x00-\x1f]/.test(name)) err.full_name = 'Enter the full name (2–100 characters).';
  if (rel.length < 2 || rel.length > 50 || /[<>\x00-\x1f]/.test(rel)) err.relationship = 'Enter the relationship, e.g. Mother.';
  if (!/^\+?[1-9]\d{0,2}$/.test((f.country_code || '').trim())) err.country_code = 'Enter a country code such as +91.';
  const num = e164(f.country_code, f.phone);
  if (!num) err.phone = normalizeCountryCode(f.country_code) === '+91' ? 'Enter a valid 10-digit Indian mobile number.' : 'Enter a valid mobile number.';
  else if (otherNumber && num === otherNumber) err.phone = 'The two contacts must have different numbers.';
  else if (ownNumber && num === ownNumber) err.phone = 'This is your own number. Enter someone else.';
  return err;
}

export const hasErrors = (e: FormErrors): boolean => Object.keys(e).length > 0;

export function emptyForm(): ContactForm {
  return { full_name: '', relationship: '', country_code: '+91', phone: '' };
}
export function formFromContact(c: ContactOut | undefined): ContactForm {
  return c ? { full_name: c.full_name, relationship: c.relationship, country_code: c.country_code, phone: c.phone } : emptyForm();
}

/** A reminder is shown until BOTH slots are saved. It never blocks anything. */
export function reminderText(missing: number[] | null | undefined): string | null {
  const m = missing ?? [];
  if (m.length === 0) return null;
  if (m.length === 2) return 'Add 2 emergency contacts so we can alert them if you press SOS.';
  return 'Add your second emergency contact.';
}

/** Server error body -> one readable line. Never echoes a number. */
export function serverMessage(e: any, fallback = 'Could not save. Please try again.'): string {
  const d = e?.response?.data?.detail ?? e?.detail ?? e?.data?.detail;
  if (d && typeof d === 'object' && typeof d.message === 'string') return d.message;
  if (typeof d === 'string') return d;
  return fallback;
}

// ---- SOS display ----------------------------------------------------------------------------
export type SosPhase = 'none' | 'active' | 'acknowledged' | 'resolved';
export function sosPhase(s: SosView | null | undefined): SosPhase {
  if (!s) return 'none';
  if (s.status === 'resolved' || s.status === 'closed') return 'resolved';
  if (s.status === 'acknowledged' || s.status === 'investigating') return 'acknowledged';
  return 'active';
}
export function sosHeadline(s: SosView | null | undefined): string {
  switch (sosPhase(s)) {
    case 'active': return 'SOS is active. NurseConnect Operations has been alerted.';
    case 'acknowledged': return 'SOS acknowledged. Operations is responding.';
    case 'resolved': return 'SOS resolved. Location sharing has stopped.';
    default: return '';
  }
}
/** "I pressed this by mistake" is offered only until Operations has seen the SOS (server enforces the same rule). */
export function canCancel(s: SosView | null | undefined): boolean {
  return !!s && s.status === 'open';
}
export function cancelMessage(e: any): string {
  if (e?.response?.status === 409) return serverMessage(e, 'Operations has already seen this SOS. Please speak to them.');
  return serverMessage(e, 'Could not cancel. If you are safe, tell Operations by phone.');
}
export function shouldShareLocation(s: SosView | null | undefined): boolean {
  return !!s && s.tracking_active === true && (sosPhase(s) === 'active' || sosPhase(s) === 'acknowledged');
}

export function deliveryLabel(status: string): string {
  switch (status) {
    case 'sent': return 'Sent';
    case 'mock_sent': return 'Test mode (not sent)';
    case 'blocked': return 'Not sent (messaging not approved yet)';
    case 'failed': return 'Failed';
    case 'pending': return 'Sending…';
    case 'no_contact': return 'No contact saved';
    default: return status;
  }
}
const CH: Record<string, string> = { sms: 'SMS', whatsapp: 'WhatsApp' };
export interface DeliveryLine { key: string; text: string }
/** One line per (contact, channel). The operations alert is shown separately. */
export function deliveryLines(ds: Delivery[] | null | undefined): DeliveryLine[] {
  return (ds ?? [])
    .filter((d) => d.slot != null && (d.channel === 'sms' || d.channel === 'whatsapp'))
    .map((d) => ({ key: `${d.slot}-${d.channel}`, text: `Contact ${d.slot} · ${CH[d.channel]}: ${deliveryLabel(d.status)}` }));
}
export function opsAlerted(ds: Delivery[] | null | undefined): boolean {
  return (ds ?? []).some((d) => d.channel === 'ops_in_app' && d.status === 'sent');
}
