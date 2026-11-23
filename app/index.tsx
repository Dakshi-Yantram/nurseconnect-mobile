import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { Gradients, Typography } from '../constants/theme';
import { useStore } from '../store';
import { portalHome } from '../lib/roles';

const SPLASH_MS = 1600;

export default function SplashScreen() {
  const router = useRouter();
  const authBootstrapping = useStore((s) => s.authBootstrapping);
  const role = useStore((s) => s.role);
  const user = useStore((s) => s.user);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.8)).current;
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setMinTimeElapsed(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, [opacity, scale]);

  useEffect(() => {
    // Hold the splash until BOTH the animation has played and the session
    // restore has settled — routing early would bounce an already-signed-in
    // user through the onboarding carousel on every cold start.
    if (!minTimeElapsed || authBootstrapping) return;
    // Signed-in users go to their portal; everyone else lands on the public
    // home (browse without an account). Authentication is judged from the
    // restored session (`user`), not `role`, which can be set before sign-in.
    router.replace((user && role ? portalHome(role) : '/explore') as any);
  }, [minTimeElapsed, authBootstrapping, role, user, router]);

  return (
    <LinearGradient colors={Gradients.splash as any} style={styles.container} testID="splash-screen">
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <View style={styles.logoCircle}>
          <Logo size={132} />
        </View>
        <Text style={styles.tag}>Trusted home nursing, on-demand</Text>
      </Animated.View>
      <Animated.View style={{ opacity, marginTop: 60 }}>
        <Text style={styles.poweredBy}>POWERED BY YANTRAM</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoCircle: {
    backgroundColor: '#fff',
    width: 160,
    height: 160,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  tag: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginTop: 20 },
  poweredBy: { ...Typography.caption, color: 'rgba(255,255,255,0.65)' },
});
