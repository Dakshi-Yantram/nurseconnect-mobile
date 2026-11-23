import React, { useState } from 'react';
import { Platform } from 'react-native';
import { InputField } from './InputField';
import { formatDateTyping, parseDateInput, type ParseOptions } from '../lib/date-input';

type InputProps = React.ComponentProps<typeof InputField>;

interface Props extends Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'error'> {
  value: string;
  /** Receives the formatted text while typing, and the normalised YYYY-MM-DD on blur. */
  onChangeText: (next: string) => void;
  /** Validation rules, e.g. { rule: 'notFuture', label: 'Date of birth' }. */
  rules?: ParseOptions;
  /** Optional external error (e.g. from a failed submit). */
  error?: string;
}

/**
 * Date text field: hyphens are inserted as you type or paste, `/` `.` `-` and
 * separator-free input (19900614) are all accepted, and the value is normalised
 * to YYYY-MM-DD when you leave the field. A message only appears when the text
 * is genuinely not a real calendar date - never just because of the format.
 */
export const DateField: React.FC<Props> = ({ value, onChangeText, rules, error, onBlur, ...rest }) => {
  const [touched, setTouched] = useState(false);
  const parsed = parseDateInput(value, rules);
  // Only complain once the user has left the field (or after a full 10-char entry).
  const showInvalid = parsed.status === 'invalid' && (touched || value.length >= 10);

  return (
    <InputField
      placeholder="YYYY-MM-DD"
      autoCorrect={false}
      autoCapitalize="none"
      autoComplete="off"
      // iOS has a digits+punctuation pad; Android's numeric pad covers the digits.
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
      {...rest}
      value={value}
      onChangeText={(t) => onChangeText(formatDateTyping(t))}
      onBlur={(e) => {
        setTouched(true);
        if (parsed.status === 'valid' && parsed.value !== value) onChangeText(parsed.value);
        onBlur?.(e);
      }}
      error={error ?? (showInvalid ? parsed.error ?? undefined : undefined)}
    />
  );
};
