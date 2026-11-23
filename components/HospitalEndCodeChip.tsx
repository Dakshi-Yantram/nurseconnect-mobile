import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { hospitalService } from '../services/hospital.service';
import type { BookingStatus } from '../types';

/**
 * Family side of the Hospital Visit Companion: shows the END code while the visit is in progress.
 * Renders nothing for any other booking (the endpoint 404s / 409s), so it is safe to mount everywhere.
 */
export const HospitalEndCodeChip: React.FC<{ bookingId: string; status: BookingStatus }> = ({ bookingId, status }) => {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'in_progress') { setCode(null); return; }
    let cancelled = false;
    hospitalService.endCode(bookingId).then((r) => { if (!cancelled) setCode(r.end_code); }).catch(() => { if (!cancelled) setCode(null); });
    return () => { cancelled = true; };
  }, [bookingId, status]);
  if (!code) return null;
  return (
    <View style={s.box} testID="hospital-end-code">
      <Text style={s.title}>End-of-visit code</Text>
      <Text style={s.code}>{code}</Text>
      <Text style={s.hint}>Share this with the companion only when the hospital visit is finished and you are home.</Text>
    </View>
  );
};

const s = StyleSheet.create({
  box: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm, alignItems: 'center' },
  title: { ...Typography.small, color: Colors.textSecondary },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 8, color: Colors.primaryDark },
  hint: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
