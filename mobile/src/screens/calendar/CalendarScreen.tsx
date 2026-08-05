import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  ScrollView, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import {
  Calendar as LucideCalendar,
  ChevronLeft,
  ChevronRight,
  Beef,
  Leaf,
  Pizza,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDay, FoodLog, MEAL_CONFIG } from '../../types';
import { API } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FONTS } from '../../theme/fonts';

interface Props { navigation: NativeStackNavigationProp<any> }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatFloat = (val: number): string => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  return rounded.toString();
};

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const { token, targets: userTargets } = useAuth();
  const { theme } = useTheme();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatDateKey(now));
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  const loadMonth = useCallback(async (y: number, m: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await API.getCalendarMonth(token, y, m);
      setDays(data.days || []);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadSelectedLog = useCallback(async (dateStr: string) => {
    if (!token) return;
    setLogLoading(true);
    try {
      const res = await API.getLog(token, dateStr);
      setSelectedLog(res.log);
    } catch {
      setSelectedLog(null);
    } finally {
      setLogLoading(false);
    }
  }, [token]);

  useEffect(() => { loadMonth(year, month); }, [year, month, loadMonth]);

  useEffect(() => {
    loadSelectedLog(selectedDateStr);
  }, [selectedDateStr, loadSelectedLog]);

  // Refresh calendar and selected log whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadMonth(year, month);
      loadSelectedLog(selectedDateStr);
    }, [year, month, selectedDateStr, loadMonth, loadSelectedLog])
  );

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Build 7-column calendar grid (Mon - Sun)
  const gridCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
    const daysInCurrentMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 2, day);
      cells.push({
        dateStr: formatDateKey(prevDate),
        dayNum: day,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curDate = new Date(year, month - 1, day);
      cells.push({
        dateStr: formatDateKey(curDate),
        dayNum: day,
        isCurrentMonth: true,
      });
    }

    // Trailing days from next month
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(year, month, day);
      cells.push({
        dateStr: formatDateKey(nextDate),
        dayNum: day,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [year, month]);

  // Compute selected day totals
  const calendarDayInfo = days.find((d) => d.date === selectedDateStr);
  const consumedCalories = selectedLog?.totalCalories ?? calendarDayInfo?.totalCalories ?? 0;
  const consumedProtein = selectedLog?.totalProteinG ?? calendarDayInfo?.totalProteinG ?? 0;
  const consumedCarbs = selectedLog?.totalCarbsG ?? calendarDayInfo?.totalCarbsG ?? 0;
  const consumedFat = selectedLog?.totalFatG ?? calendarDayInfo?.totalFatG ?? 0;
  const targetCalories = userTargets?.calories ?? calendarDayInfo?.targetCalories ?? 2200;

  const calProgress = Math.min(1, targetCalories > 0 ? consumedCalories / targetCalories : 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Page Header */}
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>History & Calendar</Text>
          <Text style={styles.sectionSub}>View daily calorie progress ring for each date</Text>
        </View>

        {/* 🗓️ Light Mode Calendar Card with Circular Progress Rings */}
        <Surface style={styles.calendarCard} elevation={2}>
          {/* Month Navigation Header */}
          <View style={styles.monthHeaderRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
              <ChevronLeft size={22} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.monthTitleText}>
              {new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
              <ChevronRight size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels Header (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Day Grid */}
          <View style={styles.gridContainer}>
            {gridCells.map((cell) => {
              const dayData = days.find((d) => d.date === cell.dateStr);
              const isSelected = cell.dateStr === selectedDateStr;
              const isToday = cell.dateStr === formatDateKey(now);

              const consumed = dayData?.totalCalories ?? 0;
              const target = dayData?.targetCalories ?? userTargets?.calories ?? 2200;

              const isLogged = consumed > 0;
              const isOver = consumed > target;
              const progress = Math.min(1, target > 0 ? consumed / target : 0);

              // SVG Ring math
              const ringSize = 42;
              const strokeWidth = 3;
              const radius = (ringSize - strokeWidth) / 2; // 19.5
              const circumference = 2 * Math.PI * radius; // ~122.5
              const strokeDashoffset = circumference * (1 - progress);

              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  style={styles.gridCell}
                  onPress={() => {
                    setSelectedDateStr(cell.dateStr);
                    if (!cell.isCurrentMonth) {
                      const parts = cell.dateStr.split('-');
                      setYear(parseInt(parts[0]));
                      setMonth(parseInt(parts[1]));
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.dayCircleWrapper,
                      isOver && styles.dayCircleOver,
                      isSelected && !isOver && styles.dayCircleSelectedBg,
                      isToday && !isSelected && !isOver && styles.dayCircleTodayBg,
                    ]}
                  >
                    {/* SVG Ring Gauge for Logged Normal Days */}
                    {isLogged && !isOver && (
                      <Svg width={ringSize} height={ringSize} style={styles.svgRing}>
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={radius}
                          stroke={isSelected ? '#FFE5D9' : '#E2E8F0'}
                          strokeWidth={isSelected ? 3.5 : 3}
                          fill="none"
                        />
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={radius}
                          stroke="#FF6B00"
                          strokeWidth={isSelected ? 3.5 : 3}
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                        />
                      </Svg>
                    )}

                    {/* Default Circle for Empty/Unlogged Days */}
                    {!isLogged && !isOver && (
                      <Svg width={ringSize} height={ringSize} style={styles.svgRing}>
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={radius}
                          stroke={isSelected ? '#FF6B00' : isToday ? '#3B82F6' : '#F1F5F9'}
                          strokeWidth={isSelected ? 2.5 : isToday ? 2 : 1.5}
                          fill="none"
                        />
                      </Svg>
                    )}

                    <Text
                      style={[
                        styles.dayNumText,
                        !cell.isCurrentMonth && styles.dayNumDisabled,
                        isOver && styles.dayNumOverText,
                        isSelected && !isOver && styles.dayNumSelectedText,
                        isToday && !isOver && !isSelected && styles.dayNumTodayText,
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#FF6B00" size="large" />
            </View>
          )}
        </Surface>

        {/* Daily Consumed Summary Card */}
        <Surface style={styles.summaryCard} elevation={2}>
          <View style={styles.summaryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <LucideCalendar size={18} color="#FF6B00" />
              <Text style={styles.summaryDateText}>{formatDisplayDate(selectedDateStr)}</Text>
            </View>
            <View style={[styles.badge, consumedCalories > targetCalories && styles.badgeOver]}>
              <Text style={[styles.badgeText, consumedCalories > targetCalories && styles.badgeOverText]}>
                {consumedCalories > targetCalories
                  ? 'Over Target'
                  : `${Math.round(calProgress * 100)}% Goal`}
              </Text>
            </View>
          </View>

          {logLoading ? (
            <ActivityIndicator color="#FF6B00" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Total Calories Consumed Display */}
              <View style={styles.calRow}>
                <View>
                  <Text style={styles.calLabel}>Total Consumed</Text>
                  <Text style={styles.calVal}>
                    {consumedCalories.toLocaleString()} <Text style={styles.calUnit}>kcal</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.goalLabel}>Daily Goal</Text>
                  <Text style={styles.goalVal}>{targetCalories.toLocaleString()} kcal</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, calProgress * 100)}%`,
                      backgroundColor: consumedCalories > targetCalories ? '#EF4444' : '#FF6B00',
                    },
                  ]}
                />
              </View>

              {/* Macro Grid */}
              <View style={styles.macroGrid}>
                <View style={styles.macroCard}>
                  <Beef size={18} color="#3B82F6" />
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroVal}>{formatFloat(consumedProtein)} g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Leaf size={18} color="#10B981" />
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={styles.macroVal}>{formatFloat(consumedCarbs)} g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Pizza size={18} color="#F59E0B" />
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={styles.macroVal}>{formatFloat(consumedFat)} g</Text>
                </View>
              </View>

              {/* Logged Entries List for Day */}
              {selectedLog?.entries && selectedLog.entries.length > 0 && (
                <View style={styles.entriesSection}>
                  <Text style={styles.entriesTitle}>Logged Items ({selectedLog.entries.length})</Text>
                  {selectedLog.entries.map((entry) => (
                    <TouchableOpacity
                      key={entry._id}
                      style={styles.entryRow}
                      onPress={() => navigation.navigate('FoodDetailEdit', { foodEntry: entry, date: selectedDateStr })}
                      activeOpacity={0.7}
                    >
                      {entry.imageUrl ? (
                        <Image
                          source={{ uri: entry.imageUrl }}
                          style={styles.entryEmojiBg as any}
                        />
                      ) : (
                        <View style={styles.entryEmojiBg}>
                          <Text style={{ fontSize: 16 }}>{MEAL_CONFIG[entry.meal]?.emoji ?? '🥗'}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryName}>{entry.name}</Text>
                        <Text style={styles.entrySub}>
                          {entry.weightGramsOrMl && entry.weightGramsOrMl !== 100
                            ? `${Math.round(entry.weightGramsOrMl)}${entry.isLiquid ? 'ml' : 'g'}`
                            : entry.portionG && entry.portionG !== 100
                            ? `${Math.round(entry.portionG)}${entry.isLiquid ? 'ml' : 'g'}`
                            : entry.calories
                            ? `${Math.round(entry.calories * 1.25)}${entry.isLiquid ? 'ml' : 'g'}`
                            : `${entry.isLiquid ? '200ml' : '150g'}`} • {MEAL_CONFIG[entry.meal]?.label ?? entry.meal}
                        </Text>
                      </View>
                      <Text style={styles.entryKcal}>{entry.calories} kcal</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {(!selectedLog?.entries || selectedLog.entries.length === 0) && consumedCalories === 0 && (
                <Text style={styles.emptyText}>No food entries logged on this day.</Text>
              )}
            </>
          )}
        </Surface>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  header: { gap: 2, marginBottom: 2 },
  sectionTitle: { fontSize: 22, color: '#1E293B', fontFamily: FONTS.heading.bold },
  sectionSub: { fontSize: 13, color: '#64748B', fontFamily: FONTS.body.regular },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  monthTitleText: {
    fontSize: 18,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  monthNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  weekdayCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONTS.heading.bold,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '14.28%',
    alignItems: 'center',
    marginVertical: 4,
  },
  dayCircleWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  svgRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Over calories state — vibrant solid red circle (like day 25 in screenshot)
  dayCircleOver: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  dayCircleSelectedBg: {
    backgroundColor: '#FFF5EF',
  },
  dayCircleTodayBg: {
    backgroundColor: '#F8FAFC',
  },
  dayNumText: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  dayNumDisabled: {
    color: '#CBD5E1',
    fontFamily: FONTS.body.regular,
  },
  dayNumOverText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayNumSelectedText: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  dayNumTodayText: {
    color: '#3B82F6',
    fontWeight: '800',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryDateText: {
    fontSize: 16,
    color: '#1E293B',
    fontFamily: FONTS.heading.bold,
  },
  badge: {
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#FF6B00',
    fontFamily: FONTS.heading.bold,
  },
  badgeOver: {
    backgroundColor: '#FEF2F2',
  },
  badgeOverText: {
    color: '#EF4444',
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  calLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONTS.body.medium,
  },
  calVal: {
    fontSize: 28,
    color: '#1E293B',
    fontFamily: FONTS.heading.bold,
  },
  calUnit: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: FONTS.heading.medium,
  },
  goalLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: FONTS.body.medium,
  },
  goalVal: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: FONTS.heading.medium,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 5,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  macroLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONTS.body.medium,
  },
  macroVal: {
    fontSize: 14,
    color: '#1E293B',
    fontFamily: FONTS.heading.bold,
  },
  entriesSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  entriesTitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: FONTS.heading.medium,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  entryEmojiBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryName: {
    fontSize: 14,
    color: '#1E293B',
    fontFamily: FONTS.heading.bold,
  },
  entrySub: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONTS.body.regular,
  },
  entryKcal: {
    fontSize: 13,
    color: '#1E293B',
    fontFamily: FONTS.heading.bold,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 6,
  },
});

export default CalendarScreen;
