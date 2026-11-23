import React from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';
import { Colors, Typography } from '../constants/theme';

interface LogoProps {
  /** Logo HEIGHT in dp; width follows the artwork's aspect ratio (no distortion). */
  size?: number;
  /** Heart-and-nurse mark only (no wordmark) - for small spots next to text. */
  mark?: boolean;
  showText?: boolean;
  textColor?: string;
  variant?: 'default' | 'stacked';
}

export const Logo: React.FC<LogoProps> = ({
  size = 56,
  mark = false,
  showText = false,
  textColor = Colors.textPrimary,
  variant = 'default',
}) => {
  const stacked = variant === 'stacked';
  return (
    <View
      style={[styles.row, stacked && styles.column]}
      testID="brand-logo"
    >
      <Image
        source={mark ? require('../assets/images/logo-mark.png') : require('../assets/images/logo-full.png')}
        style={{ width: size * (mark ? 720 / 552 : 720 / 649), height: size }}
        resizeMode="contain"
        accessibilityLabel="NurseConnect logo"
      />
      {showText && (
        <View style={[styles.textWrap, stacked && styles.textWrapStacked]}>
          <Text style={[styles.brand, { color: textColor }]}>NurseConnect</Text>
          <Text style={[styles.tagline, { color: textColor, opacity: 0.7 }]}>
            Care, delivered home
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'center' },
  textWrap: { marginLeft: 12 },
  textWrapStacked: { marginLeft: 0, marginTop: 12, alignItems: 'center' },
  brand: { ...Typography.h3, fontWeight: '800' as const },
  tagline: { ...Typography.small },
});
