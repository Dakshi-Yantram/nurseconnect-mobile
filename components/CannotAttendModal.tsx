/**
 * "I can't attend this visit" — reason picker. Calls POST /bookings/{id}/cannot-attend
 * (idempotent server-side). The booking then goes to rematch_pending and is offered
 * to other eligible nurses; this nurse is excluded from that search.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

export const CANNOT_ATTEND_REASONS = [
  { id: 'emergency', label: 'Emergency' },
  { id: 'illness', label: 'Illness' },
  { id: 'transport_issue', label: 'Transport issue' },
  { id: 'unable_to_reach_customer', label: 'Unable to reach customer' },
  { id: 'other', label: 'Other' },
] as const;
export type CannotAttendReason = (typeof CANNOT_ATTEND_REASONS)[number]['id'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: CannotAttendReason, note?: string) => Promise<void>;
}

export const CannotAttendModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
  const [reason, setReason] = useState<CannotAttendReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsNote = reason === 'other';
  const valid = !!reason && (!needsNote || note.trim().length >= 5);

  const submit = async () => {
    if (!valid || !reason || busy) return; // guards double taps
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason, note.trim() || undefined);
      setReason(null);
      setNote('');
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="cannot-attend-modal">
          <Text style={styles.title}>I can’t attend this visit</Text>
          <Text style={styles.sub}>
            We’ll tell the family and look for a replacement nurse. You won’t be offered this visit again.
          </Text>
          <ScrollView>
            {CANNOT_ATTEND_REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === r.id }}
                style={[styles.opt, reason === r.id && styles.optOn]}
                onPress={() => setReason(r.id)}
                testID={`cannot-attend-${r.id}`}
              >
                <Text style={styles.optTxt}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            {needsNote && (
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Please explain (required)"
                multiline
                maxLength={500}
                testID="cannot-attend-note"
              />
            )}
          </ScrollView>
          {!!error && <Text style={styles.err}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondary} onPress={onClose} disabled={busy}>
              <Text style={styles.secondaryTxt}>Keep visit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primary, (!valid || busy) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!valid || busy}
              testID="cannot-attend-submit"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Confirm</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: Radius.lg ?? 16, borderTopRightRadius: Radius.lg ?? 16, padding: Spacing.lg, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, marginVertical: 8 },
  opt: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginTop: 8 },
  optOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight ?? '#EEF4FF' },
  optTxt: { fontSize: 14, color: Colors.textPrimary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, marginTop: 8, minHeight: 70, textAlignVertical: 'top' },
  err: { color: Colors.danger, marginTop: 8, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondary: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  secondaryTxt: { color: Colors.textPrimary, fontWeight: '600' },
  primary: { flex: 1, backgroundColor: Colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '700' },
});
