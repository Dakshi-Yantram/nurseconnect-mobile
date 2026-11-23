/**
 * Support chat API (nurse + family/patient). Same server routes as the website:
 *   /api/support/chat/*   (the server decides the menu from the logged-in user's role)
 *
 * Distinct from support.service.ts (the older request form on /api/tickets). Tickets created from
 * the chat are ordinary support tickets, so they also appear in "Help & support > Your requests".
 */
import { api, API_BASE } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorage } from '../lib/auth-storage';
import { seenKey, type ChatAttachment, type ConversationPayload, type Lang, type SupportStatus, type TicketBrief, type ChatMessage } from '../lib/support-chat';

const P = '/support/chat';

export const supportChatService = {
  status: () => api.get<SupportStatus>(`${P}/status`),
  conversation: () => api.get<ConversationPayload>(`${P}/conversation`),
  setLanguage: (language: Lang) => api.post(`${P}/language`, { language }),
  select: (node: string) => api.post<ConversationPayload>(`${P}/select`, { node }),
  send: (body: string, attachment_ids: string[]) =>
    api.post<ConversationPayload>(`${P}/messages`, { body, attachment_ids }),
  escalate: () => api.post<ConversationPayload>(`${P}/escalate`),
  tickets: () => api.get<TicketBrief[]>(`${P}/tickets`),
  ticketDetail: (id: string) => api.get<{ ticket: TicketBrief; messages: ChatMessage[] }>(`${P}/tickets/${encodeURIComponent(id)}`),
  /** Last time this user had the chat open on this phone (device-local; not synced). */
  getSeen: async (userId?: string | null) => { try { return await AsyncStorage.getItem(seenKey(userId)); } catch { return null; } },
  setSeen: async (userId: string | null | undefined, iso: string) => { try { await AsyncStorage.setItem(seenKey(userId), iso); } catch { /* best effort */ } },
  upload: (file: { uri: string; name: string; type: string }) =>
    api.upload<ChatAttachment>(`${P}/attachments`, file),

  /**
   * Attachments are private. Ask the API for a short-lived (5 minute) signed link, then load the
   * image WITH the user's login: the link alone is not enough. The link request goes through the
   * normal client, so an expired access token is refreshed before the token is read.
   */
  async imageSource(attachmentId: string): Promise<{ uri: string; headers: Record<string, string> }> {
    const link = await api.get<{ path: string }>(`${P}/attachments/${encodeURIComponent(attachmentId)}/link`);
    const token = await authStorage.getAccessToken();
    return { uri: `${API_BASE}${link.path}`, headers: token ? { Authorization: `Bearer ${token}` } : {} };
  },
};
