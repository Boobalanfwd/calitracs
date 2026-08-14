import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  TextInput, ScrollView, Animated, ActivityIndicator,
  Alert, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActivityLevel, Goal, Gender } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { FONTS } from '../../theme/fonts';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

const TOTAL_STEPS = 9;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Goal Options ──────────────────────────────────────────────────────────────
const GOAL_OPTIONS: { value: Goal; label: string; emoji: string }[] = [
  { value: 'lose_fat',      label: 'Lose fat',       emoji: '📏' },
  { value: 'maintain',      label: 'Maintain',        emoji: '⚖️' },
  { value: 'gain_weight',   label: 'Gain weight',     emoji: '🍚' },
  { value: 'more_energy',   label: 'More energy',     emoji: '⚡' },
  { value: 'event_prep',    label: 'Event prep',      emoji: '🏆' },
  { value: 'muscle_up',     label: 'Muscle up',       emoji: '💪' },
  { value: 'control_sugar', label: 'Control sugar',   emoji: '🩺' },
  { value: 'eat_healthier', label: 'Eat healthier',   emoji: '🥗' },
  { value: 'just_track',    label: 'Just track',      emoji: '📱' },
];

// ── Activity Options ──────────────────────────────────────────────────────────
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; emoji: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary',         emoji: '🧘', desc: 'Little or no exercise' },
  { value: 'light',     label: 'Lightly active',    emoji: '🚶', desc: '1-3 days/week exercise' },
  { value: 'moderate',  label: 'Moderately active', emoji: '🏃', desc: '3-5 days/week exercise' },
  { value: 'active',    label: 'Very active',       emoji: '🚴', desc: '6-7 days/week exercise' },
  { value: 'very_active', label: 'Athlete mode',   emoji: '🏋️', desc: 'Intense daily training' },
];

// ── Scroll Picker (vertical) ──────────────────────────────────────────────────
interface ScrollPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  itemHeight?: number;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({
  values, selectedValue, onValueChange, itemHeight = 60,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const VISIBLE_ITEMS = 5;
  const PADDING = (VISIBLE_ITEMS - 1) / 2;

  const scrollToValue = useCallback((val: number) => {
    const idx = values.indexOf(val);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * itemHeight, animated: true });
    }
  }, [values, itemHeight]);

  useEffect(() => {
    const idx = values.indexOf(selectedValue);
    if (idx >= 0 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: false });
      }, 80);
    }
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const idx = Math.round(offsetY / itemHeight);
      const clamped = Math.max(0, Math.min(idx, values.length - 1));
      if (values[clamped] !== selectedValue) {
        onValueChange(values[clamped]);
      }
    },
    [values, selectedValue, onValueChange, itemHeight],
  );

  return (
    <View style={{ height: itemHeight * VISIBLE_ITEMS, overflow: 'hidden', position: 'relative' }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate={0.92}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingVertical: itemHeight * PADDING }}
      >
        {values.map((item) => {
          const isSelected = item === selectedValue;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.pickerItem, { height: itemHeight }]}
              onPress={() => { onValueChange(item); scrollToValue(item); }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.pickerItemText,
                isSelected ? styles.pickerItemTextSelected : styles.pickerItemTextDim,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Top fade */}
      <View pointerEvents="none" style={styles.pickerFadeTop} />
      {/* Bottom fade */}
      <View pointerEvents="none" style={styles.pickerFadeBottom} />
      {/* Center selection ring */}
      <View pointerEvents="none" style={[styles.pickerHighlight, { top: itemHeight * PADDING, height: itemHeight }]} />
    </View>
  );
};

// ── Horizontal Number Picker ──────────────────────────────────────────────────
interface HorizontalPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  unit?: string;
}

const HorizontalPicker: React.FC<HorizontalPickerProps> = ({ values, selectedValue, onValueChange, unit }) => {
  const ITEM_WIDTH = 72;
  const SIDE_PADDING = (SCREEN_WIDTH - ITEM_WIDTH) / 2; // always center-align

  const scrollRef = useRef<ScrollView>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      const idx = values.indexOf(selectedValue);
      if (idx >= 0) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({ x: idx * ITEM_WIDTH, animated: false });
          isInitialized.current = true;
        }, 80);
      }
    }
  }, []);

  // Re-sync scroll when values array changes (e.g. goal-based range restriction)
  useEffect(() => {
    const idx = values.indexOf(selectedValue);
    if (idx >= 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: idx * ITEM_WIDTH, animated: false });
      }, 50);
    }
  }, [values.length]);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    if (values[clamped] !== selectedValue) {
      onValueChange(values[clamped]);
    }
  }, [values, selectedValue, onValueChange]);

  return (
    <View style={styles.hPickerContainer}>
      {/* Large centered value display */}
      <View style={styles.hPickerValueBox}>
        <Text style={styles.hPickerBigText}>{selectedValue}</Text>
        {unit ? <Text style={styles.hPickerUnitText}>{unit}</Text> : null}
      </View>

      {/* Ruler-style horizontal strip */}
      <View style={styles.hPickerTrack}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate={0.88}
          contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
          style={{ height: 56 }}
          scrollEventThrottle={16}
        >
          {values.map((item) => {
            const isSelected = item === selectedValue;
            const isNear = Math.abs(item - selectedValue) === 1;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.hPickerItem, { width: ITEM_WIDTH }]}
                onPress={() => {
                  onValueChange(item);
                  const idx = values.indexOf(item);
                  scrollRef.current?.scrollTo({ x: idx * ITEM_WIDTH, animated: true });
                }}
                activeOpacity={0.6}
              >
                {/* Tick mark */}
                <View style={[
                  styles.hPickerTick,
                  isSelected ? styles.hPickerTickSelected : isNear ? styles.hPickerTickNear : null,
                ]} />
                <Text style={[
                  styles.hPickerItemText,
                  isSelected ? styles.hPickerItemSelected
                    : isNear ? styles.hPickerItemNear
                    : styles.hPickerItemDim,
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Left fade */}
        <View pointerEvents="none" style={styles.hPickerFadeLeft} />
        {/* Right fade */}
        <View pointerEvents="none" style={styles.hPickerFadeRight} />
        {/* Center selection indicator */}
        <View pointerEvents="none" style={styles.hPickerCenterIndicator} />
      </View>
    </View>
  );
};

// ── Main Onboarding Component ─────────────────────────────────────────────────
interface OnboardingForm {
  name: string;
  gender: Gender | 'prefer_not' | '';
  goals: Goal[];
  heightCm: number;
  heightUnit: 'cm' | 'ft';
  heightFt: number;
  heightIn: number;
  weightKg: number;
  weightUnit: 'kg' | 'lbs';
  targetWeightKg: number;
  targetWeightUnit: 'kg' | 'lbs';
  hasTargetWeight: boolean;
  activityLevel: ActivityLevel | '';
  age: string;
  aiDisclaimerAccepted: boolean;
}

const range = (start: number, end: number, step = 1) => {
  const arr = [];
  for (let i = start; i <= end; i += step) arr.push(i);
  return arr;
};

const HEIGHT_CM = range(100, 250);
const WEIGHT_KG = range(30, 200);
const WEIGHT_LBS = range(66, 440);
const HEIGHT_FT = range(3, 8);
const HEIGHT_IN = range(0, 11);

/**
 * Client-side Mifflin-St Jeor calculator for guaranteed personalized targets.
 * Takes inputs from all 8 onboarding steps.
 */
function calculateClientTargets(
  age: number,
  weightKg: number,
  heightCm: number,
  gender: Gender | 'other',
  activityLevel: ActivityLevel | 'moderate',
  goal: Goal
): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  let tdee = bmr * (multipliers[activityLevel] || 1.55);

  if (goal === 'lose' || goal === 'lose_fat') {
    tdee -= 500;
  } else if (goal === 'gain' || goal === 'gain_weight' || goal === 'muscle_up') {
    tdee += 300;
  }

  const minCalories = gender === 'male' ? 1500 : 1200;
  const calories = Math.round(Math.max(tdee, minCalories));

  let ratios = { protein: 0.30, carbs: 0.45, fat: 0.25 };
  if (goal === 'lose_fat' || goal === 'lose') {
    ratios = { protein: 0.35, carbs: 0.40, fat: 0.25 };
  } else if (goal === 'muscle_up' || goal === 'gain' || goal === 'gain_weight') {
    ratios = { protein: 0.35, carbs: 0.45, fat: 0.20 };
  } else if (goal === 'more_energy' || goal === 'event_prep') {
    ratios = { protein: 0.25, carbs: 0.55, fat: 0.20 };
  } else if (goal === 'control_sugar') {
    ratios = { protein: 0.35, carbs: 0.30, fat: 0.35 };
  }

  const proteinG = Math.round((calories * ratios.protein) / 4);
  const carbsG = Math.round((calories * ratios.carbs) / 4);
  const fatG = Math.round((calories * ratios.fat) / 9);

  return { calories, proteinG, carbsG, fatG };
}

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { updateProfile, updateTargets, user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  const [form, setForm] = useState<OnboardingForm>({
    name: user?.name ?? '',
    gender: '',
    goals: [],
    heightCm: 170,
    heightUnit: 'cm',
    heightFt: 5,
    heightIn: 7,
    weightKg: 70,
    weightUnit: 'kg',
    targetWeightKg: 65,
    targetWeightUnit: 'kg',
    hasTargetWeight: true,
    activityLevel: '',
    age: '',
    aiDisclaimerAccepted: false,
  });

  const update = <K extends keyof OnboardingForm>(key: K, val: OnboardingForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const goToStep = (s: number) => {
    Animated.timing(progressAnim, {
      toValue: s / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setStep(s);
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) goToStep(step + 1);
    else handleFinish();
  };

  const handleBack = () => {
    if (step > 1) goToStep(step - 1);
  };

  // Validate per-step before proceeding
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return form.aiDisclaimerAccepted;        // must tick disclaimer
      case 2: return form.name.trim().length >= 2;
      case 3: return form.gender !== '';
      case 4: return form.goals.length === 1;           // exactly one goal required
      case 5: return true;
      case 6: return true;
      case 7: return true;
      case 8: return form.activityLevel !== '';
      case 9: {
        const a = parseInt(form.age);
        return !isNaN(a) && a >= 10 && a <= 110;
      }
      default: return true;
    }
  };

  // All goals are single-select — tap to select, tap again to deselect
  const SINGLE_SELECT_GOALS: Goal[] = GOAL_OPTIONS.map((o) => o.value);

  const toggleGoal = (goal: Goal) => {
    setForm((f) => {
      // Tap same → deselect
      if (f.goals[0] === goal) return { ...f, goals: [] };
      // Otherwise replace with the new single selection
      return { ...f, goals: [goal] };
    });
  };

  const handleFinish = async () => {
    if (!canProceed()) {
      Alert.alert('Almost done!', 'Please fill in your age to continue.');
      return;
    }
    setLoading(true);
    try {
      const age = parseInt(form.age) || 25;

      // Convert height to cm
      let heightCm = form.heightCm;
      if (form.heightUnit === 'ft') {
        heightCm = Math.round((form.heightFt * 12 + form.heightIn) * 2.54);
      }

      // Convert weight to kg
      let weightKg = form.weightUnit === 'kg'
        ? form.weightKg
        : Math.round((form.weightKg / 2.20462) * 10) / 10;

      // Convert target weight to kg
      let targetWeightKg = form.targetWeightUnit === 'kg'
        ? form.targetWeightKg
        : Math.round((form.targetWeightKg / 2.20462) * 10) / 10;

      // Map gender
      const genderMapped: Gender =
        form.gender === 'prefer_not' ? 'other' : (form.gender as Gender) || 'male';

      // Primary goal = first selected goal
      const primaryGoal = form.goals[0] ?? 'maintain';
      const actLevel = (form.activityLevel as ActivityLevel) || 'moderate';

      // Compute exact personalised targets using all 8 onboarding inputs
      const calculatedTargets = calculateClientTargets(
        age,
        weightKg,
        heightCm,
        genderMapped,
        actLevel,
        primaryGoal
      );

      // Save profile to database
      const result = await updateProfile({
        age,
        weightKg,
        heightCm,
        targetWeightKg: form.hasTargetWeight ? targetWeightKg : undefined,
        gender: genderMapped,
        activityLevel: actLevel,
        goal: primaryGoal,
        goals: form.goals,
        unitSystem: form.weightUnit === 'kg' ? 'metric' : 'imperial',
      } as any);

      const finalTargets = result.suggestedTargets ?? calculatedTargets;
      await updateTargets(finalTargets);

      // Navigate to plan reveal with guaranteed accurate personalized targets
      (navigation as any).navigate('OnboardingPlan', {
        targets: finalTargets,
        name: form.name.trim(),
        goals: form.goals,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Progress bar width ──────────────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const nextEnabled = canProceed() && !loading;

  // ── Render step content ─────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ──────────────────────────────────────────────────────────────────────
      // Step 1: AI Disclaimer — must accept before starting
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>Before we start 🤖</Text>
            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerEmoji}>⚠️</Text>
              <Text style={styles.disclaimerTitle}>AI-Powered Tracking</Text>
              <Text style={styles.disclaimerBody}>
                Calitracs uses AI to estimate calories and macros from food descriptions and images.
                {`\n\n`}
                AI analysis can make mistakes — portion sizes, ingredients, and preparation methods can affect accuracy.
                {`\n\n`}
                Always cross-check results with a certified nutritionist or dietitian, especially if you have a medical condition.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.disclaimerCheckRow}
              onPress={() => update('aiDisclaimerAccepted', !form.aiDisclaimerAccepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, form.aiDisclaimerAccepted && styles.checkboxChecked]}>
                {form.aiDisclaimerAccepted && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.disclaimerCheckLabel}>
                I understand that AI results may have errors and I will cross-check important data
              </Text>
            </TouchableOpacity>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your name?</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.nameInput}
                placeholder="Your name"
                placeholderTextColor="#C5C9D6"
                value={form.name}
                onChangeText={(v) => update('name', v)}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => canProceed() && handleNext()}
              />
            </View>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your gender?</Text>
            <View style={styles.genderRow}>
              {(['male', 'female'] as const).map((g) => {
                const selected = form.gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, selected && styles.genderBtnSelected]}
                    onPress={() => update('gender', g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.genderBtnText, selected && styles.genderBtnTextSelected]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 4: {
        const selectedGoal = form.goals[0] ?? null;
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your goal?</Text>
            <View style={styles.goalList}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = selectedGoal === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.goalCard, selected && styles.goalCardSelected]}
                    onPress={() => toggleGoal(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.goalCardIcon, selected && styles.goalCardIconSelected]}>
                      <Text style={styles.goalCardEmoji}>{opt.emoji}</Text>
                    </View>
                    <Text style={[styles.goalCardLabel, selected && styles.goalCardLabelSelected]}>
                      {opt.label}
                    </Text>
                    <View style={[styles.goalCardRadio, selected && styles.goalCardRadioSelected]}>
                      {selected && <View style={styles.goalCardRadioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.goalHint}>
              {selectedGoal
                ? <Text style={{ color: '#FF6B2C', fontFamily: FONTS.body.bold }}>Tap again to deselect</Text>
                : <>Tap to <Text style={{ color: '#FF6B2C', fontFamily: FONTS.body.bold }}>pick one</Text> goal</>}
            </Text>
          </View>
        );
      }

      // ──────────────────────────────────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your height?</Text>
            {form.heightUnit === 'cm' ? (
              <ScrollPicker
                values={HEIGHT_CM}
                selectedValue={form.heightCm}
                onValueChange={(v) => update('heightCm', v)}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitSubLabel}>Feet</Text>
                  <ScrollPicker
                    values={HEIGHT_FT}
                    selectedValue={form.heightFt}
                    onValueChange={(v) => update('heightFt', v)}
                    itemHeight={48}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitSubLabel}>Inches</Text>
                  <ScrollPicker
                    values={HEIGHT_IN}
                    selectedValue={form.heightIn}
                    onValueChange={(v) => update('heightIn', v)}
                    itemHeight={48}
                  />
                </View>
              </View>
            )}
            <View style={styles.unitToggle}>
              {(['ft', 'cm'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, form.heightUnit === u && styles.unitBtnActive]}
                  onPress={() => update('heightUnit', u)}
                >
                  <Text style={[styles.unitBtnText, form.heightUnit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your current weight?</Text>
            <HorizontalPicker
              values={form.weightUnit === 'kg' ? WEIGHT_KG : WEIGHT_LBS}
              selectedValue={form.weightKg}
              onValueChange={(v) => update('weightKg', v)}
            />
            <View style={styles.unitToggle}>
              {(['lbs', 'kg'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, form.weightUnit === u && styles.unitBtnActive]}
                  onPress={() => {
                    if (form.weightUnit !== u) {
                      const newW = u === 'lbs' ? Math.round(form.weightKg * 2.20462) : Math.round(form.weightKg / 2.20462);
                      const clampedW = u === 'lbs' ? Math.max(70, Math.min(newW, 440)) : Math.max(30, Math.min(newW, 200));
                      setForm((f) => ({ ...f, weightUnit: u, weightKg: clampedW }));
                    }
                  }}
                >
                  <Text style={[styles.unitBtnText, form.weightUnit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 7: {
        const primaryGoal6 = form.goals[0];
        const isGainWeight = primaryGoal6 === 'gain_weight';
        const isLoseFat = primaryGoal6 === 'lose_fat';

        // Build the full weight range for the chosen unit
        const fullRange6 = form.targetWeightUnit === 'kg' ? WEIGHT_KG : WEIGHT_LBS;

        // Restrict the target weight range based on the primary goal
        let targetWeightValues = fullRange6;
        let hintText: string | null = null;

        if (isGainWeight) {
          // Target must be >= current weight
          targetWeightValues = fullRange6.filter((v) => v >= form.weightKg);
          hintText = 'Target must be higher than your current weight';
        } else if (isLoseFat) {
          // Target must be <= current weight
          targetWeightValues = fullRange6.filter((v) => v <= form.weightKg);
          hintText = 'Target must be lower than your current weight';
        }

        // Clamp the current target selection into the allowed range
        const minAllowed6 = targetWeightValues[0] ?? fullRange6[0];
        const maxAllowed6 = targetWeightValues[targetWeightValues.length - 1] ?? fullRange6[fullRange6.length - 1];
        const clampedTarget6 = Math.max(minAllowed6, Math.min(form.targetWeightKg, maxAllowed6));
        if (clampedTarget6 !== form.targetWeightKg) {
          // Silently correct out-of-range value
          setTimeout(() => update('targetWeightKg', clampedTarget6), 0);
        }

        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your target weight?</Text>
            <HorizontalPicker
              values={targetWeightValues}
              selectedValue={clampedTarget6}
              onValueChange={(v) => update('targetWeightKg', v)}
            />
            {hintText && (
              <Text style={styles.targetWeightHint}>{hintText}</Text>
            )}
            <View style={styles.unitToggle}>
              {(['lbs', 'kg'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, form.targetWeightUnit === u && styles.unitBtnActive]}
                  onPress={() => {
                    if (form.targetWeightUnit !== u) {
                      const newW = u === 'lbs' ? Math.round(form.targetWeightKg * 2.20462) : Math.round(form.targetWeightKg / 2.20462);
                      const clampedW = u === 'lbs' ? Math.max(70, Math.min(newW, 440)) : Math.max(30, Math.min(newW, 200));
                      setForm((f) => ({ ...f, targetWeightUnit: u, targetWeightKg: clampedW }));
                    }
                  }}
                >
                  <Text style={[styles.unitBtnText, form.targetWeightUnit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      // ──────────────────────────────────────────────────────────────────────
      case 8:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your activity level?</Text>
            <View style={styles.activityList}>
              {ACTIVITY_OPTIONS.map((opt) => {
                const selected = form.activityLevel === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.activityCard, selected && styles.activityCardSelected]}
                    onPress={() => update('activityLevel', opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.activityEmoji}>{opt.emoji}</Text>
                    <View style={styles.activityTextGroup}>
                      <Text style={[styles.activityLabel, selected && styles.activityLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.activityDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 9:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>How old are you?</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.nameInput}
                placeholder="25"
                placeholderTextColor="#C5C9D6"
                value={form.age}
                onChangeText={(v) => update('age', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                maxLength={3}
                returnKeyType="done"
              />
            </View>
            <Text style={styles.ageHint}>We use this to calculate your metabolic rate accurately</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        {step > 1 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <Text style={styles.stepCounter}>{step}/{TOTAL_STEPS}</Text>
      </View>

      {/* ── Step content ────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* ── Bottom Buttons ───────────────────────────────────────────── */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.nextBtn, !nextEnabled && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!nextEnabled}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS ? 'Build my plan ✨' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Prefer not to say (gender step only) */}
        {step === 3 && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { update('gender', 'prefer_not'); handleNext(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Prefer not to say</Text>
          </TouchableOpacity>
        )}

        {/* Skip target weight */}
        {step === 7 && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { update('hasTargetWeight', false); handleNext(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>I don't have a target weight</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────
const ORANGE = '#FF6B2C';
const ORANGE_LIGHT = '#FFF3EE';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: ORANGE,
    fontFamily: FONTS.heading.bold,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  stepCounter: {
    fontSize: 14,
    fontFamily: FONTS.body.medium,
    color: '#94A3B8',
    minWidth: 32,
    textAlign: 'right',
  },

  // ── Scroll content
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  stepContainer: {
    flex: 1,
    gap: 28,
  },
  questionTitle: {
    fontSize: 28,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
    lineHeight: 36,
  },

  // ── Step 1 / Step 8 – Name / Age
  // ── Step 1 – AI Disclaimer
  disclaimerCard: {
    backgroundColor: '#FFFBF5',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFE0C2',
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  disclaimerEmoji: {
    fontSize: 36,
  },
  disclaimerTitle: {
    fontSize: 18,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
  },
  disclaimerBody: {
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#475569',
    lineHeight: 21,
    textAlign: 'center',
  },
  disclaimerCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFB',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#FF6B2C',
    borderColor: '#FF6B2C',
  },
  checkboxTick: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: FONTS.heading.bold,
    lineHeight: 16,
  },
  disclaimerCheckLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.body.medium,
    color: '#1A1D2E',
    lineHeight: 21,
  },

  inputBox: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FAFAFB',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  nameInput: {
    fontSize: 18,
    fontFamily: FONTS.body.regular,
    color: '#1A1D2E',
    textAlign: 'center',
  },
  ageHint: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
    marginTop: -16,
  },

  // ── Step 2 – Gender
  genderRow: {
    flexDirection: 'row',
    gap: 14,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE_LIGHT,
  },
  genderBtnText: {
    fontSize: 16,
    fontFamily: FONTS.heading.semiBold,
    color: '#64748B',
  },
  genderBtnTextSelected: {
    color: ORANGE,
  },

  // ── Step 3 – Goals (card list, single-select)
  goalList: {
    gap: 10,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  goalCardSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE_LIGHT,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  goalCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F4F6FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardIconSelected: {
    backgroundColor: 'rgba(255,107,44,0.15)',
  },
  goalCardEmoji: {
    fontSize: 22,
  },
  goalCardLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.heading.semiBold,
    color: '#1A1D2E',
  },
  goalCardLabelSelected: {
    color: ORANGE,
  },
  goalCardRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardRadioSelected: {
    borderColor: ORANGE,
  },
  goalCardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },
  goalHint: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    marginTop: -4,
  },
  targetWeightHint: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#FF6B2C',
    marginTop: -16,
    paddingHorizontal: 12,
  },

  // ── Vertical Picker
  pickerItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    fontFamily: FONTS.heading.bold,
  },
  pickerItemTextSelected: {
    fontSize: 48,
    color: '#1A1D2E',
  },
  pickerItemTextDim: {
    fontSize: 20,
    color: '#D1D9E6',
  },
  pickerHighlight: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,107,44,0.04)',
  },
  pickerFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    // Simulate gradient via a semi-opaque white overlay
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    opacity: 0.85,
    // Use background gradient workaround: solid white tapering with shadow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 0,
  } as any,
  pickerFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    opacity: 0.85,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: -40 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 0,
  } as any,

  // ── Horizontal Picker (ruler-style)
  hPickerContainer: {
    gap: 16,
  },
  hPickerValueBox: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 20,
    paddingHorizontal: 36,
    minWidth: 140,
  },
  hPickerBigText: {
    fontSize: 56,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
    lineHeight: 64,
  },
  hPickerUnitText: {
    fontSize: 16,
    fontFamily: FONTS.body.medium,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  hPickerTrack: {
    position: 'relative',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFB',
  },
  hPickerItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    height: 56,
  },
  hPickerTick: {
    width: 1.5,
    height: 10,
    backgroundColor: '#D1D9E6',
    borderRadius: 1,
    marginBottom: 4,
  },
  hPickerTickSelected: {
    width: 2.5,
    height: 18,
    backgroundColor: ORANGE,
  },
  hPickerTickNear: {
    height: 14,
    backgroundColor: '#94A3B8',
  },
  hPickerItemText: {
    fontFamily: FONTS.heading.bold,
  },
  hPickerItemSelected: {
    fontSize: 18,
    color: ORANGE,
  },
  hPickerItemNear: {
    fontSize: 14,
    color: '#475569',
  },
  hPickerItemDim: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  hPickerFadeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 72,
    // Simulate left-to-right white fade
    backgroundColor: 'transparent',
    shadowColor: '#FAFAFB',
    shadowOffset: { width: 40, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
  } as any,
  hPickerFadeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 72,
    backgroundColor: 'transparent',
    shadowColor: '#FAFAFB',
    shadowOffset: { width: -40, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
  } as any,
  hPickerCenterIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%' as any,
    marginLeft: -36,
    width: 72,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,107,44,0.04)',
  },

  unitSubLabel: {
    fontSize: 12,
    fontFamily: FONTS.body.medium,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 4,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#F4F6FB',
    borderRadius: 12,
    padding: 4,
    alignSelf: 'center',
  },
  unitBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  unitBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  unitBtnText: {
    fontSize: 14,
    fontFamily: FONTS.body.medium,
    color: '#94A3B8',
  },
  unitBtnTextActive: {
    color: '#1A1D2E',
    fontFamily: FONTS.body.bold,
  },

  // ── Step 7 – Activity
  activityList: {
    gap: 10,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  activityCardSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE_LIGHT,
  },
  activityEmoji: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  activityTextGroup: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    fontSize: 15,
    fontFamily: FONTS.heading.semiBold,
    color: '#1A1D2E',
  },
  activityLabelSelected: {
    color: ORANGE,
  },
  activityDesc: {
    fontSize: 12,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ORANGE,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },

  // ── Bottom
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    gap: 10,
  },
  nextBtn: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextBtnDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnText: {
    fontSize: 17,
    fontFamily: FONTS.heading.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: FONTS.heading.semiBold,
    color: '#1A1D2E',
  },
});

export default OnboardingScreen;
