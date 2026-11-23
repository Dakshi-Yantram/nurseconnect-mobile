// Run: npm run test:privacy   (plain Node >= 22.6)
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOwnerPolicy, MAX_AGE_MS } from '../lib/offline-queue-policy.ts';

const now = 1_800_000_000_000;
const it = (owner, age = 1000) => ({ owner, createdAt: now - age, id: owner + age });

test('own items are replayable', () => {
  const r = applyOwnerPolicy([it('A'), it('A', 5000)], 'A', now);
  assert.equal(r.replayable.length, 2); assert.equal(r.dropped, 0);
});
test("another account's items are dropped, never replayed", () => {
  const r = applyOwnerPolicy([it('A'), it('B')], 'B', now);
  assert.deepEqual(r.replayable.map((x) => x.owner), ['B']); assert.equal(r.dropped, 1);
});
test('expired items are dropped', () => {
  const r = applyOwnerPolicy([it('A', MAX_AGE_MS + 1), it('A', MAX_AGE_MS - 1)], 'A', now);
  assert.equal(r.replayable.length, 1); assert.equal(r.dropped, 1);
});
test('legacy ownerless items are adopted, not lost', () => {
  const r = applyOwnerPolicy([{ createdAt: now - 10, id: 'x' }], 'A', now);
  assert.equal(r.replayable.length, 1); assert.equal(r.replayable[0].owner, 'A');
});
test('signed out: nothing replays, unexpired items are kept (no data loss)', () => {
  const r = applyOwnerPolicy([it('A')], null, now);
  assert.equal(r.replayable.length, 0); assert.equal(r.keep.length, 1);
});
test('queue and store are wired to the policy', async () => {
  const { readFileSync } = await import('node:fs');
  const q = readFileSync(new URL('../lib/offline-queue.ts', import.meta.url), 'utf8');
  const s = readFileSync(new URL('../store/index.ts', import.meta.url), 'utf8');
  assert.match(q, /applyOwnerPolicy\(await readQueue\(\)/);
  assert.match(s, /offlineQueue\.setOwner\(u\.id\)/);
  assert.match(s, /offlineQueue\.setOwner\(null\)/);
});
