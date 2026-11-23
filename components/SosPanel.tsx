/**
 * Nurse SOS + emergency-contact reminder.
 *
 * - Press SOS -> confirmation dialog -> (optional) foreground GPS -> POST /sos. Works with or without a visit.
 * - While the server says the SOS is active, the app shares its location every 15 s, IN THE FOREGROUND ONLY. It stops by itself when
 *   Operations resolves the incident (server answers 409 / /sos/active is null). There is no background tracking.
 * - A second tap returns the same incident (the server de-duplicates).
 * Messaging to contacts is shown honestly: "not sent" while SMS/WhatsApp are not approved, "test mode" on staging.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, AppState, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { nurseSafetyService } from '../services/nurse-safety.service';
import { runSos } from '../lib/sos-controller';
import {
  LOCATION_INTERVAL_MS, type SosView, canCancel, cancelMessage, deliveryLines, opsAlerted, reminderText, shouldShareLocation, sosHeadline, sosPhase,
} from '../lib/nurse-safety';

const GPS_TIMEOUT_MS = 8000;

async function currentPosition() {
  const p = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((r) => setTimeout(() => r(null), GPS_TIMEOUT_MS)),
  ]);
  if (!p) return null;
  return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_metres: p.coords.accuracy != null ? Math.round(p.coords.accuracy) : undefined };
}

export function SosPanel({ bookingId, compact = false }: { bookingId?: string; compact?: boolean }) {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const [sos, setSos] = useState<SosView | null>(null);
  const [missing, setMissing] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [lastShared, setLastShared] = useState<Date | null>(null);
  const [shareIssue, setShareIssue] = useState('');
  const sosRef = useRef<SosView | null>(null);
  sosRef.current = sos;

  const refresh = useCallback(async () => {
    try {
      const a = await nurseSafetyService.active();
      setSos((prev) => (a ?? (prev && sosPhase(prev) !== 'resolved' ? { ...prev, status: 'resolved', tracking_active: false } : prev)));
    } catch { /* keep what we have; the next tick retries */ }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role !== 'nurse') return;
      refresh();
      nurseSafetyService.contacts().then((c) => setMissing(c.missing_slots)).catch(() => {});
    }, [role, refresh]),
  );

  // While an SOS is active: poll the status and share the location (foreground only).
  const sharing = shouldShareLocation(sos);
  useEffect(() => {
    if (!sharing) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || AppState.currentState !== 'active') return;
      const cur = sosRef.current;
      if (!cur) return;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await currentPosition();
          if (pos) {
            await nurseSafetyService.postLocation(cur.id, pos);
            setLastShared(new Date()); setShareIssue('');
          } else setShareIssue('GPS is not available right now. Retrying.');
        } else setShareIssue('Location permission is off, so your location is not being shared.');
      } catch (e: any) {
        if (e?.response?.status === 409) { stopped = true; }  // incident resolved: stop sharing
        else setShareIssue('Could not share location. Retrying.');
      }
      await refresh();
    };
    tick();
    const t = setInterval(tick, LOCATION_INTERVAL_MS);
    return () => { stopped = true; clearInterval(t); };
  }, [sharing, refresh]);

  const press = async () => {
    setErr(''); setNote(''); setBusy(true);
    try {
      const out = await runSos({
        confirm: () => new Promise((resolve) =>
          Alert.alert('Send SOS?', 'This alerts NurseConnect Operations now and shares your location while the SOS is active. Your emergency contacts are messaged where this is enabled.',
            [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Send SOS', style: 'destructive', onPress: () => resolve(true) }], { cancelable: false })),
        requestLocationPermission: async () => ((await Location.requestForegroundPermissionsAsync()).status === 'granted' ? 'granted' : 'denied'),
        getPosition: currentPosition,
        send: (p) => nurseSafetyService.trigger(p),
      }, bookingId);
      if (out.kind === 'sent') {
        setSos(out.sos);
        if (out.duplicate) setNote('Your SOS is already active. Operations has it.');
        else if (out.location === 'permission_denied') setNote('SOS sent without location, because location permission is off.');
        else if (out.location === 'gps_unavailable') setNote('SOS sent. GPS was not available, so no location was shared yet.');
      } else if (out.kind === 'network_error' || out.kind === 'error') setErr(out.message);
    } finally { setBusy(false); }
  };

  const cancel = () => {
    const cur = sosRef.current;
    if (!cur) return;
    Alert.alert('Cancel this SOS?', 'Only do this if you pressed SOS by mistake and you are safe. Operations will be told it was cancelled.', [
      { text: 'Keep SOS active', style: 'cancel' },
      { text: 'Yes, cancel it', style: 'destructive', onPress: async () => {
        setBusy(true); setErr('');
        try { const out = await nurseSafetyService.cancel(cur.id, 'pressed_by_mistake'); setSos(out); setNote('SOS cancelled. Location sharing has stopped.'); }
        catch (e: any) { setErr(cancelMessage(e)); await refresh(); }
        finally { setBusy(false); }
      } },
    ]);
  };

  if (role !== 'nurse') return null;
  const phase = sosPhase(sos);
  const reminder = reminderText(missing);
  const lines = deliveryLines(sos?.deliveries);

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap} testID="sos-panel">
      {phase === 'none' || phase === 'resolved' ? (
        <>
          {!!reminder && (
            <TouchableOpacity style={styles.remind} onPress={() => router.push('/emergency-contacts' as any)} testID="sos-contacts-reminder">
              <Ionicons name="people-outline" size={16} color={Colors.warning} />
              <Text style={styles.remindTxt}>{reminder}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          )}
          {phase === 'resolved' && <Text style={styles.resolved} testID="sos-resolved">{sosHeadline(sos)}</Text>}
          <TouchableOpacity style={[styles.sosBtn, busy && { opacity: 0.6 }]} onPress={press} disabled={busy} testID="sos-button" accessibilityLabel="Send SOS">
            {busy ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="warning" size={18} color="#fff" /><Text style={styles.sosTxt}>SOS</Text></>)}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.active} testID="sos-active">
          <Text style={styles.activeTitle}>{sosHeadline(sos)}</Text>
          <Text style={styles.line}>{sharing ? (lastShared ? `Sharing your location. Last update ${lastShared.toLocaleTimeString()}` : 'Sharing your location…') : ''}</Text>
          {!!shareIssue && <Text style={styles.warn}>{shareIssue}</Text>}
          <Text style={styles.line}>{opsAlerted(sos?.deliveries) ? 'Operations alerted ✓' : 'Alerting Operations…'}</Text>
          {lines.map((l) => <Text key={l.key} style={styles.small}>{l.text}</Text>)}
          <Text style={styles.small}>Location is shared only while this app is open, and stops when Operations resolves the SOS.</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:108')} testID="sos-call-108"><Text style={styles.call}>Call 108 now</Text></TouchableOpacity>
          {canCancel(sos) && (
            <TouchableOpacity onPress={cancel} disabled={busy} testID="sos-cancel"><Text style={styles.cancel}>I pressed this by mistake</Text></TouchableOpacity>
          )}
        </View>
      )}
      {!!note && <Text style={styles.note} testID="sos-note">{note}</Text>}
      {!!err && (
        <View style={styles.errBox} testID="sos-error">
          <Text style={styles.errTxt}>{err}</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:108')}><Text style={styles.call}>Call 108</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 8 },
  wrapCompact: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: 8 },
  sosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.danger, borderRadius: Radius.lg, paddingVertical: 12 },
  sosTxt: { color: '#fff', fontWeight: '800' as const, fontSize: 16, letterSpacing: 1 },
  remind: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: 10 },
  remindTxt: { ...Typography.small, color: Colors.warning, flex: 1 },
  active: { backgroundColor: Colors.errorBg, borderRadius: Radius.lg, padding: 12, gap: 4, borderWidth: 1, borderColor: Colors.danger },
  activeTitle: { ...Typography.bodyBold, color: Colors.danger },
  line: { ...Typography.small, color: Colors.textPrimary },
  small: { ...Typography.caption, color: Colors.textSecondary },
  warn: { ...Typography.small, color: Colors.warning },
  resolved: { ...Typography.small, color: Colors.success },
  note: { ...Typography.small, color: Colors.textSecondary },
  cancel: { ...Typography.small, color: Colors.textSecondary, textDecorationLine: 'underline' as const, marginTop: 6 },
  call: { ...Typography.small, color: Colors.danger, fontWeight: '700' as const, marginTop: 4 },
  errBox: { backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: 10, gap: 4 },
  errTxt: { ...Typography.small, color: Colors.danger },
});
