import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { hospitalService, hospitalError } from '../services/hospital.service';
import { isMockOrder, type BackendPaymentOrder } from '../services/payments.service';
import { RazorpayCheckout, type RazorpaySuccess } from './RazorpayCheckout';
import type { BookingStatus } from '../types';

const STAGE: Record<string, string> = {
  left_patient_home: 'Left home', reached_hospital: 'Reached hospital', at_registration: 'At registration / queue',
  waiting_consultation: 'Waiting for consultation', consultation_in_progress: 'Consultation in progress', tests: 'Tests / investigations',
  collecting_reports: 'Collecting reports / prescription', returning_home: 'Returning home',
};
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * Family side: hospital visit report. If the visit ran over time the server answers 402 EXTRA_PAYMENT_DUE;
 * the customer pays the extra charge (its own Razorpay order) and the report then opens.
 * Renders nothing for other bookings (404/409), so it is safe to mount on every completed visit.
 */
export const HospitalReportCard: React.FC<{ bookingId: string; status: BookingStatus }> = ({ bookingId, status }) => {
  const [report, setReport] = useState<any>(null);
  const [due, setDue] = useState<{ total: string; minutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<BackendPaymentOrder | null>(null);
  const [checkout, setCheckout] = useState(false);

  const load = useCallback(() => {
    hospitalService.report(bookingId)
      .then((r) => { setReport(r); setDue(null); })
      .catch((e: any) => {
        const h = hospitalError(e);
        const body = e?.detail?.detail ?? e?.detail ?? {};
        if (e?.status === 402 && h.code === 'EXTRA_PAYMENT_DUE') setDue({ total: String(body.amount_inr), minutes: Number(body.overtime_minutes) });
      });
  }, [bookingId]);
  useEffect(() => { if (status === 'completed') load(); }, [status, load]);

  const verify = async (r: RazorpaySuccess) => {
    await hospitalService.extraVerify(bookingId, r);
    load();
  };

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const o = (await hospitalService.extraOrder(bookingId)) as unknown as BackendPaymentOrder;
      setOrder(o);
      if (isMockOrder(o)) {   // backend in mock mode (staging without live keys)
        await verify({ razorpay_order_id: o.razorpay_order_id, razorpay_payment_id: `pay_mock_${Math.random().toString(36).slice(2, 16)}`, razorpay_signature: `mock_${Math.random().toString(36).slice(2, 34)}` });
      } else {
        setCheckout(true);
      }
    } catch (e: any) {
      Alert.alert('Payment', hospitalError(e).message);
    } finally { setBusy(false); }
  };

  if (!report && !due) return null;
  if (!report && due) {
    return (
      <View style={s.warn} testID="hospital-extra-due">
        <Text style={s.title}>Payment pending</Text>
        <Text style={s.body}>Please pay the dues to be able to access the report. The visit ran {due.minutes} minutes over the included time: ₹{Number(due.total).toLocaleString('en-IN')} (incl. GST) is due.</Text>
        <TouchableOpacity style={s.btn} onPress={pay} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Pay ₹{Number(due.total).toLocaleString('en-IN')}</Text>}
        </TouchableOpacity>
        <RazorpayCheckout
          visible={checkout} order={order} description="Extra time charge"
          onSuccess={async (r) => { setCheckout(false); try { await verify(r); } catch (e: any) { Alert.alert('Payment', hospitalError(e).message); } }}
          onCancel={() => setCheckout(false)} onError={(m) => { setCheckout(false); Alert.alert('Payment failed', m); }}
        />
      </View>
    );
  }
  const sm = report.summary ?? {};
  return (
    <View style={s.box} testID="hospital-report">
      <Text style={s.title}>Hospital visit report</Text>
      <Text style={s.strong}>{report.hospital}</Text>
      <Text style={s.body}>{when(report.visit_start)} – {when(report.visit_end)}{report.total_minutes != null ? ` · ${Math.floor(report.total_minutes / 60)}h ${report.total_minutes % 60}m` : ''}</Text>
      {(report.journey ?? []).map((j: any, i: number) => (
        <Text key={i} style={s.body}>• {STAGE[j.stage] ?? j.stage} ({when(j.at)}){j.note ? ` — ${j.note}` : ''}</Text>
      ))}
      {(report.fares ?? []).length > 0 && <Text style={s.body}>Cab fares: {report.fares.map((f: any) => `${f.leg === 'to_hospital' ? 'To hospital' : 'Return'} ₹${f.amount}`).join(' · ')}</Text>}
      {sm.doctor_name ? <Text style={s.body}>Doctor: {sm.doctor_name}{sm.department ? ` (${sm.department})` : ''}</Text> : null}
      {sm.purpose ? <Text style={s.body}>Purpose: {sm.purpose}</Text> : null}
      {(sm.helped_with ?? []).length > 0 && <Text style={s.body}>Helped with: {sm.helped_with.join(', ')}</Text>}
      {sm.notes_for_family ? <Text style={[s.body, s.note]}>{sm.notes_for_family}</Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  box: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm, gap: 4 },
  warn: { backgroundColor: '#FFF7E0', borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm, gap: 6 },
  title: { ...Typography.h4, color: Colors.primaryDark },
  strong: { ...Typography.body, fontWeight: '700', color: Colors.primaryDark },
  body: { ...Typography.body, color: Colors.textSecondary },
  note: { marginTop: 6 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700' },
});
