/**
 * Forgiving date entry, shared (as an identical copy) by the mobile app
 * (`lib/date-input.ts`) and the website (`src/lib/date-input.ts`).  The backend
 * twin is `app/core/dates.py`; `scripts/date-input.test.mjs` and
 * `tests/test_flexible_dates.py` hold the same cases so all three agree.
 *
 * Accepted: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (1-2 digit month/day), YYYYMMDD,
 * and DD-MM-YYYY / DD/MM/YYYY when the LAST part is a 4-digit year.
 * Always produced: YYYY-MM-DD.
 *
 * Dates are plain calendar days.  Nothing here goes through `new Date("YYYY-MM-DD")`
 * (which is UTC midnight and shifts the day in time zones behind UTC); where a
 * Date object is unavoidable use `ymdToLocalDate`.
 *
 * No imports on purpose: this file is runnable by plain Node for tests.
 */

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

export const INVALID_DATE_MESSAGE = 'Enter a real calendar date, for example 1990-06-14.';

const SEP_CLASS = '[\\s\\-/.]';
const SEP_SPLIT = new RegExp(`${SEP_CLASS}+`);
const HAS_SEP = new RegExp(SEP_CLASS);
const ENDS_WITH_SEP = new RegExp(`${SEP_CLASS}$`);
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIGITS = /^[0-9]+$/;

const pad = (n: number, width: number) => String(n).padStart(width, '0');

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** True only for a real calendar date (leap years included) within MIN_YEAR..MAX_YEAR. */
export function isValidYmdParts(y: number, m: number, d: number): boolean {
  if (![y, m, d].every(Number.isInteger)) return false;
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= daysInMonth(y, m);
}

export function isValidYmd(value: string): boolean {
  if (!STRICT_ISO.test(value)) return false;
  return isValidYmdParts(Number(value.slice(0, 4)), Number(value.slice(5, 7)), Number(value.slice(8, 10)));
}

function build(y: string, m: string, d: string): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  return isValidYmdParts(yy, mm, dd) ? `${pad(yy, 4)}-${pad(mm, 2)}-${pad(dd, 2)}` : null;
}

/**
 * Normalise anything the user typed or pasted to `YYYY-MM-DD`.
 * Returns null when it is not a real calendar date. Empty input returns null too -
 * use {@link parseDateInput} when you need to tell "empty" from "invalid".
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  if (STRICT_ISO.test(s)) return build(s.slice(0, 4), s.slice(5, 7), s.slice(8, 10));

  if (HAS_SEP.test(s)) {
    const parts = s.split(SEP_SPLIT); // runs of separators count as one; edge separators leave '' parts
    if (parts.length !== 3 || !parts.every((p) => DIGITS.test(p))) return null;
    const [a, b, c] = parts;
    if (a.length === 4 && b.length <= 2 && c.length <= 2) return build(a, b, c);
    if (c.length === 4 && a.length <= 2 && b.length <= 2) return build(c, b, a); // DD-MM-YYYY
    return null;
  }

  if (DIGITS.test(s) && s.length === 8) return build(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
  return null;
}

export type DateRule = 'any' | 'notFuture' | 'future';

export interface ParseOptions {
  /** 'notFuture' for dates of birth; 'future' means today or later. Default 'any'. */
  rule?: DateRule;
  /** Inclusive lower / upper bound as YYYY-MM-DD. */
  min?: string;
  max?: string;
  /** Used in error text, e.g. "Date of birth". */
  label?: string;
}

export type DateParse =
  | { status: 'empty'; value: null; error: null }
  | { status: 'valid'; value: string; error: null }
  | { status: 'invalid'; value: null; error: string };

/** Today's calendar day in the DEVICE's local time zone, as YYYY-MM-DD. */
export function todayYmd(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

/** Parse, normalise and range-check. Never throws. */
export function parseDateInput(raw: string | null | undefined, opts: ParseOptions = {}): DateParse {
  const text = (raw ?? '').trim();
  const who = opts.label ?? 'Date';
  if (!text) return { status: 'empty', value: null, error: null };

  const value = normalizeDate(text);
  if (!value) return { status: 'invalid', value: null, error: `${who}: ${INVALID_DATE_MESSAGE}` };

  // YYYY-MM-DD compares correctly as a string.
  const today = todayYmd();
  if (opts.rule === 'notFuture' && value > today) {
    return { status: 'invalid', value: null, error: `${who} cannot be in the future.` };
  }
  if (opts.rule === 'future' && value < today) {
    return { status: 'invalid', value: null, error: `${who} cannot be in the past.` };
  }
  if (opts.min && value < opts.min) {
    return { status: 'invalid', value: null, error: `${who} cannot be before ${opts.min}.` };
  }
  if (opts.max && value > opts.max) {
    return { status: 'invalid', value: null, error: `${who} cannot be after ${opts.max}.` };
  }
  return { status: 'valid', value, error: null };
}

/**
 * Live formatter for onChange: inserts hyphens as the user types or pastes and
 * keeps deletion natural (backspacing a hyphen just removes it).
 *
 *   "19900614"   -> "1990-06-14"        "1990/06/14" -> "1990-06-14"
 *   "1990-061"   -> "1990-06-1"         "14/06/1990" -> "14-06-1990" (normalised on blur)
 *   letters are dropped; never longer than 10 characters.
 */
export function formatDateTyping(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/[^0-9\-/.\s]/g, '');
  if (!s) return '';

  if (!HAS_SEP.test(s)) {
    const d = s.slice(0, 8);
    if (d.length <= 4) return d;
    if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  }

  const tokens = s.split(SEP_SPLIT).filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  // A leading 1-2 digit token followed by a separator means day-first (DD-MM-YYYY).
  const caps = tokens[0].length <= 2 ? [2, 2, 4] : [4, 2, 2];
  const out: string[] = [];
  let carry = '';
  for (let i = 0; i < 3; i++) {
    const tok = carry + (tokens[i] ?? '');
    if (!tok) break;
    out.push(tok.slice(0, caps[i]));
    carry = tok.slice(caps[i]); // overflow digits roll into the next part
  }
  const trailing = ENDS_WITH_SEP.test(s) && out.length < 3 && carry === '';
  return out.join('-') + (trailing ? '-' : '');
}

/** `YYYY-MM-DD` -> a Date at LOCAL midnight (no UTC shift). Null if invalid. */
export function ymdToLocalDate(ymd: string | null | undefined): Date | null {
  if (!ymd || !isValidYmd(ymd.slice(0, 10))) return null;
  const v = ymd.slice(0, 10);
  return new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
}

/** Whole years between a YYYY-MM-DD birth date and `now` (local calendar). Null if invalid. */
export function ageFromYmd(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const v = dob.slice(0, 10);
  if (!isValidYmd(v)) return null;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  let age = now.getFullYear() - y;
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** Days from today (local calendar) until a YYYY-MM-DD date; negative if past. Null if invalid. */
export function daysUntilYmd(ymd: string | null | undefined, now: Date = new Date()): number | null {
  const target = ymdToLocalDate(ymd);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
