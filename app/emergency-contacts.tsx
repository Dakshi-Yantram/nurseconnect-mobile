/**
 * Emergency contacts (nurse). Two independent cards: each saves on its own, so one bad number never loses the other.
 * Optional for now: a reminder is shown elsewhere until both are saved; nothing is blocked.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { nurseSafetyService } from '../services/nurse-safety.service';
import {
  SLOTS, type ContactForm, type ContactsPayload, type FormErrors, type Slot,
  emptyForm, formFromContact, hasErrors, reminderText, serverMessage, validateContactForm, e164,
} from '../lib/nurse-safety';

type CardState = { form: ContactForm; errors: FormErrors; saving: boolean; msg: string; ok: boolean };
const blank = (): CardState => ({ form: emptyForm(), errors: {}, saving: false, msg: '', ok: false });

export default function EmergencyContactsScreen() {
  const role = useStore((s) => s.role);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState<ContactsPayload | null>(null);
  const [cards, setCards] = useState<Record<Slot, CardState>>({ 1: blank(), 2: blank() });

  const apply = useCallback((p: ContactsPayload, keepMsgFor?: Slot) => {
    setData(p);
    setCards((prev) => {
      const next = { ...prev };
      for (const s of SLOTS) {
        const c = p.contacts.find((x) => x.slot === s);
        next[s] = { ...prev[s], form: formFromContact(c), errors: {}, saving: false, msg: s === keepMsgFor ? prev[s].msg : '', ok: s === keepMsgFor ? prev[s].ok : false };
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      apply(await nurseSafetyService.contacts());
    } catch (e) {
      setLoadError(serverMessage(e, 'Could not load your emergency contacts. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (slot: Slot, patch: Partial<ContactForm>) =>
    setCards((p) => ({ ...p, [slot]: { ...p[slot], form: { ...p[slot].form, ...patch }, msg: '', ok: false } }));

  const otherNumber = (slot: Slot) => {
    const o = data?.contacts.find((c) => c.slot !== slot);
    return o ? e164(o.country_code, o.phone) : null;
  };

  const save = async (slot: Slot) => {
    const card = cards[slot];
    const errors = validateContactForm(card.form, otherNumber(slot));
    if (hasErrors(errors)) {
      setCards((p) => ({ ...p, [slot]: { ...p[slot], errors, msg: 'Please fix the highlighted fields.', ok: false } }));
      return;
    }
    setCards((p) => ({ ...p, [slot]: { ...p[slot], errors: {}, saving: true, msg: '', ok: false } }));
    try {
      const res = await nurseSafetyService.saveContact(slot, card.form);
      setCards((p) => ({ ...p, [slot]: { ...p[slot], msg: 'Saved.', ok: true } }));
      apply(res, slot);
      setCards((p) => ({ ...p, [slot]: { ...p[slot], msg: 'Saved.', ok: true, saving: false } }));
    } catch (e) {
      setCards((p) => ({ ...p, [slot]: { ...p[slot], saving: false, ok: false, msg: serverMessage(e) } }));
    }
  };

  const remove = (slot: Slot) =>
    Alert.alert('Remove this contact?', 'They will no longer be alerted if you press SOS.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { apply(await nurseSafetyService.deleteContact(slot)); }
          catch (e) { setCards((p) => ({ ...p, [slot]: { ...p[slot], ok: false, msg: serverMessage(e, 'Could not remove. Try again.') } })); }
        },
      },
    ]);

  if (role !== 'nurse') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Emergency contacts" />
        <Text style={styles.muted}>Emergency contacts are for care professionals.</Text>
      </SafeAreaView>
    );
  }
  const reminder = reminderText(data?.missing_slots);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="emergency-contacts-screen">
      <OfflineBanner />
      <Header title="Emergency contacts" fallbackHref="/(nurse)/profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            If you press SOS, NurseConnect Operations is alerted first. Your contacts get a short message with your name and the time only. No patient details and no location.
          </Text>
          {loading ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} /> : null}
          {!!loadError && (
            <View style={styles.errBox}>
              <Text style={styles.errTxt}>{loadError}</Text>
              <TouchableOpacity onPress={load} testID="contacts-retry"><Text style={styles.link}>Try again</Text></TouchableOpacity>
            </View>
          )}
          {!loading && !loadError && !!reminder && (
            <View style={styles.remind} testID="contacts-reminder"><Ionicons name="alert-circle" size={18} color={Colors.warning} /><Text style={styles.remindTxt}>{reminder}</Text></View>
          )}
          {!loading && !loadError && SLOTS.map((slot) => {
            const c = cards[slot];
            const saved = !!data?.contacts.find((x) => x.slot === slot);
            return (
              <View key={slot} style={styles.card} testID={`contact-card-${slot}`}>
                <Text style={styles.cardTitle}>Emergency contact {slot}{saved ? '  ✓' : ''}</Text>
                <Field label="Full name" value={c.form.full_name} error={c.errors.full_name} onChangeText={(v) => set(slot, { full_name: v })} testID={`contact-${slot}-name`} />
                <Field label="Relationship" value={c.form.relationship} error={c.errors.relationship} onChangeText={(v) => set(slot, { relationship: v })} testID={`contact-${slot}-relationship`} placeholder="e.g. Mother" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 90 }}><Field label="Code" value={c.form.country_code} error={c.errors.country_code} onChangeText={(v) => set(slot, { country_code: v })} keyboardType="phone-pad" testID={`contact-${slot}-cc`} /></View>
                  <View style={{ flex: 1 }}><Field label="Mobile number" value={c.form.phone} error={c.errors.phone} onChangeText={(v) => set(slot, { phone: v })} keyboardType="phone-pad" testID={`contact-${slot}-phone`} /></View>
                </View>
                {!!c.msg && <Text style={[styles.msg, { color: c.ok ? Colors.success : Colors.danger }]} testID={`contact-${slot}-msg`}>{c.msg}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
                  <TouchableOpacity style={[styles.btn, c.saving && { opacity: 0.6 }]} disabled={c.saving} onPress={() => save(slot)} testID={`contact-${slot}-save`}>
                    {c.saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Save contact {slot}</Text>}
                  </TouchableOpacity>
                  {saved && <TouchableOpacity onPress={() => remove(slot)} testID={`contact-${slot}-remove`}><Text style={[styles.link, { color: Colors.danger }]}>Remove</Text></TouchableOpacity>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(p: { label: string; value: string; error?: string; onChangeText: (v: string) => void; keyboardType?: any; placeholder?: string; testID?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{p.label}</Text>
      <TextInput style={[styles.input, !!p.error && { borderColor: Colors.danger }]} value={p.value} onChangeText={p.onChangeText}
        keyboardType={p.keyboardType} placeholder={p.placeholder} placeholderTextColor={Colors.textTertiary} autoCorrect={false} testID={p.testID} />
      {!!p.error && <Text style={styles.fieldErr}>{p.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  muted: { ...Typography.body, color: Colors.textSecondary, padding: Spacing.lg },
  intro: { ...Typography.small, color: Colors.textSecondary, lineHeight: 19, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginBottom: Spacing.md, ...Shadows.card },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 10 },
  label: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, backgroundColor: Colors.bgApp },
  fieldErr: { ...Typography.caption, color: Colors.danger, marginTop: 3 },
  msg: { ...Typography.small, marginTop: 4 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 11, paddingHorizontal: 18, minWidth: 140, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' as const },
  link: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  remind: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.warningBg, padding: 12, borderRadius: Radius.md, marginBottom: Spacing.md },
  remindTxt: { ...Typography.small, color: Colors.warning, flex: 1 },
  errBox: { backgroundColor: Colors.errorBg, padding: 12, borderRadius: Radius.md, gap: 6 },
  errTxt: { ...Typography.small, color: Colors.danger },
});
