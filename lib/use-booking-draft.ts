import { useEffect, useState } from 'react';
import { BookingDraft, getDraft, loadDraft, subscribeDraft } from './booking-draft';

/** Reactive view of the persisted booking draft. `ready` is false until it has been read from storage. */
export function useBookingDraft(): { draft: BookingDraft; ready: boolean } {
  const [draft, setDraft] = useState<BookingDraft>(getDraft());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const unsub = subscribeDraft(() => alive && setDraft({ ...getDraft() }));
    loadDraft().then((d) => {
      if (!alive) return;
      setDraft({ ...d });
      setReady(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return { draft, ready };
}
