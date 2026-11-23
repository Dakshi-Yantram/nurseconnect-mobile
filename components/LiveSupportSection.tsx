/**
 * "Live Support" block on Help & support (nurse + family). Read-only summary; the chat itself is app/support-chat.tsx.
 * Uses the existing /support/chat/status and /support/chat/tickets endpoints (no new API). Shown only when the build flag is on.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { supportChatService } from '../services/support-chat.service';
import {
  badgeText, isTicketActive, liveSupportAction, supportChatVisible, supportStatusText, unreadCount,
  type SupportStatus, type TicketBrief,
} from '../lib/support-chat';

const TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: Colors.warningBg, fg: Colors.warning },
  in_progress: { bg: Colors.infoBg, fg: Colors.primary },
  waiting_for_nurse: { bg: Colors.infoBg, fg: Colors.primary },
  resolved: { bg: Colors.successBg, fg: Colors.success },
  closed: { bg: Colors.surfaceAlt, fg: Colors.textSecondary },
};

export function LiveSupportSection() {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const userId = useStore((s) => s.user?.id);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [tickets, setTickets] = useState<TicketBrief[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const visible = supportChatVisible(role, process.env.EXPO_PUBLIC_SUPPORT_CHAT);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [s, t] = await Promise.all([supportChatService.status().catch(() => null), supportChatService.tickets()]);
      setStatus(s);
      setTickets(t);
      const active = t.find((x) => isTicketActive(x.status));
      if (active) {
        const [d, seen] = await Promise.all([supportChatService.ticketDetail(active.id), supportChatService.getSeen(userId)]);
        setUnread(unreadCount(d.messages, seen));
      } else setUnread(0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Refreshes every time the Help screen comes back into view (e.g. after closing the chat).
  useFocusEffect(useCallback(() => { if (visible) void load(); }, [visible, load]));

  if (!visible) return null;
  const active = tickets.find((x) => isTicketActive(x.status)) ?? null;
  const recent = tickets.slice(0, 3);
  const badge = badgeText(unread);

  return (
    <View style={styles.wrap} testID="live-support">
      <View style={styles.head}>
        <Text style={styles.title}>Live Support</Text>
        <Text style={[styles.online, { color: status?.online ? Colors.success : Colors.textTertiary }]}>{supportStatusText(status)}</Text>
      </View>
      <TouchableOpacity style={styles.card} onPress={() => router.push('/support-chat' as any)} testID="open-support-chat">
        <View style={styles.icon}><Ionicons name="chatbubbles" size={20} color="#fff" /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.cardTitle}>{liveSupportAction(active, tickets.length > 0)}</Text>
          <Text style={styles.sub}>{active ? `${active.ticket_ref} · ${active.status_label}` : 'Ask a question or raise a request'}</Text>
        </View>
        {!!badge && <View style={styles.badge} testID="support-unread-badge"><Text style={styles.badgeTxt}>{badge}</Text></View>}
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>
      {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />}
      {failed && (
        <TouchableOpacity onPress={load} testID="live-support-retry"><Text style={styles.err}>Could not load your conversations. Tap to retry.</Text></TouchableOpacity>
      )}
      {recent.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionLbl}>Your conversations</Text>
          {recent.map((t) => {
            const tone = TONE[t.status] ?? TONE.open;
            return (
              <TouchableOpacity key={t.id} style={styles.row} onPress={() => router.push('/support-chat' as any)} testID={`live-ticket-${t.id}`}>
                <Text style={styles.rowTxt} numberOfLines={1}>{t.ticket_ref} · {t.subject}</Text>
                <View style={[styles.chip, { backgroundColor: tone.bg }]}><Text style={[styles.chipTxt, { color: tone.fg }]}>{t.status_label}</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { ...Typography.h4, color: Colors.textPrimary },
  online: { ...Typography.caption },
  card: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#075E54', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  err: { ...Typography.small, color: Colors.danger, marginTop: 8 },
  sectionLbl: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowTxt: { ...Typography.small, color: Colors.textPrimary, flex: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  chipTxt: { ...Typography.caption, fontWeight: '700' },
});
