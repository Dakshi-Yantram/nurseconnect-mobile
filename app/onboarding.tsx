import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';
import { GradientButton } from '../components/GradientButton';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    title: 'Verified nurses, at your doorstep',
    desc: 'Book trained, background-verified nurses for any home-care need in minutes.',
    icon: 'medkit-outline' as const,
  },
  {
    key: '2',
    title: 'Track every visit, in real-time',
    desc: 'Live status, vitals updates and care notes – all in one place for your family.',
    icon: 'navigate-outline' as const,
  },
  {
    key: '3',
    title: 'Affordable, with subsidies',
    desc: 'BPL subsidy support and transparent pricing make care accessible to everyone.',
    icon: 'heart-outline' as const,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== idx) setIdx(i);
  };

  const next = () => {
    if (idx < SLIDES.length - 1) {
      ref.current?.scrollTo({ x: (idx + 1) * width, animated: true });
    } else {
      router.replace('/role-select');
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="onboarding-screen">
      <View style={styles.topRow}>
        <View />
        <TouchableOpacity onPress={() => router.replace('/role-select')} testID="onboarding-skip">
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.img} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={s.icon} size={96} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.desc}>{s.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, idx === i && styles.dotActive]}
            />
          ))}
        </View>
        <GradientButton
          title={idx === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          onPress={next}
          testID="onboarding-next"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
  },
  skip: { ...Typography.bodyBold, color: Colors.textSecondary },
  slide: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  img: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 12,
  },
  desc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  bottom: { padding: Spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.lg },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: Colors.primary, width: 28 },
});
