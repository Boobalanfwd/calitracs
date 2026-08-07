import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Surface, Button, Card, Chip, Portal, Dialog } from 'react-native-paper';
import { RootStackParamList, MealType, MEAL_CONFIG, PortionUnit } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useLog } from '../contexts/LogContext';
import { API } from '../services/api';
import { todayDateKey } from '../utils/dates';

type ResultNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;
type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;

interface Props {
  navigation: ResultNavigationProp;
  route: ResultRouteProp;
}

interface ConfirmedFoodItem {
  id: string;
  name: string;
  quantity: string;
  unitMode: 'g' | 'count';
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  isLiquid?: boolean;
  nutritionSource?: string;
  basePer100g: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  singlePieceWeightG: number;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];

const ResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { addEntry } = useLog();
  const insets = useSafeAreaInsets();
  const { imageUri, result } = route.params;

  const initialFoods = result.foods || [];
  const [items, setItems] = useState<ConfirmedFoodItem[]>(() =>
    initialFoods.map((f, idx) => {
      const isLiquid = Boolean((f as any).isLiquid);
      const singlePieceWeightG = Math.max(
        1,
        f.portionG || (f as any).typical_portion_g || (f as any).weightGramsOrMl || 150
      );

      const baseCals = f.calories || 200;
      const baseProt = f.proteinG || 8;
      const baseCarb = f.carbsG || 25;
      const baseFat = f.fatG || 5;

      const cal100 = (f as any).caloriesPer100gOrMl || Math.round((baseCals / singlePieceWeightG) * 100);
      const prot100 = (f as any).proteinGPer100gOrMl || Math.round((baseProt / singlePieceWeightG) * 100 * 10) / 10;
      const carb100 = (f as any).carbsGPer100gOrMl || Math.round((baseCarb / singlePieceWeightG) * 100 * 10) / 10;
      const fat100 = (f as any).fatGPer100gOrMl || Math.round((baseFat / singlePieceWeightG) * 100 * 10) / 10;

      return {
        id: idx.toString(),
        name: f.name,
        quantity: '1',
        unitMode: 'count',
        calories: baseCals,
        proteinG: baseProt,
        carbsG: baseCarb,
        fatG: baseFat,
        fiberG: 0,
        isLiquid,
        nutritionSource: (f as any).nutritionSource || 'gemini_estimate',
        basePer100g: {
          calories: cal100,
          proteinG: prot100,
          carbsG: carb100,
          fatG: fat100,
        },
        singlePieceWeightG,
      };
    })
  );

  const [selectedMeal, setSelectedMeal] = useState<MealType>(() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'evening_snack';
  });

  // Tracks which food item name is currently being edited
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  const handleNameChange = (id: string, newName: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: newName } : item))
    );
  };

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [isUploadingAndSaving, setIsUploadingAndSaving] = useState(false);

  const recalculateItemMacros = (
    item: ConfirmedFoodItem,
    newQtyStr: string,
    newUnitMode: 'g' | 'count'
  ): ConfirmedFoodItem => {
    const qtyNum = Math.max(0, parseFloat(newQtyStr) || 0);

    if (qtyNum === 0) {
      return {
        ...item,
        quantity: newQtyStr,
        unitMode: newUnitMode,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      };
    }

    const totalGrams = newUnitMode === 'g' ? qtyNum : qtyNum * item.singlePieceWeightG;
    const factor = totalGrams / 100;

    return {
      ...item,
      quantity: newQtyStr,
      unitMode: newUnitMode,
      calories: Math.round(item.basePer100g.calories * factor),
      proteinG: Math.round(item.basePer100g.proteinG * factor * 10) / 10,
      carbsG: Math.round(item.basePer100g.carbsG * factor * 10) / 10,
      fatG: Math.round(item.basePer100g.fatG * factor * 10) / 10,
    };
  };

  const handleQuantityChange = (id: string, qty: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? recalculateItemMacros(i, qty, i.unitMode) : i))
    );
  };

  const handleUnitModeToggle = (id: string, targetMode: 'g' | 'count') => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (i.unitMode === targetMode) return i;

        const currentQty = parseFloat(i.quantity) || 1;
        let newQtyStr = '1';

        if (targetMode === 'g') {
          const totalG = Math.round(currentQty * i.singlePieceWeightG);
          newQtyStr = totalG.toString();
        } else {
          const countVal = Math.round((currentQty / i.singlePieceWeightG) * 10) / 10;
          newQtyStr = countVal.toString();
        }

        return recalculateItemMacros(i, newQtyStr, targetMode);
      })
    );
  };

  // Grand totals
  const totalCalories = items.reduce((sum, i) => sum + i.calories, 0);
  const totalProtein = items.reduce((sum, i) => sum + i.proteinG, 0);
  const totalCarbs = items.reduce((sum, i) => sum + i.carbsG, 0);
  const totalFat = items.reduce((sum, i) => sum + i.fatG, 0);

  const handleConfirmSessionAndLog = async () => {
    setSessionModalOpen(false);
    setIsUploadingAndSaving(true);

    try {
      let cdnUrl: string | null = null;
      try {
        cdnUrl = await API.uploadFoodImage(imageUri);
      } catch (e) {}

      for (const item of items) {
        const qtyNum = parseFloat(item.quantity) || 1;
        const totalWeightG = Math.round(
          item.unitMode === 'g' ? qtyNum : qtyNum * item.singlePieceWeightG
        );

        await addEntry({
          name: item.name,
          meal: selectedMeal,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          portionUnit: item.unitMode === 'g' ? (item.isLiquid ? 'ml' : 'g') : 'piece',
          portionQuantity: qtyNum,
          weightGramsOrMl: totalWeightG,
          portionG: totalWeightG,
          portionDescription: `${totalWeightG}${item.isLiquid ? 'ml' : 'g'}`,
          isLiquid: item.isLiquid,
          source: 'ai',
          nutritionSource: (item.nutritionSource as any) || 'gemini_estimate',
          imageUrl: cdnUrl || undefined,
          date: todayDateKey(),
        });
      }

      Alert.alert(
        '✅ Logged!',
        `Saved ${items.length} item(s) (${totalCalories} kcal) to ${MEAL_CONFIG[selectedMeal].label}.`,
        [
          {
            text: 'View Dashboard',
            onPress: () => (navigation as any).navigate('Main', { screen: 'Dashboard' }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save log entry.');
    } finally {
      setIsUploadingAndSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero Image */}
        <Card style={styles.imageCard}>
          <Card.Cover source={{ uri: imageUri }} style={{ height: 200 }} />
        </Card>

        {/* Step Indicator */}
        <Surface style={[styles.stepBanner, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]} elevation={1}>
          <Text style={[styles.stepBannerTitle, { color: theme.primary }]}>
            🎯 Confirm Count or Weight for Identified Foods
          </Text>
          <Text style={[styles.stepBannerSub, { color: theme.textMuted }]}>
            Adjust food items, weight in grams or piece count below
          </Text>
        </Surface>

        {/* Detected Food Items List */}
        {items.map((item) => (
          <Surface key={item.id} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} elevation={2}>

            {/* Food Name Row — tap pencil to edit */}
            <View style={styles.itemNameRow}>
              {editingNameId === item.id ? (
                <TextInput
                  style={[styles.itemNameInput, { color: theme.textPrimary, borderColor: theme.primary, backgroundColor: theme.inputBg }]}
                  value={item.name}
                  onChangeText={(t) => handleNameChange(item.id, t)}
                  onBlur={() => setEditingNameId(null)}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => setEditingNameId(null)}
                />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setEditingNameId(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemName, { color: theme.textPrimary }]}>🍽️ {item.name}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setEditingNameId(editingNameId === item.id ? null : item.id)}
                style={styles.editNameBtn}
              >
                <Text style={{ fontSize: 14 }}>{editingNameId === item.id ? '✓' : '✏️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Measurement Unit Selector Toggles (Grams vs Count) */}
            <View style={styles.unitToggleRow}>
              <TouchableOpacity
                style={[
                  styles.unitToggleBtn,
                  item.unitMode === 'g' && { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                  item.unitMode !== 'g' && { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                ]}
                onPress={() => handleUnitModeToggle(item.id, 'g')}
                activeOpacity={0.8}
              >
                <Text style={[styles.unitToggleText, { color: item.unitMode === 'g' ? theme.primary : theme.textMuted }]}>
                  ⚖️ Grams ({item.isLiquid ? 'ml' : 'g'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.unitToggleBtn,
                  item.unitMode === 'count' && { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                  item.unitMode !== 'count' && { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                ]}
                onPress={() => handleUnitModeToggle(item.id, 'count')}
                activeOpacity={0.8}
              >
                <Text style={[styles.unitToggleText, { color: item.unitMode === 'count' ? theme.primary : theme.textMuted }]}>
                  🔢 Count / Portion
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quantity Input Field with Addon */}
            <View style={styles.qtyContainer}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {item.unitMode === 'g'
                  ? `Weight in ${item.isLiquid ? 'milliliters (ml)' : 'grams (g)'}:`
                  : `Item Count (1 serving = approx ${item.singlePieceWeightG}${item.isLiquid ? 'ml' : 'g'}):`}
              </Text>

              <View style={styles.inputWithAddon}>
                <TextInput
                  style={[styles.inputFlex, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  value={item.quantity}
                  onChangeText={(qty) => handleQuantityChange(item.id, qty)}
                  keyboardType="decimal-pad"
                  placeholder={item.unitMode === 'g' ? '150' : '1'}
                />
                <View style={[styles.addonBadge, { backgroundColor: theme.cardSecondary }]}>
                  <Text style={[styles.addonBadgeText, { color: theme.primary }]}>
                    {item.unitMode === 'g' ? (item.isLiquid ? 'ml' : 'g') : 'x count'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Calculated Macro Pills */}
            <View style={styles.macroPillsRow}>
              <Chip style={{ backgroundColor: theme.cardSecondary }} compact>
                <Text style={{ color: theme.primary, fontWeight: '800' }}>{item.calories} kcal</Text>
              </Chip>
              <Chip style={{ backgroundColor: theme.cardSecondary }} compact>
                <Text style={{ color: '#6366F1', fontWeight: '800' }}>P: {item.proteinG}g</Text>
              </Chip>
              <Chip style={{ backgroundColor: theme.cardSecondary }} compact>
                <Text style={{ color: '#22C55E', fontWeight: '800' }}>C: {item.carbsG}g</Text>
              </Chip>
              <Chip style={{ backgroundColor: theme.cardSecondary }} compact>
                <Text style={{ color: '#F59E0B', fontWeight: '800' }}>F: {item.fatG}g</Text>
              </Chip>
            </View>

          </Surface>
        ))}

        {/* Grand Total Summary Card */}
        <Surface style={[styles.totalCard, { backgroundColor: theme.card, borderColor: theme.primary }]} elevation={3}>
          <Text style={[styles.totalTitle, { color: theme.primary }]}>Meal Grand Total ({items.length} items)</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalCol}>
              <Text style={[styles.totalNum, { color: theme.primary }]}>{totalCalories}</Text>
              <Text style={[styles.totalSub, { color: theme.textMuted }]}>Calories (kcal)</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={[styles.totalNum, { color: '#6366F1' }]}>{Math.round(totalProtein * 10) / 10}g</Text>
              <Text style={[styles.totalSub, { color: theme.textMuted }]}>Protein</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={[styles.totalNum, { color: '#22C55E' }]}>{Math.round(totalCarbs * 10) / 10}g</Text>
              <Text style={[styles.totalSub, { color: theme.textMuted }]}>Carbs</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={[styles.totalNum, { color: '#F59E0B' }]}>{Math.round(totalFat * 10) / 10}g</Text>
              <Text style={[styles.totalSub, { color: theme.textMuted }]}>Fat</Text>
            </View>
          </View>
        </Surface>

      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={() => setSessionModalOpen(true)}
          style={styles.stickySaveBtn}
          contentStyle={{ height: 48 }}
          labelStyle={{ fontSize: 16, fontWeight: '800' }}
          buttonColor={theme.primary}
          loading={isUploadingAndSaving}
          disabled={isUploadingAndSaving}
        >
          Save to Daily Log ({totalCalories} kcal)
        </Button>
      </View>

      {/* Meal Session Selection Dialog Modal */}
      <Portal>
        <Dialog
          visible={sessionModalOpen}
          onDismiss={() => setSessionModalOpen(false)}
          style={{ borderRadius: 24, backgroundColor: theme.card }}
        >
          <Dialog.Title style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary }}>
            Select Meal Session
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 14 }}>
              Which meal session would you like to attach these {items.length} item(s) to?
            </Text>

            <View style={{ gap: 8 }}>
              {MEAL_ORDER.map((meal) => {
                const config = MEAL_CONFIG[meal];
                const active = selectedMeal === meal;
                return (
                  <TouchableOpacity
                    key={meal}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: active ? theme.primary : theme.cardBorder,
                      backgroundColor: active ? theme.primaryLight : theme.cardSecondary,
                      gap: 10,
                    }}
                    onPress={() => setSelectedMeal(meal)}
                  >
                    <Text style={{ fontSize: 20 }}>{config.emoji}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: active ? theme.primary : theme.textPrimary, flex: 1 }}>
                      {config.label}
                    </Text>
                    {active && <Text style={{ color: theme.primary, fontWeight: '800' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>

          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Button onPress={() => setSessionModalOpen(false)} textColor={theme.textMuted}>
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor={theme.primary}
              onPress={handleConfirmSessionAndLog}
              loading={isUploadingAndSaving}
            >
              Confirm & Log
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 },
  imageCard: { borderRadius: 24, overflow: 'hidden' },
  stepBanner: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 2 },
  stepBannerTitle: { fontSize: 14, fontWeight: '800' },
  stepBannerSub: { fontSize: 12 },
  itemCard: { borderRadius: 20, padding: 16, gap: 12, borderWidth: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 17, fontWeight: '800' },
  itemNameInput: { flex: 1, fontSize: 16, fontWeight: '700', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  editNameBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  unitToggleRow: { flexDirection: 'row', gap: 8 },
  unitToggleBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  unitToggleText: { fontSize: 13, fontWeight: '700' },
  unitToggleTextActive: { fontWeight: '800' },
  qtyContainer: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  inputWithAddon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '700' },
  addonBadge: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addonBadgeText: { fontSize: 13, fontWeight: '800' },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  macroPillsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, paddingTop: 4 },
  totalCard: { borderRadius: 20, padding: 16, gap: 12, borderWidth: 1.5 },
  totalTitle: { fontSize: 15, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalCol: { alignItems: 'center' },
  totalNum: { fontSize: 20, fontWeight: '800' },
  totalSub: { fontSize: 11, fontWeight: '500' },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  stickySaveBtn: {
    borderRadius: 16,
  },
});

export default ResultScreen;
