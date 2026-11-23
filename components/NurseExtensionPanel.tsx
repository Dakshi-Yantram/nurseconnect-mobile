import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { OTPInput } from './OTPInput';
import { GradientButton } from './GradientButton';
import {
  visitExtensionsService,
  extErr,
  type WorkerExtensionStatus,
} from '../services/visit-extensions.service';
import { formatTime } from '../lib/format';

const endLabel = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
};

const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Nurse side of the timed-visit flow (shown while the visit is in progress).
 * Renders nothing when the backend feature flag is off.
 *   • live countdown ("50:00 / 60:00")
 *   • "family has been asked to extend" notice in the last minutes
 *   • waiting-for-payment notice, then "Extension approved" + 6-digit Extension OTP
 *   • updated end time / total duration after an extension
 *   • 6-digit End Visit OTP (required before the visit can be ended)
 */
interface Props {
  bookingId: string;
  /** enabled=false => feature off; endVerified gates the "End visit" button. */
  onStatus?: (s: { enabled: boolean; endVerified: boolean }) => void;
}

export const NurseExtensionPanel: React.FC<Props> = ({ bookingId, onStatus }) => {
  const [enabled, setEnabled] = useState(false);
  const [st, setSt] = useState<WorkerExtensionStatus | null>(null);
  const [extOtp, setExtOtp] = useState('');
  const [endOtp, setEndOtp] = useState('');
  const [busy, setBusy] = useState<'ext' | 'end' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cfg, setCfg] = useState({ extensionMinutes: 30, promptMinutes: 10 });

  const load = useCallback(async () => {
    try {
      const s = await visitExtensionsService.workerStatus(bookingId);
      setSt(s);
      onStatus?.({ enabled: true, endVerified: s.end_otp_verified });
    } catch {
      /* keep last state */
    }
  }, [bookingId, onStatus]);

  useEffect(() => {
    let alive = true;
    visitExtensionsService
      .config()
      .then((c) => {
        if (!alive) return;
        if (c) {
          setEnabled(true);
          setCfg({
            extensionMinutes: c.extension_minutes || 30,
            promptMinutes: c.prompt_minutes || 10,
          });
          load();
        } else {
          onStatus?.({ enabled: false, endVerified: true });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [load, onStatus]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [enabled, load]);

  // 1-second tick for the countdown.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  if (!enabled || !st) return null;

  const submitExt = async () => {
    setBusy('ext');
    try {
      const r = await visitExtensionsService.verifyExtensionOtp(bookingId, extOtp);
      setExtOtp('');
      Alert.alert('Extension started', `+${r.added_minutes} minutes added to this visit.`);
      await load();
    } catch (e: any) {
      Alert.alert('Code not accepted', extErr(e));
    } finally {
      setBusy(null);
    }
  };

  const submitEnd = async () => {
    setBusy('end');
    try {
      await visitExtensionsService.verifyEndOtp(bookingId, endOtp);
      setEndOtp('');
      await load();
    } catch (e: any) {
      Alert.alert('Code not accepted', extErr(e));
    } finally {
      setBusy(null);
    }
  };

  const scheduled = st.total_minutes - st.extended_minutes;
  const endMs = st.end_time ? new Date(st.end_time).getTime() : NaN;
  const remaining = Number.isFinite(endMs) ? Math.max(0, Math.round((endMs - now) / 1000)) : null;
  const totalSecs = st.total_minutes * 60;
  const elapsed = remaining == null ? 0 : Math.max(0, totalSecs - remaining);
  const progress = remaining == null || totalSecs <= 0 ? 0 : Math.min(1, elapsed / totalSecs);
  const lastMinutes = remaining != null && remaining <= cfg.promptMinutes * 60;
  const nearEnd =
    lastMinutes && (remaining ?? 0) > 0 &&
    !st.extension_otp_required && !st.extension_payment_pending && !st.end_otp_verified;

  return (
    <View style={styles.card} testID="nurse-extension-panel">
      <Text style={styles.title}>Visit in progress</Text>

      {remaining != null && (
        <View style={styles.timerWrap}>
          <View style={[styles.ring, lastMinutes && styles.ringWarn]}>
            <Text style={styles.timerBig}>{clock(remaining)}</Text>
            <Text style={styles.timerSub}>remaining</Text>
            <Text style={styles.timerSmall}>
              {clock(elapsed)} / {clock(totalSecs)}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(progress * 100)}%` },
                lastMinutes && { backgroundColor: Colors.warning },
              ]}
            />
          </View>
          <Text style={styles.hint}>
            {remaining === 0 ? 'Scheduled time is up · ' : ''}ends {endLabel(st.end_time)}
          </Text>
        </View>
      )}

      {nearEnd && (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.noteTxt}>
            The family has been asked if they want to extend by {cfg.extensionMinutes} minutes.
            Nothing changes unless they approve and pay.
          </Text>
        </View>
      )}

      {st.extension_payment_pending && (
        <View style={[styles.note, { backgroundColor: Colors.warning + '18' }]}>
          <Ionicons name="hourglass-outline" size={16} color={Colors.warning} />
          <Text style={styles.noteTxt}>
            The family is completing payment for the extension. Wait for the Extension OTP.
          </Text>
        </View>
      )}

      {st.extension_otp_required && (
        <View style={[styles.block, styles.approved]}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={styles.label}>Extension approved</Text>
          </View>
          <Text style={styles.hint}>
            Payment for the extension is completed. Ask the family for the extension OTP and enter
            it to add {cfg.extensionMinutes} minutes and continue the visit.
          </Text>
          <OTPInput value={extOtp} onChange={setExtOtp} length={6} testID="ext-otp-input" />
          <View style={{ height: Spacing.sm }} />
          <GradientButton
            title="Confirm & continue visit"
            onPress={submitExt}
            loading={busy === 'ext'}
            disabled={extOtp.length < 6}
            testID="ext-otp-submit"
          />
        </View>
      )}

      {st.extended_minutes > 0 && !st.extension_otp_required && (
        <View style={[styles.note, styles.added]}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTxt, { fontWeight: '700' as const }]}>
              +{st.extended_minutes} minutes added to this visit
            </Text>
            <Text style={styles.noteTxt}>Updated end time: {endLabel(st.end_time)}</Text>
            <Text style={styles.noteTxt}>
              Total duration: {st.total_minutes} minutes ({scheduled} + {st.extended_minutes})
            </Text>
          </View>
        </View>
      )}

      <View style={styles.block}>
        <Text style={styles.label}>End visit</Text>
        {st.end_otp_verified ? (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={[styles.noteTxt, { color: Colors.success }]}>
              Accepted — you can now end the visit.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              When care is finished, ask the family for the 6-digit end OTP and enter it. It is
              required before you can end the visit.
            </Text>
            <View style={styles.sum}>
              <Text style={styles.noteTxt}>
                Total duration: {st.total_minutes} minutes
                {st.extended_minutes > 0 ? ` (${scheduled} + ${st.extended_minutes} extension)` : ''}
              </Text>
              <Text style={styles.noteTxt}>Visit end time: {endLabel(st.end_time)}</Text>
            </View>
            <OTPInput value={endOtp} onChange={setEndOtp} length={6} testID="end-otp-input" />
            <View style={{ height: Spacing.sm }} />
            <GradientButton
              title="Confirm end OTP"
              variant="outline"
              onPress={submitEnd}
              loading={busy === 'end'}
              disabled={endOtp.length < 6}
              testID="end-otp-submit"
            />
          </>
        )}
      </View>
      {busy && <ActivityIndicator size="small" color={Colors.primary} />}
    </View>
  );
};

/**
 * Completed-visit card for the nurse (mirrors the family's "Visit completed"
 * screen): real duration including any paid extension, summary status, and
 * the payment-gated report note. Falls back to report numbers if the feature
 * is off.
 */
export const NurseCompletedSummary: React.FC<{
  bookingId: string;
  serviceName?: string | null;
  actualMinutes?: number | null;
  summaryReady: boolean;
}> = ({ bookingId, serviceName, actualMinutes, summaryReady }) => {
  const [extended, setExtended] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    visitExtensionsService
      .workerStatus(bookingId)
      .then((s) => {
        if (!alive) return;
        setExtended(s.extended_minutes);
        setTotal(s.total_minutes);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bookingId]);
  const actual = actualMinutes ?? total;
  return (
    <View style={styles.doneCard} testID="nurse-completed-summary">
      {!!serviceName && (
        <View style={styles.doneRow}>
          <Text style={styles.doneKey}>Service</Text>
          <Text style={styles.doneVal}>{serviceName}</Text>
        </View>
      )}
      {actual != null && (
        <View style={styles.doneRow}>
          <Text style={styles.doneKey}>Actual duration</Text>
          <Text style={styles.doneVal}>
            {actual} minutes
            {extended > 0 ? ` (${Math.max(0, actual - extended)} + ${extended} extension)` : ''}
          </Text>
        </View>
      )}
      <View style={styles.doneRow}>
        <Text style={styles.doneKey}>Visit summary</Text>
        <Text style={styles.doneVal}>{summaryReady ? 'Ready' : 'Not written'}</Text>
      </View>
      <View style={[styles.note, { marginTop: Spacing.sm }]}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
        <Text style={styles.noteTxt}>
          The family can open the report only after all payments due for this visit (including any
          extension) are completed.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.card, marginBottom: Spacing.md },
  title: { ...Typography.h4, color: Colors.textPrimary },
  block: { marginTop: Spacing.md },
  approved: { backgroundColor: Colors.success + '12', borderRadius: Radius.md, padding: Spacing.md },
  label: { ...Typography.small, color: Colors.textPrimary, fontWeight: '700' as const, marginBottom: 6 },
  hint: { ...Typography.small, color: Colors.textSecondary, marginBottom: 6 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 10, marginTop: Spacing.sm },
  added: { backgroundColor: Colors.success + '18' },
  noteTxt: { ...Typography.small, color: Colors.textPrimary, flex: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sum: { backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: 10, marginBottom: 8, gap: 2 },
  timerWrap: { alignItems: 'center', marginTop: Spacing.md },
  ring: {
    width: 148, height: 148, borderRadius: 74, borderWidth: 9, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.infoBg,
  },
  ringWarn: { borderColor: Colors.warning, backgroundColor: Colors.warning + '14' },
  timerBig: { fontSize: 28, fontWeight: '800' as const, color: Colors.primaryDark },
  timerSub: { ...Typography.small, color: Colors.textSecondary },
  timerSmall: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  barTrack: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden', marginTop: Spacing.md },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  doneCard: { alignSelf: 'stretch', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg, gap: 8 },
  doneRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  doneKey: { ...Typography.small, color: Colors.textSecondary },
  doneVal: { ...Typography.small, color: Colors.textPrimary, fontWeight: '700' as const, flexShrink: 1, textAlign: 'right' },
});
