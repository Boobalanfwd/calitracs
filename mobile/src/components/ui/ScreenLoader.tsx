/**
 * ScreenLoader — Themed animated loading states.
 *
 * ── Variants ────────────────────────────────────────────────────────────────
 *   'fullscreen'   — Centered card with pulsing dots  (generic / initial load)
 *   'inline'       — Small inline spinner row
 *   'skeleton'     — Shimmer placeholder (generic card-based)
 *   'dashboard'    — Pixel-perfect skeleton for DashboardScreen
 *   'calendar'     — Pixel-perfect skeleton for CalendarScreen
 *   'progress'     — Pixel-perfect skeleton for ProgressScreen
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { ScreenLoader } from '../../components/ui';
 *
 *   if (isLoadingLog) return <ScreenLoader variant="dashboard" />;
 *   if (loading)      return <ScreenLoader variant="calendar" />;
 *   if (loading)      return <ScreenLoader variant="progress" />;
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { FONTS } from '../../theme/fonts';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Core shimmer hook ────────────────────────────────────────────────────────

const useShimmer = (): Animated.Value => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return shimmer;
};

// ─── ShimmerBox — single shimmering rectangle ─────────────────────────────────

interface ShimmerBoxProps {
  shimmer: Animated.Value;
  width?: number | string;
  height?: number;
  radius?: number;
  style?: object;
}

const ShimmerBox: React.FC<ShimmerBoxProps> = ({
  shimmer,
  width = '100%',
  height = 14,
  radius = 8,
  style,
}) => {
  const { theme } = useTheme();
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: theme.cardBorder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
            backgroundColor: 'rgba(255,255,255,0.5)',
            width: 180,
          },
        ]}
      />
    </View>
  );
};

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={{ flex: 1, opacity: fade }}>{children}</Animated.View>;
};

// ─── Skeleton card wrapper ─────────────────────────────────────────────────────

const SkCard: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => {
  const { theme } = useTheme();
  return (
    <View style={[skStyles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }, style]}>
      {children}
    </View>
  );
};

// ─── Pulsing dots (fullscreen variant) ───────────────────────────────────────

const PulsingDots: React.FC<{ color: string }> = ({ color }) => {
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const anims = [a0, a1, a2];

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(a, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: color,
            opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }}
        />
      ))}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Skeleton — mirrors header, date strip, hero card, macro cards, meals
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const shimmer = useShimmer();

  return (
    <FadeIn>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={[skStyles.screen, { backgroundColor: theme.background }]}>
          {/* Header row: avatar + greeting + bell */}
          <View style={skStyles.row}>
            <ShimmerBox shimmer={shimmer} width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 8 }}>
              <ShimmerBox shimmer={shimmer} width="50%" height={14} />
              <ShimmerBox shimmer={shimmer} width="35%" height={10} radius={5} />
            </View>
            <ShimmerBox shimmer={shimmer} width={44} height={44} radius={22} />
          </View>

          {/* Date strip */}
          <View style={[skStyles.row, { gap: 8 }]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <ShimmerBox key={i} shimmer={shimmer} width={52} height={60} radius={16} />
            ))}
          </View>

          {/* Hero calorie card */}
          <SkCard>
            <View style={[skStyles.row, { justifyContent: 'space-between' }]}>
              <View style={{ gap: 10, flex: 1 }}>
                <ShimmerBox shimmer={shimmer} width="55%" height={12} />
                <ShimmerBox shimmer={shimmer} width="70%" height={38} radius={8} />
                <ShimmerBox shimmer={shimmer} width="40%" height={10} radius={5} />
              </View>
              <ShimmerBox shimmer={shimmer} width={92} height={92} radius={46} />
            </View>
          </SkCard>

          {/* Macro cards row */}
          <View style={[skStyles.row, { gap: 10 }]}>
            {[0, 1, 2].map((i) => (
              <SkCard key={i} style={{ flex: 1, alignItems: 'center', gap: 10, paddingVertical: 14 }}>
                <ShimmerBox shimmer={shimmer} width="60%" height={10} />
                <ShimmerBox shimmer={shimmer} width={64} height={64} radius={32} />
              </SkCard>
            ))}
          </View>

          {/* Meal cards */}
          {[0, 1].map((i) => (
            <SkCard key={i} style={{ gap: 12 }}>
              <View style={[skStyles.row, { justifyContent: 'space-between' }]}>
                <View style={{ gap: 6 }}>
                  <ShimmerBox shimmer={shimmer} width={110} height={14} />
                  <ShimmerBox shimmer={shimmer} width={70} height={10} radius={5} />
                </View>
                <ShimmerBox shimmer={shimmer} width={36} height={36} radius={10} />
              </View>
              <ShimmerBox shimmer={shimmer} width="75%" height={11} radius={5} />
            </SkCard>
          ))}
        </View>
      </SafeAreaView>
    </FadeIn>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Calendar Skeleton — mirrors month nav, grid, selected log card
// ═══════════════════════════════════════════════════════════════════════════════

const CalendarSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const shimmer = useShimmer();

  return (
    <FadeIn>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={[skStyles.screen, { backgroundColor: theme.background }]}>
          {/* Screen title */}
          <ShimmerBox shimmer={shimmer} width="45%" height={22} radius={10} />

          {/* Month nav */}
          <SkCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <ShimmerBox shimmer={shimmer} width={32} height={32} radius={16} />
            <ShimmerBox shimmer={shimmer} width="40%" height={16} />
            <ShimmerBox shimmer={shimmer} width={32} height={32} radius={16} />
          </SkCard>

          {/* Weekday labels */}
          <View style={[skStyles.row, { justifyContent: 'space-between' }]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <ShimmerBox key={i} shimmer={shimmer} width={32} height={10} radius={5} />
            ))}
          </View>

          {/* Calendar grid: 5 rows × 7 cells */}
          {[0, 1, 2, 3, 4].map((row) => (
            <View key={row} style={[skStyles.row, { justifyContent: 'space-between' }]}>
              {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                <ShimmerBox key={col} shimmer={shimmer} width={40} height={40} radius={12} />
              ))}
            </View>
          ))}

          {/* Selected log card */}
          <SkCard style={{ gap: 12, marginTop: 4 }}>
            <ShimmerBox shimmer={shimmer} width="50%" height={14} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[skStyles.row, { gap: 10 }]}>
                <ShimmerBox shimmer={shimmer} width={44} height={44} radius={10} />
                <View style={{ flex: 1, gap: 8 }}>
                  <ShimmerBox shimmer={shimmer} width="65%" height={12} />
                  <ShimmerBox shimmer={shimmer} width="45%" height={10} radius={5} />
                </View>
                <ShimmerBox shimmer={shimmer} width={48} height={14} />
              </View>
            ))}
          </SkCard>
        </View>
      </SafeAreaView>
    </FadeIn>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Progress / Analytics Skeleton — mirrors BMI card, chart, stats
// ═══════════════════════════════════════════════════════════════════════════════

const ProgressSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const shimmer = useShimmer();

  return (
    <FadeIn>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={[skStyles.screen, { backgroundColor: theme.background }]}>
          {/* Title */}
          <ShimmerBox shimmer={shimmer} width="50%" height={22} radius={10} />

          {/* Weight / BMI card */}
          <SkCard style={{ gap: 14 }}>
            <ShimmerBox shimmer={shimmer} width="40%" height={14} />
            <View style={[skStyles.row, { justifyContent: 'space-around' }]}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                  <ShimmerBox shimmer={shimmer} width={60} height={28} radius={8} />
                  <ShimmerBox shimmer={shimmer} width={50} height={10} radius={5} />
                </View>
              ))}
            </View>
            <ShimmerBox shimmer={shimmer} width="100%" height={10} radius={5} />
          </SkCard>

          {/* Period selector tabs */}
          <View style={[skStyles.row, { gap: 8 }]}>
            {[0, 1, 2, 3].map((i) => (
              <ShimmerBox key={i} shimmer={shimmer} width={70} height={32} radius={16} />
            ))}
          </View>

          {/* Bar chart card */}
          <SkCard style={{ gap: 12 }}>
            <ShimmerBox shimmer={shimmer} width="35%" height={14} />
            <View style={[skStyles.row, { alignItems: 'flex-end', justifyContent: 'space-between', height: 100 }]}>
              {[65, 45, 80, 55, 90, 40, 70].map((h, i) => (
                <ShimmerBox key={i} shimmer={shimmer} width={28} height={h} radius={6} />
              ))}
            </View>
            <View style={[skStyles.row, { justifyContent: 'space-between' }]}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <ShimmerBox key={i} shimmer={shimmer} width={28} height={10} radius={4} />
              ))}
            </View>
          </SkCard>

          {/* Summary stats row */}
          <View style={[skStyles.row, { gap: 10 }]}>
            {[0, 1].map((i) => (
              <SkCard key={i} style={{ flex: 1, gap: 10 }}>
                <ShimmerBox shimmer={shimmer} width="60%" height={12} />
                <ShimmerBox shimmer={shimmer} width="80%" height={22} radius={8} />
              </SkCard>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </FadeIn>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Generic skeleton (cards with rows)
// ═══════════════════════════════════════════════════════════════════════════════

const GenericSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const shimmer = useShimmer();

  return (
    <FadeIn>
      <View style={[skStyles.screen, { flex: 1, backgroundColor: theme.background }]}>
        {[0, 1, 2].map((i) => (
          <SkCard key={i} style={{ gap: 12 }}>
            <View style={[skStyles.row, { gap: 12 }]}>
              <ShimmerBox shimmer={shimmer} width={44} height={44} radius={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <ShimmerBox shimmer={shimmer} width="65%" height={14} />
                <ShimmerBox shimmer={shimmer} width="45%" height={10} radius={5} />
              </View>
            </View>
            {[90, 75, 80].map((w, j) => (
              <ShimmerBox key={j} shimmer={shimmer} width={`${w}%`} height={11} radius={5} />
            ))}
          </SkCard>
        ))}
      </View>
    </FadeIn>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main ScreenLoader export
// ═══════════════════════════════════════════════════════════════════════════════

export type LoaderVariant = 'fullscreen' | 'inline' | 'skeleton' | 'dashboard' | 'calendar' | 'progress';

interface ScreenLoaderProps {
  message?: string;
  variant?: LoaderVariant;
}

const ScreenLoader: React.FC<ScreenLoaderProps> = ({
  message = 'Loading…',
  variant = 'fullscreen',
}) => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  if (variant === 'dashboard') return <DashboardSkeleton />;
  if (variant === 'calendar') return <CalendarSkeleton />;
  if (variant === 'progress') return <ProgressSkeleton />;
  if (variant === 'skeleton') return <GenericSkeleton />;

  if (variant === 'inline') {
    return (
      <View style={[inlineStyles.wrap, { backgroundColor: theme.background }]}>
        <PulsingDots color={theme.primary} />
        {message ? (
          <Text style={[inlineStyles.text, { color: theme.textSecondary, fontFamily: FONTS.body.medium }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  // Default: fullscreen
  return (
    <Animated.View style={[fsStyles.wrap, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <View style={[fsStyles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <PulsingDots color={theme.primary} />
        <Text style={[fsStyles.msg, { color: theme.textPrimary, fontFamily: FONTS.heading.semiBold }]}>
          {message}
        </Text>
        <Text style={[fsStyles.sub, { color: theme.textMuted, fontFamily: FONTS.body.regular }]}>
          Hang tight, this won't take long
        </Text>
      </View>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const skStyles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
});

const fsStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 36,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    minWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  msg: { fontSize: 17, textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center' },
});

const inlineStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  text: { fontSize: 14 },
});

export default ScreenLoader;
