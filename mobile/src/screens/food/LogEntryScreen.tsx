import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FoodItem, MealType, MEAL_CONFIG } from '../../types';
import { useLog } from '../../contexts/LogContext';
import { useTheme } from '../../contexts/ThemeContext';
import { API } from '../../services/api';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
}

const PORTION_MULTIPLIERS = [
  { label: '½x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '1½x', value: 1.5 },
  { label: '2x', value: 2 },
];

const MEAL_ORDER: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];

const LogEntryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { food, imageUri } = route.params as { food: FoodItem; imageUri?: string };
  const { addEntry } = useLog();

  const [portion, setPortion] = useState(1);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 17) return 'afternoon_snack';
    if (h < 21) return 'dinner';
    return 'evening_snack';
  });
  const [loading, setLoading] = useState(false);

  const scaled = (val: number) => Math.round(val * portion);
  const scaledF = (val: number) => Math.round(val * portion * 10) / 10;

  const handleAdd = async () => {
    setLoading(true);
    try {
      let cdnUrl: string | null = null;
      if (imageUri) {
        try {
          cdnUrl = await API.uploadFoodImage(imageUri);
        } catch (e) {}
      }

      await addEntry({
        name: food.name,
        meal: selectedMeal,
        calories: scaled(food.calories),
        proteinG: scaledF(food.proteinG),
        carbsG: scaledF(food.carbsG),
        fatG: scaledF(food.fatG),
        portionUnit: food.portionUnit || (food.isLiquid ? 'ml' : 'g'),
        portionQuantity: portion,
        weightGramsOrMl: Math.round((food.portionG || (food.calories ? Math.round(food.calories * 1.25) : 180)) * portion),
        portionG: Math.round((food.portionG || (food.calories ? Math.round(food.calories * 1.25) : 180)) * portion),
        portionDescription: food.portionDescription ? `${portion}x ${food.portionDescription}` : undefined,
        isLiquid: food.isLiquid,
        source: 'ai',
        nutritionSource: food.nutritionSource || 'gemini_estimate',
        confidence: food.confidence,
        imageUrl: cdnUrl || undefined,
      });

      Alert.alert('✅ Added!', `${food.name} added to ${MEAL_CONFIG[selectedMeal].label}.`, [
        { text: 'View Dashboard', onPress: () => navigation.navigate('Main', { screen: 'Dashboard' }) },
        { text: 'Done', onPress: () => navigation.popToTop() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add entry.');
    } finally {
      setLoading(false);
    }
  };

  const confidencePct = Math.min(100, Math.max(0, Math.round((food.confidence || 0.95) * 100)));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: theme.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Add to Log</Text>
        </View>

        {/* Food Photo if available */}
        {imageUri && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          </View>
        )}

        {/* Food card */}
        <View style={[styles.foodCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.foodName, { color: theme.textPrimary }]}>{food.name}</Text>
          <View style={styles.confidenceRow}>
            <View style={styles.confBarTrack}>
              <View style={[styles.confBarFill, { width: `${confidencePct}%` as any, backgroundColor: theme.primary }]} />
            </View>
            <Text style={[styles.confLabel, { color: theme.textMuted }]}>{confidencePct}% confidence</Text>
          </View>
        </View>

        {/* Nutrition at 1x */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.nutritionTitle, { color: theme.textMuted }]}>Nutrition ({portion}x portion)</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: theme.primary }]}>{scaled(food.calories)}</Text>
              <Text style={[styles.macroLabel, { color: theme.textMuted }]}>kcal</Text>
            </View>
            <View style={[styles.macroDivider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#6366F1' }]}>{scaledF(food.proteinG)}g</Text>
              <Text style={[styles.macroLabel, { color: theme.textMuted }]}>Protein</Text>
            </View>
            <View style={[styles.macroDivider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#22C55E' }]}>{scaledF(food.carbsG)}g</Text>
              <Text style={[styles.macroLabel, { color: theme.textMuted }]}>Carbs</Text>
            </View>
            <View style={[styles.macroDivider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#F59E0B' }]}>{scaledF(food.fatG)}g</Text>
              <Text style={[styles.macroLabel, { color: theme.textMuted }]}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Portion selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Portion Size</Text>
          <View style={styles.portionRow}>
            {PORTION_MULTIPLIERS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.portionBtn,
                  { backgroundColor: portion === p.value ? theme.primaryLight : theme.card, borderColor: portion === p.value ? theme.primary : theme.cardBorder },
                ]}
                onPress={() => setPortion(p.value)}
              >
                <Text style={[styles.portionLabel, { color: portion === p.value ? theme.primary : theme.textMuted }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Meal Session Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Meal Session</Text>
          <View style={styles.mealGrid}>
            {MEAL_ORDER.map((meal) => {
              const cfg = MEAL_CONFIG[meal];
              const active = selectedMeal === meal;
              return (
                <TouchableOpacity
                  key={meal}
                  style={[
                    styles.mealBtn,
                    { backgroundColor: active ? theme.primaryLight : theme.card, borderColor: active ? theme.primary : theme.cardBorder },
                  ]}
                  onPress={() => setSelectedMeal(meal)}
                >
                  <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? theme.primary : theme.textSecondary }}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Bottom bar with safe area padding */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.cardBorder,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.summaryText}>
          <Text style={[styles.summaryTitle, { color: theme.textPrimary }]}>{scaled(food.calories)} kcal</Text>
          <Text style={[styles.summarySub, { color: theme.textMuted }]}>{MEAL_CONFIG[selectedMeal].label}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
          onPress={handleAdd} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addBtnText}>Log Food Item</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 8 },
  backBtn: { padding: 4 },
  backText: { fontSize: 24, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800' },
  photoContainer: { borderRadius: 20, overflow: 'hidden', height: 180, marginTop: 8 },
  photo: { width: '100%', height: '100%' },
  foodCard: { borderRadius: 20, padding: 18, gap: 10, marginTop: 12, borderWidth: 1 },
  foodName: { fontSize: 22, fontWeight: '800' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  confBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  confBarFill: { height: '100%', borderRadius: 3 },
  confLabel: { fontSize: 12, fontWeight: '600', minWidth: 100, textAlign: 'right' },
  nutritionCard: { borderRadius: 20, padding: 18, gap: 12, marginTop: 12, borderWidth: 1 },
  nutritionTitle: { fontSize: 13, fontWeight: '600' },
  macroGrid: { flexDirection: 'row', alignItems: 'center' },
  macroItem: { flex: 1, alignItems: 'center', gap: 3 },
  macroVal: { fontSize: 20, fontWeight: '800' },
  macroLabel: { fontSize: 11, fontWeight: '500' },
  macroDivider: { width: 1, height: 40 },
  section: { marginTop: 16, gap: 10 },
  sectionLabel: { fontSize: 15, fontWeight: '800' },
  portionRow: { flexDirection: 'row', gap: 10 },
  portionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1.5 },
  portionLabel: { fontSize: 15, fontWeight: '700' },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 20, fontWeight: '800' },
  summarySub: { fontSize: 13 },
  addBtn: { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24 },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default LogEntryScreen;

