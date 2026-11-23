import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { GradientButton } from './GradientButton';
import { RazorpayCheckout, type RazorpaySuccess } from './RazorpayCheckout';
import { isMockOrder } from '../services/payments.service';
import {
  visitExtensionsService,
  extErr,
  type ExtensionOrder,
  type ExtensionState,
} from '../services/visit-extensions.service';
import { formatTime, inr } from '../lib/format';
import { useStore } from '../store';

/**
 * Family-side card shown while a visit is in progress.
 *   • live countdown + "Extend this visit?" prompt in the last 10 minutes
 *   • pay for +30 min (Razorpay), then read the Extension OTP to the nurse
 *   • the End Visit OTP the nurse needs to close the visit
 * Renders nothing when the backend feature flag is off (config -> 404).
 */
interface Props {
  bookingId: string;
  status: string;
  careTitle?: string;
}

const endLabel = (iso: string) => {
  const d = new Date(iso);
  return formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
};

const mmss = (secs: number) => {
  const s = Math.max(0, secs);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const VisitExtensionCard: React.FC<Props> = ({ bookingId, status, careTitle }) => {
  const user = useStore((s) => s.user);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<ExtensionState | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<ExtensionOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [endOtp, setEndOtp] = useState<string | null>(null);
  const [endBusy, setEndBusy] = useState(false);
  const inFlight = useRef(false);
  const active = status === 'in_progress';

  const load = useCallback(async () => {
    try {
      const s = await visitExtensionsService.state(bookingId);
      setState(s);
      setLeft(s.remaining_seconds);
    } catch {
      /* transient — keep the last state */
    }
  }, [bookingId]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    visitExtensionsService
      .config()
      .then((c) => {
        if (alive && c) {
          setEnabled(true);
          load();
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [active, load]);

  // Poll for the server's view (extension paid on another device, nurse OTP, …).
  useEffect(() => {
    if (!enabled || !active) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [enabled, active, load]);

  // Local 1-second countdown between polls.
  useEffect(() => {
    if (!enabled || !active || left === null) return;
    const t = setInterval(() => setLeft((v) => (v === null ? v : v - 1)), 1000);
    return () => clearInterval(t);
  }, [enabled, active, left === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !enabled || !state) return null;

  const offer = state.offer;
  const promptNow =
    showPrompt && !state.extension_otp && (state.pending_extension || state.prompt_extension || (left !== null && left <= 600));

  const settle = async (r: RazorpaySuccess) => {
    try {
      await visitExtensionsService.verifyPayment(bookingId, r);
      setCheckoutOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not confirm payment', extErr(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const payAndExtend = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const created = await visitExtensionsService.request(bookingId);
      setOrder(created);
      if (isMockOrder(created)) {
        await settle({
          razorpay_order_id: created.razorpay_order_id,
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).slice(2, 16)}`,
          razorpay_signature: `mock_${Math.random().toString(36).slice(2, 34)}`,
        });
        return;
      }
      setCheckoutOpen(true);
    } catch (e: any) {
      inFlight.current = false;
      setBusy(false);
      Alert.alert('Could not start payment', extErr(e));
    }
  };

  const declineExtension = async () => {
    try {
      await visitExtensionsService.cancel(bookingId);
    } catch {
      /* nothing unpaid to drop */
    }
    setShowPrompt(false);
    load();
  };

  const showEndOtp = async () => {
    setEndBusy(true);
    try {
      const c = await visitExtensionsService.completion(bookingId);
      setEndOtp(c.end_otp);
    } catch (e: any) {
      Alert.alert('Could not get the code', extErr(e));
    } finally {
      setEndBusy(false);
    }
  };

  return (
    <View testID="visit-extension-card">
      {/* ------------------------------------------------ progress ---- */}
      <View style={styles.progress}>
        <Text style={styles.progTitle}>Visit in progress</Text>
        <Text style={styles.timer}>{left !== null && left > 0 ? `${mmss(left)} remaining` : 'Visit time is up'}</Text>
        <Text style={styles.progSub}>
          {state.total_minutes} min total
          {state.extended_minutes > 0 ? ` (${state.scheduled_minutes} + ${state.extended_minutes} extension)` : ''}
          {state.end_time ? ` · ends ${endLabel(state.end_time)}` : ''}
        </Text>
      </View>

      {/* ------------------------------------- extension OTP (paid) --- */}
      {!!state.extension_otp && (
        <View style={styles.okBox} testID="extension-otp-box">
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={styles.okTitle}>Extension approved</Text>
          </View>
          <Text style={styles.hint}>Payment for the extension is completed.</Text>
          <Text style={styles.big}>+{state.extension_otp_for?.minutes ?? offer.minutes} minutes added to this visit</Text>
          <Text style={styles.label}>Extension OTP</Text>
          <Text style={styles.code}>{state.extension_otp}</Text>
          <Text style={styles.hint}>
            Share this extension OTP with the nurse. The nurse must enter it on her app to continue the visit.
          </Text>
        </View>
      )}

      {/* ------------------------------------------ extend prompt ----- */}
      {promptNow && (
        <View style={styles.prompt} testID="extension-prompt">
          <Ionicons name="time-outline" size={34} color={Colors.primary} style={{ alignSelf: 'center' }} />
          <Text style={styles.promptTitle}>
            {left !== null && left > 0 ? `${Math.max(1, Math.ceil(left / 60))} minutes remaining` : 'Visit time is up'}
          </Text>
          {state.end_time ? (
            <Text style={[styles.hint, { textAlign: 'center' }]}>
              Your visit is scheduled to end at {endLabel(state.end_time)}.
            </Text>
          ) : null}
          <View style={styles.more}>
            <Ionicons name="add-circle" size={26} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTitle}>Need more time?</Text>
              <Text style={styles.hint}>Add {offer.minutes} minutes to your visit.</Text>
            </View>
          </View>
          <GradientButton
            title={`Approve & Pay ${inr(offer.amount)} — add ${offer.minutes} minutes`}
            onPress={payAndExtend}
            loading={busy}
            testID="extend-pay"
          />
          <GradientButton
            title="Finish on time"
            variant="outline"
            onPress={declineExtension}
            style={{ marginTop: Spacing.sm }}
            testID="extend-decline"
          />
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTxt}>• Only a paying customer can approve an extension.</Text>
              <Text style={styles.noteTxt}>• Nurse availability is required.</Text>
              <Text style={styles.noteTxt}>• The extension of {offer.minutes} minutes begins after payment confirmation.</Text>
              <Text style={styles.noteTxt}>• Payment must be completed before the visit report can be reviewed or downloaded.</Text>
            </View>
          </View>
        </View>
      )}

      {/* ---------------------------------------------- end OTP ------ */}
      <View style={styles.endBox}>
        {endOtp ? (
          <>
            <Text style={styles.label}>End Visit OTP</Text>
            <Text style={styles.code} testID="end-otp-code">{endOtp}</Text>
            <Text style={styles.hint}>Give this to the nurse when the visit is finished. It is used to close the visit.</Text>
          </>
        ) : (
          <TouchableOpacity style={styles.row} onPress={showEndOtp} disabled={endBusy} testID="show-end-otp">
            {endBusy ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="key-outline" size={16} color={Colors.primary} />
            )}
            <Text style={styles.link}>Show the End Visit OTP (for when the visit is finished)</Text>
          </TouchableOpacity>
        )}
      </View>

      <RazorpayCheckout
        visible={checkoutOpen}
        order={order}
        description={`Visit extension · ${careTitle ?? ''}`.trim()}
        prefill={{ name: user?.name || undefined, email: user?.email || undefined, contact: user?.phone || undefined }}
        onSuccess={settle}
        onCancel={() => {
          setCheckoutOpen(false);
          inFlight.current = false;
          setBusy(false);
        }}
        onError={(m) => {
          setCheckoutOpen(false);
          inFlight.current = false;
          setBusy(false);
          Alert.alert('Payment failed', m);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  progress: { alignItems: 'center', paddingVertical: Spacing.md },
  progTitle: { ...Typography.h4, color: Colors.textPrimary },
  timer: { ...Typography.h2, color: Colors.primary, fontWeight: '800' as const, marginTop: 4 },
  progSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  okBox: { backgroundColor: Colors.success + '18', borderRadius: Radius.md, padding: 14, marginTop: Spacing.sm },
  okTitle: { ...Typography.h4, color: Colors.success },
  big: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' as const, marginTop: 8 },
  prompt: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.divider },
  promptTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center', marginVertical: 6 },
  more: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 12, marginVertical: Spacing.sm },
  moreTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  note: { flexDirection: 'row', gap: 6, backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: 10, marginVertical: Spacing.sm },
  noteTxt: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 16 },
  endBox: { marginTop: Spacing.md, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.bgApp },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { ...Typography.small, color: Colors.primary, flex: 1, fontWeight: '600' as const },
  label: { ...Typography.caption, color: Colors.textTertiary, marginTop: 8 },
  code: { ...Typography.h2, color: Colors.textPrimary, fontWeight: '800' as const, letterSpacing: 6, marginVertical: 4 },
  hint: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
});
