import React, { useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
  Image, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Portal, Dialog, Button } from 'react-native-paper';
import { RootStackParamList, PortionUnit } from '../../types';
import { useLog } from '../../contexts/LogContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FONTS } from '../../theme/fonts';
import {
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Minus,
  Trash2,
  Heart,
  Flame,
  Beef,
  Leaf,
  Pizza,
  Droplet,
  Bookmark,
  Share2,
  Camera,
  HelpCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { API } from '../../services/api';

type FoodDetailEditNavProp = NativeStackNavigationProp<RootStackParamList, 'FoodDetailEdit'>;
type FoodDetailEditRouteProp = RouteProp<RootStackParamList, 'FoodDetailEdit'>;

interface Props {
  navigation: FoodDetailEditNavProp;
  route: FoodDetailEditRouteProp;
}

const DEFAULT_FOOD_HERO = 'https://images.unsplash.com/photo-1484723091479-00321ed0b691?auto=format&fit=crop&w=800&q=80';

const FoodDetailEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { foodEntry, date } = route.params;
  const { addEntry, deleteEntry, loadTodayLog } = useLog();

  const [quantity, setQuantity] = useState<number>(foodEntry.portionQuantity || 1);
  const [unit, setUnit] = useState<PortionUnit>(foodEntry.portionUnit || (foodEntry.isLiquid ? 'ml' : 'g'));
  const [calories, setCalories] = useState<number>(foodEntry.calories);
  const [proteinG, setProteinG] = useState<number>(foodEntry.proteinG);
  const [carbsG, setCarbsG] = useState<number>(foodEntry.carbsG);
  const [fatG, setFatG] = useState<number>(foodEntry.fatG);
  const [foodName, setFoodName] = useState<string>(foodEntry.name);

  // Food Image state
  const [imageUrl, setImageUrl] = useState<string | undefined>(foodEntry.imageUrl);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Edit Modal State for inline macro edits
  const [editMacroField, setEditMacroField] = useState<{ field: 'calories' | 'protein' | 'carbs' | 'fat'; label: string; value: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1-unit base calculation
  const baseQty = foodEntry.portionQuantity || 1;
  const baseCals = foodEntry.calories / baseQty;
  const baseProtein = foodEntry.proteinG / baseQty;
  const baseCarbs = foodEntry.carbsG / baseQty;
  const baseFat = foodEntry.fatG / baseQty;

  const handleStepQuantity = (delta: number) => {
    const nextQty = Math.max(0.25, Math.round((quantity + delta) * 100) / 100);
    setQuantity(nextQty);
    setCalories(Math.round(baseCals * nextQty));
    setProteinG(Math.round(baseProtein * nextQty * 10) / 10);
    setCarbsG(Math.round(baseCarbs * nextQty * 10) / 10);
    setFatG(Math.round(baseFat * nextQty * 10) / 10);
  };

  const handlePickAndUploadImage = () => {
    Alert.alert('Alter Food Photo', 'Choose an image source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
          if (!result.canceled && result.assets[0]?.uri) await processUploadImage(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission required', 'Photo library access is needed.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
          if (!result.canceled && result.assets[0]?.uri) await processUploadImage(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const processUploadImage = async (uri: string) => {
    setIsUploadingImg(true);
    try {
      const uploadedUrl = await API.uploadFoodImage(uri);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        Alert.alert('✅ Photo Updated', 'Food image updated! Tap Save Changes to persist.');
      } else {
        Alert.alert('Upload Failed', 'Could not upload photo to Cloudinary.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Image upload failed.');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleSaveMacroOverride = () => {
    if (!editMacroField) return;
    const num = parseFloat(editMacroField.value) || 0;
    if (editMacroField.field === 'calories') setCalories(Math.round(num));
    if (editMacroField.field === 'protein') setProteinG(Math.round(num * 10) / 10);
    if (editMacroField.field === 'carbs') setCarbsG(Math.round(num * 10) / 10);
    if (editMacroField.field === 'fat') setFatG(Math.round(num * 10) / 10);
    setEditMacroField(null);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      if (foodEntry._id) {
        await deleteEntry(foodEntry._id, date);
      }

      await addEntry({
        name: foodName,
        meal: foodEntry.meal,
        calories,
        proteinG,
        carbsG,
        fatG,
        portionUnit: unit,
        portionQuantity: quantity,
        weightGramsOrMl: Math.round((foodEntry.weightGramsOrMl || 100) * quantity),
        portionDescription: `${quantity} ${unit}`,
        isLiquid: foodEntry.isLiquid,
        source: foodEntry.source,
        nutritionSource: foodEntry.nutritionSource,
        imageUrl: imageUrl || undefined,
        date,
      });

      await loadTodayLog(date);

      Alert.alert('✅ Saved!', 'Food log updated successfully in database.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update food entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = () => {
    Alert.alert('Delete Food Entry?', `Remove "${foodName}" from your log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (foodEntry._id) {
            await deleteEntry(foodEntry._id, date);
            await loadTodayLog(date);
            navigation.goBack();
          }
        },
      },
    ]);
  };

  // Dynamic Health Score calculation heuristic (1-10 scale based on current macro density)
  const getDynamicHealthScore = (cals: number, protein: number, carbs: number, fat: number) => {
    if (!cals || cals <= 0) return 10;
    const proteinKcal = protein * 4;
    const fatKcal = fat * 9;
    const proteinPct = proteinKcal / Math.max(1, cals);
    const fatPct = fatKcal / Math.max(1, cals);

    let score = 8;
    if (proteinPct >= 0.20) score += 2;
    else if (proteinPct >= 0.12) score += 1;

    if (fatPct > 0.50) score -= 2;
    else if (fatPct > 0.35) score -= 1;

    return Math.min(10, Math.max(1, Math.round(score)));
  };

  const healthScore = getDynamicHealthScore(calories, proteinG, carbsG, fatG);
  const timeString = new Date(foodEntry.addedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Main ScrollView wrapping Hero Image and White Sheet */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Top Hero Dish Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: imageUrl || DEFAULT_FOOD_HERO }} style={styles.heroImage} />

          {/* Top Header Floating Overlay Buttons */}
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <ChevronLeft size={22} color="#0F172A" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Alter / Change Photo Button */}
              <TouchableOpacity style={styles.iconCircle} onPress={handlePickAndUploadImage} disabled={isUploadingImg} activeOpacity={0.8}>
                {isUploadingImg ? (
                  <ActivityIndicator size="small" color="#0284C7" />
                ) : (
                  <Camera size={20} color="#0284C7" />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconCircle} onPress={handleDeleteItem} activeOpacity={0.8}>
                <MoreHorizontal size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Main White Card Sheet Overlapping Hero Image */}
        <View style={styles.mainCard}>
          {/* Timestamp & Bookmark/Share Row */}
          <View style={styles.topMetaRow}>
            <Text style={styles.timeText}>{timeString}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity activeOpacity={0.7}>
                <Bookmark size={20} color="#334155" />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}>
                <Share2 size={20} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dish Title */}
          <TextInput
            style={styles.dishTitleInput}
            value={foodName}
            onChangeText={setFoodName}
            placeholder="Dish Name"
          />

          {/* Health Score & Quantity Stepper Row (Exact Match to User Screenshot) */}
          <View style={styles.scoreStepperRow}>
            {/* Left Health Score Inline Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.healthScoreLabel}>Health Score</Text>
              <HelpCircle size={13} color="#EC4899" />
              <View style={styles.scoreBadge}>
                <Heart size={13} color="#EC4899" fill="#EC4899" />
                <Text style={styles.scoreBadgeText}>{healthScore}/10</Text>
              </View>
            </View>

            {/* Right Quantity Stepper Buttons */}
            <View style={styles.stepperContainer}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => handleStepQuantity(-1)} activeOpacity={0.7}>
                <Minus size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.stepQtyText}>{quantity}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => handleStepQuantity(1)} activeOpacity={0.7}>
                <Plus size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 4 Macro Cards Grid (2x2) - Exact UI Matching Reference Screenshot */}
          <View style={styles.macroGrid}>
            {/* Calories Card */}
            <TouchableOpacity
              style={styles.macroBox}
              onPress={() => setEditMacroField({ field: 'calories', label: 'Calories (kcal)', value: calories.toString() })}
              activeOpacity={0.8}
            >
              <View style={[styles.macroIconBox, { backgroundColor: '#F8FAFC' }]}>
                <Flame size={22} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroBoxLabel}>Calories</Text>
                <Text style={styles.macroBoxValue}>{calories}k</Text>
              </View>
              <View style={styles.pencilCorner}>
                <Pencil size={15} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Protein Card */}
            <TouchableOpacity
              style={styles.macroBox}
              onPress={() => setEditMacroField({ field: 'protein', label: 'Protein (g)', value: proteinG.toString() })}
              activeOpacity={0.8}
            >
              <View style={[styles.macroIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Beef size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroBoxLabel}>Protein</Text>
                <Text style={styles.macroBoxValue}>{proteinG}g</Text>
              </View>
              <View style={styles.pencilCorner}>
                <Pencil size={15} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Carbs Card */}
            <TouchableOpacity
              style={styles.macroBox}
              onPress={() => setEditMacroField({ field: 'carbs', label: 'Carbs (g)', value: carbsG.toString() })}
              activeOpacity={0.8}
            >
              <View style={[styles.macroIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Leaf size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroBoxLabel}>Carbs</Text>
                <Text style={styles.macroBoxValue}>{carbsG}g</Text>
              </View>
              <View style={styles.pencilCorner}>
                <Pencil size={15} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Fat Card */}
            <TouchableOpacity
              style={styles.macroBox}
              onPress={() => setEditMacroField({ field: 'fat', label: 'Fat (g)', value: fatG.toString() })}
              activeOpacity={0.8}
            >
              <View style={[styles.macroIconBox, { backgroundColor: '#FEFCE8' }]}>
                <Pizza size={22} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroBoxLabel}>Fat</Text>
                <Text style={styles.macroBoxValue}>{fatG}g</Text>
              </View>
              <View style={styles.pencilCorner}>
                <Pencil size={15} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 12, marginTop: 24 }}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges} disabled={isSaving} activeOpacity={0.8}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteItem} activeOpacity={0.8}>
              <Trash2 size={18} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Remove from Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Macro Dialog Modal */}
      <Portal>
        <Dialog visible={Boolean(editMacroField)} onDismiss={() => setEditMacroField(null)} style={{ borderRadius: 20, backgroundColor: '#FFFFFF' }}>
          <Dialog.Title style={{ fontSize: 18, color: '#0F172A', fontFamily: FONTS.heading.bold }}>
            Edit {editMacroField?.label}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              style={styles.modalInput}
              value={editMacroField?.value || ''}
              onChangeText={(val) => setEditMacroField((prev) => (prev ? { ...prev, value: val } : null))}
              keyboardType="decimal-pad"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions style={{ gap: 8 }}>
            <Button onPress={() => setEditMacroField(null)} textColor="#64748B">Cancel</Button>
            <Button mode="contained" buttonColor="#FF6B00" onPress={handleSaveMacroOverride}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: { height: 300, width: '100%', position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerOverlay: {
    position: 'absolute', top: 0, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardOverlayScroll: { paddingTop: 0 },
  mainCard: {
    marginTop: -32,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 18,
  },
  topMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { fontSize: 13, color: '#94A3B8', fontFamily: FONTS.body.regular },
  dishTitleInput: { fontSize: 24, color: '#0F172A', fontFamily: FONTS.heading.bold, padding: 0 },
  
  scoreStepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  healthScoreLabel: { fontSize: 13, color: '#EC4899', fontFamily: FONTS.heading.medium },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  scoreBadgeText: { fontSize: 13, color: '#EC4899', fontFamily: FONTS.heading.bold },
  
  stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  stepQtyText: { fontSize: 20, color: '#0F172A', fontFamily: FONTS.heading.bold },

  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  macroBox: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  macroIconBox: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  macroBoxLabel: { fontSize: 13, color: '#94A3B8', fontFamily: FONTS.body.regular },
  macroBoxValue: { fontSize: 18, color: '#0F172A', fontFamily: FONTS.heading.bold, marginTop: 2 },
  pencilCorner: { alignSelf: 'center' },

  saveBtn: {
    height: 54, borderRadius: 18, backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, color: '#FFFFFF', fontFamily: FONTS.heading.bold },
  deleteBtn: {
    height: 48, borderRadius: 18, backgroundColor: '#FEF2F2',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  deleteBtnText: { fontSize: 15, color: '#EF4444', fontFamily: FONTS.heading.medium },

  modalInput: {
    fontSize: 20, color: '#0F172A', fontFamily: FONTS.heading.bold,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, textAlign: 'center',
  },
});

export default FoodDetailEditScreen;
