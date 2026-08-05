import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  StatusBar, Platform, Easing, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Goal } from '../../types';
import { FONTS } from '../../theme/fonts';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'OnboardingPlan'>;
};

const ORANGE = '#FF6B2C';
const ORANGE_LIGHT = '#FFF3EE';

// Processing steps that animate in sequence
const PROCESSING_STEPS = [
  { emoji: '🧮', text: 'Calculating your metabolic rate…' },
  { emoji: '⚖️', text: 'Analysing body composition…' },
  { emoji: '🎯', text: 'Setting personalised targets…' },
  { emoji: '🥗', text: 'Calibrating macro ratios…' },
  { emoji: '✨', text: 'Your plan is ready!' },
];

// Map goal values to readable labels
const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
  lose_fat: 'Lose fat',
  gain_weight: 'Gain weight',
  more_energy: 'More energy',
  event_prep: 'Event prep',
  muscle_up: 'Muscle up',
  control_sugar: 'Control sugar',
  eat_healthier: 'Eat healthier',
  just_track: 'Just track',
};

const OnboardingPlanScreen: React.FC<Props> = ({ navigation, route }) => {
  const { targets, name, goals } = route.params;

  // ── All hooks declared at the top (Rules of Hooks) ───────────────────────
  const { updateProfile } = useAuth();
  const [phase, setPhase] = useState<'loading' | 'results'>('loading');
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const stepFadeAnims = useRef(
    PROCESSING_STEPS.map(() => new Animated.Value(0))
  ).current;
  const macroAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // ── Pulsing ring animation ────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  // ── Sequential step reveal then transition to results ────────────────────
  useEffect(() => {
    if (phase !== 'loading') return;

    let currentStep = 0;
    const revealNext = () => {
      if (currentStep >= PROCESSING_STEPS.length) {
        // All steps shown — switch to results
        setTimeout(() => setPhase('results'), 400);
        return;
      }
      setStepIndex(currentStep);
      Animated.timing(stepFadeAnims[currentStep], {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        currentStep++;
        setTimeout(revealNext, 650);
      });
    };

    const timer = setTimeout(revealNext, 300);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Results reveal animation ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'results') return;

    // Fade + slide in the results card
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();

    // Stagger macro cards in
    Animated.stagger(
      120,
      macroAnims.map((anim) =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 })
      )
    ).start();
  }, [phase]);

  const handleStartJourney = async () => {
    setCompleting(true);
    try {
      await updateProfile({ onboardingComplete: true } as any);
    } catch (err) {
      console.warn('Failed to update onboardingComplete flag:', err);
    } finally {
      setCompleting(false);
      (navigation as any).replace('Main');
    }
  };

  // ── Loading phase ─────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          {/* Pulsing brain / AI icon */}
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.pulseInner}>
              <Text style={styles.pulseEmoji}>🤖</Text>
            </View>
          </Animated.View>

          <Text style={styles.loadingTitle}>Building your plan</Text>
          <Text style={styles.loadingSubtitle}>
            Our AI nutritionist is working on{'\n'}your personalised programme
          </Text>

          {/* Processing steps */}
          <View style={styles.stepsContainer}>
            {PROCESSING_STEPS.map((s, i) => (
              <Animated.View key={i} style={[styles.processingStep, { opacity: stepFadeAnims[i] }]}>
                <View style={[
                  styles.stepDot,
                  i < stepIndex ? styles.stepDotDone : i === stepIndex ? styles.stepDotActive : styles.stepDotPending,
                ]}>
                  {i < stepIndex ? (
                    <Text style={styles.stepCheck}>✓</Text>
                  ) : (
                    <Text style={styles.stepEmoji}>{s.emoji}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText,
                  i === stepIndex && styles.stepTextActive,
                  i < stepIndex && styles.stepTextDone,
                ]}>
                  {s.text}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Results phase ─────────────────────────────────────────────────────────
  const macroCards = [
    { label: 'Daily Calories', value: `${targets.calories}`, unit: 'kcal', color: ORANGE, emoji: '🔥' },
    { label: 'Protein', value: `${targets.proteinG}g`, unit: 'per day', color: '#3B82F6', emoji: '💪' },
    { label: 'Carbs', value: `${targets.carbsG}g`, unit: 'per day', color: '#10B981', emoji: '🌾' },
    { label: 'Fat', value: `${targets.fatG}g`, unit: 'per day', color: '#8B5CF6', emoji: '🥑' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.resultsScroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.resultsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={styles.resultsHeader}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.resultsTitle}>Your plan is ready,{'\n'}{name.split(' ')[0]}!</Text>
            <Text style={styles.resultsSubtitle}>
              Based on your goals and body metrics, here's what{'\n'}our AI nutritionist recommends
            </Text>
          </View>

          {/* Goals tag row */}
          <View style={styles.goalTags}>
            {goals.slice(0, 3).map((g) => (
              <View key={g} style={styles.goalTag}>
                <Text style={styles.goalTagText}>{GOAL_LABELS[g] ?? g}</Text>
              </View>
            ))}
          </View>

          {/* Big calorie card */}
          <View style={styles.calorieCard}>
            <Text style={styles.calorieEmoji}>🔥</Text>
            <View>
              <Text style={styles.calorieValue}>{targets.calories}</Text>
              <Text style={styles.calorieLabel}>calories per day</Text>
            </View>
            <View style={styles.calorieTag}>
              <Text style={styles.calorieTagText}>AI recommended</Text>
            </View>
          </View>

          {/* Macro grid */}
          <Text style={styles.macroSectionTitle}>Daily Macro Targets</Text>
          <View style={styles.macroGrid}>
            {macroCards.slice(1).map((card, i) => (
              <Animated.View
                key={card.label}
                style={[
                  styles.macroCard,
                  { borderLeftColor: card.color },
                  {
                    opacity: macroAnims[i],
                    transform: [{
                      scale: macroAnims[i].interpolate({
                        inputRange: [0, 1], outputRange: [0.85, 1],
                      }),
                    }],
                  },
                ]}
              >
                <Text style={styles.macroEmoji}>{card.emoji}</Text>
                <Text style={[styles.macroValue, { color: card.color }]}>{card.value}</Text>
                <Text style={styles.macroLabel}>{card.label}</Text>
                <Text style={styles.macroUnit}>{card.unit}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Nutritionist note */}
          <View style={styles.noteCard}>
            <Text style={styles.noteEmoji}>👩‍⚕️</Text>
            <Text style={styles.noteText}>
              These targets are calculated using the{' '}
              <Text style={{ fontFamily: FONTS.body.bold, color: '#1A1D2E' }}>Mifflin-St Jeor</Text> formula —
              the gold standard used by certified nutritionists.{' '}
              Your macros are fine-tuned for your specific goals.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>

      {/* CTA Button */}
      <Animated.View style={[styles.ctaContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, completing && { opacity: 0.7 }]}
          onPress={handleStartJourney}
          disabled={completing}
          activeOpacity={0.85}
        >
          {completing ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>Start my journey 🚀</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  pulseRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ORANGE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  pulseInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseEmoji: {
    fontSize: 40,
  },
  loadingTitle: {
    fontSize: 26,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 15,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -12,
  },
  stepsContainer: {
    width: '100%',
    gap: 14,
    marginTop: 8,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotPending: { backgroundColor: '#F1F5F9' },
  stepDotActive: {
    backgroundColor: ORANGE_LIGHT,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  stepDotDone: { backgroundColor: '#DCFCE7' },
  stepEmoji: { fontSize: 18 },
  stepCheck: { fontSize: 16, color: '#16A34A', fontFamily: FONTS.heading.bold },
  stepText: {
    fontSize: 15,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
    flex: 1,
  },
  stepTextActive: {
    color: '#1A1D2E',
    fontFamily: FONTS.body.medium,
  },
  stepTextDone: {
    color: '#16A34A',
    textDecorationLine: 'line-through',
  },

  // ── Results ──────────────────────────────────────────────────────────────
  resultsScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  resultsContainer: {
    gap: 20,
  },
  resultsHeader: {
    alignItems: 'center',
    gap: 10,
  },
  successEmoji: {
    fontSize: 52,
  },
  resultsTitle: {
    fontSize: 28,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
    lineHeight: 36,
  },
  resultsSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Goal tags
  goalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  goalTag: {
    backgroundColor: ORANGE_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FFD5C2',
  },
  goalTagText: {
    fontSize: 13,
    fontFamily: FONTS.body.medium,
    color: ORANGE,
  },

  // Big calorie card
  calorieCard: {
    backgroundColor: '#FFF8F5',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFD5C2',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  calorieEmoji: { fontSize: 36 },
  calorieValue: {
    fontSize: 40,
    fontFamily: FONTS.heading.bold,
    color: ORANGE,
  },
  calorieLabel: {
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
  },
  calorieTag: {
    marginLeft: 'auto',
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calorieTagText: {
    fontSize: 10,
    fontFamily: FONTS.body.bold,
    color: '#FFFFFF',
  },

  // Macro grid
  macroSectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.heading.semiBold,
    color: '#1A1D2E',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FAFAFB',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    gap: 4,
  },
  macroEmoji: { fontSize: 20 },
  macroValue: {
    fontSize: 24,
    fontFamily: FONTS.heading.bold,
  },
  macroLabel: {
    fontSize: 13,
    fontFamily: FONTS.body.medium,
    color: '#475569',
  },
  macroUnit: {
    fontSize: 11,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
  },

  // Note card
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteEmoji: { fontSize: 22, marginTop: 2 },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    lineHeight: 20,
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
    paddingTop: 8,
  },
  ctaBtn: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 7,
  },
  ctaBtnText: {
    fontSize: 18,
    fontFamily: FONTS.heading.bold,
    color: '#FFFFFF',
  },
});

export default OnboardingPlanScreen;
