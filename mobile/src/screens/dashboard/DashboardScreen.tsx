import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  ScrollView, TouchableOpacity, RefreshControl, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Portal, Dialog, Button } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { useLog } from '../../contexts/LogContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MealType, FoodEntry, MEAL_CONFIG, DailyTarget } from '../../types';
import { FONTS } from '../../theme/fonts';
import { Plus, Bell, ChevronRight, Camera, Edit3, Trash2, Soup, Egg, Pizza, Flame, Beef, Leaf, Droplet } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { WaterIntakeModal } from '../../components/WaterIntakeModal';
import { AddFoodModal } from '../../components/AddFoodModal';
import { NotificationCenterModal } from '../../components/NotificationCenterModal';
import { notificationService } from '../../services/notificationService';
import { ScreenLoader, ScreenError, SkeletonTransition } from '../../components/ui';
import { getResizedCloudinaryUrl } from '../../utils/imageUtils';

interface Props { navigation: NativeStackNavigationProp<any> }

const MEAL_ORDER: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];

// Default food image fallback
const DEFAULT_FOOD_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';

const CircularProgressRing = React.memo(({
  size = 76,
  strokeWidth = 6,
  progress = 0.5,
  color = '#3B82F6',
  trackColor = '#F1F5F9',
  children,
}: {
  size?: number;
  strokeWidth?: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}, (prev, next) => prev.progress === next.progress && prev.color === next.color && prev.size === next.size);

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, targets } = useAuth();
  const { theme } = useTheme();
  const { todayLog, isLoadingLog, loadError, loadTodayLog, getEntriesByMeal, deleteEntry, updateWaterIntake } = useLog();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fabOpen, setFabOpen] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [targetMealForAdd, setTargetMealForAdd] = useState<MealType | undefined>(undefined);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; name: string } | null>(null);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setUnreadCount(notificationService.getUnreadCount());
    const unsubscribe = notificationService.subscribe(() => {
      setUnreadCount(notificationService.getUnreadCount());
    });
    return unsubscribe;
  }, []);

  const handleOpenAddModal = (meal?: MealType) => {
    setTargetMealForAdd(meal);
    setShowAddFoodModal(true);
  };

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Single fetch source: reload the selected day's log whenever the screen is
  // focused or the selected date changes (no duplicate mount/focus fetches).
  useFocusEffect(
    useCallback(() => {
      loadTodayLog(formatDateKey(selectedDate));
    }, [selectedDate, loadTodayLog])
  );

  const onRefresh = useCallback(() => {
    loadTodayLog(formatDateKey(selectedDate));
  }, [selectedDate, loadTodayLog]);

  const handleDateSelect = (d: Date) => {
    setSelectedDate(d);
  };

  const consumed = todayLog?.totalCalories ?? 0;
  const target: DailyTarget = targets ?? { calories: 2200, proteinG: 143, carbsG: 359, fatG: 370 };
  const targetCal = target.calories || 2000;

  const isZeroLogged = consumed === 0;
  const isTargetReached = consumed >= targetCal;
  const isOverTarget = consumed > targetCal;
  const remainingCalories = Math.max(0, targetCal - consumed);
  const overCalories = Math.max(0, consumed - targetCal);

  const totalProtein = todayLog?.totalProteinG ?? 0;
  const totalCarbs = todayLog?.totalCarbsG ?? 0;
  const totalFat = todayLog?.totalFatG ?? 0;

  // Convert macros to kcal for summary display (Carbs & Protein: 4 kcal/g, Fat: 9 kcal/g)
  const carbsKcal = Math.round(totalCarbs * 4);
  const targetCarbsKcal = Math.round(target.carbsG * 4);
  const proteinKcal = Math.round(totalProtein * 4);
  const targetProteinKcal = Math.round(target.proteinG * 4);
  const fatKcal = Math.round(totalFat * 9);
  const targetFatKcal = Math.round(target.fatG * 9);

  // Dynamic target percentage for 3 states:
  // State 1 (Zero Logged): 2.5% (thin accent indicator strip on left edge)
  // State 2 (Partially Consumed): (consumed / targetCal) * 100 % (animated fill block)
  // State 3 (Over Target): 100% (filled 100% with crimson red excess card)
  const targetPct = useMemo(() => {
    if (isOverTarget) return 100;
    if (isZeroLogged) return 2.5;
    return Math.min(95, Math.max(12, Math.round((consumed / targetCal) * 100)));
  }, [consumed, targetCal, isOverTarget, isZeroLogged]);

  // Date strip generator
  const generateScrollableDays = useCallback(() => {
    const days: Date[] = [];
    const base = new Date();
    for (let i = -7; i <= 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const scrollableDays = useMemo(() => generateScrollableDays(), [generateScrollableDays]);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedIndex = useMemo(() => {
    const idx = scrollableDays.findIndex((d) => d.toDateString() === selectedDate.toDateString());
    return idx >= 0 ? idx : 7;
  }, [scrollableDays, selectedDate]);

  const initialScrollOffset = selectedIndex * 60;
  const dateScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (dateScrollRef.current && selectedIndex >= 0) {
      dateScrollRef.current.scrollTo({ x: selectedIndex * 60, animated: true });
    }
  }, [selectedIndex]);

  const handleAddWater = () => {
    updateWaterIntake(250, 'add', formatDateKey(selectedDate));
  };

  const isInitialLoad = isLoadingLog && !todayLog;

  // If the very first load for this date failed and there's nothing to show,
  // surface a retryable error state instead of a misleading "no food logged".
  const showLoadError =
    loadError !== null &&
    !isLoadingLog &&
    todayLog !== null &&
    todayLog.entries.length === 0 &&
    (todayLog.waterLogs ?? []).length === 0;

  if (showLoadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ScreenError
          variant="network"
          message={loadError || 'Could not load your food log. Please try again.'}
          onRetry={onRefresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SkeletonTransition
      isLoading={isInitialLoad}
      skeleton={<ScreenLoader variant="dashboard" />}
    >
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoadingLog} onRefresh={onRefresh} tintColor="#FF6B00" />}
      >
        {/* Header Bar (Matches Image: Avatar + Hello, Ghea! + Bell Icon) */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Profile')} activeOpacity={0.8}>
              {user?.profile?.avatarUrl ? (
                <Image source={{ uri: getResizedCloudinaryUrl(user.profile.avatarUrl, 88) || undefined }} style={styles.avatarCircle} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View>
              <Text style={styles.greetingTitle}>
                Hello, {user?.name?.split(' ')[0] || 'User'}!
              </Text>
              <Text style={styles.greetingSub}>Start tracking your meals!</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => {
              setShowNotificationModal(true);
              notificationService.markAllAsRead();
            }}
            activeOpacity={0.8}
          >
            <Bell size={20} color="#64748B" />
            {unreadCount > 0 && <View style={styles.unreadBadgeDot} />}
          </TouchableOpacity>
        </View>

        {/* Date Selector Strip */}
        <ScrollView
          ref={dateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialScrollOffset, y: 0 }}
          contentContainerStyle={styles.dateStripScrollContent}
        >
          {scrollableDays.map((d, index) => {
            const isSelected = d.toDateString() === selectedDate.toDateString();
            const dateNum = d.getDate().toString().padStart(2, '0');
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCard,
                  isSelected ? styles.dayCardActive : styles.dayCardInactive,
                ]}
                onPress={() => handleDateSelect(d)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dayNumText, { color: isSelected ? '#FFFFFF' : '#1E293B' }]}>
                  {dateNum}
                </Text>
                <Text style={[styles.dayNameText, { color: isSelected ? '#FFFFFF' : '#64748B' }]}>
                  {dayNames[d.getDay()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 🏆 Hero Calorie Card (Matching Screenshot 1) */}
        <Surface style={styles.heroSummaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 }}>
            {/* Left Stat Column */}
            <View style={{ gap: 6 }}>
              <Text style={styles.bannerSubtitle}>
                {isOverTarget ? 'Calories over target' : isTargetReached ? 'Daily target reached 🎉' : 'Calories left'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.bannerLargeNum}>
                  {isOverTarget
                    ? overCalories.toLocaleString()
                    : isZeroLogged
                    ? targetCal.toLocaleString()
                    : remainingCalories.toLocaleString()}
                </Text>
                <Text style={styles.bannerUnitText}>Kcal</Text>
              </View>
            </View>

            {/* Right Circular Progress Ring Gauge with Black Flame Icon */}
            <CircularProgressRing
              size={92}
              strokeWidth={7}
              progress={targetPct / 100}
              color={isOverTarget ? '#FF3B30' : '#3B82F6'}
              trackColor="#F1F5F9"
            >
              <Flame size={32} color="#0F172A" fill="#0F172A" />
            </CircularProgressRing>
          </View>
        </Surface>

        {/* 3 Bottom Macro Circular Cards (Protein, Carbs, Fat) - Fixed Responsiveness */}
        <View style={styles.macroCardsRow}>
          {/* Protein Card */}
          <Surface style={styles.macroCardItem}>
            <View style={styles.macroCardHeader}>
              <Beef size={15} color="#3B82F6" />
              <Text style={styles.macroCardTitle} numberOfLines={1}>Protein</Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <CircularProgressRing
                size={64}
                strokeWidth={5}
                progress={Math.min(1, totalProtein / (target.proteinG || 1))}
                color="#3B82F6"
                trackColor="#F1F5F9"
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ringValText} numberOfLines={1}>
                    {Math.max(0, Math.round(target.proteinG - totalProtein))}g
                  </Text>
                  <Text style={styles.ringSubText}>Left</Text>
                </View>
              </CircularProgressRing>
            </View>
          </Surface>

          {/* Carbs Card */}
          <Surface style={styles.macroCardItem}>
            <View style={styles.macroCardHeader}>
              <Leaf size={15} color="#10B981" />
              <Text style={styles.macroCardTitle} numberOfLines={1}>Carbs</Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <CircularProgressRing
                size={64}
                strokeWidth={5}
                progress={Math.min(1, totalCarbs / (target.carbsG || 1))}
                color="#10B981"
                trackColor="#F1F5F9"
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ringValText} numberOfLines={1}>
                    {Math.max(0, Math.round(target.carbsG - totalCarbs))}g
                  </Text>
                  <Text style={styles.ringSubText}>Left</Text>
                </View>
              </CircularProgressRing>
            </View>
          </Surface>

          {/* Fat Card */}
          <Surface style={styles.macroCardItem}>
            <View style={styles.macroCardHeader}>
              <Pizza size={15} color="#F59E0B" />
              <Text style={styles.macroCardTitle} numberOfLines={1}>Fat</Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <CircularProgressRing
                size={64}
                strokeWidth={5}
                progress={Math.min(1, totalFat / (target.fatG || 1))}
                color="#F59E0B"
                trackColor="#F1F5F9"
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ringValText} numberOfLines={1}>
                    {Math.max(0, Math.round(target.fatG - totalFat))}g
                  </Text>
                  <Text style={styles.ringSubText}>Left</Text>
                </View>
              </CircularProgressRing>
            </View>
          </Surface>
        </View>

        {/* 🍱 Meal Group Cards (Breakfast, Lunch, Dinner, Snacks) */}
        {MEAL_ORDER.map((meal) => {
          const config = MEAL_CONFIG[meal];
          const entries = getEntriesByMeal(meal);
          const totalMealCal = entries.reduce((sum, e) => sum + e.calories, 0);

          return (
            <Surface key={meal} style={styles.mealCard}>
              {/* Meal Header */}
              <View style={styles.mealCardHeader}>
                <View>
                  <Text style={styles.mealTitle}>{config.label}</Text>
                  <Text style={styles.mealKcalText}>{totalMealCal} kcal</Text>
                </View>

                <TouchableOpacity
                  style={styles.addPlusBtn}
                  onPress={() => handleOpenAddModal(meal)}
                  activeOpacity={0.8}
                >
                  <Plus size={20} color="#FF6B00" />
                </TouchableOpacity>
              </View>

              {/* Meal Logged Items List */}
              {entries.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyMealBox}
                  onPress={() => handleOpenAddModal(meal)}
                >
                  <Text style={styles.emptyMealText}>Tap + to log {config.label.toLowerCase()}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 12, marginTop: 10 }}>
                  {entries.map((item) => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.foodItemRow}
                      onPress={() => navigation.navigate('FoodDetailEdit', { foodEntry: item, date: formatDateKey(selectedDate) })}
                      activeOpacity={0.7}
                    >
                      {/* Left Dish Photo */}
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: getResizedCloudinaryUrl(item.imageUrl, 96) || undefined }}
                          style={styles.foodItemImg}
                        />
                      ) : (
                        <View style={[styles.foodItemImg, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 22 }}>{MEAL_CONFIG[item.meal]?.emoji ?? '🥗'}</Text>
                        </View>
                      )}

                      {/* Middle Food Details & Macro Pills */}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.foodItemName} numberOfLines={1}>
                          {item.name}
                        </Text>

                        <View style={styles.macroPillRow}>
                          <View style={styles.pillItem}>
                            <Beef size={14} color="#3B82F6" />
                            <Text style={styles.pillText}>{item.proteinG}g</Text>
                          </View>

                          <View style={styles.pillItem}>
                            <Leaf size={14} color="#10B981" />
                            <Text style={styles.pillText}>{item.carbsG}g</Text>
                          </View>

                          <View style={styles.pillItem}>
                            <Pizza size={14} color="#F59E0B" />
                            <Text style={styles.pillText}>{item.fatG}g</Text>
                          </View>
                        </View>
                      </View>

                      {/* Right Calorie Count & Grams/ml Measurement */}
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={styles.foodKcalVal}>{item.calories} kcal</Text>
                        <Text style={styles.foodPortionVal}>
                          {item.weightGramsOrMl && item.weightGramsOrMl !== 100
                            ? `${Math.round(item.weightGramsOrMl)}${item.isLiquid ? 'ml' : 'g'}`
                            : item.portionG && item.portionG !== 100
                            ? `${Math.round(item.portionG)}${item.isLiquid ? 'ml' : 'g'}`
                            : item.calories
                            ? `${Math.round(item.calories * 1.25)}${item.isLiquid ? 'ml' : 'g'}`
                            : `${item.isLiquid ? '200ml' : '150g'}`}
                        </Text>
                      </View>

                      {/* Delete Item */}
                      <TouchableOpacity
                        onPress={() => setDeleteConfirmItem({ id: item._id, name: item.name })}
                        style={{ paddingLeft: 6 }}
                      >
                        <Trash2 size={15} color="#CBD5E1" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Surface>
          );
        })}

        {/* 💧 Water Intake Card (Exact Reference UI) */}
        {(() => {
          const currentWater = todayLog?.waterIntakeMl || 0;
          const targetWater = targets?.waterMl || 2000;
          const fillPercent = Math.min(100, Math.round((currentWater / targetWater) * 100));

          return (
            <Surface style={styles.waterCard}>
              <TouchableOpacity
                style={styles.waterHeader}
                onPress={() => setWaterModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.waterTitle}>Water intake</Text>
                </View>
                <ChevronRight size={22} color="#0284C7" />
              </TouchableOpacity>

              <View style={styles.waterRow}>
                {/* Blue Progress Bar Track */}
                <TouchableOpacity
                  style={styles.waterTrack}
                  onPress={() => setWaterModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.waterFill,
                      { width: `${fillPercent}%` as any },
                    ]}
                  >
                    <Text style={styles.waterFillText}>
                      {currentWater.toLocaleString()}/{targetWater.toLocaleString()} ml
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Quick Add Water Button (+250ml) */}
                <TouchableOpacity style={styles.waterAddBtn} onPress={handleAddWater} activeOpacity={0.7}>
                  <Text style={{ fontSize: 20 }}>🥛</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.waterFooterText}>
                {fillPercent >= 100 ? '🎉 Daily hydration target reached!' : "Don't forget to drink more water!"}
              </Text>
            </Surface>
          );
        })()}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Quick Action & Delete Confirmation Dialogs */}
      <Portal>
        {/* Delete Confirmation Popover Modal */}
        <Dialog
          visible={Boolean(deleteConfirmItem)}
          onDismiss={() => setDeleteConfirmItem(null)}
          style={{ borderRadius: 20, backgroundColor: '#FFFFFF' }}
        >
          <Dialog.Title style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', fontFamily: FONTS.heading.bold }}>
            Delete Food Entry?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 14, color: '#64748B', fontFamily: FONTS.body.regular }}>
              Are you sure you want to remove "{deleteConfirmItem?.name}" from your daily food log?
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ gap: 8 }}>
            <Button onPress={() => setDeleteConfirmItem(null)} textColor="#64748B">
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor="#EF4444"
              onPress={async () => {
                if (deleteConfirmItem) {
                  const targetId = deleteConfirmItem.id;
                  setDeleteConfirmItem(null);
                  try {
                    await deleteEntry(targetId);
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to delete entry. Please try again.');
                  }
                }
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={fabOpen} onDismiss={() => setFabOpen(false)}>
          <Dialog.Title>Quick AI Actions</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TouchableOpacity
              style={styles.actionSheetOpt}
              onPress={() => { setFabOpen(false); navigation.navigate('CameraScanner'); }}
            >
              <Camera size={24} color="#FF6B00" />
              <View>
                <Text style={styles.actionSheetOptTitle}>Scan Food Photo</Text>
                <Text style={{ fontSize: 12, color: '#94A3B8' }}>AI Instant Macro Calculator</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOpt}
              onPress={() => { setFabOpen(false); navigation.navigate('ManualEntry'); }}
            >
              <Edit3 size={24} color="#8B5CF6" />
              <View>
                <Text style={styles.actionSheetOptTitle}>Quick Text Entry</Text>
                <Text style={{ fontSize: 12, color: '#94A3B8' }}>Auto-calculate Protein & Fiber</Text>
              </View>
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFabOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <WaterIntakeModal
        visible={waterModalVisible}
        onClose={() => setWaterModalVisible(false)}
      />

      <AddFoodModal
        visible={showAddFoodModal}
        onClose={() => setShowAddFoodModal(false)}
        navigation={navigation}
        targetMeal={targetMealForAdd}
      />

      <NotificationCenterModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </SafeAreaView>
    </SkeletonTransition>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  greetingTitle: { fontSize: 20, color: '#0F172A', fontFamily: FONTS.heading.bold },
  greetingSub: { fontSize: 13, color: '#64748B', marginTop: 1, fontFamily: FONTS.body.regular },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dateStripScrollContent: { paddingHorizontal: 2, gap: 8, alignItems: 'center', paddingVertical: 2 },
  dayCard: { width: 52, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayCardActive: {
    backgroundColor: '#FF6B00',
  },
  dayCardInactive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  dayNumText: { fontSize: 16, fontFamily: FONTS.heading.bold },
  dayNameText: { fontSize: 11, fontFamily: FONTS.heading.medium },

  // Hero Summary Card
  heroSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  orangeBannerTrack: {
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 110,
    justifyContent: 'center',
  },
  orangeBannerFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#FF6B00',
    borderRadius: 18,
  },
  orangeBannerContent: {
    padding: 20,
    gap: 4,
    zIndex: 2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: FONTS.body.medium,
  },
  bannerMainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bannerLargeNum: {
    fontSize: 42,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  bannerUnitText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: FONTS.heading.medium,
  },

  macroCardsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  macroCardItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  macroCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  macroCardTitle: { fontSize: 12, color: '#0F172A', fontFamily: FONTS.heading.bold },
  ringValText: { fontSize: 13, color: '#0F172A', fontFamily: FONTS.heading.bold },
  ringSubText: { fontSize: 9, color: '#94A3B8', fontFamily: FONTS.body.regular },

  // Meal Cards
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTitle: { fontSize: 18, color: '#0F172A', fontFamily: FONTS.heading.bold },
  mealKcalText: { fontSize: 14, color: '#FF6B00', marginTop: 2, fontFamily: FONTS.heading.medium },
  addPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMealBox: { paddingTop: 10, paddingBottom: 4 },
  emptyMealText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', fontFamily: FONTS.body.regular },

  foodItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foodItemImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9' },
  foodItemName: { fontSize: 15, color: '#0F172A', fontFamily: FONTS.heading.medium },
  macroPillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.regular },
  foodKcalVal: { fontSize: 14, color: '#FF6B00', fontFamily: FONTS.heading.bold },
  foodPortionVal: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.regular },

  // Water Intake Card
  waterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterTitle: { fontSize: 18, color: '#0F172A', fontFamily: FONTS.heading.bold },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  waterTrack: { flex: 1, height: 40, backgroundColor: '#EFF6FF', borderRadius: 12, overflow: 'hidden' },
  waterFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  waterFillText: { fontSize: 14, color: '#FFFFFF', fontFamily: FONTS.heading.bold },
  waterAddBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  waterFooterText: { fontSize: 13, color: '#64748B', fontFamily: FONTS.body.regular },

  actionSheetOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC' },
  actionSheetOptTitle: { fontSize: 15, color: '#0F172A', fontFamily: FONTS.heading.bold },
});

export default DashboardScreen;
