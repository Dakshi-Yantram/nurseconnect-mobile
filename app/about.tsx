import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { FitImage } from '../components/public/FitImage';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';

const HIGHLIGHTS: [keyof typeof Ionicons.glyphMap, string][] = [
  ['shield-checkmark-outline', 'Verified Professionals'],
  ['home-outline', 'Care at Your Home'],
  ['people-outline', 'Safe & Reliable Service'],
  ['document-text-outline', 'Care Records & Family Updates'],
];

const WHY: { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; t: string; d: string }[] = [
  { icon: 'ribbon-outline', bg: '#E0F2FE', fg: '#0284C7', t: 'Verified Credentials', d: 'Trained, degree-qualified and state-licensed nurses and healthcare professionals with background verification.' },
  { icon: 'document-text-outline', bg: '#CCFBF1', fg: '#0D9488', t: 'Care Visit Summaries', d: 'Digital records after every visit with vitals, care provided and next steps. Easy to share with your family or doctor.' },
  { icon: 'people-outline', bg: '#FEF3C7', fg: '#D97706', t: 'Family Updates', d: 'Keep your loved ones informed with real-time visit status, timeline and reports, especially useful for families living away.' },
];

/** Public "About us" screen (no login). */
export default function About() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']} testID="about-screen">
      <Header title="About NurseConnect" fallbackHref="/explore" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <FitImage source={require('../assets/images/public/about-hero.jpg')} ratio={1.35} focusY={0.35} />
        <View style={s.pad}>
          <Text style={s.eyebrow}>ABOUT NURSECONNECT</Text>
          <Text style={s.h1}>
            Care at home. Confidence for the <Text style={{ color: Colors.primary }}>whole family.</Text>
          </Text>
          <Text style={s.lead}>Qualified home healthcare professionals, thoughtfully matched to your needs in Hyderabad.</Text>

          <View style={s.highlights}>
            {HIGHLIGHTS.map(([ic, t]) => (
              <View key={t} style={s.hl}>
                <View style={s.hlIcon}><Ionicons name={ic} size={20} color={Colors.primary} /></View>
                <Text style={s.hlTxt}>{t}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.cta} onPress={() => router.push('/explore')}>
            <Text style={s.ctaTxt}>Explore Care Packages</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>

          <Text style={s.h2}>Why Families Choose NurseConnect</Text>
          <Text style={s.sub}>We make home healthcare simple, safe and dependable for you and your loved ones.</Text>
          {WHY.map((w) => (
            <View key={w.t} style={s.card}>
              <View style={[s.whyIcon, { backgroundColor: w.bg }]}><Ionicons name={w.icon} size={22} color={w.fg} /></View>
              <Text style={s.cardTitle}>{w.t}</Text>
              <Text style={s.cardBody}>{w.d}</Text>
            </View>
          ))}

          <View style={s.story}>
            <Text style={s.h2}>Our Story</Text>
            <Text style={s.storySub}>Built by Yantram Medtech for healthier lives at home.</Text>
            <Text style={s.cardBody}>
              NurseConnect is a home healthcare platform by Yantram Medtech Pvt Ltd, a healthcare innovation company focused on
              making quality care more accessible. We started NurseConnect to bridge the gap between patients who need reliable
              care at home and qualified, trustworthy healthcare professionals in their neighbourhood.
            </Text>
            <View style={s.logoBox}>
              <Image source={require('../assets/images/public/yantram-logo.jpg')} style={s.logo} resizeMode="contain" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { width: '100%', aspectRatio: 1.35 },
  pad: { padding: Spacing.lg },
  eyebrow: { ...Typography.small, fontWeight: '800', letterSpacing: 2, color: Colors.primaryDark },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: Colors.primaryDark, marginTop: 8 },
  lead: { ...Typography.body, color: Colors.textSecondary, marginTop: 10 },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: Spacing.lg },
  hl: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  hlIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.card },
  hlTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, marginTop: Spacing.lg },
  ctaTxt: { color: '#fff', fontWeight: '800' },
  h2: { ...Typography.h3, color: Colors.primaryDark, marginTop: Spacing.xl },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.md, ...Shadows.card },
  whyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.h4, color: Colors.primaryDark, marginTop: 10 },
  cardBody: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
  story: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xl },
  storySub: { ...Typography.bodyBold, color: Colors.textPrimary, marginTop: 4 },
  logoBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.md, ...Shadows.card },
  logo: { width: 180, height: 90 },
});
