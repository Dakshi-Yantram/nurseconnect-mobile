/**
 * Hospital Visit Companion — the companion's step-by-step flow (design screens 1-10).
 * All numbers (earnings, included time, advance) come from the server; nothing is hardcoded here.
 * Backend: /api/bookings/{id}/hospital/* (staging flag). Start OTP uses the existing visits endpoint.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { OTPInput } from '../../components/OTPInput';
import { api } from '../../lib/api';
import { hospitalError, hospitalService, type HospitalStatus, type JourneyStage } from '../../services/hospital.service';

type Phase = 'checklist' | 'start' | 'journey' | 'receipts' | 'end' | 'summary' | 'done';

const CHECKLIST = [
  'I have read the job details and confirm I can reach on time',
  'I will maintain patient privacy and dignity',
  'I will not perform any medical procedures',
  'I understand transport advance will be given after the start OTP',
  'I will upload cab receipts after the visit',
  'I have emergency contact number saved',
];
const STAGES: { id: JourneyStage; label: string; hint: string; icon: any }[] = [
  { id: 'left_patient_home', label: 'Left patient’s home', hint: 'Tap when you leave', icon: 'car-outline' },
  { id: 'reached_hospital', label: 'Reached hospital', hint: 'Tap when you reach', icon: 'location-outline' },
  { id: 'at_registration', label: 'At registration / queue', hint: 'Tap to update', icon: 'document-text-outline' },
  { id: 'waiting_consultation', label: 'Waiting for consultation', hint: 'Tap to update', icon: 'time-outline' },
  { id: 'consultation_in_progress', label: 'Consultation in progress', hint: 'Tap to update', icon: 'medkit-outline' },
  { id: 'tests', label: 'Tests / investigations', hint: 'Tap to update', icon: 'flask-outline' },
  { id: 'collecting_reports', label: 'Collecting reports / prescription', hint: 'Tap to update', icon: 'clipboard-outline' },
  { id: 'returning_home', label: 'Returning home', hint: 'Tap when you start return journey', icon: 'home-outline' },
];
const HELPED = ['Registration / token', 'Queues / navigation', 'Attended consultation', 'Collected reports / prescription', 'Returned patient home safely'];
const EXPERIENCE = [
  { id: 'smooth', label: 'Smooth and on time' }, { id: 'some_waiting', label: 'Some waiting time' }, { id: 'long_waiting', label: 'Long waiting time' },
] as const;

const inr = (v?: string | number | null) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);
const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

export default function HospitalVisitScreen() {
  const router = useRouter();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<HospitalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [checklistDone, setChecklistDone] = useState(false);
  const [local, setLocal] = useState<'journey' | 'receipts' | 'end'>('journey');
  const [otp, setOtp] = useState('');
  const [note, setNote] = useState('');
  const [fare, setFare] = useState<{ to_hospital: string; return: string }>({ to_hospital: '', return: '' });
  const [thumb, setThumb] = useState<{ to_hospital?: string; return?: string }>({});
  const [form, setForm] = useState({ doctor_name: '', department: '', purpose: '', notes_for_family: '' });
  const [helped, setHelped] = useState<string[]>([]);
  const [experience, setExperience] = useState<'smooth' | 'some_waiting' | 'long_waiting'>('smooth');
  const [endResult, setEndResult] = useState<{ total_minutes: number; overtime_minutes: number; your_earning_inr: string } | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      setS(await hospitalService.status(bookingId));
    } catch (e: any) {
      setErr(hospitalError(e).message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);

  const cab = s?.transport_option === 'cab_by_nurseconnect';
  const receiptLegs = new Set((s?.receipts ?? []).map((r) => r.leg));
  const phase: Phase = !s ? 'checklist'
    : !s.visit_started_at ? (checklistDone ? 'start' : 'checklist')
    : s.ended_at ? (s.summary_submitted ? 'done' : 'summary')
    : local;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e: any) { setErr(hospitalError(e).message); } finally { setBusy(false); }
  };

  // ── Step 3: start with the family's OTP (existing endpoint, GPS-checked server-side) ──
  const startVisit = () => run(async () => {
    if (otp.length < 4) throw { message: 'Enter the 4-digit start code.' };
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') throw { message: 'Location permission is required to start the visit.' };
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await api.post(`/visits/${bookingId}/verify-start-otp`, {
      otp: otp.trim(), latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      accuracy_m: typeof loc.coords.accuracy === 'number' ? loc.coords.accuracy : undefined,
      captured_at: new Date(loc.timestamp || Date.now()).toISOString(),
    });
    setOtp(''); await load();
  });

  const postStage = (stage: JourneyStage) => run(async () => { await hospitalService.journey(bookingId!, stage, note); setNote(''); await load(); });

  const pickReceipt = (leg: 'to_hospital' | 'return') => run(async () => {
    const amount = fare[leg].trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) throw { message: 'Enter the fare shown on the receipt first.' };
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw { message: 'Photo permission is required to attach the receipt.' };
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const res = await hospitalService.uploadReceipt(bookingId!, leg, amount, { uri: a.uri, name: `receipt-${leg}.jpg`, type: a.mimeType || 'image/jpeg' });
    setThumb((t) => ({ ...t, [leg]: a.uri }));
    if (Number(res.fares_above_advance_inr) > 0) Alert.alert('Fare above advance', 'Your fares are above the advance. Please inform NurseConnect before booking the return ride.');
    await load();
  });

  const endVisit = () => run(async () => { setEndResult(await hospitalService.end(bookingId!, otp)); setOtp(''); await load(); });
  const submitSummary = () => run(async () => {
    await hospitalService.submitSummary(bookingId!, { ...form, helped_with: helped, experience });
    await load();
  });

  if (loading) return <SafeAreaView style={st.center}><ActivityIndicator color={Colors.primary} /></SafeAreaView>;
  if (!s) return (
    <SafeAreaView style={st.center}>
      <Text style={st.h1}>Not a hospital visit</Text>
      <Text style={st.sub}>{err || 'This booking has no hospital details yet, or the feature is not switched on.'}</Text>
      <Btn label="Go back" onPress={() => router.back()} />
    </SafeAreaView>
  );

  const adv = s.advance_status;
  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={Colors.primary} /></TouchableOpacity>

        {phase === 'checklist' && (<>
          <Text style={st.h1}>Hospital Visit Companion</Text>
          <View style={st.card}>
            <Row icon="business-outline" k="Hospital" v={`${s.hospital}${s.hospital_address ? `\n${s.hospital_address}` : ''}\n${s.distance_km} km (one way)`} />
            <Row icon="car-outline" k="Transport" v={cab ? `Round-trip cab included\nNurseConnect will transfer ${inr(s.advance_inr)} advance after start OTP` : 'Family arranges transport'} />
            <View style={st.earn}><Text style={st.small}>Your earnings</Text>
              <Text style={st.big}>{inr(s.terms.base_inr)} <Text style={st.small}>(up to {s.terms.included_minutes / 60} hrs)</Text></Text>
              <Text style={st.small}>+ {inr(s.terms.overtime_per_min_inr)}/min for additional time</Text></View>
          </View>
          <Text style={st.h2}>Before you start</Text>
          {CHECKLIST.map((t, i) => (
            <TouchableOpacity key={t} style={st.check} onPress={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}>
              <Ionicons name={checks[i] ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={checks[i] ? Colors.primary : Colors.textTertiary} />
              <Text style={st.checkTxt}>{t}</Text>
            </TouchableOpacity>
          ))}
          <Btn label="Confirm & continue" disabled={!checks.every(Boolean)} onPress={() => setChecklistDone(true)} />
        </>)}

        {phase === 'start' && (<>
          <Text style={st.h1}>Start Visit at Patient’s Home</Text>
          <Text style={st.sub}>Ask the patient or authorized person for the start OTP.</Text>
          <OTPInput length={4} value={otp} onChange={setOtp} />
          <Btn label="Start visit" busy={busy} onPress={startVisit} />
        </>)}

        {(phase === 'journey' || phase === 'receipts' || phase === 'end') && (
          <View style={st.ok}><Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={st.okTxt}>Visit started {clock(s.visit_started_at)}</Text></View>
        )}
        {cab && phase !== 'checklist' && phase !== 'start' && phase !== 'summary' && phase !== 'done' && (
          <View style={st.info}><Text style={st.checkTxt}>
            {adv === 'paid' ? `Transport advance ${inr(s.advance_inr)} has been paid to you. Use it for cab fares.`
              : `Transport advance ${inr(s.advance_inr)} is being arranged by NurseConnect. Book the first cab only after you receive it.`}
          </Text></View>
        )}

        {phase === 'journey' && (<>
          <Text style={st.h1}>Journey and hospital updates</Text>
          {STAGES.map((g) => {
            const done = s.journey.some((j) => j.stage === g.id);
            return (
              <TouchableOpacity key={g.id} style={[st.stage, done && st.stageDone]} disabled={busy} onPress={() => postStage(g.id)}>
                <Ionicons name={g.icon} size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}><Text style={st.checkTxt}>{g.label}</Text><Text style={st.small}>{done ? `Updated ${clock(s.journey.filter((j) => j.stage === g.id).slice(-1)[0].at)}` : g.hint}</Text></View>
                {done && <Ionicons name="checkmark" size={18} color={Colors.success} />}
              </TouchableOpacity>
            );
          })}
          <Text style={st.label}>Notes (optional)</Text>
          <TextInput style={[st.input, { height: 70 }]} multiline value={note} onChangeText={setNote} placeholder="E.g. Waiting time is around 30 minutes." />
          <Btn label={cab ? 'Continue to receipts' : 'Continue to end visit'} onPress={() => setLocal(cab ? 'receipts' : 'end')} />
        </>)}

        {phase === 'receipts' && (<>
          <Text style={st.h1}>Transport Receipts</Text>
          <Text style={st.sub}>Please upload screenshots or photos of cab receipts.</Text>
          {(['to_hospital', 'return'] as const).map((leg) => (
            <View key={leg} style={st.card}>
              <Text style={st.h2}>{leg === 'to_hospital' ? 'Trip to hospital' : 'Return trip'} (mandatory)</Text>
              {receiptLegs.has(leg) ? (
                <View style={st.rowC}>{thumb[leg] ? <Image source={{ uri: thumb[leg] }} style={st.thumb} /> : null}
                  <Text style={st.checkTxt}>Uploaded · {inr(s.receipts.find((r) => r.leg === leg)?.amount)}</Text></View>
              ) : (<>
                <TextInput style={st.input} keyboardType="decimal-pad" placeholder="Fare in ₹ (as on receipt)" value={fare[leg]} onChangeText={(v) => setFare((f) => ({ ...f, [leg]: v }))} />
                <Btn label="Add receipt" busy={busy} onPress={() => pickReceipt(leg)} />
              </>)}
            </View>
          ))}
          <Btn label="Continue" disabled={!(receiptLegs.has('to_hospital') && receiptLegs.has('return'))} onPress={() => setLocal('end')} />
        </>)}

        {phase === 'end' && (<>
          <Text style={st.h1}>End Visit</Text>
          <Text style={st.sub}>Ask the patient or authorized person for the end OTP.</Text>
          <OTPInput length={4} value={otp} onChange={setOtp} />
          <Btn label="End visit" busy={busy} onPress={endVisit} />
        </>)}

        {phase === 'summary' && (<>
          <View style={st.ok}><Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={st.okTxt}>Visit completed {clock(s.ended_at)}{endResult ? ` · Total ${Math.floor(endResult.total_minutes / 60)}h ${endResult.total_minutes % 60}m` : ''}</Text></View>
          {s.overtime_minutes > 0 && <View style={st.info}><Text style={st.checkTxt}>Overtime recorded: {s.overtime_minutes} min. Your earning for this visit: {inr(s.your_earning_inr)}</Text></View>}
          <Text style={st.h1}>Visit Summary</Text>
          <Text style={st.sub}>Please share key details about the visit.</Text>
          <Field label="Doctor’s name" value={form.doctor_name} onChange={(v) => setForm({ ...form, doctor_name: v })} />
          <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
          <Field label="Purpose of visit" value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} />
          <Text style={st.h2}>What you helped with</Text>
          {HELPED.map((h) => (
            <TouchableOpacity key={h} style={st.check} onPress={() => setHelped((x) => (x.includes(h) ? x.filter((y) => y !== h) : [...x, h]))}>
              <Ionicons name={helped.includes(h) ? 'checkbox' : 'square-outline'} size={22} color={helped.includes(h) ? Colors.primary : Colors.textTertiary} />
              <Text style={st.checkTxt}>{h}</Text>
            </TouchableOpacity>
          ))}
          <Text style={st.h2}>Overall experience</Text>
          {EXPERIENCE.map((x) => (
            <TouchableOpacity key={x.id} style={st.check} onPress={() => setExperience(x.id)}>
              <Ionicons name={experience === x.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={Colors.primary} />
              <Text style={st.checkTxt}>{x.label}</Text>
            </TouchableOpacity>
          ))}
          <Field label="Notes for family (optional)" multiline value={form.notes_for_family} onChange={(v) => setForm({ ...form, notes_for_family: v })} />
          <Btn label="Submit Visit Summary" busy={busy} onPress={submitSummary} />
        </>)}

        {phase === 'done' && (<>
          <View style={{ alignItems: 'center', marginTop: Spacing.xl }}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
            <Text style={st.h1}>Visit Summary Submitted</Text>
            <Text style={st.sub}>Thank you for completing the visit.</Text>
          </View>
          <View style={st.card}>
            <Row icon="business-outline" k="Hospital" v={s.hospital} />
            <Row icon="time-outline" k="Time" v={`${clock(s.visit_started_at)} – ${clock(s.ended_at)}`} />
            {cab && <Row icon="car-outline" k="Cab receipts" v={`${s.receipts.length} uploaded`} />}
            <Row icon="cash-outline" k="Your earning" v={inr(s.your_earning_inr)} />
          </View>
          <View style={st.info}><Text style={st.small}>NurseConnect will review the details. Your final payment will be processed after verification.</Text></View>
          <Btn label="Go to Home" onPress={() => router.replace('/(nurse)/assignments')} />
        </>)}

        {!!err && <Text style={st.err}>{err}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const Btn = ({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) => (
  <TouchableOpacity style={[st.btn, (disabled || busy) && { opacity: 0.5 }]} disabled={disabled || busy} onPress={onPress}>
    {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>{label}</Text>}
  </TouchableOpacity>
);
const Row = ({ icon, k, v }: { icon: any; k: string; v: string }) => (
  <View style={st.row}><Ionicons name={icon} size={20} color={Colors.primary} /><View style={{ flex: 1 }}><Text style={st.small}>{k}</Text><Text style={st.checkTxt}>{v}</Text></View></View>
);
const Field = ({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) => (
  <View><Text style={st.label}>{label}</Text><TextInput style={[st.input, multiline && { height: 80 }]} multiline={multiline} value={value} onChangeText={onChange} /></View>
);

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.bgApp },
  pad: { padding: Spacing.screen, paddingBottom: 60, gap: Spacing.sm },
  h1: { ...Typography.h3, color: Colors.primaryDark, marginTop: Spacing.sm },
  h2: { ...Typography.bodyBold, color: Colors.primaryDark, marginTop: Spacing.sm },
  sub: { ...Typography.body, color: Colors.textSecondary },
  small: { ...Typography.small, color: Colors.textSecondary },
  big: { ...Typography.h4, color: Colors.primaryDark },
  label: { ...Typography.small, color: Colors.textSecondary, marginTop: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  rowC: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  earn: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: Spacing.md },
  check: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', paddingVertical: 6 },
  checkTxt: { ...Typography.body, color: Colors.textPrimary, flexShrink: 1 },
  stage: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  stageDone: { borderColor: Colors.success, backgroundColor: Colors.successBg },
  ok: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: Spacing.md },
  okTxt: { ...Typography.bodyBold, color: Colors.success, flexShrink: 1 },
  info: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: Spacing.md },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, ...Typography.body, textAlignVertical: 'top' },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  btnTxt: { color: '#fff', ...Typography.bodyBold },
  err: { color: Colors.danger, ...Typography.body, marginTop: Spacing.sm },
});
