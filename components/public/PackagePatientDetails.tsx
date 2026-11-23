import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import type { PackagePatientDetails } from '../../services/public.service';

/**
 * "Not included" (red box) and the collapsible "Visit duration & extension"
 * block from the package details design. "What's included" is rendered by the
 * screen itself, from the same data.
 */
export const NotIncludedBox: React.FC<{ items: string[] }> = ({ items }) => (
  <View style={s.notBox} testID="not-included">
    <View style={s.row}>
      <Ionicons name="close-circle" size={18} color={Colors.danger} />
      <Text style={s.notTitle}>Not included</Text>
    </View>
    {items.map((t, i) => (
      <Text key={`${i}-${t}`} style={s.notItem}>• {t}</Text>
    ))}
  </View>
);

export const VisitDurationBox: React.FC<{ d: NonNullable<PackagePatientDetails['visit_duration_and_extension']> }> = ({ d }) => {
  const [open, setOpen] = useState(true);
  return (
    <View style={s.durBox} testID="visit-duration">
      <TouchableOpacity style={s.row} onPress={() => setOpen((v) => !v)} accessibilityRole="button">
        <Ionicons name="time-outline" size={18} color={Colors.primary} />
        <Text style={s.durTitle}>Visit duration & extension</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.durItem}>• {d.summary}</Text>
          {d.rules.map((r, i) => (
            <Text key={`${i}-${r}`} style={s.durItem}>• {r}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notBox: { backgroundColor: Colors.errorBg, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.md },
  notTitle: { ...Typography.bodyBold, color: Colors.danger },
  notItem: { ...Typography.small, color: Colors.textPrimary, marginTop: 6, lineHeight: 18 },
  durBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.divider, ...Shadows.card },
  durTitle: { ...Typography.bodyBold, color: Colors.primaryDark, flex: 1 },
  durItem: { ...Typography.small, color: Colors.textPrimary, marginTop: 4, lineHeight: 18 },
});
