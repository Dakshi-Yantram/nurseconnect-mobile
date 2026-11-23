import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { inr } from '../../lib/format';
import {
  PublicPackage,
  Serviceability,
  publicService,
  packageDuration,
  packagePrice,
} from '../../services/public.service';
import { saveDraft, todayYmd } from '../../lib/booking-draft';
import { useBookingDraft } from '../../lib/use-booking-draft';
import { useRouter } from 'expo-router';
import { FitImage } from './FitImage';
import { packageKind, variantOf, type VariantGroup } from '../../lib/package-kinds';
import { COMING_SOON_MESSAGE, displayDescription, displayName, isComingSoon, isEnquiryOnly } from '../../lib/package-display';

export const Chip: React.FC<{ text: string; tone?: 'blue' | 'green' | 'amber' | 'muted' }> = ({
  text,
  tone = 'muted',
}) => {
  const map = {
    blue: [Colors.infoBg, Colors.info],
    green: [Colors.successBg, Colors.success],
    amber: [Colors.warningBg, Colors.warning],
    muted: [Colors.surfaceAlt, Colors.textSecondary],
  } as const;
  return (
    <View style={[s.chip, { backgroundColor: map[tone][0] }]}>
      <Text style={[s.chipTxt, { color: map[tone][1] }]}>{text}</Text>
    </View>
  );
};

export const Message: React.FC<{
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ title, body, actionLabel, onAction, icon = 'information-circle-outline' }) => (
  <View style={s.msg} testID="public-message">
    <Ionicons name={icon} size={30} color={Colors.textTertiary} />
    <Text style={s.msgTitle}>{title}</Text>
    {body ? <Text style={s.msgBody}>{body}</Text> : null}
    {actionLabel && onAction ? (
      <TouchableOpacity style={s.msgBtn} onPress={onAction}>
        <Text style={s.msgBtnTxt}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const Loading: React.FC = () => (
  <View style={s.msg} testID="public-loading">
    <ActivityIndicator color={Colors.primary} />
    <Text style={s.msgBody}>Loading…</Text>
  </View>
);

/** Package card: photo, round icon + name, short description, price, Book Now. */
export const PublicPackageCard: React.FC<{
  pkg: PublicPackage;
  note?: { text: string; ok: boolean } | null;
  onOpen: () => void;
  onBook: () => void;
}> = ({ pkg, onOpen, onBook }) => {
  const router = useRouter();
  const [notice, setNotice] = React.useState(false);
  const kind = packageKind(pkg);
  const soon = isComingSoon(pkg);
  const enquire = isEnquiryOnly(pkg);
  const name = displayName(pkg);
  const price = packagePrice(pkg);
  const multi = (pkg.visits_per_cycle ?? 1) > 1 || (pkg.cycle_duration_days ?? 1) > 1;
  const desc = displayDescription(pkg);
  return (
    <View style={[s.card, soon && s.cardSoon]} testID={`pkg-card-${pkg.id}`}>
      <TouchableOpacity activeOpacity={0.9} onPress={onOpen}>
        <FitImage source={kind.image} ratio={2.5} radius={14} focusY={0.3} />
      </TouchableOpacity>
      <View style={s.cardBody}>
        <View style={s.titleRow}>
          <View style={[s.iconBadge, { backgroundColor: kind.bg }]}>
            <Ionicons name={kind.icon} size={24} color={kind.fg} />
          </View>
          <Text style={s.cardTitle} onPress={onOpen}>{name}</Text>
        </View>
        {desc ? <Text style={s.cardSub} numberOfLines={2}>{desc}</Text> : null}
        {desc && desc.length > 90 ? <Text style={s.viewMore} onPress={onOpen}>View more</Text> : null}
        <View style={s.priceRow}>
          {price !== null ? (
            <>
              <Text style={s.price}>{inr(price)}</Text>
              <Text style={s.priceUnit}> / {multi ? 'package' : 'visit'}</Text>
            </>
          ) : (
            <Text style={s.priceUnit}>Price shown at booking</Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.bookBtnFull, soon && { backgroundColor: '#94A3B8' }]}
          onPress={() => (enquire ? router.push('/contact') : soon ? setNotice(true) : onBook())}
          testID={`book-${pkg.id}`}
        >
          <Text style={s.bookTxt}>{enquire ? 'Enquire now' : 'Book Now'}</Text>
        </TouchableOpacity>
        {notice ? <Text style={s.soonNote}>{COMING_SOON_MESSAGE}</Text> : null}
      </View>
    </View>
  );
};

/** One card for a group of options (hours / duration / type); the option is chosen on the package screen. */
export const PublicVariantCard: React.FC<{
  group: VariantGroup;
  options: PublicPackage[];
  onOpen: (id: string) => void;
}> = ({ group, options, onOpen }) => {
  const cheapest = options.reduce((m, o) => ((packagePrice(o) ?? Infinity) < (packagePrice(m) ?? Infinity) ? o : m), options[0]);
  const kind = packageKind({ ...cheapest, name: group.title, tagline: null });
  const price = packagePrice(cheapest);
  return (
    <View style={s.card} testID={`group-card-${group.id}`}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onOpen(cheapest.id)}>
        <FitImage source={kind.image} ratio={2.5} radius={14} focusY={0.3} />
      </TouchableOpacity>
      <View style={s.cardBody}>
        <View style={s.titleRow}>
          <View style={[s.iconBadge, { backgroundColor: kind.bg }]}>
            <Ionicons name={kind.icon} size={24} color={kind.fg} />
          </View>
          <Text style={s.cardTitle} onPress={() => onOpen(cheapest.id)}>{group.title}</Text>
        </View>
        {group.description || cheapest.tagline || cheapest.description ? (
          <Text style={s.cardSub} numberOfLines={2}>{group.description ?? (cheapest.tagline || cheapest.description)}</Text>
        ) : null}
        <View style={s.priceRow}>
          <Text style={s.priceUnit}>From </Text>
          <Text style={s.price}>{price !== null ? inr(price) : '—'}</Text>
        </View>
        <TouchableOpacity style={s.bookBtnFull} onPress={() => onOpen(cheapest.id)}>
          <Text style={s.bookTxt}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** "Choose Package Duration" tiles. Every tile is a real package with its own price. */
export const VariantTiles: React.FC<{
  group: VariantGroup;
  options: PublicPackage[];
  selectedId: string;
  onPick: (id: string) => void;
}> = ({ group, options, selectedId, onPick }) => {
  const items = options
    .map((o) => ({ o, v: variantOf(o) }))
    .filter((x): x is { o: PublicPackage; v: NonNullable<ReturnType<typeof variantOf>> } => !!x.v)
    .sort((a, b) => a.v.order - b.v.order);
  return (
    <View>
      <Text style={s.tilesHead}>{group.heading}</Text>
      <View style={s.tiles}>
        {items.map(({ o, v }) => {
          const on = o.id === selectedId;
          return (
            <TouchableOpacity
              key={o.id}
              style={[s.tile, on && s.tileOn]}
              onPress={() => (on ? undefined : onPick(o.id))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`tile-${o.id}`}
            >
              {on ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
              <Text style={[s.tileLabel, on && { color: Colors.primary }]}>{v.label}</Text>
              <Text style={s.tilePrice}>{inr(packagePrice(o) ?? 0)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/** Next 14 local days. */
function buildDays() {
  const out: { ymd: string; weekday: string; day: string }[] = [];
  const t = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    out.push({
      ymd: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: String(d.getDate()),
    });
  }
  return out;
}

/**
 * Locality + preferred date/time + serviceability. Choices are saved to the
 * booking draft as they change, so they survive login. Slots and
 * serviceability are the backend's answers (/public/slots, /public/serviceability).
 */
export const AvailabilityForm: React.FC<{
  packageId?: string;
  onResult?: (r: Serviceability | null) => void;
}> = ({ packageId, onResult }) => {
  const { draft, ready } = useBookingDraft();
  const days = useMemo(buildDays, []);
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [slots, setSlots] = useState<{ value: string; label: string; surcharge: number }[] | null>(null);
  const [slotsErr, setSlotsErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Serviceability | null>(null);
  const [err, setErr] = useState('');
  const date = draft.date && draft.date >= todayYmd() ? draft.date : days[0].ymd;

  useEffect(() => {
    if (!ready) return;
    setCity((c) => c || draft.city || '');
    setPincode((p) => p || draft.pincode || '');
  }, [ready, draft.city, draft.pincode]);

  useEffect(() => {
    let alive = true;
    publicService.cities().then((r) => alive && setCities(r.cities ?? [])).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setSlotsErr(false);
    publicService
      .slots(date)
      .then((r) => alive && setSlots(r.slots.filter((x) => x.available)))
      .catch(() => alive && setSlotsErr(true));
    return () => {
      alive = false;
    };
  }, [date]);

  const check = async () => {
    const c = city.trim();
    if (!c) {
      setErr('Enter your city or locality first.');
      return;
    }
    setErr('');
    setChecking(true);
    await saveDraft({ city: c, pincode: pincode.trim() || undefined });
    try {
      const r = await publicService.serviceability(c, packageId, pincode.trim() || undefined);
      setResult(r);
      onResult?.(r);
    } catch (e: any) {
      setResult(null);
      onResult?.(null);
      setErr(e?.message || 'Could not check availability. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={s.form} testID="availability-form">
      <Text style={s.label}>Your city / locality</Text>
      <TextInput
        style={s.input}
        value={city}
        onChangeText={(v) => {
          setCity(v);
          setResult(null);
        }}
        onEndEditing={() => city.trim() && saveDraft({ city: city.trim() })}
        placeholder="e.g. Delhi"
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize="words"
        testID="avail-city"
      />
      {cities.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {cities.map((c) => (
            <TouchableOpacity
              key={c}
              style={[s.pill, city.trim().toLowerCase() === c.toLowerCase() && s.pillOn]}
              onPress={() => {
                setCity(c);
                setResult(null);
                saveDraft({ city: c });
              }}
            >
              <Text style={[s.pillTxt, city.trim().toLowerCase() === c.toLowerCase() && { color: '#fff' }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      <Text style={[s.label, { marginTop: 12 }]}>Pincode (optional — pre-fills your address)</Text>
      <TextInput
        style={s.input}
        value={pincode}
        onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
        onEndEditing={() => saveDraft({ pincode: pincode.trim() || undefined })}
        keyboardType="number-pad"
        placeholder="6-digit pincode"
        placeholderTextColor={Colors.textTertiary}
        testID="avail-pincode"
      />

      <Text style={[s.label, { marginTop: 12 }]}>Preferred date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => (
          <TouchableOpacity
            key={d.ymd}
            style={[s.day, date === d.ymd && s.pillOn]}
            onPress={() => saveDraft({ date: d.ymd, time: undefined })}
            testID={`avail-day-${d.ymd}`}
          >
            <Text style={[s.dayW, date === d.ymd && { color: '#fff' }]}>{d.weekday}</Text>
            <Text style={[s.dayN, date === d.ymd && { color: '#fff' }]}>{d.day}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[s.label, { marginTop: 12 }]}>Preferred time</Text>
      {slotsErr ? (
        <Text style={s.hint}>Couldn’t load time slots. Check your connection and pick the date again.</Text>
      ) : slots === null ? (
        <ActivityIndicator color={Colors.primary} style={{ alignSelf: 'flex-start' }} />
      ) : slots.length === 0 ? (
        <Text style={s.hint}>No slots left on this day — please pick another date.</Text>
      ) : (
        <View style={s.slotWrap}>
          {slots.map((sl) => (
            <TouchableOpacity
              key={sl.value}
              style={[s.slot, draft.time === sl.value && draft.date === date && s.pillOn]}
              onPress={() => saveDraft({ date, time: sl.value })}
              testID={`avail-slot-${sl.value}`}
            >
              <Text style={[s.pillTxt, draft.time === sl.value && draft.date === date && { color: '#fff' }]}>{sl.label}</Text>
              {sl.surcharge > 0 ? (
                <Text style={[s.fee, draft.time === sl.value && draft.date === date && { color: '#fff' }]}>+ {inr(sl.surcharge)}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.checkBtn} onPress={check} disabled={checking} testID="avail-check">
        {checking ? <ActivityIndicator color="#fff" /> : <Text style={s.checkTxt}>Check availability</Text>}
      </TouchableOpacity>
      {err ? <Text style={[s.hint, { color: Colors.error }]}>{err}</Text> : null}
      {result ? (
        <View style={[s.result, { backgroundColor: result.serviceable ? Colors.successBg : Colors.warningBg }]}>
          <Ionicons
            name={result.serviceable ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={result.serviceable ? Colors.success : Colors.warning}
          />
          <Text style={[s.resultTxt, { color: result.serviceable ? Colors.success : Colors.warning }]}>{result.message}</Text>
        </View>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, marginRight: 6, marginBottom: 6 },
  chipTxt: { ...Typography.small, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  msg: { alignItems: 'center', padding: Spacing.lg, gap: 8 },
  msgTitle: { ...Typography.bodyBold, color: Colors.textPrimary, textAlign: 'center' },
  msgBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  msgBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  msgBtnTxt: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 10, marginBottom: Spacing.md, ...Shadows.card },
  cardImg: { width: '100%', aspectRatio: 2.5, borderRadius: 14 },
  cardBody: { paddingHorizontal: 4, paddingTop: 0, paddingBottom: 4 },
  // The round icon overlaps the photo by half; minHeight keeps the description clear of it.
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 34 },
  cardSoon: { opacity: 0.6, backgroundColor: '#F1F5F9' },
  soonNote: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 8 },
  iconBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, borderColor: '#fff' },
  cardTitle: { ...Typography.h4, color: Colors.primaryDark, flex: 1, paddingTop: 6 },
  cardSub: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
  viewMore: { ...Typography.body, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  priceUnit: { ...Typography.small, color: Colors.textSecondary },
  bookBtnFull: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  tilesHead: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', minHeight: 62, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: Colors.surface },
  tileOn: { borderColor: Colors.primary, backgroundColor: Colors.infoBg },
  tileLabel: { ...Typography.small, fontWeight: '700', color: Colors.textPrimary },
  tilePrice: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  bulletTxt: { ...Typography.small, color: Colors.textPrimary, flex: 1 },
  note: { ...Typography.small, fontWeight: '600', marginTop: 8 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { ...Typography.h3, color: Colors.primary },
  priceSub: { ...Typography.small, color: Colors.textSecondary },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 10 },
  bookTxt: { color: '#fff', fontWeight: '700' },
  form: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, ...Shadows.card },
  label: { ...Typography.small, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, backgroundColor: Colors.bgApp },
  pill: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  pillOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' },
  day: { width: 52, alignItems: 'center', paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, marginRight: 8 },
  dayW: { ...Typography.small, color: Colors.textSecondary },
  dayN: { ...Typography.bodyBold, color: Colors.textPrimary },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  fee: { ...Typography.caption, color: Colors.warning },
  hint: { ...Typography.small, color: Colors.textSecondary, marginTop: 6 },
  checkBtn: { backgroundColor: Colors.primaryDark, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  checkTxt: { color: '#fff', fontWeight: '700' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10, marginTop: 10 },
  resultTxt: { ...Typography.small, fontWeight: '600', flex: 1 },
});
