import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import {
  HELP_LANGUAGES,
  matchVideos,
  thumbUrl,
  videosFor,
  watchUrl,
  type HelpLang,
  type PlayableVideo,
} from '../lib/help-videos';

// Remembered for the rest of the app session so the nurse is not asked again on every screen.
let rememberedLang: HelpLang | null = null;

/**
 * Video help for nurses. First asks which language the nurse wants help in:
 *   English -> the written answers stay in the chat / FAQs; videos in English are listed here.
 *   Telugu  -> the video that matches the question (from `query`, e.g. what they last typed in the chat),
 *              or all Telugu videos when none matches.
 * Videos open on YouTube (the YouTube app if installed, else the browser).
 */
export const HelpVideoPanel: React.FC<{ query?: string; testID?: string }> = ({ query, testID }) => {
  const [lang, setLangState] = useState<HelpLang | null>(rememberedLang);
  const setLang = (l: HelpLang | null) => {
    rememberedLang = l;
    setLangState(l);
  };

  const { list, exact } = useMemo(() => {
    if (!lang) return { list: [] as PlayableVideo[], exact: false };
    const q = (query ?? '').trim();
    if (q) {
      const hits = matchVideos(q, lang, 3);
      if (hits.length > 0) return { list: hits, exact: true };
    }
    return { list: videosFor(lang), exact: false };
  }, [lang, query]);

  const open = (v: PlayableVideo) => {
    Linking.openURL(watchUrl(v.videoId)).catch(() =>
      Alert.alert('Could not open YouTube', 'Please check your internet connection and try again.'),
    );
  };

  return (
    <View style={styles.card} testID={testID ?? 'help-video-panel'}>
      <View style={styles.head}>
        <Ionicons name="logo-youtube" size={20} color="#DC2626" />
        <Text style={styles.title}>Video help</Text>
      </View>

      {!lang ? (
        <>
          <Text style={styles.sub}>Which language would you like help in?</Text>
          <View style={styles.chips}>
            {HELP_LANGUAGES.map((l) => (
              <TouchableOpacity key={l.code} style={styles.chip} onPress={() => setLang(l.code)} testID={`help-lang-${l.code}`}>
                <Text style={styles.chipTxt}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.chips}>
            {HELP_LANGUAGES.map((l) => {
              const on = l.code === lang;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setLang(l.code)}
                  accessibilityState={{ selected: on }}
                  testID={`help-lang-${l.code}`}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {list.length === 0 ? (
            <Text style={styles.sub}>No videos in this language yet. Please check back soon.</Text>
          ) : (
            <>
              <Text style={styles.sub}>
                {exact ? 'This video should help:' : (query ?? '').trim() && lang !== 'en' ? 'No video matches that question yet. All videos in this language:' : 'Tap a video to watch it on YouTube.'}
              </Text>
              {list.map((v) => (
                <TouchableOpacity key={v.id} style={styles.video} onPress={() => open(v)} testID={`help-video-${v.id}`}>
                  <View>
                    <Image source={{ uri: thumbUrl(v.videoId) }} style={styles.thumb} resizeMode="cover" />
                    <View style={styles.play}>
                      <Ionicons name="play-circle" size={44} color="#fff" />
                    </View>
                  </View>
                  <View style={{ padding: Spacing.md }}>
                    <Text style={styles.vTitle}>{v.title}</Text>
                    {!!v.description && <Text style={styles.vDesc}>{v.description}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginVertical: Spacing.md, ...Shadows.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { ...Typography.h4, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  chipTxtOn: { color: '#fff' },
  video: { backgroundColor: Colors.bgApp, borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.sm },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  play: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  vTitle: { ...Typography.small, color: Colors.textPrimary, fontWeight: '700' as const },
  vDesc: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
