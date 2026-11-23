import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TextInput, TouchableOpacity, ActivityIndicator, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { FitImage } from '../components/public/FitImage';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../constants/contact';
import { publicService } from '../services/public.service';

const TOPICS = [
  'Booking a care package',
  'An upcoming or past visit',
  'Prescription or documents',
  'Payments and refunds',
  'Partner with NurseConnect',
  'Something else',
];

/** Public "Contact us" screen (no login). The form emails support via POST /api/public/enquiries. */
export default function Contact() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    publicService.cities().then((r) => setCities(r.cities ?? [])).catch(() => setCities([]));
  }, []);

  const submit = async () => {
    setError(null);
    setFailed(false);
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (name.trim().length < 2) return setError('Please enter your full name.');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Please enter a valid 10-digit mobile number.');
    if (!topic) return setError('Please select a topic.');
    if (message.trim().length < 5) return setError('Please tell us how we can help.');
    setBusy(true);
    try {
      await publicService.sendEnquiry({ name: name.trim(), phone: digits, topic, message: message.trim() });
      setSent(true);
    } catch {
      setFailed(true);
      setError('We couldn’t send your message right now. Please try again, or email us directly.');
    } finally {
      setBusy(false);
    }
  };

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(topic || 'Enquiry')}&body=${encodeURIComponent(`${message}\n\nName: ${name}\nMobile: ${phone}`)}`;

  return (
    <SafeAreaView style={s.safe} edges={['top']} testID="contact-screen">
      <Header title="Contact us" fallbackHref="/explore" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <FitImage source={require('../assets/images/public/contact-hero.jpg')} ratio={1.6} focusY={0.2} />
          <View style={s.pad}>
            <Text style={s.eyebrow}>CONTACT US</Text>
            <Text style={s.h1}>How can we help <Text style={{ color: Colors.primary }}>you today?</Text></Text>
            <Text style={s.lead}>Questions about a service, an upcoming visit, or care for a loved one? We’re here to help.</Text>

            <View style={s.card}>
              <Text style={s.h2}>Send us a message</Text>
              <Text style={s.sub}>Fill in your details and we’ll get back to you shortly.</Text>
              {sent ? (
                <View style={s.ok}><Text style={s.okTxt}>Thank you — your message has been sent. Our team will get back to you shortly.</Text></View>
              ) : (
                <>
                  <Text style={s.label}>Full Name *</Text>
                  <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Enter your full name" maxLength={100} autoComplete="name" />
                  <Text style={s.label}>Mobile Number *</Text>
                  <TextInput style={s.input} value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+\s]/g, ''))} placeholder="Enter your mobile number" keyboardType="phone-pad" maxLength={15} />
                  <Text style={s.label}>Service / Topic *</Text>
                  <View style={s.pills}>
                    {TOPICS.map((t) => (
                      <TouchableOpacity key={t} style={[s.pill, topic === t && s.pillOn]} onPress={() => setTopic(t)}>
                        <Text style={[s.pillTxt, topic === t && { color: '#fff' }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Message *</Text>
                  <TextInput style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage} placeholder="How can we help you?" multiline maxLength={2000} />
                  {error ? (
                    <Text style={s.err}>
                      {error}{' '}
                      {failed ? <Text style={{ textDecorationLine: 'underline', fontWeight: '700' }} onPress={() => Linking.openURL(mailto)}>Email us</Text> : null}
                    </Text>
                  ) : null}
                  <TouchableOpacity style={s.send} onPress={submit} disabled={busy} testID="contact-send">
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.sendTxt}>Send Enquiry</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={s.card}>
              <View style={s.row}>
                <View style={s.pin}><Ionicons name="location" size={20} color={Colors.primary} /></View>
                <Text style={s.cardTitle}>Currently serving select Hyderabad neighbourhoods</Text>
              </View>
              {cities.length > 0 ? (
                <>
                  <Text style={s.sub}>We provide home nursing services in:</Text>
                  <View style={s.pills}>
                    {cities.map((c) => (
                      <View key={c} style={s.cityChip}>
                        <Ionicons name="location-outline" size={13} color={Colors.primary} />
                        <Text style={s.pillTxt}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={s.sub}>Coverage in other areas may be available soon. Please confirm availability while booking.</Text>
              <TouchableOpacity style={s.send} onPress={() => router.push('/explore')}>
                <Text style={s.sendTxt}>Book a Care Visit</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <View style={s.row}>
                <Ionicons name="headset-outline" size={22} color={Colors.primary} />
                <Text style={s.cardTitle}>Other ways to reach us</Text>
              </View>
              <TouchableOpacity style={s.reach} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
                <Ionicons name="call-outline" size={20} color={Colors.primary} />
                <Text style={s.reachTxt}>{SUPPORT_PHONE}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.reach} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
                <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                <Text style={s.reachTxt}>{SUPPORT_EMAIL}</Text>
              </TouchableOpacity>
              <View style={s.reach}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={s.reachTxt}>Hyderabad, Telangana</Text>
              </View>
            </View>

            <View style={s.emerg}>
              <Ionicons name="warning-outline" size={20} color={Colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={s.emergTitle}>Not for emergencies</Text>
                <Text style={s.emergBody}>NurseConnect is for scheduled home healthcare services. For medical emergencies, please call 108 or visit the nearest hospital.</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { width: '100%', aspectRatio: 1.6 },
  pad: { padding: Spacing.lg },
  eyebrow: { ...Typography.small, fontWeight: '800', letterSpacing: 2, color: Colors.primaryDark },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: Colors.primaryDark, marginTop: 8 },
  lead: { ...Typography.body, color: Colors.textSecondary, marginTop: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.lg, ...Shadows.card },
  h2: { ...Typography.h3, color: Colors.primaryDark },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 6 },
  label: { ...Typography.small, fontWeight: '700', color: Colors.textPrimary, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 12, color: Colors.textPrimary, backgroundColor: Colors.bgApp },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  pillOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillTxt: { ...Typography.small, fontWeight: '600', color: Colors.textPrimary },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  err: { color: Colors.error, marginTop: 10, ...Typography.small },
  send: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  sendTxt: { color: '#fff', fontWeight: '800' },
  ok: { backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: 12, marginTop: 14 },
  okTxt: { color: Colors.success, ...Typography.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pin: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.h4, color: Colors.primaryDark, flex: 1 },
  reach: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  reachTxt: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  emerg: { flexDirection: 'row', gap: 10, backgroundColor: Colors.errorBg, borderRadius: Radius.lg, padding: Spacing.card, marginTop: Spacing.lg },
  emergTitle: { ...Typography.bodyBold, color: Colors.error },
  emergBody: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
