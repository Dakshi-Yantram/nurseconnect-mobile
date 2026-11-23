/**
 * Support chat (nurse + family/patient): types and PURE helpers.
 *
 * No React Native, no network and no env access in this file, so it runs under plain Node
 * (`npm run test:support-chat`). The server owns the conversation, the menu flow, tickets and
 * admin replies; this app only displays them. The same backend routes serve the website.
 */

export type Lang = 'en' | 'hi';
export type Sender = 'user' | 'bot' | 'admin' | 'system';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_nurse' | 'resolved' | 'closed';

export interface ChatOption {
  id: string;
  label: string;
}
export interface ChatAttachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}
export interface ChatMessage {
  id: string;
  sender: Sender;
  body: string;
  options: ChatOption[] | null;
  created_at: string | null;
  ticket_ref: string | null;
  attachments: ChatAttachment[];
  /** Client-only: the send failed; the bubble offers "tap to retry". Never sent by the server. */
  failed?: boolean;
}
export interface TicketBrief {
  id: string;
  ticket_ref: string;
  subject: string;
  status: TicketStatus;
  /** Wording chosen by the SERVER for this audience (family and nurse read different text). */
  status_label: string;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
}
export interface ConversationPayload {
  language: Lang;
  current_node: string;
  awaiting_details: boolean;
  active_ticket: TicketBrief | null;
  messages: ChatMessage[];
}
export interface SupportStatus {
  online: boolean;
  reason: 'online' | 'no_staff' | 'outside_hours';
  hours_start: string;
  hours_end: string;
}

// ---- who sees the chat ------------------------------------------------------------------------
/** App portals that get the chat: nurse ("worker" on the server) and family/patient ("consumer"). */
export function isChatRole(role: string | null | undefined): boolean {
  return role === 'nurse' || role === 'family';
}

/**
 * The entry point is shown only for chat roles AND when the build flag is "true".
 * `EXPO_PUBLIC_SUPPORT_CHAT` is baked in at build time (eas.json), so a production build stays
 * unchanged until someone deliberately turns the flag on. The server enforces the roles anyway.
 */
export function supportChatVisible(role: string | null | undefined, flag: string | undefined | null): boolean {
  return flag === 'true' && isChatRole(role);
}

// ---- attachments (the server is the authority; this is a friendly pre-check) --------------------
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_PENDING_ATTACHMENTS = 3;
/** The app attaches photos only (no document picker is installed). PDFs can be added on the website. */
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];

export interface PickedFile {
  size?: number | null;
  mimeType?: string | null;
  name?: string | null;
}

export function validateAttachment(file: PickedFile, lang: Lang = 'en'): string | null {
  const ext = (file.name ?? '').toLowerCase().split('.').pop() ?? '';
  const type = (file.mimeType ?? '').toLowerCase();
  const typeOk = ALLOWED_PHOTO_TYPES.includes(type) || (type === '' && ['jpg', 'jpeg', 'png'].includes(ext));
  if (!typeOk) return lang === 'hi' ? 'ऐप में केवल JPG या PNG फ़ोटो जोड़ी जा सकती है।' : 'Only JPG or PNG photos can be attached in the app.';
  if (file.size != null && file.size <= 0) return lang === 'hi' ? 'फ़ाइल खाली है।' : 'The file is empty.';
  if (file.size != null && file.size > MAX_ATTACHMENT_BYTES) return lang === 'hi' ? 'फ़ाइल 5 MB से बड़ी है।' : 'The file is larger than 5 MB.';
  return null;
}

/** A safe upload name and content type for a picked photo (pickers sometimes omit both). */
export function uploadDescriptor(file: PickedFile & { uri: string }): { uri: string; name: string; type: string } {
  const type = (file.mimeType ?? '').toLowerCase() === 'image/png' || /\.png$/i.test(file.name ?? file.uri) ? 'image/png' : 'image/jpeg';
  const base = (file.name ?? '').split(/[\\/]/).pop() || `photo.${type === 'image/png' ? 'png' : 'jpg'}`;
  const name = /\.(jpe?g|png)$/i.test(base) ? base : `${base}.${type === 'image/png' ? 'png' : 'jpg'}`;
  return { uri: file.uri, name: name.slice(-100), type };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- conversation helpers -----------------------------------------------------------------------
/** Quick-reply buttons are shown only under the LAST bot message (WhatsApp style). */
export function activeOptionsMessageId(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'bot') {
      const o = messages[i].options;
      return o && o.length ? messages[i].id : null;
    }
  }
  return null;
}

export function isTicketActive(s: TicketStatus | string | null | undefined): boolean {
  return s === 'open' || s === 'in_progress' || s === 'waiting_for_nurse';
}

export function optimisticMessage(body: string, attachments: ChatAttachment[] = [], now: number = Date.now()): ChatMessage {
  return {
    id: `tmp:${now}`,
    sender: 'user',
    body,
    options: null,
    created_at: new Date(now).toISOString(),
    ticket_ref: null,
    attachments,
  };
}

/** HH:MM (12-hour) in the device's time zone; empty text for a missing or invalid date. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export function supportStatusText(s: SupportStatus | null, lang: Lang = 'en'): string {
  if (!s) return lang === 'hi' ? 'जाँच रहे हैं…' : 'checking…';
  if (s.online) return lang === 'hi' ? 'ऑनलाइन' : 'online';
  return lang === 'hi' ? `ऑफ़लाइन · समय ${s.hours_start}–${s.hours_end} IST` : `offline · hours ${s.hours_start}–${s.hours_end} IST`;
}

export const UI_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    title: 'NurseConnect Support', placeholder: 'Type a message', attach: 'Attach photo', menu: 'Main menu', back: 'Back',
    language: 'हिन्दी में बदलें', tickets: 'My requests', loading: 'Loading your chat…', retry: 'Try again',
    failed: 'Could not load the chat. Check your connection and try again.', typing: 'typing…',
    openTicket: 'Open ticket', viewTicket: 'View ticket', sendFailed: 'Something went wrong. Please try again.',
    uploadFailed: 'Upload failed.', tooMany: 'You can attach up to 3 photos per message.', notAvailable: 'Support chat is not available for this account.',
    emergency: 'Medical emergency? Call 108 now.', support: 'NurseConnect Support Team', viewPhoto: 'Photo',
    pdfWebOnly: 'PDF files can be opened on the NurseConnect website.', close: 'Close',
  },
  hi: {
    title: 'NurseConnect सपोर्ट', placeholder: 'संदेश लिखें', attach: 'फ़ोटो जोड़ें', menu: 'मुख्य मेनू', back: 'पीछे',
    language: 'Switch to English', tickets: 'मेरे अनुरोध', loading: 'आपकी चैट लोड हो रही है…', retry: 'फिर कोशिश करें',
    failed: 'चैट लोड नहीं हो सकी। कनेक्शन जाँचकर फिर कोशिश करें।', typing: 'टाइप कर रहे हैं…',
    openTicket: 'खुला टिकट', viewTicket: 'टिकट देखें', sendFailed: 'कुछ गड़बड़ हुई। फिर कोशिश करें।',
    uploadFailed: 'अपलोड नहीं हो सका।', tooMany: 'एक संदेश में अधिकतम 3 फ़ोटो जोड़ सकते हैं।', notAvailable: 'इस खाते के लिए सपोर्ट चैट उपलब्ध नहीं है।',
    emergency: 'मेडिकल इमरजेंसी? अभी 108 पर कॉल करें।', support: 'NurseConnect सपोर्ट टीम', viewPhoto: 'फ़ोटो',
    pdfWebOnly: 'PDF फ़ाइलें NurseConnect वेबसाइट पर खोली जा सकती हैं।', close: 'बंद करें',
  },
};

// ---- unread + retry (client-side; the server keeps no read marker) ------------------------------------
/**
 * Unread = support-team (admin) messages newer than the last time this user had the chat open on THIS phone.
 * With no stored time every admin message counts. Bot, system and the user's own messages never count.
 */
export function unreadCount(messages: ChatMessage[] | null | undefined, lastSeenIso: string | null | undefined): number {
  const seen = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;
  const base = Number.isNaN(seen) ? 0 : seen;
  return (messages ?? []).filter((m) => {
    if (m.sender !== 'admin') return false;
    const t = m.created_at ? new Date(m.created_at).getTime() : NaN;
    return Number.isNaN(t) ? false : t > base;
  }).length;
}

/** Newest message time (any sender) - what gets stored as "seen" when the chat is open. */
export function latestMessageTime(messages: ChatMessage[] | null | undefined): string | null {
  let best = 0;
  for (const m of messages ?? []) {
    const t = m.created_at ? new Date(m.created_at).getTime() : 0;
    if (t > best) best = t;
  }
  return best ? new Date(best).toISOString() : null;
}

export const seenKey = (userId: string | null | undefined) => `support_chat_seen:${userId ?? 'me'}`;

export function markFailed(messages: ChatMessage[], id: string): ChatMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, failed: true } : m));
}
export function removeMessage(messages: ChatMessage[], id: string): ChatMessage[] {
  return messages.filter((m) => m.id !== id);
}

export function badgeText(n: number): string {
  return n <= 0 ? '' : n > 9 ? '9+' : String(n);
}

/** One line for the Help screen: what the person can do with Live Support right now. */
export function liveSupportAction(active: TicketBrief | null | undefined, hasHistory: boolean): string {
  if (active) return 'Continue conversation';
  return hasHistory ? 'Start a new conversation' : 'Chat with NurseConnect Support';
}

/** True when the request never got an answer (offline / timeout), as opposed to the server refusing it. */
export function isNetworkFailure(e: any): boolean {
  if (!e || e.response) return false;
  return e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.message === 'Network Error' || e.isNetworkError === true || /timeout/i.test(String(e.message || ''));
}
