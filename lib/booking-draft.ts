/**
 * The visitor's in-progress booking choices: package, locality, preferred
 * date and time. Persisted so they survive the login / registration / OTP step
 * and an app restart, then consumed by the booking screen after sign-in.
 *
 * Deliberately NON-SENSITIVE: only what the visitor typed into the public
 * browsing form (package id, city, pincode, date, time). No tokens, no medical
 * or personal data - those stay in SecureStore / the backend. Expires after
 * 24h. All storage access is wrapped so a storage failure never breaks a screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BookingDraft {
  packageId?: string;
  city?: string;
  pincode?: string;
  /** YYYY-MM-DD (local calendar day) */
  date?: string;
  /** HH:MM, 24h */
  time?: string;
  /** TEMPORARY / DEMO: "Do you need a doctor's prescription?" answer. Same values as the website. */
  prescriptionOption?: 'yes' | 'no';
  /** True once the visitor tapped Book Now while logged out. */
  resume?: boolean;
  savedAt?: number;
}

const KEY = 'nc.bookingDraft.v1';
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: BookingDraft = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function sanitise(d: BookingDraft | null | undefined): BookingDraft {
  if (!d || typeof d !== 'object') return {};
  if (!d.savedAt || Date.now() - d.savedAt > TTL_MS) return {};
  const out = { ...d };
  // A past day can no longer be booked: drop date/time, keep the rest.
  if (out.date && out.date < todayYmd()) {
    delete out.date;
    delete out.time;
  }
  return out;
}

export async function loadDraft(): Promise<BookingDraft> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? sanitise(JSON.parse(raw)) : {};
  } catch {
    cache = {};
  }
  loaded = true;
  emit();
  return cache;
}

export function getDraft(): BookingDraft {
  return cache;
}

async function persist() {
  try {
    const empty = !cache.packageId && !cache.city && !cache.pincode && !cache.date && !cache.time && !cache.prescriptionOption;
    if (empty) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable - the draft just won't survive a restart */
  }
}

export async function saveDraft(patch: Partial<BookingDraft>): Promise<BookingDraft> {
  if (!loaded) await loadDraft();
  cache = { ...cache, ...patch, savedAt: Date.now() };
  emit();
  await persist();
  return cache;
}

export async function clearDraft(): Promise<void> {
  cache = {};
  loaded = true;
  emit();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function subscribeDraft(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
