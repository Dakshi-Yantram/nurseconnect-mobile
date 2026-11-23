// Run: npm run test:availability   (plain Node >= 22.6; no extra dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRESETS, expandPreset, applyPreset, validateSlots, toMinutes, hhmm, isOvernight, sortSlots,
  outsideScheduleMessage, todayText, effectiveLabel, windowText,
} from '../lib/availability-schedule.ts';

const s = (d, a, b) => ({ day_of_week: d, start_time: a, end_time: b });
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('time parsing', () => {
  assert.equal(toMinutes('09:00'), 540); assert.equal(toMinutes('09:00:00'), 540);
  assert.equal(toMinutes('24:00'), null); assert.equal(hhmm('9:05'), '09:05');
});
test('valid schedules incl. touching windows and Sunday night into Monday', () => {
  assert.deepEqual(validateSlots([]), []);
  assert.deepEqual(validateSlots([s(0, '09:00', '13:00'), s(0, '13:00', '17:00')]), []);
  assert.deepEqual(validateSlots([s(6, '22:00', '06:00'), s(0, '06:00', '09:00')]), []);
});
test('overlaps rejected: same day, overnight, Sunday into Monday, duplicates', () => {
  assert.equal(validateSlots([s(0, '09:00', '13:00'), s(0, '12:00', '15:00')]).length, 1);
  assert.ok(validateSlots([s(6, '22:00', '06:00'), s(0, '04:00', '08:00')]).length);
  assert.ok(validateSlots([s(0, '22:00', '06:00'), s(1, '05:00', '09:00')]).length);
  assert.ok(validateSlots([s(0, '09:00', '17:00'), s(0, '09:00', '17:00')]).length);
});
test('equal start and end rejected; overnight detected', () => {
  assert.ok(validateSlots([s(0, '09:00', '09:00')])[0].includes('different'));
  assert.equal(isOvernight(s(0, '22:00', '06:00')), true); assert.equal(isOvernight(s(0, '09:00', '17:00')), false);
});
test('presets: weekdays, weekends, every day', () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ['weekdays', 'weekends', 'everyday']);
  assert.deepEqual(expandPreset('weekdays', '09:00', '17:00').map((x) => x.day_of_week), [0, 1, 2, 3, 4]);
  assert.deepEqual(expandPreset('weekends', '10:00', '14:00').map((x) => x.day_of_week), [5, 6]);
  assert.deepEqual(expandPreset('everyday', '09:00', '17:00').map((x) => x.day_of_week), [0, 1, 2, 3, 4, 5, 6]);
});
test('preset shifts are valid, including overnight; weekdays + weekends fill the week', () => {
  assert.deepEqual(validateSlots(expandPreset('weekdays', '09:00', '17:00')), []);
  assert.deepEqual(validateSlots(expandPreset('everyday', '22:00', '06:00')), []);
  const all = [...expandPreset('weekdays', '09:00', '17:00'), ...expandPreset('weekends', '10:00', '14:00')];
  assert.equal(all.length, 7); assert.deepEqual(validateSlots(all), []);
});
test('applyPreset does not duplicate, keeps other days, sorts, and conflicts are reported', () => {
  const once = applyPreset([], 'weekdays', '09:00', '17:00');
  assert.equal(applyPreset(once, 'weekdays', '09:00', '17:00').length, 5);
  assert.deepEqual(applyPreset([s(6, '08:00', '12:00')], 'weekdays', '09:00', '17:00').map((x) => x.day_of_week), [0, 1, 2, 3, 4, 6]);
  assert.ok(validateSlots(applyPreset(once, 'everyday', '12:00', '20:00')).length > 0);
});
test('sorting', () => {
  assert.deepEqual(sortSlots([s(2, '09:00', '10:00'), s(0, '14:00', '15:00'), s(0, '08:00', '09:00')]).map((x) => x.start_time), ['08:00', '14:00', '09:00']);
});
test('outside-schedule message is read from the app api error shape', () => {
  // the app throws { status, message, detail: <response body> }; the body is { detail: { code, message } }
  const err = { status: 409, message: "You're outside your scheduled hours. Next: Monday at 09:00",
    detail: { detail: { code: 'OUTSIDE_SCHEDULE', message: "You're outside your scheduled hours. Next: Monday at 09:00" } } };
  assert.match(outsideScheduleMessage(err), /outside your scheduled hours/);
  assert.match(outsideScheduleMessage({ detail: { code: 'OUTSIDE_SCHEDULE' } }), /outside your scheduled hours/);
  assert.equal(outsideScheduleMessage({ status: 409, message: 'x', detail: { detail: { code: 'OTHER' } } }), null);
  assert.equal(outsideScheduleMessage({ status: 500, message: 'boom' }), null);
  assert.equal(outsideScheduleMessage(null), null);
});
test('status text', () => {
  const none = { manual_status: 'online', effective_status: 'online', has_schedule: false, in_schedule: null, reason: null, today_windows: [], next_window: null };
  assert.match(todayText(none), /No schedule set/);
  const out = { ...none, has_schedule: true, in_schedule: false, effective_status: 'offline', reason: 'outside_schedule', today_windows: [{ start: '09:00', end: '17:00', overnight: false, continues_from_yesterday: false }] };
  assert.equal(effectiveLabel(out), 'Offline (outside schedule)'); assert.equal(todayText(out), '09:00-17:00');
  assert.match(windowText({ start: '22:00', end: '06:00', overnight: true, continues_from_yesterday: false }), /next day/);
});
test('availability screen is wired to the new rules', () => {
  const a = read('../app/availability.tsx');
  assert.match(a, /PRESETS\.map/); assert.match(a, /pickPreset\(p\.days\)/);
  assert.match(a, /validateSlots\(\[\.\.\.slots, \.\.\.additions\]\)/);   // overlap check when adding
  assert.match(a, /validateSlots\(slots\)/);                              // and before saving
  assert.doesNotMatch(a, /slotEnd <= slotStart/);                        // overnight is no longer rejected
  assert.match(a, /outsideScheduleMessage\(e\)/); assert.match(a, /availabilityStatus\(\)/);
});
test('dashboard shows the outside-hours message instead of failing silently', () => {
  const d = read('../app/(nurse)/dashboard.tsx');
  assert.match(d, /outsideScheduleMessage\(e\)/); assert.match(d, /Alert\.alert/);
});
test('service calls the new status endpoint and the existing slot endpoints', () => {
  const sv = read('../services/worker-self.service.ts');
  assert.match(sv, /\/workers\/me\/availability-status/); assert.match(sv, /\/workers\/me\/availability-slots/);
});
test('app never touches bookings from the availability code', () => {
  assert.doesNotMatch(read('../lib/availability-schedule.ts'), /booking/i);
});
