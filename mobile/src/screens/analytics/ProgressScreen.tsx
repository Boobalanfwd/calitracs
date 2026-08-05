import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
  TouchableOpacity, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Button, Portal, Dialog, TextInput as PaperInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { HelpCircle, Pencil, RotateCcw, Droplet } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLog } from '../../contexts/LogContext';
import { API } from '../../services/api';
import { FONTS } from '../../theme/fonts';
import { ScreenLoader, SkeletonTransition } from '../../components/ui';

const { width } = Dimensions.get('window');

// Helper to get 7 days of current week (Monday to Sunday)
const getWeekDays = (weekOffset = 0) => {
  const now = new Date();
  now.setDate(now.getDate() - weekOffset * 7);

  const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
  const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + distToMon);

  const days = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    days.push({
      day: dayNames[i],
      dateStr,
      isToday,
    });
  }
  return days;
};

type PeriodType = 'this_week' | 'last_week' | '2_wks' | '3_wks';

const ProgressScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, token, targets, updateProfile } = useAuth();
  const { todayLog } = useLog();

  // Dynamic profile weight and height values
  const currentWeight = user?.profile?.weightKg ?? 75;
  const currentHeight = user?.profile?.heightCm ?? 172;
  const targetWeight =
    user?.profile?.targetWeightKg ??
    (user?.profile?.goal === 'lose' ? currentWeight - 5 : currentWeight + 3);

  // Calculate BMI (weight in kg / (height in meters)^2)
  const heightM = currentHeight / 100;
  const rawBmi = heightM > 0 ? currentWeight / (heightM * heightM) : 25.4;
  const bmi = Math.round(rawBmi * 10) / 10;

  // Determine BMI Status category & color scheme
  let bmiCategory = 'Normal';
  let bmiBadgeBg = '#DCFCE7';
  let bmiBadgeText = '#16A34A';
  if (bmi < 18.5) {
    bmiCategory = 'Underweight';
    bmiBadgeBg = '#EFF6FF';
    bmiBadgeText = '#2563EB';
  } else if (bmi >= 18.5 && bmi < 25) {
    bmiCategory = 'Normal';
    bmiBadgeBg = '#DCFCE7';
    bmiBadgeText = '#16A34A';
  } else if (bmi >= 25 && bmi < 30) {
    bmiCategory = 'Overweight';
    bmiBadgeBg = '#FEF9C3';
    bmiBadgeText = '#CA8A04';
  } else {
    bmiCategory = 'Obese';
    bmiBadgeBg = '#FEE2E2';
    bmiBadgeText = '#DC2626';
  }

  // Calculate position index for the 28-dash segmented scale (range: 15 to 35 BMI)
  const totalDashes = 28;
  const minBmiScale = 15;
  const maxBmiScale = 35;
  const normalizedBmi = Math.max(minBmiScale, Math.min(maxBmiScale, bmi));
  const activeDashIndex = Math.round(
    ((normalizedBmi - minBmiScale) / (maxBmiScale - minBmiScale)) * (totalDashes - 1)
  );

  // Modals & State
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState(currentWeight.toString());
  const [newHeightInput, setNewHeightInput] = useState(currentHeight.toString());
  const [newTargetInput, setNewTargetInput] = useState(targetWeight.toString());
  const [isSaving, setIsSaving] = useState(false);

  // Period filter state for Nutrition chart (default: This week)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this_week');

  // Weekly Data state
  const [weeklyData, setWeeklyData] = useState<
    Array<{
      day: string;
      dateStr: string;
      kcal: number;
      proteinKcal: number;
      carbsKcal: number;
      fatKcal: number;
      isToday: boolean;
    }>
  >([]);
  const [totalWeeklyKcal, setTotalWeeklyKcal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Water chart state
  const [waterData, setWaterData] = useState<Array<{ date: string; waterMl: number; day: string; isToday: boolean }>>([]);
  const [waterTarget, setWaterTarget] = useState(2000);
  const [avgWaterMl, setAvgWaterMl] = useState(0);

  useEffect(() => {
    setNewWeightInput(currentWeight.toString());
    setNewHeightInput(currentHeight.toString());
    setNewTargetInput(targetWeight.toString());
  }, [currentWeight, currentHeight, targetWeight]);

  const loadWeeklyData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let offset = 0;
      if (selectedPeriod === 'last_week') offset = 1;
      if (selectedPeriod === '2_wks') offset = 2;
      if (selectedPeriod === '3_wks') offset = 3;

      const weekDays = getWeekDays(offset);
      const firstWeekDate = new Date(weekDays[0].dateStr);
      const lastWeekDate = new Date(weekDays[6].dateStr);

      const monthsToFetch = new Set<string>();
      monthsToFetch.add(`${firstWeekDate.getFullYear()}-${firstWeekDate.getMonth() + 1}`);
      monthsToFetch.add(`${lastWeekDate.getFullYear()}-${lastWeekDate.getMonth() + 1}`);

      const logsMap = new Map<
        string,
        { kcal: number; protein: number; carbs: number; fat: number }
      >();

      for (const mStr of monthsToFetch) {
        const [y, m] = mStr.split('-').map(Number);
        const monthRes = await API.getCalendarMonth(token, y, m);
        (monthRes.days || []).forEach((d: any) => {
          logsMap.set(d.date, {
            kcal: d.totalCalories || 0,
            protein: d.totalProteinG ?? (d.totalProtein || Math.round((d.totalCalories * 0.25) / 4)),
            carbs: d.totalCarbsG ?? (d.totalCarbs || Math.round((d.totalCalories * 0.5) / 4)),
            fat: d.totalFatG ?? (d.totalFat || Math.round((d.totalCalories * 0.25) / 9)),
          });
        });
      }

      let sum = 0;
      const mapped = weekDays.map((w) => {
        let entry = logsMap.get(w.dateStr) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        // Only override entry if todayLog in LogContext actually belongs to this exact date
        if (todayLog && todayLog.date === w.dateStr) {
          entry = {
            kcal: todayLog.totalCalories ?? entry.kcal,
            protein: todayLog.totalProteinG ?? entry.protein,
            carbs: todayLog.totalCarbsG ?? entry.carbs,
            fat: todayLog.totalFatG ?? entry.fat,
          };
        }
        sum += entry.kcal;

        // Convert macros to calories for stacked bar segment height
        const proteinKcal = Math.round(entry.protein * 4);
        const carbsKcal = Math.round(entry.carbs * 4);
        const fatKcal = Math.round(entry.fat * 9);

        return {
          day: w.day,
          dateStr: w.dateStr,
          kcal: entry.kcal,
          proteinKcal,
          carbsKcal,
          fatKcal,
          isToday: w.isToday,
        };
      });

      // 100% Real Database Data (No mock fallback)
      setWeeklyData(mapped);
      setTotalWeeklyKcal(sum);

      // ── Fetch weekly water data (same week range) ──────────────────────────
      const weekDaysForWater = getWeekDays(offset);
      const startDateStr = weekDaysForWater[0].dateStr;
      try {
        const waterRes = await API.getWeeklyWater(token, startDateStr);
        const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const todayStr = new Date().toISOString().split('T')[0];
        const mapped = waterRes.days.map((d, i) => ({
          date: d.date,
          waterMl: d.waterMl,
          day: DAY_NAMES[i] ?? '',
          isToday: d.date === todayStr,
        }));
        setWaterData(mapped);
        setWaterTarget(waterRes.targetWaterMl);
        setAvgWaterMl(waterRes.avgWaterMl);
      } catch (wErr) {
        console.warn('[ProgressScreen] Weekly water fetch failed:', wErr);
      }
    } catch (err) {
      console.warn('[ProgressScreen] Failed to load weekly database progress:', err);
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  }, [token, todayLog, selectedPeriod]);

  useFocusEffect(
    useCallback(() => {
      loadWeeklyData();
    }, [loadWeeklyData])
  );

  const dailyAvgKcal = Math.round(totalWeeklyKcal / 7);
  const maxBarKcal = Math.max(2500, ...weeklyData.map((d) => d.kcal));

  const handleSaveWeighIn = async () => {
    const parsedWeight = parseFloat(newWeightInput);
    const parsedHeight = parseFloat(newHeightInput);
    const parsedTarget = parseFloat(newTargetInput);

    if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        weightKg: parsedWeight,
        heightCm: !isNaN(parsedHeight) ? parsedHeight : currentHeight,
        targetWeightKg: !isNaN(parsedTarget) ? parsedTarget : targetWeight,
      });

      setWeightModalOpen(false);
      Alert.alert('✅ BMI & Weight Saved!', `Updated profile to ${parsedWeight} kg.`);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Failed to update weight.');
    } finally {
      setIsSaving(false);
    }
  };

  const isInitialLoad = loading && weeklyData.length === 0;

  return (
    <SkeletonTransition
      isLoading={isInitialLoad}
      skeleton={<ScreenLoader variant="progress" />}
    >
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── SECTION 1: YOUR BMI ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your BMI</Text>
        </View>

        <Surface style={styles.cardContainer} elevation={1}>
          {/* Card Header: Status & Help Icon */}
          <View style={styles.bmiHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.bmiWeightText}>Your Weight is</Text>
              <View style={[styles.bmiStatusBadge, { backgroundColor: bmiBadgeBg }]}>
                <Text style={[styles.bmiStatusText, { color: bmiBadgeText }]}>{bmiCategory}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => setWeightModalOpen(true)} activeOpacity={0.7}>
              <HelpCircle size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* BMI Value Large Row */}
          <View style={styles.bmiValRow}>
            <Text style={styles.bmiBigNum}>{Math.round(bmi)}</Text>
            <Text style={styles.bmiUnitLabel}>BMI</Text>
          </View>

          {/* Multi-Color Segmented Dashes Scale Bar with Active Pin Indicator */}
          <View style={styles.bmiScaleContainer}>
            {/* Active Pointer Arrow ▼ */}
            <View style={styles.pointerRow}>
              {Array.from({ length: totalDashes }).map((_, idx) => (
                <View key={idx} style={styles.dashSlot}>
                  {idx === activeDashIndex && <Text style={styles.pointerArrow}>▼</Text>}
                </View>
              ))}
            </View>

            {/* Segmented Dash Bars */}
            <View style={styles.dashesRow}>
              {Array.from({ length: totalDashes }).map((_, idx) => {
                let dashColor = '#3B82F6'; // Underweight (0..6)
                if (idx >= 7 && idx < 15) dashColor = '#10B981'; // Normal (7..14)
                if (idx >= 15 && idx < 22) dashColor = '#F59E0B'; // Overweight (15..21)
                if (idx >= 22) dashColor = '#EF4444'; // Obese (22..27)

                const isActive = idx === activeDashIndex;

                return (
                  <View key={idx} style={styles.dashSlot}>
                    <View
                      style={[
                        styles.dashBar,
                        { backgroundColor: isActive ? '#0F172A' : dashColor },
                        isActive && { width: 5, borderRadius: 3 },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            {/* Category Labels below scale */}
            <View style={styles.bmiLabelsRow}>
              <Text style={styles.bmiCategoryLabel}>Underweight</Text>
              <Text
                style={[
                  styles.bmiCategoryLabel,
                  bmiCategory === 'Normal' && { color: '#10B981', fontFamily: FONTS.heading.bold },
                ]}
              >
                Normal
              </Text>
              <Text
                style={[
                  styles.bmiCategoryLabel,
                  bmiCategory === 'Overweight' && { color: '#F59E0B', fontFamily: FONTS.heading.bold },
                ]}
              >
                Overweight
              </Text>
              <Text
                style={[
                  styles.bmiCategoryLabel,
                  bmiCategory === 'Obese' && { color: '#EF4444', fontFamily: FONTS.heading.bold },
                ]}
              >
                Obese
              </Text>
            </View>
          </View>
        </Surface>

        {/* ── SECTION 2: NUTRITION ── */}
        <View style={[styles.sectionHeader, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
        </View>

        <Surface style={styles.cardContainer} elevation={1}>
          {/* Period Filter Pill Tabs (This week / Last week / 2 wks. ago / 3 wks. ago) */}
          <View style={styles.periodTabsContainer}>
            <TouchableOpacity
              style={[styles.periodTab, selectedPeriod === 'this_week' && styles.periodTabActive]}
              onPress={() => setSelectedPeriod('this_week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === 'this_week' && styles.periodTabTextActive,
                ]}
              >
                This week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodTab, selectedPeriod === 'last_week' && styles.periodTabActive]}
              onPress={() => setSelectedPeriod('last_week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === 'last_week' && styles.periodTabTextActive,
                ]}
              >
                Last week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodTab, selectedPeriod === '2_wks' && styles.periodTabActive]}
              onPress={() => setSelectedPeriod('2_wks')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === '2_wks' && styles.periodTabTextActive,
                ]}
              >
                2 wks. ago
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodTab, selectedPeriod === '3_wks' && styles.periodTabActive]}
              onPress={() => setSelectedPeriod('3_wks')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === '3_wks' && styles.periodTabTextActive,
                ]}
              >
                3 wks. ago
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats Summary Row (Total calories & Daily avg.) */}
          <View style={styles.nutritionStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statBigNum}>
                {totalWeeklyKcal.toLocaleString().replace(/,/g, ' ')}
              </Text>
              <Text style={styles.statSubLabel}>Total calories</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.statBigNum}>
                {dailyAvgKcal.toLocaleString().replace(/,/g, ' ')}
              </Text>
              <Text style={styles.statSubLabel}>Daily avg.</Text>
            </View>
          </View>

          {/* Exact Multi-Color Stacked Macro Bar Chart */}
          <View style={styles.stackedChartContainer}>
            <View style={styles.stackedBarsRow}>
              {weeklyData.map((item, idx) => {
                const totalKcal = Math.max(1, item.kcal);
                const totalBarPct = Math.min(100, Math.max(12, (totalKcal / maxBarKcal) * 100));

                const pPct = item.proteinKcal / totalKcal;
                const cPct = item.carbsKcal / totalKcal;
                const fPct = item.fatKcal / totalKcal;

                return (
                  <View key={idx} style={styles.stackedBarCol}>
                    {/* Multi-Color Stacked Bar */}
                    <View style={[styles.stackedBarTrack, { height: `${totalBarPct}%` as any }]}>
                      {/* Top Yellow Segment: Fat */}
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            height: `${Math.round(fPct * 100)}%` as any,
                            backgroundColor: '#F59E0B',
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                          },
                        ]}
                      />
                      {/* Middle Green Segment: Carbs */}
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            height: `${Math.round(cPct * 100)}%` as any,
                            backgroundColor: '#10B981',
                          },
                        ]}
                      />
                      {/* Bottom Blue Segment: Protein */}
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            height: `${Math.round(pPct * 100)}%` as any,
                            backgroundColor: '#3B82F6',
                            borderBottomLeftRadius: 6,
                            borderBottomRightRadius: 6,
                          },
                        ]}
                      />
                    </View>

                    {/* Day Name */}
                    <Text style={styles.stackedDayText}>{item.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Surface>

        {/* ── SECTION 3: WEEKLY WATER INTAKE CHART ── */}
        {waterData.length > 0 && (() => {
          const maxWater = Math.max(waterTarget, ...waterData.map(d => d.waterMl), 500);
          return (
            <Surface style={styles.cardContainer} elevation={1}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                    <Droplet size={16} color="#0284C7" fill="#0284C7" />
                  </View>
                  <View>
                    <Text style={[styles.sectionTitle, { color: '#0F172A', fontSize: 15, marginBottom: 0 }]}>Weekly Hydration</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', fontFamily: FONTS.body.regular }}>
                      Avg {avgWaterMl.toLocaleString()} ml/day · Target {(waterTarget / 1000).toFixed(1)}L
                    </Text>
                  </View>
                </View>
                {/* Summary badge */}
                <View style={{ backgroundColor: avgWaterMl >= waterTarget ? '#DCFCE7' : '#EFF6FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, fontFamily: FONTS.heading.bold, color: avgWaterMl >= waterTarget ? '#16A34A' : '#0284C7' }}>
                    {avgWaterMl >= waterTarget ? '💧 On Track' : `${Math.round((avgWaterMl / waterTarget) * 100)}%`}
                  </Text>
                </View>
              </View>

              {/* Bar Chart */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {waterData.map((d, i) => {
                  const barHeightPct = maxWater > 0 ? d.waterMl / maxWater : 0;
                  const barH = Math.max(4, Math.round(barHeightPct * 110));
                  const reachedTarget = d.waterMl >= waterTarget;
                  const barColor = reachedTarget ? '#0284C7' : '#BAE6FD';
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 120 }}>
                      {/* Value label on top */}
                      {d.waterMl > 0 && (
                        <Text style={{ fontSize: 8, color: '#64748B', fontFamily: FONTS.body.bold, marginBottom: 2 }}>
                          {d.waterMl >= 1000 ? `${(d.waterMl / 1000).toFixed(1)}L` : `${d.waterMl}`}
                        </Text>
                      )}
                      <View
                        style={[
                          {
                            width: '80%',
                            height: barH,
                            backgroundColor: barColor,
                            borderRadius: 6,
                            borderWidth: d.isToday ? 2 : 0,
                            borderColor: '#0284C7',
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Day labels */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {waterData.map((d, i) => (
                  <Text
                    key={i}
                    style={[
                      { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: FONTS.heading.medium, color: d.isToday ? '#0284C7' : '#94A3B8' },
                    ]}
                  >
                    {d.day}
                  </Text>
                ))}
              </View>

              {/* Legend */}
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#0284C7' }} />
                  <Text style={{ fontSize: 11, color: '#64748B', fontFamily: FONTS.body.regular }}>Target reached</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#BAE6FD' }} />
                  <Text style={{ fontSize: 11, color: '#64748B', fontFamily: FONTS.body.regular }}>Below target</Text>
                </View>
              </View>
            </Surface>
          );
        })()}

        {/* Height & Weight Quick Edit Button */}
        <Surface style={styles.editProfileCard} elevation={1}>
          <TouchableOpacity onPress={() => setWeightModalOpen(true)} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.editCardLabel}>Profile Parameters</Text>
                <Text style={styles.editCardVal}>
                  {currentWeight} kg | {currentHeight} cm <Text style={{ fontSize: 13, color: '#FF6B00', fontFamily: FONTS.heading.medium }}>(BMI: {bmi})</Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Pencil size={14} color="#FF6B00" />
                <Text style={{ fontSize: 14, color: '#FF6B00', fontFamily: FONTS.heading.bold }}>Edit</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Surface>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Edit Weight & Height Modal Dialog */}
      <Portal>
        <Dialog visible={weightModalOpen} onDismiss={() => setWeightModalOpen(false)} style={{ borderRadius: 20, backgroundColor: '#FFFFFF' }}>
          <Dialog.Title style={{ fontSize: 18, color: '#0F172A', fontFamily: FONTS.heading.bold }}>
            Update BMI Parameters
          </Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <PaperInput
              label="Weight (kg)"
              value={newWeightInput}
              onChangeText={setNewWeightInput}
              keyboardType="decimal-pad"
              mode="outlined"
            />
            <PaperInput
              label="Height (cm)"
              value={newHeightInput}
              onChangeText={setNewHeightInput}
              keyboardType="decimal-pad"
              mode="outlined"
            />
            <PaperInput
              label="Goal Weight (kg)"
              value={newTargetInput}
              onChangeText={setNewTargetInput}
              keyboardType="decimal-pad"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions style={{ gap: 8 }}>
            <Button onPress={() => setWeightModalOpen(false)} textColor="#64748B">
              Cancel
            </Button>
            <Button mode="contained" buttonColor="#FF6B00" onPress={handleSaveWeighIn} loading={isSaving} disabled={isSaving}>
              Save Changes
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
    </SkeletonTransition>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  sectionHeader: { marginBottom: 4 },
  sectionTitle: { fontSize: 14, color: '#64748B', fontFamily: FONTS.body.regular },

  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },

  // BMI Section Styles
  bmiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bmiWeightText: { fontSize: 16, color: '#1E293B', fontFamily: FONTS.heading.bold },
  bmiStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bmiStatusText: { fontSize: 12, fontFamily: FONTS.heading.bold },
  bmiValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  bmiBigNum: { fontSize: 36, color: '#0F172A', fontFamily: FONTS.heading.bold },
  bmiUnitLabel: { fontSize: 14, color: '#64748B', fontFamily: FONTS.heading.medium },

  bmiScaleContainer: { marginTop: 8, gap: 4 },
  pointerRow: { flexDirection: 'row', width: '100%', height: 14 },
  dashesRow: { flexDirection: 'row', width: '100%', height: 26, alignItems: 'center' },
  dashSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dashBar: { width: 3, height: 22, borderRadius: 1.5 },
  pointerArrow: { fontSize: 10, color: '#0F172A', textAlign: 'center' },
  bmiLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  bmiCategoryLabel: { fontSize: 11, color: '#94A3B8', fontFamily: FONTS.body.regular },

  // Nutrition Section Styles
  periodTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 4,
    justifyContent: 'space-between',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabActive: {
    backgroundColor: '#0F172A',
  },
  periodTabText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONTS.body.medium,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.heading.bold,
  },

  nutritionStatsRow: { flexDirection: 'row', marginTop: 8, gap: 16 },
  statBigNum: { fontSize: 26, color: '#0F172A', fontFamily: FONTS.heading.bold },
  statSubLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.regular, marginTop: 2 },

  // Multi-color Stacked Bar Chart
  stackedChartContainer: { height: 160, marginTop: 16 },
  stackedBarsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stackedBarCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stackedBarTrack: { width: 14, borderRadius: 6, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  stackedSegment: { width: '100%' },
  stackedDayText: { fontSize: 11, color: '#64748B', fontFamily: FONTS.body.regular },

  editProfileCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4 },
  editCardLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.medium },
  editCardVal: { fontSize: 16, color: '#1E293B', marginTop: 2, fontFamily: FONTS.heading.bold },
});

export default ProgressScreen;
