// Weekly availability schedule helpers (India time). Same rules as the server and the website.
// Run: npm run test:availability
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type Slot = { day_of_week: number; start_time: string; end_time: string };
export type AvailabilityWindow = { start: string; end: string; overnight: boolean; continues_from_yesterday: boolean };
export type AvailabilityStatus = {
  manual_status: string;
  effective_status: string;
  has_schedule: boolean;
  in_schedule: boolean | null;
  reason: string | null;
  today_windows: AvailabilityWindow[];
  next_window: { day: string; start: string } | null;
};

const WEEK = 7 * 1440;

/** "HH:MM" or "HH:MM:SS" -> minutes, or null when invalid. */
export function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

export function hhmm(t: string): string {
  const m = toMinutes(t);
  if (m === null) return t;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function interval(s: Slot): [number, number] | null {
  const a = toMinutes(s.start_time), b = toMinutes(s.end_time);
  if (a === null || b === null || a === b) return null;
  const start = s.day_of_week * 1440 + a;
  let end = s.day_of_week * 1440 + b;
  if (end <= start) end += 1440; // overnight
  return [start, end];
}

export function isOvernight(s: Slot): boolean {
  const a = toMinutes(s.start_time), b = toMinutes(s.end_time);
  return a !== null && b !== null && b < a;
}

/** Problems with a proposed schedule (empty = valid). Touching windows are allowed; the week wraps Sunday -> Monday. */
export function validateSlots(slots: Slot[]): string[] {
  const errors: string[] = [];
  const pieces: { a: number; b: number; label: string }[] = [];
  for (const s of slots) {
    const label = `${DAY_NAMES[s.day_of_week] ?? "Day " + s.day_of_week} ${hhmm(s.start_time)}-${hhmm(s.end_time)}`;
    if (!(s.day_of_week >= 0 && s.day_of_week <= 6)) { errors.push(`${label}: invalid day`); continue; }
    if (toMinutes(s.start_time) === null || toMinutes(s.end_time) === null) { errors.push(`${label}: enter both times`); continue; }
    const iv = interval(s);
    if (!iv) { errors.push(`${label}: start and end time must be different`); continue; }
    if (iv[1] <= WEEK) pieces.push({ a: iv[0], b: iv[1], label });
    else { pieces.push({ a: iv[0], b: WEEK, label }); pieces.push({ a: 0, b: iv[1] - WEEK, label }); }
  }
  pieces.sort((x, y) => x.a - y.a);
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (pieces[j].a >= pieces[i].b) break;
      const msg = pieces[i].label === pieces[j].label
        ? `${pieces[i].label} is listed more than once or overlaps itself`
        : `${pieces[i].label} overlaps ${pieces[j].label}`;
      if (!errors.includes(msg)) errors.push(msg);
    }
  }
  return errors;
}

export function sortSlots<T extends Slot>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.day_of_week - b.day_of_week || (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0));
}

export function windowText(w: AvailabilityWindow): string {
  if (w.continues_from_yesterday) return `until ${w.end} (started yesterday)`;
  return w.overnight ? `${w.start} to ${w.end} (next day)` : `${w.start}-${w.end}`;
}

/** One line for the admin panel: today's window(s), or a clear "no schedule". */
export function todayText(s: AvailabilityStatus | null | undefined): string {
  if (!s) return "—";
  if (!s.has_schedule) return "No schedule set (always available when online)";
  if (!s.today_windows.length) return "No window today";
  return s.today_windows.map(windowText).join(", ");
}

export function effectiveLabel(s: AvailabilityStatus | null | undefined): string {
  if (!s) return "—";
  if (s.reason === "outside_schedule") return "Offline (outside schedule)";
  return s.effective_status.replace(/_/g, " ");
}

// ---- Presets: create a fixed shift once and apply it to many days -------------------------------------------
export type PresetId = "weekdays" | "weekends" | "everyday";
export const PRESETS: { id: PresetId; label: string; days: number[] }[] = [
  { id: "weekdays", label: "Weekdays (Mon–Fri)", days: [0, 1, 2, 3, 4] },
  { id: "weekends", label: "Weekends (Sat–Sun)", days: [5, 6] },
  { id: "everyday", label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
];

/** One window per day of the preset, all with the same start and end (an end earlier than the start runs overnight). */
export function expandPreset(id: PresetId, start: string, end: string): Slot[] {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return [];
  return p.days.map((d) => ({ day_of_week: d, start_time: hhmm(start), end_time: hhmm(end) }));
}

/** Adds a preset to an existing schedule. Exact duplicates are skipped; real overlaps are left for validateSlots to report. */
export function applyPreset(existing: Slot[], id: PresetId, start: string, end: string): Slot[] {
  const key = (x: Slot) => `${x.day_of_week}|${hhmm(x.start_time)}|${hhmm(x.end_time)}`;
  const have = new Set(existing.map(key));
  return sortSlots([...existing, ...expandPreset(id, start, end).filter((x) => !have.has(key(x)))]);
}

/** Message for the server refusing "Available" outside scheduled hours (409 OUTSIDE_SCHEDULE), else null.
 *  The app's api layer throws { status, message, detail: <response body> }. */
export function outsideScheduleMessage(err: any): string | null {
  const body = err?.detail;
  const inner = body && typeof body === 'object' ? (body.detail ?? body) : null;
  const code = inner && typeof inner === 'object' ? (inner as any).code : null;
  if (code !== 'OUTSIDE_SCHEDULE') return null;
  const m = (inner as any).message;
  return (typeof m === 'string' && m) || (typeof err?.message === 'string' && err.message) ||
    "You're outside your scheduled hours, so you can't go online right now.";
}
