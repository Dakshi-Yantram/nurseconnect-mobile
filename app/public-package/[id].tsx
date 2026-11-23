import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { inr } from '../../lib/format';
import { PublicPackage, publicService, packageDuration, packagePrice } from '../../services/public.service';
import { Loading, Message, VariantTiles } from '../../components/public/PublicParts';
import { FitImage } from '../../components/public/FitImage';
import { packageKind, variantOf } from '../../lib/package-kinds';
import { COMING_SOON_MESSAGE, displayDescription, displayName, isComingSoon, isEnquiryOnly, professionBadge } from '../../lib/package-display';
import { SUPPORT_EMAIL } from '../../constants/contact';
import { useStartBooking } from '../../components/public/use-start-booking';
import { NotIncludedBox, VisitDurationBox } from '../../components/public/PackagePatientDetails';

const PROVIDER: Record<string, string> = {
  nurse: 'Nurse', doctor: 'Doctor', dentist: 'Dentist', physiotherapist: 'Physiotherapist',
  caregiver: 'Caregiver', mother_baby_caregiver: 'Mother & Baby caregiver',
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={s.sec}>
    <Text style={s.secTitle}>{title}</Text>
    {children}
  </View>
);
const Body: React.FC<{ text: string }> = ({ text }) => <Text style={s.body}>{text}</Text>;

export default function PublicPackageDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const startBooking = useStartBooking();
  const [pkg, setPkg] = useState<PublicPackage | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [all, setAll] = useState<PublicPackage[]>([]);
  const [soon, setSoon] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setState('loading');
    publicService
      .package(String(id))
      .then((d) => {
        setPkg(d);
        setState('ok');
      })
      .catch((e) => setState(e?.status === 404 || e?.status === 422 ? 'missing' : 'error'));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    publicService.packages().then(setAll).catch(() => setAll([]));
  }, []);

  const price = pkg ? packagePrice(pkg) : null;
  const kind = pkg ? packageKind(pkg) : null;
  const variant = pkg ? variantOf(pkg) : null;
  const siblings = variant ? all.filter((q) => variantOf(q)?.group.id === variant.group.id) : [];
  const multi = !!pkg && ((pkg.visits_per_cycle ?? 1) > 1 || (pkg.cycle_duration_days ?? 1) > 1);
  const pd = pkg?.patient_details ?? null;
  const included = pkg
    ? pd?.whats_included?.length
      ? pd.whats_included
      : pkg.whats_included?.length
      ? pkg.whats_included
      : pkg.services.map((x) => x.name)
    : [];

  return (
    <SafeAreaView style={s.safe} edges={['top']} testID="public-package-screen">
      <Header title="Back to Care Packages" fallbackHref="/explore" />
      {state === 'loading' ? (
        <Loading />
      ) : state === 'missing' ? (
        <Message icon="alert-circle-outline" title="This package isn’t available" body="It may have been removed or is not currently offered." actionLabel="Browse packages" onAction={() => router.replace('/explore')} />
      ) : state === 'error' || !pkg ? (
        <Message icon="cloud-offline-outline" title="Couldn’t load this package" body="Please check your connection and try again." actionLabel="Try again" onAction={load} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {kind ? <FitImage source={kind.image} ratio={2} radius={16} focusY={0.3} /> : null}
            <View style={s.titleRow}>
              {kind ? (
                <View style={[s.iconBadge, { backgroundColor: kind.bg }]}>
                  <Ionicons name={kind.icon} size={28} color={kind.fg} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={s.h1}>{displayName(pkg)}</Text>
                {displayDescription(pkg) ? <Text style={s.tag}>{displayDescription(pkg)}</Text> : null}
              </View>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceBig}>{price !== null ? inr(price) : 'Price at booking'}</Text>
              {price !== null ? <Text style={s.priceUnit}> / {multi ? 'package' : 'visit'}</Text> : null}
            </View>
            {multi && packageDuration(pkg) ? <Text style={s.muted}>{packageDuration(pkg)}</Text> : null}
            <View style={s.trust}>
              {[professionBadge(pkg) ? ['people-outline', professionBadge(pkg) as string] : null, ['shield-checkmark-outline', 'Background Verified'], ['time-outline', 'Flexible Timing']].filter((x): x is string[] => !!x).map(([ic, t]) => (
                <View key={t} style={s.trustItem}>
                  <Ionicons name={ic as any} size={20} color={Colors.primary} />
                  <Text style={s.trustTxt}>{t}</Text>
                </View>
              ))}
            </View>

            {/^annual health check-?up/i.test(pkg.name.trim()) ? (
              <Text style={s.soonNote}>Before booking, check exactly which diagnostic tests and doctor review fees, if any, are included in the displayed price.</Text>
            ) : null}
            {included.length > 0 ? (
              <Section title="What’s Included">
                {included.map((t, i) => (
                  <View key={`${t}-${i}`} style={s.bullet}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={s.bulletTxt}>{t}</Text>
                  </View>
                ))}
              </Section>
            ) : null}
            {pd?.whats_not_included?.length ? <NotIncludedBox items={pd.whats_not_included} /> : null}
            {pd?.visit_duration_and_extension ? <VisitDurationBox d={pd.visit_duration_and_extension} /> : null}

            {variant && siblings.length > 1 ? (
              <View style={[s.sec, { marginTop: Spacing.md }]}>
                <VariantTiles
                  group={variant.group}
                  options={siblings}
                  selectedId={pkg.id}
                  onPick={(pid) => router.replace({ pathname: '/public-package/[id]', params: { id: pid } })}
                />
              </View>
            ) : null}

            {pkg.description || pkg.target_condition ? (
              <Section title="About this package">
                {pkg.description ? <Body text={pkg.description} /> : null}
                {pkg.target_condition ? <Text style={s.muted}>Suited for: {pkg.target_condition}</Text> : null}
              </Section>
            ) : null}
            {pkg.included_scope && !pd ? <Section title="Scope of service"><Body text={pkg.included_scope} /></Section> : null}
            {pkg.service_details_text ? <Section title="Service details"><Body text={pkg.service_details_text} /></Section> : null}
            {pkg.services.length > 0 ? (
              <Section title="Services in this package">
                <View style={s.chips}>
                  {pkg.services.map((x) => (
                    <TouchableOpacity key={x.id} style={s.svcPill} onPress={() => router.push({ pathname: '/public-service/[id]', params: { id: x.id } })}>
                      <Text style={s.svcPillTxt}>{x.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
            ) : null}
            <Section title="Requirements">
              <Body text={pkg.requires_prescription ? 'A valid doctor’s prescription is required. You’ll upload it before payment.' : 'No prescription is required.'} />
              <Body text={pkg.material_included ? 'Medical materials are included in the price.' : 'Materials are not part of this package unless offered at booking.'} />
              {pkg.provider_types && pkg.provider_types.length > 0 ? (
                <Body text={`Delivered by: ${pkg.provider_types.map((t) => PROVIDER[t] ?? t).join(', ')}.`} />
              ) : null}
              {pkg.available_cities && pkg.available_cities.length > 0 ? <Body text={`Offered in: ${pkg.available_cities.join(', ')}.`} /> : null}
            </Section>
            {pkg.scope_boundary || (pkg.insurance_exclusions && pkg.insurance_exclusions.length > 0) || !pkg.insurance_covered ? (
              <Section title="Exclusions & coverage">
                {pkg.scope_boundary && !pd ? <Body text={pkg.scope_boundary} /> : null}
                <Text style={s.muted}>{pkg.insurance_covered ? 'Eligible for insurance claims (subject to your policy).' : 'Not covered by insurance.'}</Text>
                {(pkg.insurance_exclusions ?? []).map((t, i) => <Text key={`${t}-${i}`} style={s.muted}>• {t}</Text>)}
              </Section>
            ) : null}
            {pkg.important_information ? <Section title="Important information"><Body text={pkg.important_information} /></Section> : null}

          </ScrollView>

          {soon ? <Text style={s.soonNote}>{COMING_SOON_MESSAGE}</Text> : null}
          <View style={s.bar}>
            <TouchableOpacity
              style={s.cta}
              onPress={() => (isEnquiryOnly(pkg) ? router.push('/contact') : isComingSoon(pkg) ? setSoon(true) : startBooking(pkg.id))}
              testID="book-now"
            >
              <Text style={s.ctaTxt}>{isEnquiryOnly(pkg) ? 'Enquire now' : 'Book Now'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ctaGhost} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              <Text style={s.ctaGhostTxt}>Contact Us</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  soonNote: { ...Typography.small, color: Colors.textSecondary, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginHorizontal: Spacing.lg, marginTop: 10, textAlign: 'center' },
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { width: '100%', aspectRatio: 2, borderRadius: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: Spacing.md },
  iconBadge: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  priceBig: { ...Typography.h2, color: Colors.primary },
  priceUnit: { ...Typography.small, color: Colors.textSecondary },
  trust: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, marginTop: Spacing.md, ...Shadows.card },
  trustItem: { flex: 1, alignItems: 'center', gap: 4 },
  trustTxt: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  h1: { ...Typography.h2, color: Colors.primaryDark },
  tag: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  sec: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.md, ...Shadows.card },
  secTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 8 },
  body: { ...Typography.body, color: Colors.textPrimary, marginBottom: 6 },
  muted: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  bullet: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bulletTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  svcPill: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  svcPillTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  price: { ...Typography.h3, color: Colors.textPrimary },
  priceSub: { ...Typography.caption, color: Colors.textSecondary },
  cta: { flex: 1, alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14 },
  ctaGhost: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 13 },
  ctaGhostTxt: { color: Colors.primary, fontWeight: '800' },
  ctaTxt: { color: '#fff', fontWeight: '800' },
});
