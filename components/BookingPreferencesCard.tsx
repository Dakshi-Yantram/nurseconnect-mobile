import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { InputField } from './InputField';

/**
 * "Trusted support contact", "Privacy & support preference" and the
 * same-nurse choice from the Confirm Booking screen. Controlled: the booking
 * screen owns the value and saves it once the booking exists.
 */
export interface PrefsValue {
  same_nurse_preference: boolean;
  ask_before_sharing: boolean;
  trusted_contact_name: string;
  trusted_contact_relation: string;
  trusted_contact_phone: string;
}

export const emptyPrefs: PrefsValue = {
  same_nurse_preference: false,
  ask_before_sharing: true,
  trusted_contact_name: '',
  trusted_contact_relation: '',
  trusted_contact_phone: '',
};

/** Returns an error message, or null when the (optional) contact is fine. */
export function validatePrefs(v: PrefsValue): string | null {
  const phone = v.trusted_contact_phone.replace(/\D/g, '');
  if (v.trusted_contact_phone.trim() && phone.length < 10) {
    return 'Enter a valid 10-digit phone number for the trusted support contact, or leave it blank.';
  }
  if (phone && !v.trusted_contact_name.trim()) {
    return 'Add the trusted support contact’s name.';
  }
  return null;
}

interface Props {
  value: PrefsValue;
  onChange: (v: PrefsValue) => void;
  sameNurseLabel?: string;
}

export const BookingPreferencesCard: React.FC<Props> = ({
  value,
  onChange,
  sameNurseLabel = 'Prefer the same nurse for follow-up visits (subject to availability)',
}) => {
  const set = <K extends keyof PrefsValue>(k: K, v: PrefsValue[K]) => onChange({ ...value, [k]: v });
  const Check: React.FC<{ on: boolean; label: string; onPress: () => void; testID?: string }> = ({ on, label, onPress, testID }) => (
    <TouchableOpacity style={styles.check} onPress={onPress} testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
      <Text style={styles.checkTxt}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View testID="booking-preferences">
      <Text style={styles.sec}>Trusted support contact</Text>
      <Text style={styles.hint}>Optional — someone we can reach if the nurse needs support during the visit.</Text>
      <InputField
        placeholder="Name"
        value={value.trusted_contact_name}
        onChangeText={(t) => set('trusted_contact_name', t)}
        testID="trusted-name"
      />
      <InputField
        placeholder="Relationship (e.g. Husband)"
        value={value.trusted_contact_relation}
        onChangeText={(t) => set('trusted_contact_relation', t)}
        testID="trusted-relation"
      />
      <InputField
        placeholder="Phone number"
        value={value.trusted_contact_phone}
        onChangeText={(t) => set('trusted_contact_phone', t.replace(/[^\d+ ]/g, ''))}
        keyboardType="phone-pad"
        testID="trusted-phone"
      />

      <Text style={styles.sec}>Privacy & support preference</Text>
      <Text style={styles.hint}>
        If the nurse identifies a concern about your wellbeing, may they discuss it with your chosen support person?
      </Text>
      <Check
        on={value.ask_before_sharing}
        label="Please ask me before sharing"
        onPress={() => set('ask_before_sharing', !value.ask_before_sharing)}
        testID="ask-before-sharing"
      />

      <Check
        on={value.same_nurse_preference}
        label={sameNurseLabel}
        onPress={() => set('same_nurse_preference', !value.same_nurse_preference)}
        testID="same-nurse"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: 4 },
  hint: { ...Typography.small, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 18 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: Radius.md },
  checkTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
});
