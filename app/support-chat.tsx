/**
 * Support chat for nurses and family/patients.
 *
 * A WhatsApp-style chat backed by /api/support/chat/*. The conversation, the menu flow (the server
 * picks the nurse or the family menu from the logged-in role), tickets and admin replies all live
 * on the server, so history survives logout and reinstall. Nothing sensitive is stored on the device.
 * Replies from the support team appear while this screen is open (refreshed every 15 s) and when the
 * chat is opened again; the older "Help & support" request screens keep working unchanged.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { OfflineBanner } from '../components/OfflineBanner';
import { HelpVideoPanel } from '../components/HelpVideoPanel';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { supportChatService } from '../services/support-chat.service';
import {
  MAX_PENDING_ATTACHMENTS,
  UI_TEXT,
  activeOptionsMessageId,
  formatBytes,
  formatClock,
  isChatRole,
  isNetworkFailure,
  isTicketActive,
  latestMessageTime,
  markFailed,
  removeMessage,
  optimisticMessage,
  supportStatusText,
  uploadDescriptor,
  validateAttachment,
  type ChatAttachment,
  type ChatMessage,
  type ChatOption,
  type ConversationPayload,
  type Lang,
  type SupportStatus,
} from '../lib/support-chat';

const GREEN = '#075E54';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SupportChatScreen() {
  const role = useStore((s) => s.role);
  const userId = useStore((s) => s.user?.id);
  if (!isChatRole(role)) {
    return (
      <SafeAreaView style={styles.safe} testID="support-chat-unavailable">
        <View style={styles.centered}>
          <Text style={styles.errorTxt}>{UI_TEXT.en.notAvailable}</Text>
        </View>
      </SafeAreaView>
    );
  }
  // `key` resets every piece of state when a different user signs in.
  return <ChatScreen key={userId ?? 'me'} />;
}

function ChatScreen() {
  const router = useRouter();
  const userId = useStore((s) => s.user?.id);
  const isNurse = useStore((s) => s.role) === 'nurse';
  const [conv, setConv] = useState<ConversationPayload | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [viewer, setViewer] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const focused = useRef(false);
  const retryRef = useRef<Record<string, { text: string; ids: string[] }>>({});

  // Opening the chat (and every update while it is open) marks everything as read on this phone.
  useEffect(() => {
    const latest = latestMessageTime(conv?.messages);
    if (latest) void supportChatService.setSeen(userId, latest);
  }, [conv, userId]);

  const lang: Lang = conv?.language ?? 'en';
  const t = UI_TEXT[lang];

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([supportChatService.conversation(), supportChatService.status().catch(() => null)]);
      setConv(c);
      setStatus(s);
    } catch (e: any) {
      setLoadError(e?.message || UI_TEXT.en.failed);
    }
  }, []);

  // Load when the screen is first shown, and keep admin replies coming in while an active ticket exists.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
      };
    }, [load]),
  );

  const activeTicketId = conv?.active_ticket?.id ?? null;
  useEffect(() => {
    if (!activeTicketId) return;
    const id = setInterval(() => {
      if (!focused.current || busy || AppState.currentState !== 'active') return;
      supportChatService.conversation().then(setConv).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [activeTicketId, busy]);

  const optId = useMemo(() => (conv ? activeOptionsMessageId(conv.messages) : null), [conv]);
  // What the nurse last typed: used to pick the matching help video.
  const lastUserText = useMemo(
    () => [...(conv?.messages ?? [])].reverse().find((m) => m.sender === 'user' && !!m.body?.trim())?.body ?? '',
    [conv],
  );

  /** Show the user's bubble + typing dots right away; replace with the server's copy when it answers. */
  const runStep = async (userBubble: ChatMessage | null, call: () => Promise<ConversationPayload>, minTyping = 650) => {
    if (busy) return;
    setBusy(true);
    if (userBubble) setConv((c) => (c ? { ...c, messages: [...c.messages, userBubble] } : c));
    setTyping(true);
    try {
      const [next] = await Promise.all([call(), sleep(minTyping)]);
      setConv(next);
    } catch (e: any) {
      if (userBubble && isNetworkFailure(e)) {
        // Keep the person's text on screen with a retry action instead of losing it.
        setConv((c) => (c ? { ...c, messages: markFailed(c.messages, userBubble.id) } : c));
      } else {
        Alert.alert('', e?.message || t.sendFailed);
        try {
          setConv(await supportChatService.conversation());
        } catch {
          /* keep what we have */
        }
      }
    } finally {
      setTyping(false);
      setBusy(false);
    }
  };

  const sendDraft = async () => {
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    const ids = pending.map((p) => p.id);
    const bubble = optimisticMessage(text || '📎', pending);
    setDraft('');
    setPending([]);
    retryRef.current[bubble.id] = { text, ids };
    await runStep(bubble, () => supportChatService.send(text, ids), 450);
  };

  /** Tap on a failed bubble: drop it and send the same text again (a new bubble appears while sending). */
  const retry = async (id: string) => {
    const r = retryRef.current[id];
    if (!r || busy) return;
    setConv((c) => (c ? { ...c, messages: removeMessage(c.messages, id) } : c));
    delete retryRef.current[id];
    const bubble = optimisticMessage(r.text || '📎', []);
    retryRef.current[bubble.id] = r;
    await runStep(bubble, () => supportChatService.send(r.text, r.ids), 450);
  };

  const onOption = async (o: ChatOption) => {
    if (busy) return;
    if (o.id === 'escalate') {
      if (draft.trim() || pending.length) await sendDraft();
      await runStep(null, () => supportChatService.escalate(), 700);
      return;
    }
    await runStep(optimisticMessage(o.label), () => supportChatService.select(o.id));
  };

  const goBack = async () => {
    if (conv && conv.current_node !== 'menu') {
      await runStep(optimisticMessage(t.back), () => supportChatService.select('back'));
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/support' as any);
  };

  const toMenu = () => runStep(optimisticMessage(t.menu), () => supportChatService.select('menu'));

  const toggleLanguage = async () => {
    const next: Lang = lang === 'en' ? 'hi' : 'en';
    try {
      await supportChatService.setLanguage(next);
      setConv((c) => (c ? { ...c, language: next } : c));
      await runStep(null, () => supportChatService.select('menu'), 300);
    } catch (e: any) {
      Alert.alert('', e?.message || t.sendFailed);
    }
  };

  const pickPhoto = async () => {
    if (uploading || busy) return;
    if (pending.length >= MAX_PENDING_ATTACHMENTS) {
      Alert.alert('', t.tooMany);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    const err = validateAttachment({ size: a.fileSize, mimeType: a.mimeType, name: a.fileName }, lang);
    if (err) {
      Alert.alert('', err);
      return;
    }
    setUploading(true);
    try {
      const up = await supportChatService.upload(
        uploadDescriptor({ uri: a.uri, size: a.fileSize, mimeType: a.mimeType, name: a.fileName }),
      );
      setPending((p) => [...p, up]);
    } catch (e: any) {
      Alert.alert('', e?.message || t.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const openAttachment = async (a: ChatAttachment) => {
    if (!a.content_type.startsWith('image/')) {
      Alert.alert('', t.pdfWebOnly);
      return;
    }
    try {
      setViewer(await supportChatService.imageSource(a.id));
    } catch (e: any) {
      Alert.alert('', e?.message || t.sendFailed);
    }
  };

  const online = !!status?.online;
  const ticket = conv?.active_ticket ?? null;
  const canSend = !busy && !uploading && (draft.trim().length > 0 || pending.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="support-chat-screen">
      <OfflineBanner />
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.hBtn} accessibilityLabel={t.back} testID="support-chat-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={styles.hTitle} numberOfLines={1}>
            {t.title}
          </Text>
          <View style={styles.hStatusRow} testID="support-chat-status">
            <View style={[styles.dot, { backgroundColor: online ? '#6EE7B7' : '#CBD5E1' }]} />
            <Text style={styles.hStatus}>{typing ? t.typing : supportStatusText(status, lang)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={toMenu} style={styles.hBtn} accessibilityLabel={t.menu} testID="support-chat-menu">
          <Ionicons name="home-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleLanguage} style={styles.hBtn} accessibilityLabel={t.language} testID="support-chat-language">
          <Ionicons name="language-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/support' as any)}
          style={styles.hBtn}
          accessibilityLabel={t.tickets}
          testID="support-chat-tickets"
        >
          <Ionicons name="list-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.emergency} onPress={() => Linking.openURL('tel:108')} testID="support-chat-emergency">
        <Ionicons name="call" size={14} color={Colors.danger} />
        <Text style={styles.emergencyTxt}>{t.emergency}</Text>
      </TouchableOpacity>

      {ticket && isTicketActive(ticket.status) && (
        <TouchableOpacity
          style={styles.ticketBar}
          onPress={() => router.push({ pathname: '/support/ticket/[id]', params: { id: ticket.id } } as any)}
          testID="support-chat-active-ticket"
        >
          <Ionicons name="ticket-outline" size={16} color={GREEN} />
          <Text style={styles.ticketBarTxt} numberOfLines={1}>
            {t.openTicket} {ticket.ticket_ref} · {ticket.status_label}
          </Text>
          <Text style={styles.ticketBarLink}>{t.viewTicket}</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {!conv ? (
          <View style={styles.centered}>
            {loadError ? (
              <>
                <Text style={styles.errorTxt}>{loadError}</Text>
                <TouchableOpacity onPress={load} style={styles.retry} testID="support-chat-retry">
                  <Text style={styles.retryTxt}>{t.retry}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator color={GREEN} />
                <Text style={styles.loadingTxt}>{t.loading}</Text>
              </>
            )}
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {conv.messages.map((m) => (
              <Bubble key={m.id} m={m} lang={lang} showOptions={m.id === optId && !busy} onOption={onOption} onOpenAttachment={openAttachment} onRetry={retry} />
            ))}
            {typing && (
              <View style={[styles.row, { justifyContent: 'flex-start' }]}>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <Text style={styles.typingTxt}>{t.typing}</Text>
                </View>
              </View>
            )}
            {/* Nurses: asks English / Telugu, then shows the matching YouTube help video. */}
            {isNurse && <HelpVideoPanel query={lastUserText} testID="support-chat-video-help" />}
          </ScrollView>
        )}

        {/* composer */}
        {conv && (
          <View style={styles.composerWrap}>
            {pending.length > 0 && (
              <View style={styles.pendingRow}>
                {pending.map((p) => (
                  <View key={p.id} style={styles.chip}>
                    <Ionicons name="image-outline" size={14} color={GREEN} />
                    <Text style={styles.chipTxt} numberOfLines={1}>
                      {p.filename} · {formatBytes(p.size_bytes)}
                    </Text>
                    <TouchableOpacity onPress={() => setPending((x) => x.filter((y) => y.id !== p.id))} hitSlop={8}>
                      <Ionicons name="close" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.composer}>
              <TouchableOpacity onPress={pickPhoto} style={styles.iconBtn} accessibilityLabel={t.attach} testID="support-chat-attach" disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color={GREEN} /> : <Ionicons name="attach" size={22} color={GREEN} />}
              </TouchableOpacity>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t.placeholder}
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
                multiline
                maxLength={4000}
                testID="support-chat-input"
              />
              <TouchableOpacity
                onPress={sendDraft}
                disabled={!canSend}
                style={[styles.sendBtn, { opacity: canSend ? 1 : 0.4 }]}
                accessibilityLabel="Send"
                testID="support-chat-send"
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* photo viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBg}>
          {viewer && <ExpoImage source={{ uri: viewer.uri, headers: viewer.headers }} style={styles.viewerImg} contentFit="contain" />}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)} accessibilityLabel={t.close} testID="support-chat-viewer-close">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Bubble({
  m,
  lang,
  showOptions,
  onOption,
  onOpenAttachment,
  onRetry,
}: {
  m: ChatMessage;
  lang: Lang;
  showOptions: boolean;
  onOption: (o: ChatOption) => void;
  onOpenAttachment: (a: ChatAttachment) => void;
  onRetry: (id: string) => void;
}) {
  const mine = m.sender === 'user';
  const system = m.sender === 'system';
  if (system) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemTxt}>{m.body}</Text>
      </View>
    );
  }
  return (
    <View>
      <View style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleBot]}>
          {m.sender === 'admin' && <Text style={styles.adminTag}>{UI_TEXT[lang].support}</Text>}
          <Text style={styles.bubbleTxt}>{m.body}</Text>
          {m.attachments?.map((a) => (
            <TouchableOpacity key={a.id} onPress={() => onOpenAttachment(a)} style={styles.attach} testID={`support-chat-attachment-${a.id}`}>
              <Ionicons name={a.content_type.startsWith('image/') ? 'image-outline' : 'document-outline'} size={16} color={GREEN} />
              <Text style={styles.attachTxt} numberOfLines={1}>
                {a.filename} · {formatBytes(a.size_bytes)}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.time}>{formatClock(m.created_at)}</Text>
          {m.failed && (
            <TouchableOpacity onPress={() => onRetry(m.id)} testID={`support-chat-retry-${m.id}`}>
              <Text style={styles.failed}>Not sent. Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {showOptions && m.options && m.options.length > 0 && (
        <View style={styles.options}>
          {m.options.map((o) => (
            <TouchableOpacity key={o.id} style={styles.optionBtn} onPress={() => onOption(o)} testID={`support-chat-option-${o.id}`}>
              <Text style={styles.optionTxt}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ECE5DD' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, paddingHorizontal: 6, paddingVertical: 8 },
  hBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  hStatus: { color: '#fff', opacity: 0.9, fontSize: 11.5, marginLeft: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emergency: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.errorBg, paddingVertical: 6 },
  emergencyTxt: { color: Colors.danger, fontSize: 12, fontWeight: '600' },
  ticketBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D9FDD3', paddingHorizontal: Spacing.md, paddingVertical: 8 },
  ticketBarTxt: { flex: 1, color: GREEN, fontSize: 12.5, fontWeight: '600' },
  ticketBarLink: { color: GREEN, fontSize: 12, textDecorationLine: 'underline' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: { ...Typography.body, color: Colors.danger, textAlign: 'center' },
  loadingTxt: { ...Typography.small, color: Colors.textSecondary, marginTop: 8 },
  retry: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: GREEN },
  retryTxt: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  bubbleMine: { backgroundColor: '#D9FDD3', borderTopRightRadius: 2 },
  bubbleBot: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 2 },
  bubbleTxt: { ...Typography.body, color: Colors.textPrimary },
  adminTag: { fontSize: 11, fontWeight: '700', color: GREEN, marginBottom: 2 },
  typingTxt: { ...Typography.small, color: Colors.textSecondary },
  time: { alignSelf: 'flex-end', fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  failed: { fontSize: 11, color: Colors.danger, marginTop: 3, fontWeight: '700' },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingVertical: 4 },
  attachTxt: { flex: 1, fontSize: 12.5, color: GREEN, textDecorationLine: 'underline' },
  systemRow: { alignSelf: 'center', backgroundColor: '#FFF3C4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginVertical: 6, maxWidth: '90%' },
  systemTxt: { fontSize: 12, color: '#5B4A00', textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 6 },
  optionBtn: { backgroundColor: '#FFFFFF', borderColor: GREEN, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  optionTxt: { color: GREEN, fontSize: 13.5, fontWeight: '600' },
  composerWrap: { backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  chipTxt: { fontSize: 12, color: Colors.textPrimary, maxWidth: 200 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: Colors.textPrimary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
});
