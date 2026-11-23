// Run: npm run test:support-chat   (plain Node >= 22.6)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChatRole, supportChatVisible, unreadCount, latestMessageTime, markFailed, removeMessage, badgeText, liveSupportAction, isNetworkFailure, seenKey, validateAttachment, uploadDescriptor, formatBytes, activeOptionsMessageId,
  isTicketActive, optimisticMessage, formatClock, supportStatusText, MAX_ATTACHMENT_BYTES, UI_TEXT,
} from '../lib/support-chat.ts';

test('only nurse and family portals get the chat', () => {
  assert.equal(isChatRole('nurse'), true);
  assert.equal(isChatRole('family'), true);
  for (const r of ['trainer', 'clinical_lead', 'admin', 'support', 'worker', 'consumer', '', null, undefined]) assert.equal(isChatRole(r), false, String(r));
});

test('entry point needs BOTH a chat role and the build flag "true"', () => {
  assert.equal(supportChatVisible('nurse', 'true'), true);
  assert.equal(supportChatVisible('family', 'true'), true);
  for (const flag of [undefined, null, '', 'false', '1', 'TRUE', 'yes']) assert.equal(supportChatVisible('nurse', flag), false, String(flag));
  assert.equal(supportChatVisible('trainer', 'true'), false);
  assert.equal(supportChatVisible(null, 'true'), false);
});

test('attachment pre-check: JPG/PNG up to 5 MB only', () => {
  assert.equal(validateAttachment({ size: 1000, mimeType: 'image/jpeg', name: 'a.jpg' }), null);
  assert.equal(validateAttachment({ size: 1000, mimeType: 'image/png', name: 'a.png' }), null);
  assert.equal(validateAttachment({ size: null, mimeType: 'image/jpeg', name: 'a.jpg' }), null); // size unknown: server decides
  assert.equal(validateAttachment({ size: 1000, mimeType: '', name: 'photo.JPEG' }), null);      // picker omitted the type
  assert.ok(validateAttachment({ size: 1000, mimeType: 'application/pdf', name: 'a.pdf' }));
  assert.ok(validateAttachment({ size: 1000, mimeType: 'image/heic', name: 'a.heic' }));
  assert.ok(validateAttachment({ size: 1000, mimeType: 'text/plain', name: 'a.png.txt' }));
  assert.ok(validateAttachment({ size: 0, mimeType: 'image/png', name: 'a.png' }));
  assert.equal(validateAttachment({ size: MAX_ATTACHMENT_BYTES, mimeType: 'image/png', name: 'a.png' }), null);
  assert.ok(validateAttachment({ size: MAX_ATTACHMENT_BYTES + 1, mimeType: 'image/png', name: 'a.png' }));
  assert.match(validateAttachment({ size: 1, mimeType: 'application/pdf' }, 'hi'), /JPG/);
});

test('upload descriptor always has a safe name and a JPG/PNG type', () => {
  assert.deepEqual(uploadDescriptor({ uri: 'file:///x/abc.jpg', mimeType: 'image/jpeg', name: 'abc.jpg' }), { uri: 'file:///x/abc.jpg', name: 'abc.jpg', type: 'image/jpeg' });
  assert.deepEqual(uploadDescriptor({ uri: 'file:///x/p.png', mimeType: 'image/png', name: null }), { uri: 'file:///x/p.png', name: 'photo.png', type: 'image/png' });
  assert.deepEqual(uploadDescriptor({ uri: 'file:///x/q', mimeType: null, name: null }), { uri: 'file:///x/q', name: 'photo.jpg', type: 'image/jpeg' });
  assert.equal(uploadDescriptor({ uri: 'u', mimeType: 'image/jpeg', name: '../../etc/passwd' }).name, 'passwd.jpg'); // no path parts
  assert.ok(uploadDescriptor({ uri: 'u', mimeType: 'image/png', name: 'x'.repeat(300) + '.png' }).name.length <= 100);
});

test('formatBytes', () => {
  assert.equal(formatBytes(10), '10 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
});

test('quick-reply buttons only under the LAST bot message', () => {
  const m = (id, sender, options = null) => ({ id, sender, body: 'x', options, created_at: null, ticket_ref: null, attachments: [] });
  const opts = [{ id: 'a', label: 'A' }];
  assert.equal(activeOptionsMessageId([m('1', 'bot', opts), m('2', 'user'), m('3', 'bot', opts)]), '3');
  assert.equal(activeOptionsMessageId([m('1', 'bot', opts), m('2', 'user')]), '1');
  assert.equal(activeOptionsMessageId([m('1', 'bot', opts), m('2', 'bot', [])]), null);
  assert.equal(activeOptionsMessageId([m('1', 'user')]), null);
  assert.equal(activeOptionsMessageId([]), null);
});

test('ticket activity (waiting_for_nurse is the server status that means "waiting for the requester")', () => {
  for (const s of ['open', 'in_progress', 'waiting_for_nurse']) assert.equal(isTicketActive(s), true);
  for (const s of ['resolved', 'closed', '', null, undefined, 'bogus']) assert.equal(isTicketActive(s), false);
});

test('optimistic message and clock', () => {
  const o = optimisticMessage('hello', [], 1_700_000_000_000);
  assert.equal(o.sender, 'user'); assert.equal(o.body, 'hello'); assert.equal(o.id, 'tmp:1700000000000');
  assert.equal(formatClock(null), ''); assert.equal(formatClock('nope'), '');
  assert.match(formatClock('2026-01-01T10:05:00'), /^10:05 AM$/);
  assert.match(formatClock('2026-01-01T00:07:00'), /^12:07 AM$/);
  assert.match(formatClock('2026-01-01T13:30:00'), /^1:30 PM$/);
});

test('support status text and both languages have the same UI keys', () => {
  assert.equal(supportStatusText(null), 'checking…');
  assert.equal(supportStatusText({ online: true, reason: 'online', hours_start: '09:00', hours_end: '18:00' }), 'online');
  assert.match(supportStatusText({ online: false, reason: 'outside_hours', hours_start: '09:00', hours_end: '18:00' }), /09:00–18:00 IST/);
  assert.deepEqual(Object.keys(UI_TEXT.en).sort(), Object.keys(UI_TEXT.hi).sort());
  for (const k of Object.keys(UI_TEXT.en)) assert.ok(UI_TEXT.hi[k].length > 0, k);
});

const M = (id, sender, at) => ({ id, sender, body: 'x', options: null, created_at: at, ticket_ref: null, attachments: [] });

test('unread = only support-team messages newer than the last time the chat was open', () => {
  const msgs = [M('1', 'bot', '2026-11-06T10:00:00Z'), M('2', 'user', '2026-11-06T10:01:00Z'), M('3', 'admin', '2026-11-06T10:05:00Z'), M('4', 'admin', '2026-11-06T10:09:00Z'), M('5', 'system', '2026-11-06T10:10:00Z')];
  assert.equal(unreadCount(msgs, null), 2);                       // never opened: all admin messages
  assert.equal(unreadCount(msgs, '2026-11-06T10:06:00Z'), 1);     // one read, one new
  assert.equal(unreadCount(msgs, '2026-11-06T10:09:00Z'), 0);     // exactly at the newest: nothing unread
  assert.equal(unreadCount(msgs, 'garbage'), 2);
  assert.equal(unreadCount([], null), 0); assert.equal(unreadCount(null, null), 0);
  assert.equal(unreadCount([M('9', 'admin', null)], null), 0);    // no timestamp: not counted
});

test('opening the chat marks everything read (stored time = newest message)', () => {
  const msgs = [M('1', 'admin', '2026-11-06T10:05:00Z'), M('2', 'bot', '2026-11-06T10:09:00Z')];
  const t = latestMessageTime(msgs);
  assert.equal(t, '2026-11-06T10:09:00.000Z');
  assert.equal(unreadCount(msgs, t), 0);
  assert.equal(latestMessageTime([]), null);
  assert.notEqual(seenKey('a'), seenKey('b'));                     // per user: no mixing between accounts
});

test('failed message keeps its text and can be removed for retry', () => {
  const msgs = [M('tmp:1', 'user', '2026-11-06T10:00:00Z'), M('2', 'admin', '2026-11-06T10:01:00Z')];
  const f = markFailed(msgs, 'tmp:1');
  assert.equal(f[0].failed, true); assert.equal(f[0].body, 'x'); assert.equal(f[1].failed, undefined);
  assert.deepEqual(removeMessage(f, 'tmp:1').map((m) => m.id), ['2']);
});

test('network failure is told apart from a server refusal', () => {
  assert.equal(isNetworkFailure({ message: 'Network Error', code: 'ERR_NETWORK' }), true);
  assert.equal(isNetworkFailure({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }), true);
  assert.equal(isNetworkFailure({ response: { status: 500 } }), false);
  assert.equal(isNetworkFailure({ response: { status: 403 }, message: 'Network Error' }), false);
  assert.equal(isNetworkFailure(null), false);
});

test('badge and Help-screen wording', () => {
  assert.equal(badgeText(0), ''); assert.equal(badgeText(3), '3'); assert.equal(badgeText(12), '9+');
  assert.equal(liveSupportAction({ id: 'x', status: 'open' }, true), 'Continue conversation');
  assert.equal(liveSupportAction(null, true), 'Start a new conversation');
  assert.equal(liveSupportAction(null, false), 'Chat with NurseConnect Support');
});
