import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/Logo';
import { SearchBar } from '../components/SearchBar';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { portalHome } from '../lib/roles';
import { inr } from '../lib/format';
import {
  PublicPackage,
  PublicService,
  Serviceability,
  publicService,
  categoryLabel,
  serviceDuration,
  toNum,
} from '../services/public.service';
import { Chip, Loading, Message, PublicPackageCard, PublicVariantCard } from '../components/public/PublicParts';
import { CATEGORIES, classifyPackage, groupRows, type CategoryId } from '../lib/package-kinds';
import { useStartBooking } from '../components/public/use-start-booking';
import { useBookingDraft } from '../lib/use-booking-draft';

type Load<T> = { data: T | null; loading: boolean; error: string | null };

/**
 * Public home. Reachable with no account: services, categories, packages,
 * prices, locality / date / time and serviceability - all from /api/public/*.
 * Login is requested only when "Book Now" is tapped.
 */
export default function Explore() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const role = useStore((s) => s.role);
  const startBooking = useStartBooking();
  const scrollRef = React.useRef<ScrollView>(null);
  const [listY, setListY] = useState(0);
  const { draft } = useBookingDraft();

  const [svc, setSvc] = useState<Load<PublicService[]>>({ data: null, loading: true, error: null });
  const [pkg, setPkg] = useState<Load<PublicPackage[]>>({ data: null, loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);

  const load = useCallback(async () => {
    setSvc((p) => ({ ...p, loading: true, error: null }));
    setPkg((p) => ({ ...p, loading: true, error: null }));
    publicService
      .services()
      .then((d) => setSvc({ data: d, loading: false, error: null }))
      .catch((e) => setSvc({ data: null, loading: false, error: e?.message || 'Could not load services' }));
    publicService
      .packages()
      .then((d) => setPkg({ data: d, loading: false, error: null }))
      .catch((e) => setPkg({ data: null, loading: false, error: e?.message || 'Could not load packages' }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const services = useMemo(
    () =>
      (svc.data ?? []).filter(
        (x) =>
          (!q || [x.name, x.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))),
      ),
    [svc.data, q],
  );
  const packages = useMemo(
    () =>
      (pkg.data ?? []).filter(
        (p) =>
          (!category || classifyPackage(p) === category) &&
          (!q ||
          [p.name, p.tagline, p.description, p.target_condition, ...(p.whats_included ?? [])]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
      ),
    [pkg.data, q, category],
  );

  const rows = useMemo(() => groupRows(packages, pkg.data ?? []), [packages, pkg.data]);
  const noteFor = (p: PublicPackage) => {
    const city = draft.city?.trim().toLowerCase();
    if (!city || !p.available_cities || p.available_cities.length === 0) return null;
    const ok = p.available_cities.some((c) => c.trim().toLowerCase() === city);
    return ok ? { text: `Offered in ${draft.city}`, ok: true } : { text: `Not offered in ${draft.city}`, ok: false };
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']} testID="explore-screen">
      <OfflineBanner />
      <View style={s.top}>
        <View style={s.brand}>
          <Logo size={36} mark />
          <Text style={s.brandTxt}>NurseConnect</Text>
        </View>
        {user && role ? (
          <TouchableOpacity onPress={() => router.replace(portalHome(role) as any)} testID="explore-account">
            <Text style={s.link}>My account</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.push('/role-select')} testID="explore-signin">
            <Text style={s.link}>Sign in</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LinearGradient colors={['#EAF3FF', '#F5F9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero} testID="explore-hero">
          <Text style={s.heroH1}>
            Trusted Nursing Care at Your <Text style={{ color: Colors.primary }}>Doorstep</Text>
          </Text>
          <Text style={s.heroSub}>Skilled nurses, caregivers and healthcare professionals for you and your loved ones.</Text>
          <View style={s.heroTrust}>
            <View style={s.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={15} color={Colors.primary} />
              <Text style={s.trustTxt}>Verified & background checked</Text>
            </View>
            <View style={s.trustItem}>
              <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
              <Text style={s.trustTxt}>Flexible scheduling</Text>
            </View>
          </View>
          <View style={s.heroBtns}>
            <TouchableOpacity
              style={s.heroPrimary}
              onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, listY - 8), animated: true })}
              testID="hero-explore"
            >
              <Text style={s.heroPrimaryTxt}>Explore Packages</Text>
              <Ionicons name="arrow-down" size={15} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.heroSecondary} onPress={() => router.push('/contact')} testID="hero-contact">
              <Text style={s.heroSecondaryTxt}>Contact Us</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={{ height: Spacing.md }} onLayout={(e) => setListY(e.nativeEvent.layout.y)} />
        <SearchBar value={query} onChange={setQuery} placeholder="Search care packages, services..." />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.md }}>
          <TouchableOpacity style={[s.cat, !category && s.catOn]} onPress={() => setCategory(null)}>
            <Text style={[s.catTxt, !category && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.id} style={[s.cat, category === c.id && s.catOn]} onPress={() => setCategory(c.id)} testID={`cat-${c.id}`}>
              <Text style={[s.catTxt, category === c.id && { color: '#fff' }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: Spacing.md }} />
        {pkg.loading && !pkg.data ? (
          <Loading />
        ) : pkg.error ? (
          <Message icon="cloud-offline-outline" title="Couldn’t load packages" body={pkg.error} actionLabel="Try again" onAction={load} />
        ) : rows.length === 0 ? (
          <Message
            icon="medkit-outline"
            title={q ? `No packages match “${query.trim()}”` : category ? 'No packages in this category' : 'No care packages available right now'}
            body={q ? undefined : 'Please check back shortly.'}
          />
        ) : (
          rows.map((r) =>
            r.kind === 'group' ? (
              <PublicVariantCard
                key={r.group.id}
                group={r.group}
                options={r.options}
                onOpen={(id) => router.push({ pathname: '/public-package/[id]', params: { id } })}
              />
            ) : (
              <PublicPackageCard
                key={r.pkg.id}
                pkg={r.pkg}
                note={noteFor(r.pkg)}
                onOpen={() => router.push({ pathname: '/public-package/[id]', params: { id: r.pkg.id } })}
                onBook={() => startBooking(r.pkg.id)}
              />
            ),
          )
        )}

        {!svc.error && svc.data && services.length > 0 && (
          <>
            <Text style={s.sec}>Individual services</Text>
            {services.map((x) => {
              const base = toNum(x.base_price);
              return (
                <TouchableOpacity
                  key={x.id}
                  style={s.row}
                  onPress={() => router.push({ pathname: '/public-service/[id]', params: { id: x.id } })}
                  testID={`svc-${x.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{x.name}</Text>
                    <View style={s.chips}>
                      <Chip tone="blue" text={categoryLabel(x.category)} />
                      <Chip text={serviceDuration(x.duration_minutes)} />
                    </View>
                  </View>
                  <Text style={s.rowPrice}>{base !== null ? `From ${inr(base)}` : ''}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={s.links}>
          <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/about')} testID="explore-about">
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={s.linkBtnTxt}>About us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/contact')} testID="explore-contact">
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
            <Text style={s.linkBtnTxt}>Contact us</Text>
          </TouchableOpacity>
        </View>

        {!user && (
          <TouchableOpacity style={s.pro} onPress={() => router.push('/role-select')} testID="explore-pro">
            <Ionicons name="medical-outline" size={18} color={Colors.textSecondary} />
            <Text style={s.proTxt}>Care professional or staff? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Sign in</Text></Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { ...Typography.h4, color: Colors.textPrimary },
  link: { color: Colors.primary, fontWeight: '700' },
  hero: { borderRadius: Radius.xl, padding: Spacing.card + 4, borderWidth: 1, borderColor: '#DCE9FB' },
  heroH1: { fontSize: 26, lineHeight: 31, fontWeight: '800', color: Colors.primaryDark },
  heroSub: { ...Typography.body, color: Colors.textSecondary, marginTop: 8 },
  heroTrust: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustTxt: { ...Typography.small, color: Colors.textSecondary },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroPrimary: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 12 },
  heroPrimaryTxt: { color: '#fff', fontWeight: '800' },
  heroSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.primary },
  heroSecondaryTxt: { color: Colors.primary, fontWeight: '800' },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  cat: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  catOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catTxt: { fontWeight: '600', color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginBottom: Spacing.sm, gap: 8, ...Shadows.card },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowPrice: { ...Typography.small, fontWeight: '700', color: Colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  links: { flexDirection: 'row', gap: 12, marginTop: Spacing.lg },
  linkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  linkBtnTxt: { color: Colors.primary, fontWeight: '700' },
  pro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: Spacing.lg },
  proTxt: { ...Typography.body, color: Colors.textSecondary },
});
