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

const TOTAL_STEPS = 8;
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

// ── Scroll Picker ─────────────────────────────────────────────────────────────
interface ScrollPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  itemHeight?: number;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({
  values, selectedValue, onValueChange, itemHeight = 56,
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
      }, 50);
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
    <View style={{ height: itemHeight * VISIBLE_ITEMS, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
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
              style={[
                styles.pickerItem,
                { height: itemHeight },
                isSelected && styles.pickerItemSelected,
              ]}
              onPress={() => { onValueChange(item); scrollToValue(item); }}
              activeOpacity={0.8}
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
      {/* Selection highlight overlay */}
      <View pointerEvents="none" style={[styles.pickerHighlight, { top: itemHeight * PADDING, height: itemHeight }]} />
    </View>
  );
};

// ── Horizontal Number Picker ──────────────────────────────────────────────────
interface HorizontalPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
}

const HorizontalPicker: React.FC<HorizontalPickerProps> = ({ values, selectedValue, onValueChange }) => {
  const ITEM_WIDTH = 64;
  const VISIBLE_ITEMS = 5;
  const SIDE_PADDING = Math.floor(VISIBLE_ITEMS / 2) * ITEM_WIDTH; // 2 * 64 = 128

  const scrollRef = useRef<ScrollView>(null);
  const isInitialized = useRef(false);

  // Scroll to initial selectedValue on first mount
  useEffect(() => {
    if (!isInitialized.current) {
      const idx = values.indexOf(selectedValue);
      if (idx >= 0) {
        // Small delay ensures layout is complete before scrollTo
        setTimeout(() => {
          scrollRef.current?.scrollTo({ x: idx * ITEM_WIDTH, animated: false });
          isInitialized.current = true;
        }, 80);
      }
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    if (values[clamped] !== selectedValue) {
      onValueChange(values[clamped]);
    }
  }, [values, selectedValue, onValueChange]);

  return (
    <View>
      {/* Big selected number shown ABOVE the scroll bar */}
      <View style={styles.hPickerValueBox}>
        <Text style={styles.hPickerBigText}>{selectedValue}</Text>
      </View>

      {/* Horizontal scroll strip showing adjacent numbers */}
      <View style={styles.hPickerScrollRow}>
        <View style={styles.hPickerLine} />
        <View style={styles.hPickerScrollWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
            onMomentumScrollEnd={handleScroll}
            onScrollEndDrag={handleScroll}
            style={{ height: 44 }}
          >
            {values.map((item) => {
              const isSelected = item === selectedValue;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.hPickerItem, { width: ITEM_WIDTH }]}
                  onPress={() => {
                    onValueChange(item);
                    const idx = values.indexOf(item);
                    scrollRef.current?.scrollTo({ x: idx * ITEM_WIDTH, animated: true });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={isSelected ? styles.hPickerItemSelected : styles.hPickerItemDim}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Center highlight box — purely decorative, no text */}
          <View pointerEvents="none" style={styles.hPickerCenterBox} />
        </View>
        <View style={styles.hPickerLine} />
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
      case 1: return form.name.trim().length >= 2;
      case 2: return form.gender !== '';
      case 3: return form.goals.length > 0;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      case 7: return form.activityLevel !== '';
      case 8: {
        const a = parseInt(form.age);
        return !isNaN(a) && a >= 10 && a <= 110;
      }
      default: return true;
    }
  };

  const toggleGoal = (goal: Goal) => {
    setForm((f) => {
      if (f.goals.includes(goal)) {
        return { ...f, goals: f.goals.filter((g) => g !== goal) };
      }
      if (f.goals.length >= 3) {
        // Remove oldest, add new
        return { ...f, goals: [...f.goals.slice(1), goal] };
      }
      return { ...f, goals: [...f.goals, goal] };
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
      case 1:
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
      case 2:
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
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your goal?</Text>
            <View style={styles.goalGrid}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = form.goals.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.goalBubble, selected && styles.goalBubbleSelected]}
                    onPress={() => toggleGoal(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.goalEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.goalHint}>
              Pick up to <Text style={{ color: '#FF6B2C', fontFamily: FONTS.body.bold }}>3 goals</Text> that fit you best!
            </Text>
          </View>
        );

      // ──────────────────────────────────────────────────────────────────────
      case 4:
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
      case 5:
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
      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionTitle}>What's your target weight?</Text>
            <HorizontalPicker
              values={form.targetWeightUnit === 'kg' ? WEIGHT_KG : WEIGHT_LBS}
              selectedValue={form.targetWeightKg}
              onValueChange={(v) => update('targetWeightKg', v)}
            />
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

      // ──────────────────────────────────────────────────────────────────────
      case 7:
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
      case 8:
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
        {step === 2 && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { update('gender', 'prefer_not'); handleNext(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Prefer not to say</Text>
          </TouchableOpacity>
        )}

        {/* Skip target weight */}
        {step === 6 && (
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

  // ── Step 3 – Goals
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  goalBubble: {
    width: (SCREEN_WIDTH - 48 - 32) / 3,
    aspectRatio: 1,
    borderRadius: 100,
    backgroundColor: '#F4F6FB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalBubbleSelected: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  goalEmoji: {
    fontSize: 26,
  },
  goalLabel: {
    fontSize: 11,
    fontFamily: FONTS.body.medium,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  goalLabelSelected: {
    color: '#FFFFFF',
    fontFamily: FONTS.body.bold,
  },
  goalHint: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    marginTop: -12,
  },

  // ── Steps 4-6 – Pickers
  pickerItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#FAFAFB',
    borderRadius: 14,
    marginHorizontal: 12,
  },
  pickerItemText: {
    fontFamily: FONTS.heading.bold,
  },
  pickerItemTextSelected: {
    fontSize: 48,
    color: '#1A1D2E',
  },
  pickerItemTextDim: {
    fontSize: 22,
    color: '#CBD5E1',
  },
  pickerHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: 'transparent',
  },

  // Horizontal picker — clean separated layout
  hPickerValueBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignSelf: 'center',
    minWidth: 120,
    marginBottom: 20,
  },
  hPickerBigText: {
    fontSize: 52,
    fontFamily: FONTS.heading.bold,
    color: '#1A1D2E',
    textAlign: 'center',
  },
  hPickerScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hPickerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E2E8F0',
  },
  hPickerScrollWrap: {
    position: 'relative',
    width: 320,
  },
  hPickerCenterBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -32,
    width: 64,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ORANGE,
    backgroundColor: 'transparent',
  } as any,
  hPickerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  hPickerItemSelected: {
    fontSize: 20,
    fontFamily: FONTS.heading.bold,
    color: ORANGE,
  },
  hPickerItemDim: {
    fontSize: 16,
    fontFamily: FONTS.heading.regular,
    color: '#CBD5E1',
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
