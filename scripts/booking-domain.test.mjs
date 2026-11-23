// Run: node --experimental-strip-types --test scripts/booking-domain.test.mjs
// Cancellation cutoff must use the IST slot start, exactly like the backend (core/timeutil.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledStart, canCancel, msUntilCancellationCutoff } from '../lib/booking-domain.ts';

const booking = (over = {}) => ({ rawStatus: 'assigned', date: '2026-11-01', slot: '10:00', ...over });

test('slot 10:00 IST is 04:30 UTC', () => {
  assert.equal(scheduledStart(booking()).toISOString(), '2026-11-01T04:30:00.000Z');
  assert.equal(
    scheduledStart(booking({ scheduledStartISO: '2026-11-01T10:00:00+05:30' })).toISOString(),
    '2026-11-01T04:30:00.000Z',
  );
});

test('cancel allowed until 6h before the IST start, in any device time zone', () => {
  const start = Date.parse('2026-11-01T04:30:00Z'); // 10:00 IST
  const sixHoursBefore = start - 6 * 3600_000;
  assert.equal(canCancel(booking(), sixHoursBefore - 60_000), true);   // 6h01m before
  assert.equal(canCancel(booking(), sixHoursBefore + 60_000), false);  // 5h59m before
  assert.equal(msUntilCancellationCutoff(booking(), sixHoursBefore), 0);
});

test('old UTC-based behaviour would have been wrong (guard)', () => {
  const wrongStart = Date.parse('2026-11-01T10:00:00Z'); // 5.5h too late
  assert.notEqual(scheduledStart(booking()).getTime(), wrongStart);
});
