/**
 * Privacy rules for the offline queue (pure, unit-tested).
 * Queued bodies can hold vitals, medications and check-in data, so they must:
 *  - only ever be replayed by the account that created them,
 *  - be discarded when a DIFFERENT account signs in on the device,
 *  - expire after MAX_AGE_MS instead of living on the phone forever.
 * Items created before this change have no owner; they are adopted by the next
 * signed-in account (the previous behaviour) so no unsent data is lost on upgrade.
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface OwnedItem { owner?: string; createdAt: number }

export function applyOwnerPolicy<T extends OwnedItem>(items: T[], owner: string | null, now: number) {
  const keep: T[] = [];
  let dropped = 0;
  for (const it of items) {
    const expired = now - it.createdAt > MAX_AGE_MS;
    const foreign = !!it.owner && it.owner !== owner;
    if (expired || foreign || !owner) {
      // No signed-in owner: keep unexpired items untouched, replay nothing.
      if (!owner && !expired) keep.push(it);
      else dropped += 1;
      continue;
    }
    keep.push(it.owner ? it : { ...it, owner });
  }
  return { keep, dropped, replayable: owner ? keep : [] };
}
