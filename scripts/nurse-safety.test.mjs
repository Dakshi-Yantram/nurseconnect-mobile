// Run: npm run test:nurse-safety   (plain Node >= 22.6)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  e164, validateContactForm, hasErrors, emptyForm, formFromContact, reminderText, serverMessage,
  sosPhase, sosHeadline, canCancel, cancelMessage, shouldShareLocation, deliveryLabel, deliveryLines, opsAlerted, normalizeCountryCode,
} from '../lib/nurse-safety.ts';
import { runSos } from '../lib/sos-controller.ts';

const ok = { full_name: 'Asha Devi', relationship: 'Mother', country_code: '+91', phone: '9876543210' };

test('valid contact passes; India numbers normalise', () => {
  assert.deepEqual(validateContactForm(ok), {});
  assert.equal(e164('+91', '98765 43210'), '+919876543210');
  assert.equal(e164('91', '09876543210'), '+919876543210');
  assert.equal(normalizeCountryCode('91'), '+91');
});

test('invalid numbers / codes / names rejected', () => {
  assert.ok(validateContactForm({ ...ok, phone: '12345' }).phone);
  assert.ok(validateContactForm({ ...ok, phone: '5876543210' }).phone);
  assert.ok(validateContactForm({ ...ok, phone: 'abcdefghij' }).phone);
  assert.ok(validateContactForm({ ...ok, country_code: '+9999' }).country_code);
  assert.ok(validateContactForm({ ...ok, country_code: '' }).country_code);
  assert.ok(validateContactForm({ ...ok, full_name: 'A' }).full_name);
  assert.ok(validateContactForm({ ...ok, relationship: '' }).relationship);
  assert.ok(validateContactForm({ ...ok, full_name: '<b>x</b>' }).full_name);
  assert.equal(e164('+44', '123'), null);
  assert.equal(e164('+44', '7911123456'), '+447911123456');
});

test('duplicate and own number rejected', () => {
  assert.ok(validateContactForm(ok, '+919876543210').phone);
  assert.equal(hasErrors(validateContactForm(ok, '+919876543211')), false);
  assert.ok(validateContactForm(ok, null, '+919876543210').phone);
});

test('form helpers: empty form defaults to +91; edit form shows saved values', () => {
  assert.equal(emptyForm().country_code, '+91');
  const c = { slot: 1, full_name: 'A B', relationship: 'Dad', country_code: '+91', phone: '9876543210', phone_masked: '+91********10' };
  assert.deepEqual(formFromContact(c), { full_name: 'A B', relationship: 'Dad', country_code: '+91', phone: '9876543210' });
  assert.deepEqual(formFromContact(undefined), emptyForm());
});

test('reminder shows until both contacts are saved, never blocks', () => {
  assert.match(reminderText([1, 2]), /2 emergency contacts/);
  assert.match(reminderText([2]), /second/);
  assert.equal(reminderText([]), null);
  assert.equal(reminderText(null), null);
});

test('server error text never echoes the number', () => {
  assert.equal(serverMessage({ response: { data: { detail: { code: 'phone_invalid', message: 'Enter a valid 10-digit Indian mobile number.' } } } }), 'Enter a valid 10-digit Indian mobile number.');
  assert.equal(serverMessage({}), 'Could not save. Please try again.');
});

test('SOS phases and location-sharing rule (stops when resolved)', () => {
  const v = (status, tracking) => ({ id: 'x', status, duplicate: false, created_at: null, acknowledged_at: null, resolved_at: null, tracking_active: tracking, deliveries: [] });
  assert.equal(sosPhase(null), 'none');
  assert.equal(sosPhase(v('open', true)), 'active');
  assert.equal(sosPhase(v('acknowledged', true)), 'acknowledged');
  assert.equal(sosPhase(v('resolved', false)), 'resolved');
  assert.equal(shouldShareLocation(v('open', true)), true);
  assert.equal(shouldShareLocation(v('acknowledged', true)), true);
  assert.equal(shouldShareLocation(v('resolved', false)), false);
  assert.equal(shouldShareLocation(v('open', false)), false);
  assert.equal(shouldShareLocation(null), false);
  assert.match(sosHeadline(v('resolved', false)), /stopped/);
});

test('notification status display: per contact + channel, honest wording', () => {
  const ds = [
    { slot: 1, channel: 'sms', status: 'blocked' }, { slot: 1, channel: 'whatsapp', status: 'mock_sent' },
    { slot: 2, channel: 'sms', status: 'no_contact' }, { slot: 2, channel: 'whatsapp', status: 'failed' },
    { slot: null, channel: 'ops_in_app', status: 'sent' },
  ];
  const lines = deliveryLines(ds);
  assert.equal(lines.length, 4);
  assert.match(lines[0].text, /Contact 1 · SMS: Not sent/);
  assert.match(lines[1].text, /WhatsApp: Test mode \(not sent\)/);
  assert.equal(opsAlerted(ds), true);
  assert.equal(opsAlerted([{ slot: null, channel: 'ops_in_app', status: 'failed' }]), false);
  assert.equal(deliveryLabel('sent'), 'Sent');
});

// ---- SOS press flow, with injected phone / network ------------------------------------------------
const sosView = (dup = false) => ({ id: 's1', status: 'open', duplicate: dup, created_at: null, acknowledged_at: null, resolved_at: null, tracking_active: true, deliveries: [] });
const deps = (o = {}) => {
  const sent = [];
  return { sent, d: {
    confirm: async () => true, requestLocationPermission: async () => 'granted',
    getPosition: async () => ({ latitude: 12.9, longitude: 77.5, accuracy_metres: 12 }),
    send: async (p) => { sent.push(p); return sosView(); }, ...o } };
};

test('SOS: cancelled at the confirmation dialog sends nothing', async () => {
  const { d, sent } = deps({ confirm: async () => false });
  assert.deepEqual(await runSos(d), { kind: 'cancelled' });
  assert.equal(sent.length, 0);
});

test('SOS: success sends coordinates', async () => {
  const { d, sent } = deps();
  const r = await runSos(d);
  assert.equal(r.kind, 'sent'); assert.equal(r.location, 'shared');
  assert.deepEqual(sent[0], { latitude: 12.9, longitude: 77.5, accuracy_metres: 12 });
});

test('SOS: GPS permission DENIED still sends SOS, without coordinates', async () => {
  const { d, sent } = deps({ requestLocationPermission: async () => 'denied' });
  const r = await runSos(d);
  assert.equal(r.kind, 'sent'); assert.equal(r.location, 'permission_denied');
  assert.deepEqual(sent[0], {});
});

test('SOS: GPS unavailable / throws still sends SOS', async () => {
  for (const getPosition of [async () => null, async () => { throw new Error('no fix'); }]) {
    const { d, sent } = deps({ getPosition });
    const r = await runSos(d);
    assert.equal(r.kind, 'sent'); assert.equal(r.location, 'gps_unavailable'); assert.deepEqual(sent[0], {});
  }
  const { d } = deps({ requestLocationPermission: async () => { throw new Error('x'); } });
  assert.equal((await runSos(d)).location, 'gps_unavailable');
});

test('SOS: network failure is reported with the call-108 instruction', async () => {
  const { d } = deps({ send: async () => { const e = new Error('Network Error'); e.code = 'ERR_NETWORK'; throw e; } });
  const r = await runSos(d);
  assert.equal(r.kind, 'network_error'); assert.match(r.message, /Call 108/);
});

test('SOS: server error is reported; repeated tap shows duplicate', async () => {
  const { d } = deps({ send: async () => { const e = new Error('x'); e.response = { status: 500, data: { detail: 'boom' } }; throw e; } });
  const r = await runSos(d);
  assert.equal(r.kind, 'error'); assert.equal(r.message, 'boom');
  const dup = deps({ send: async () => sosView(true) });
  assert.equal((await runSos(dup.d)).duplicate, true);
});

test('SOS: booking id is passed only when given', async () => {
  const a = deps(); await runSos(a.d, 'b-1'); assert.equal(a.sent[0].booking_id, 'b-1');
  const b = deps(); await runSos(b.d); assert.equal('booking_id' in b.sent[0], false);
});

test('cancel is offered only while the SOS is still open (matches the server rule)', () => {
  assert.equal(canCancel({ id: 'a', status: 'open' }), true);
  for (const st of ['acknowledged', 'investigating', 'resolved', 'closed']) assert.equal(canCancel({ id: 'a', status: st }), false);
  assert.equal(canCancel(null), false);
});

test('cancel errors: server message shown; network failure tells her to phone Operations', () => {
  const e = new Error('x'); e.response = { status: 409, data: { detail: { code: 'CANNOT_CANCEL', message: 'Operations has already seen this SOS. Please speak to them.' } } };
  assert.match(cancelMessage(e), /already seen/);
  assert.match(cancelMessage(new Error('Network Error')), /tell Operations by phone/);
});
