import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MealType, MEAL_CONFIG } from '../../types';
import { useLog } from '../../contexts/LogContext';
import { useTheme } from '../../contexts/ThemeContext';
import { API } from '../../services/api';

interface Props { navigation: NativeStackNavigationProp<any> }

interface MultiFoodItemInput {
  id: string;
  name: string;
  quantity: string; // e.g. "2" or "150"
  unit: 'pieces' | 'grams' | 'cups' | 'ml';
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  isCalculating?: boolean;
  imageUrl?: string;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];

const ManualEntryScreen: React.FC<Props> = ({ navigation }) => {
  const { addEntry } = useLog();
  const { theme } = useTheme();

  const [items, setItems] = useState<MultiFoodItemInput[]>([
    { id: '1', name: '', quantity: '1', unit: 'pieces', calories: '', protein: '', carbs: '', fat: '', fiber: '' },
  ]);

  const [selectedMeal, setSelectedMeal] = useState<MealType>(() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'evening_snack';
  });

  const [isSaving, setIsSaving] = useState(false);

  // Debounced auto-calculation when food name or quantity changes
  const calcTimerRef = useRef<Record<string, any>>({});

  const handleItemChange = (id: string, field: keyof MultiFoodItemInput, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );

    if (field === 'name' || field === 'quantity' || field === 'unit') {
      triggerAutoCalc(id, field === 'name' ? val : undefined);
    }
  };

  const triggerAutoCalc = (id: string, updatedName?: string) => {
    if (calcTimerRef.current[id]) clearTimeout(calcTimerRef.current[id]);

    calcTimerRef.current[id] = setTimeout(async () => {
      const currentItem = items.find((i) => i.id === id);
      const nameToUse = updatedName !== undefined ? updatedName : currentItem?.name;
      if (!nameToUse || nameToUse.trim().length < 2) return;

      const qty = currentItem?.quantity || '1';
      const unit = currentItem?.unit || 'pieces';

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isCalculating: true } : i))
      );

      try {
        const queryStr = `${qty} ${unit} of ${nameToUse.trim()}`;
        const res = await API.quickTextLookup(queryStr);
        if (res && res.items && res.items[0]) {
          const calc = res.items[0];
          setItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    calories: calc.calories.toString(),
                    protein: calc.proteinG.toString(),
                    carbs: calc.carbsG.toString(),
                    fat: calc.fatG.toString(),
                    fiber: (calc.fiberG || 0).toString(),
                    isCalculating: false,
                  }
                : i
            )
          );
        }
      } catch (err) {
        console.warn('Auto calc warning:', err);
      } finally {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, isCalculating: false } : i))
        );
      }
    }, 600);
  };

  const addItem = () => {
    const newId = Date.now().toString();
    setItems((prev) => [
      ...prev,
      { id: newId, name: '', quantity: '1', unit: 'pieces', calories: '', protein: '', carbs: '', fat: '', fiber: '' },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Calculate overall meal totals
  const totalCalories = items.reduce((acc, i) => acc + (parseFloat(i.calories) || 0), 0);
  const totalProtein = items.reduce((acc, i) => acc + (parseFloat(i.protein) || 0), 0);
  const totalCarbs = items.reduce((acc, i) => acc + (parseFloat(i.carbs) || 0), 0);
  const totalFat = items.reduce((acc, i) => acc + (parseFloat(i.fat) || 0), 0);
  const totalFiber = items.reduce((acc, i) => acc + (parseFloat(i.fiber) || 0), 0);

  const handleSaveAll = async () => {
    const validItems = items.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      Alert.alert('Missing Food Name', 'Please enter at least one food item.');
      return;
    }

    setIsSaving(true);
    try {
      for (const item of validItems) {
        const qtyNum = parseFloat(item.quantity) || 1;
        const itemCal = Math.round(parseFloat(item.calories) || 0);
        const u = (item.unit as string).toLowerCase();
        let weightG = itemCal > 0 ? Math.round(itemCal * 1.25) : 180;
        if (u === 'g' || u === 'grams') weightG = qtyNum;
        else if (u === 'ml') weightG = qtyNum;
        else if (u.includes('cup')) weightG = qtyNum * 200;
        else if (u.includes('bowl')) weightG = qtyNum * 300;
        else if (u.includes('glass')) weightG = qtyNum * 250;
        else if (u.includes('piece')) weightG = qtyNum * 120;
        else if (u.includes('slice')) weightG = qtyNum * 40;

        const isLiq = u === 'ml' || u.includes('glass');

        await addEntry({
          name: item.name.trim(),
          meal: selectedMeal,
          calories: itemCal,
          proteinG: Math.round((parseFloat(item.protein) || 0) * 10) / 10,
          carbsG: Math.round((parseFloat(item.carbs) || 0) * 10) / 10,
          fatG: Math.round((parseFloat(item.fat) || 0) * 10) / 10,
          portionUnit: isLiq ? 'ml' : 'g',
          portionQuantity: qtyNum,
          weightGramsOrMl: Math.round(weightG),
          portionG: Math.round(weightG),
          portionDescription: `${Math.round(weightG)}${isLiq ? 'ml' : 'g'}`,
          isLiquid: isLiq,
          imageUrl: item.imageUrl || undefined,
          source: 'manual',
          nutritionSource: 'gemini_estimate',
        });
      }

      Alert.alert('✅ Saved!', `${validItems.length} food item(s) added to ${MEAL_CONFIG[selectedMeal].label}.`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save food entries.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: theme.primary }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Quick Food Entry</Text>
          </View>

          <Text style={[styles.subHint, { color: theme.textMuted }]}>
            ✨ Enter food name & quantity. Calories, Protein & Fiber are auto-calculated live!
          </Text>

          {/* Food Items List */}
          {items.map((item, index) => (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              
              <View style={styles.cardHeader}>
                <Text style={[styles.itemIndexLabel, { color: theme.primary }]}>Item #{index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Food Name input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Food Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  placeholder="e.g. Masala Dosa, Egg, Chicken Salad"
                  placeholderTextColor={theme.textMuted}
                  value={item.name}
                  onChangeText={(text) => handleItemChange(item.id, 'name', text)}
                />
              </View>

              {/* Portion size & Unit */}
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Quantity / Count</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    placeholder="1"
                    placeholderTextColor={theme.textMuted}
                    value={item.quantity}
                    onChangeText={(val) => handleItemChange(item.id, 'quantity', val)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Unit</Text>
                  <View style={styles.unitRow}>
                    {(['pieces', 'grams', 'cups'] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitBtn,
                          { backgroundColor: item.unit === u ? theme.primaryLight : theme.inputBg, borderColor: item.unit === u ? theme.primary : theme.inputBorder },
                        ]}
                        onPress={() => handleItemChange(item.id, 'unit', u)}
                      >
                        <Text style={[styles.unitBtnText, { color: item.unit === u ? theme.primary : theme.textMuted }]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Auto Calculating Indicator or Macros grid */}
              {item.isCalculating ? (
                <View style={styles.calcIndicator}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                    ⚡ Calculating macros for {item.name}...
                  </Text>
                </View>
              ) : (
                <View style={styles.macroPillsRow}>
                  <View style={[styles.macroPill, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.macroVal, { color: theme.textPrimary }]}>{item.calories || '0'}</Text>
                    <Text style={[styles.macroLbl, { color: theme.textMuted }]}>kcal</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.macroVal, { color: '#6366F1' }]}>{item.protein || '0'}g</Text>
                    <Text style={[styles.macroLbl, { color: theme.textMuted }]}>Protein</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.macroVal, { color: '#22C55E' }]}>{item.carbs || '0'}g</Text>
                    <Text style={[styles.macroLbl, { color: theme.textMuted }]}>Carbs</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.macroVal, { color: '#F59E0B' }]}>{item.fat || '0'}g</Text>
                    <Text style={[styles.macroLbl, { color: theme.textMuted }]}>Fat</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.macroVal, { color: '#EC4899' }]}>{item.fiber || '0'}g</Text>
                    <Text style={[styles.macroLbl, { color: theme.textMuted }]}>Fiber</Text>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Add Extra Food Button */}
          <TouchableOpacity
            style={[styles.addExtraBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.cardBorder }]}
            onPress={addItem}
          >
            <Text style={[styles.addExtraText, { color: theme.primary }]}>+ Add Extra Food Item</Text>
          </TouchableOpacity>

          {/* Total Meal Summary Card */}
          <View style={[styles.totalCard, { backgroundColor: theme.card, borderColor: theme.primaryLight }]}>
            <Text style={[styles.totalTitle, { color: theme.textPrimary }]}>Total Meal Nutrition</Text>
            <View style={styles.totalRow}>
              <View style={styles.totalCol}>
                <Text style={[styles.totalNum, { color: theme.primary }]}>{Math.round(totalCalories)}</Text>
                <Text style={[styles.totalSub, { color: theme.textMuted }]}>Calories</Text>
              </View>
              <View style={styles.totalCol}>
                <Text style={[styles.totalNum, { color: '#6366F1' }]}>{totalProtein.toFixed(1)}g</Text>
                <Text style={[styles.totalSub, { color: theme.textMuted }]}>Protein</Text>
              </View>
              <View style={styles.totalCol}>
                <Text style={[styles.totalNum, { color: '#22C55E' }]}>{totalCarbs.toFixed(1)}g</Text>
                <Text style={[styles.totalSub, { color: theme.textMuted }]}>Carbs</Text>
              </View>
              <View style={styles.totalCol}>
                <Text style={[styles.totalNum, { color: '#F59E0B' }]}>{totalFat.toFixed(1)}g</Text>
                <Text style={[styles.totalSub, { color: theme.textMuted }]}>Fat</Text>
              </View>
            </View>
          </View>

          {/* Meal Picker */}
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Select Meal</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.primary : theme.textSecondary }}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Bottom Save Bar */}
        <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }, isSaving && { opacity: 0.6 }]}
            onPress={handleSaveAll}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Meal to Daily Log</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 4 },
  backBtn: { padding: 4 },
  backText: { fontSize: 24, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800' },
  subHint: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  itemCard: { borderRadius: 18, padding: 16, gap: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemIndexLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10 },
  unitRow: { flexDirection: 'row', gap: 4 },
  unitBtn: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  unitBtnText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  calcIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  macroPillsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, paddingTop: 4 },
  macroPill: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  macroVal: { fontSize: 13, fontWeight: '800' },
  macroLbl: { fontSize: 10, fontWeight: '500' },
  addExtraBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  addExtraText: { fontSize: 14, fontWeight: '700' },
  totalCard: { borderRadius: 18, padding: 16, gap: 12, borderWidth: 1.5 },
  totalTitle: { fontSize: 14, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalCol: { alignItems: 'center' },
  totalNum: { fontSize: 18, fontWeight: '800' },
  totalSub: { fontSize: 11, fontWeight: '500' },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  bottomBar: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default ManualEntryScreen;
