import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { GradientButton } from './GradientButton';
import {
  visitExtensionsService,
  extErr,
  type CompletionState,
} from '../services/visit-extensions.service';
import { visitsService } from '../services/visits.service';
import { inr } from '../lib/format';

/**
 * "Visit Completed" panel: service, actual duration (with extension), whether
 * the report is unlocked (it stays locked until every due payment is
 * complete), download, and "Book Follow-up Visit".
 * Renders nothing when the backend feature flag is off.
 */
interface Props {
  bookingId: string;
  completed: boolean;
  /** Called with the finished state so the parent can hide its own un-gated report block. */
  onState?: (s: CompletionState | null) => void;
}

export const VisitCompletionCard: React.FC<Props> = ({ bookingId, completed, onState }) => {
  const router = useRouter();
  const [state, setState] = useState<CompletionState | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await visitExtensionsService.completion(bookingId);
      setState(s);
      onState?.(s);
    } catch {
      setState(null); // flag off (404) or transient — parent falls back to its normal report block
      onState?.(null);
    }
  }, [bookingId, onState]);

  useEffect(() => {
    if (completed) load();
  }, [completed, load]);

  if (!completed || !state) return null;

  const download = async () => {
    setDownloading(true);
    try {
      const r = await visitsService.getReportPdfLink(bookingId, 'consumer');
      await Linking.openURL(r.pdf_url);
    } catch (e: any) {
      Alert.alert('Could not download report', extErr(e));
    } finally {
      setDownloading(false);
    }
  };

  const fu = state.follow_up;
  const bookFollowUp = () =>
    router.push({
      pathname: '/booking',
      params: { packageId: fu.package_id ?? '', followUpOf: fu.follow_up_of_booking_id },
    });

  return (
    <View style={styles.card} testID="visit-completion-card">
      <View style={styles.head}>
        <Ionicons name="checkmark-circle" size={44} color={Colors.success} />
        <Text style={styles.title}>Visit Completed</Text>
        <Text style={styles.sub}>
          {state.report_unlocked ? 'Your visit is completed and the summary is ready.' : 'Your visit is completed.'}
        </Text>
      </View>

      <Row label="Service" value={state.service_name ?? 'Home nursing visit'} />
      <Row
        label="Actual duration"
        value={
          state.extended_minutes > 0
            ? `${state.actual_minutes} minutes (${state.scheduled_minutes} + ${state.extended_minutes} extension)`
            : `${state.actual_minutes} minutes`
        }
      />
      <Row label="Visit summary" value={state.summary_ready ? 'Ready' : 'Being prepared'} />

      {state.report_unlocked ? (
        <View style={[styles.banner, { backgroundColor: Colors.success + '18' }]}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={[styles.bannerTxt, { color: Colors.success }]}>All payments completed — report unlocked</Text>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: Colors.warning + '22' }]} testID="report-locked">
          <Ionicons name="lock-closed" size={18} color={Colors.warning} />
          <Text style={[styles.bannerTxt, { color: Colors.textPrimary }]}>
            Report access is unlocked only after all due payment is completed
            {state.due_amount > 0 ? ` (${inr(state.due_amount)} due)` : ''}.
          </Text>
        </View>
      )}

      <GradientButton
        title="Download Report"
        variant="outline"
        disabled={!state.report_unlocked}
        loading={downloading}
        onPress={download}
        style={{ marginTop: Spacing.md }}
        testID="completion-download"
      />
      {fu.available && (
        <GradientButton
          title={`Book Follow-up Visit (${fu.window_days} Days)`}
          variant="outline"
          onPress={bookFollowUp}
          style={{ marginTop: Spacing.sm }}
          testID="book-follow-up"
        />
      )}
      {state.end_otp_used && (
        <Text style={styles.footer}>The visit was closed with the End Visit OTP.</Text>
      )}
    </View>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowL}>{label}</Text>
    <Text style={styles.rowV}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.card, marginBottom: Spacing.md },
  head: { alignItems: 'center', marginBottom: Spacing.md },
  title: { ...Typography.h3, color: Colors.textPrimary, marginTop: 6 },
  sub: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 12 },
  rowL: { ...Typography.small, color: Colors.textSecondary },
  rowV: { ...Typography.small, color: Colors.textPrimary, fontWeight: '700' as const, flex: 1, textAlign: 'right' },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: Radius.md, padding: 12, marginTop: Spacing.md },
  bannerTxt: { ...Typography.small, flex: 1, lineHeight: 18 },
  footer: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.md },
});
