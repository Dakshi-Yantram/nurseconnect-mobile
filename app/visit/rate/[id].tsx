/**
 * Consumer: after a finished visit.
 *   Step 1  rate the nurse with stars (no write-up needed)
 *   Step 2  feedback about NurseConnect itself (optional comment; may agree to publish it)
 *   Then    optional link to leave a public Google Play review
 * Nurse rating: POST /visits/{id}/rating (one per visit). Platform feedback: POST /bookings/{id}/platform-feedback.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Switch, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../../components/Header';
import { GradientButton } from '../../../components/GradientButton';
import { InputField } from '../../../components/InputField';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../constants/theme';
import { visitsService } from '../../../services/visits.service';

const LABELS = ['Poor', 'Below average', 'Good', 'Very good', 'Excellent'];
type Status = Awaited<ReturnType<typeof visitsService.feedbackStatus>>;
type Step = 'loading' | 'nurse' | 'platform' | 'thanks';

const msg = (e: any, fallback: string) => {
  const d = e?.detail?.detail ?? e?.detail;
  return d?.message || e?.message || fallback;
};
const code = (e: any) => (e?.detail?.detail ?? e?.detail)?.code;

function Stars({ value, onChange, prefix }: { value: number; onChange: (n: number) => void; prefix: string }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} testID={`${prefix}-star-${n}`} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
          <MaterialCommunityIcons name={n <= value ? 'star' : 'star-outline'} size={40} color={Colors.warning} style={{ marginHorizontal: 4 }} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RateVisit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [status, setStatus] = useState<Status | null>(null);
  const [nurse, setNurse] = useState(0);
  const [plat, setPlat] = useState(0);
  const [comment, setComment] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    visitsService.feedbackStatus(id).then((s) => {
      setStatus(s);
      setPlayUrl(s.play_store_url);
      if (!s.eligible) { setError('You can rate once the visit is finished.'); setStep('thanks'); return; }
      setStep(s.has_nurse && !s.nurse_rated ? 'nurse' : s.platform_feedback_enabled && !s.platform_rated ? 'platform' : 'thanks');
    }).catch((e) => { setError(msg(e, 'Could not load. Please try again.')); setStep('thanks'); });
  }, [id]);

  const submitNurse = async () => {
    if (!id) return;
    if (nurse < 1) { setError('Please tap a star rating.'); return; }
    setError(''); setBusy(true);
    try {
      await visitsService.submitRating(id, nurse);
    } catch (e: any) {
      if (code(e) !== 'ALREADY_RATED') { setError(msg(e, 'Could not save your rating. Please try again.')); setBusy(false); return; }
    }
    setBusy(false);
    setStep(status?.platform_feedback_enabled && !status.platform_rated ? 'platform' : 'thanks');
  };

  const submitPlatform = async () => {
    if (!id) return;
    if (plat < 1) { setError('Please tap a star rating.'); return; }
    setError(''); setBusy(true);
    try {
      const r = await visitsService.submitPlatformFeedback(id, { rating: plat, comment: comment.trim() || undefined, allow_publish: publish && comment.trim().length > 0 });
      if (r.play_store_url) setPlayUrl(r.play_store_url);
    } catch (e: any) {
      if (code(e) !== 'ALREADY_SUBMITTED') { setError(msg(e, 'Could not save your feedback. Please try again.')); setBusy(false); return; }
    }
    setBusy(false);
    setStep('thanks');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="rate-visit-screen">
      <Header title={step === 'platform' ? 'About NurseConnect' : 'Rate your nurse'} fallbackHref={`/visit/${id || ''}`} />
      <View style={{ padding: Spacing.lg }}>
        <View style={styles.card}>
          {step === 'loading' && <ActivityIndicator color={Colors.primary} />}

          {step === 'nurse' && (
            <>
              <Text style={styles.title}>How was your nurse?</Text>
              <Text style={styles.sub}>Tap a star. It takes a second and helps us keep care quality high.</Text>
              <Stars value={nurse} onChange={(n) => { setNurse(n); setError(''); }} prefix="nurse" />
              {nurse > 0 && <Text style={styles.ratingLabel}>{LABELS[nurse - 1]}</Text>}
              {!!error && <Text style={styles.errorTxt}>{error}</Text>}
              <GradientButton title="Submit rating" onPress={submitNurse} loading={busy} style={{ marginTop: Spacing.md }} testID="submit-rating" />
            </>
          )}

          {step === 'platform' && (
            <>
              <Text style={styles.title}>How was NurseConnect?</Text>
              <Text style={styles.sub}>Booking, payment and the service overall.</Text>
              <Stars value={plat} onChange={(n) => { setPlat(n); setError(''); }} prefix="platform" />
              <InputField
                label="Anything we could do better? (optional)"
                placeholder="Your comment…"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              {comment.trim().length > 0 && (
                <View style={styles.consent}>
                  <Switch value={publish} onValueChange={setPublish} />
                  <Text style={styles.consentTxt}>NurseConnect may publish my comment (first name and last initial only).</Text>
                </View>
              )}
              {!!error && <Text style={styles.errorTxt}>{error}</Text>}
              <GradientButton title="Submit" onPress={submitPlatform} loading={busy} style={{ marginTop: Spacing.md }} testID="submit-platform-feedback" />
              <TouchableOpacity onPress={() => setStep('thanks')} style={{ marginTop: Spacing.md, alignItems: 'center' }}>
                <Text style={styles.skip}>Skip</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'thanks' && (
            <>
              <Text style={styles.title}>{error ? 'Nothing to rate yet' : 'Thank you!'}</Text>
              <Text style={styles.sub}>{error || 'Your feedback has been recorded.'}</Text>
              {!error && !!playUrl && Platform.OS === 'android' && (
                <TouchableOpacity style={styles.playBtn} onPress={() => Linking.openURL(playUrl).catch(() => Alert.alert('Could not open Google Play'))} testID="play-review">
                  <Text style={styles.playTxt}>Also review us on Google Play</Text>
                </TouchableOpacity>
              )}
              <GradientButton title="Done" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.card, ...Shadows.card },
  title: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  sub: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: Spacing.lg },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.sm },
  ratingLabel: { ...Typography.bodyBold, color: Colors.warning, textAlign: 'center', marginTop: 10, marginBottom: Spacing.lg },
  errorTxt: { ...Typography.small, color: Colors.danger, marginTop: 8, textAlign: 'center' },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.sm },
  consentTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  skip: { ...Typography.bodyBold, color: Colors.textSecondary },
  playBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: Spacing.sm },
  playTxt: { color: Colors.primary, fontWeight: '700' },
});
