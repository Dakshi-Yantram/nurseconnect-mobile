// Run: npm run test:dates   (plain Node >= 22.6; no extra dependencies)
// Same cases as tests/test_flexible_dates.py (backend) and the website copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDate, formatDateTyping, parseDateInput, isValidYmd, ageFromYmd,
  ymdToLocalDate, daysUntilYmd, todayYmd,
} from '../lib/date-input.ts';

test('normalizeDate accepts the documented shapes', () => {
  const cases = {
    '19900614': '1990-06-14', '1990/06/14': '1990-06-14', '1990-06-14': '1990-06-14',
    '20280106': '2028-01-06', '1990.6.14': '1990-06-14', '1990/6/4': '1990-06-04',
    ' 1990-06-14 ': '1990-06-14', '14/06/1990': '1990-06-14', '14-6-1990': '1990-06-14',
    '2024-02-29': '2024-02-29', '2000-02-29': '2000-02-29', '1990 / 06 / 14': '1990-06-14',
  };
  for (const [raw, want] of Object.entries(cases)) assert.equal(normalizeDate(raw), want, raw);
});

test('normalizeDate rejects impossible or malformed dates', () => {
  for (const raw of [
    '2023-02-29', '1900-02-29', '2100-02-29', '1990-13-01', '1990-00-10', '1990-06-31', '1990-04-31',
    'abcd', '1990', '199006', '1990-06', '1990-06-14-01', '1990061', '199006141', '90-06-14',
    '1990/06/14/', '1899-12-31', '2201-01-01', '14/06/90', '1990-0a-14', '１９９０-06-14', '', '   ',
  ]) assert.equal(normalizeDate(raw), null, JSON.stringify(raw));
});

test('formatDateTyping inserts hyphens while typing, one keystroke at a time', () => {
  let v = '';
  const seen = [];
  for (const ch of '19900614') { v = formatDateTyping(v + ch); seen.push(v); }
  assert.deepEqual(seen, ['1', '19', '199', '1990', '1990-0', '1990-06', '1990-06-1', '1990-06-14']);
});

test('formatDateTyping handles paste, separators and letters', () => {
  assert.equal(formatDateTyping('19900614'), '1990-06-14');
  assert.equal(formatDateTyping('1990/06/14'), '1990-06-14');
  assert.equal(formatDateTyping('1990.06.14'), '1990-06-14');
  assert.equal(formatDateTyping('20280106'), '2028-01-06');
  assert.equal(formatDateTyping('1990-0614'), '1990-06-14');
  assert.equal(formatDateTyping('1990-061'), '1990-06-1');
  assert.equal(formatDateTyping('19a9b0'), '1990');
  assert.equal(formatDateTyping('1990-06-14999'), '1990-06-14');
  assert.equal(formatDateTyping('14/06/1990'), '14-06-1990');
  assert.equal(formatDateTyping(''), '');
  assert.equal(formatDateTyping(null), '');
});

test('formatDateTyping: deleting works naturally (hyphen can be backspaced)', () => {
  assert.equal(formatDateTyping('1990-'), '1990-');   // user typed the hyphen
  assert.equal(formatDateTyping('1990'), '1990');     // ...then backspaced it
  assert.equal(formatDateTyping('1990-06-'), '1990-06-');
  assert.equal(formatDateTyping('1990-06'), '1990-06');
  assert.equal(formatDateTyping('1990-0'), '1990-0');
  assert.equal(formatDateTyping('199'), '199');
});

test('formatDateTyping output always normalises when it is a full date', () => {
  for (const raw of ['19900614', '1990/6/4', '20280106', '1990.06.14']) {
    assert.ok(isValidYmd(normalizeDate(formatDateTyping(raw))), raw);
  }
});

test('parseDateInput distinguishes empty, valid, invalid and applies rules', () => {
  assert.deepEqual(parseDateInput('  '), { status: 'empty', value: null, error: null });
  assert.equal(parseDateInput('19900614').value, '1990-06-14');
  const bad = parseDateInput('2023-02-29', { label: 'Date of birth' });
  assert.equal(bad.status, 'invalid');
  assert.match(bad.error, /^Date of birth: .*real calendar date/);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const t = todayYmd(tomorrow);
  assert.equal(parseDateInput(t, { rule: 'notFuture' }).status, 'invalid');
  assert.equal(parseDateInput(todayYmd(), { rule: 'notFuture' }).status, 'valid');
  assert.equal(parseDateInput('2001-01-01').status, 'valid'); // past expiry is not a format error
  assert.equal(parseDateInput('2001-01-01', { rule: 'future' }).status, 'invalid');
  assert.equal(parseDateInput('2020-01-01', { min: '2021-01-01' }).status, 'invalid');
});

test('no time-zone day shift: local-calendar helpers', () => {
  // Same result in any TZ because everything is local-calendar arithmetic.
  const d = ymdToLocalDate('2026-07-26');
  assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 6); assert.equal(d.getDate(), 26);
  assert.equal(ymdToLocalDate('2026-02-30'), null);
  const now = new Date(2026, 5, 13, 23, 59); // 13 Jun 2026 local, late evening
  assert.equal(ageFromYmd('1990-06-14', now), 35); // birthday tomorrow
  assert.equal(ageFromYmd('1990-06-13', now), 36); // birthday today
  assert.equal(ageFromYmd('2999-01-01', now), null);
  assert.equal(daysUntilYmd('2026-06-13', now), 0);
  assert.equal(daysUntilYmd('2026-06-14', now), 1);
  assert.equal(daysUntilYmd('2026-06-12', now), -1);
});
