import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { inr } from '../../lib/format';
import { PublicPackage, PublicService, publicService, categoryLabel, serviceDuration, toNum } from '../../services/public.service';
import { Chip, Loading, Message, PublicPackageCard } from '../../components/public/PublicParts';
import { useStartBooking } from '../../components/public/use-start-booking';

export default function PublicServiceDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const startBooking = useStartBooking();
  const [svc, setSvc] = useState<PublicService | null>(null);
  const [pkgs, setPkgs] = useState<PublicPackage[] | null>(null);
  const [pkgErr, setPkgErr] = useState(false);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');

  const load = useCallback(() => {
    if (!id) return;
    setState('loading');
    setPkgErr(false);
    publicService
      .service(String(id))
      .then((d) => {
        setSvc(d);
        setState('ok');
      })
      .catch((e) => setState(e?.status === 404 || e?.status === 422 ? 'missing' : 'error'));
    publicService.packages().then(setPkgs).catch(() => setPkgErr(true));
  }, [id]);
  useEffect(load, [load]);

  const including = useMemo(
    () => (pkgs ?? []).filter((p) => p.primary_service_id === id || p.services.some((x) => x.id === id)),
    [pkgs, id],
  );
  const base = svc ? toNum(svc.base_price) : null;
  const max = svc ? toNum(svc.max_price) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']} testID="public-service-screen">
      <Header title="Service" fallbackHref="/explore" />
      {state === 'loading' ? (
        <Loading />
      ) : state === 'missing' ? (
        <Message icon="alert-circle-outline" title="This service isn’t available" body="It may have been removed or is not currently offered." actionLabel="Browse services" onAction={() => router.replace('/explore')} />
      ) : state === 'error' || !svc ? (
        <Message icon="cloud-offline-outline" title="Couldn’t load this service" body="Please check your connection and try again." actionLabel="Try again" onAction={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}>
          <View style={s.card}>
            <Text style={s.h1}>{svc.name}</Text>
            <View style={s.chips}>
              <Chip tone="blue" text={categoryLabel(svc.category)} />
              <Chip text={serviceDuration(svc.duration_minutes)} />
              {svc.requires_prescription ? <Chip tone="amber" text="Prescription required" /> : null}
              <Chip tone={svc.insurance_covered ? 'green' : 'muted'} text={svc.insurance_covered ? 'Insurance eligible' : 'Not covered by insurance'} />
            </View>
            <Text style={s.price}>{base !== null ? `From ${inr(base)}` : 'Price at booking'}</Text>
            {max !== null && base !== null && max > base ? <Text style={s.muted}>up to {inr(max)}</Text> : null}
            {svc.description ? <Text style={s.body}>{svc.description}</Text> : null}
            <Text style={s.muted}>
              {svc.requires_prescription ? 'A valid doctor’s prescription is required before this service can be delivered.' : 'No prescription is required for this service.'}
            </Text>
          </View>

          <Text style={s.sec}>Book this service</Text>
          <Text style={s.muted}>Online booking is done through care packages that include this service.</Text>
          <View style={{ height: Spacing.sm }} />
          {pkgErr ? (
            <Message icon="cloud-offline-outline" title="Couldn’t load packages" actionLabel="Try again" onAction={load} />
          ) : pkgs === null ? (
            <Loading />
          ) : including.length === 0 ? (
            <Message icon="medkit-outline" title="No package includes this service right now" body="You can still browse our other packages." actionLabel="View all packages" onAction={() => router.replace('/explore')} />
          ) : (
            including.map((p) => (
              <PublicPackageCard
                key={p.id}
                pkg={p}
                onOpen={() => router.push({ pathname: '/public-package/[id]', params: { id: p.id } })}
                onBook={() => startBooking(p.id)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, ...Shadows.card },
  h1: { ...Typography.h2, color: Colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  price: { ...Typography.h3, color: Colors.textPrimary, marginTop: 6 },
  body: { ...Typography.body, color: Colors.textPrimary, marginTop: 10 },
  muted: { ...Typography.small, color: Colors.textSecondary, marginTop: 6 },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.lg },
});
