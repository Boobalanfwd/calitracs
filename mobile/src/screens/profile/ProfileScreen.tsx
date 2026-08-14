import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator, Image, Modal,
  Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User as LucideUser,
  Camera,
  Scale,
  Ruler,
  Activity,
  Users,
  Bell,
  Sliders,
  Headphones,
  LogOut,
  ChevronRight,
  Sparkles,
  Flame,
  X,
  Edit3,
  Droplet,
  Info,
  Zap,
  MoreHorizontal,
  Trophy,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, ActivityLevel, Goal, Gender } from '../../types';
import { FONTS } from '../../theme/fonts';
import { API } from '../../services/api';
import { getResizedCloudinaryUrl } from '../../utils/imageUtils';
import NotificationSettingsScreen from '../settings/NotificationSettingsScreen';
import AppPreferencesScreen from '../settings/AppPreferencesScreen';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Reusable Settings Row Component ──────────────────────────────────────────
interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  valueLabel?: string;
  valueBg?: string;
  valueColor?: string;
  onPress: () => void;
  isLast?: boolean;
  isDanger?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon, iconBg, title, subtitle, valueLabel, valueBg, valueColor,
  onPress, isLast, isDanger,
}) => (
  <TouchableOpacity
    style={[s.row, isLast && s.rowLast]}
    onPress={onPress}
    activeOpacity={0.65}
  >
    <View style={[s.rowIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={s.rowBody}>
      <Text style={[s.rowTitle, isDanger && { color: '#EF4444' }]}>{title}</Text>
      <Text style={s.rowSub}>{subtitle}</Text>
    </View>
    <View style={s.rowRight}>
      {valueLabel ? (
        <View style={[s.valuePill, { backgroundColor: valueBg || '#F1F5F9' }]}>
          <Text style={[s.valuePillText, { color: valueColor || '#64748B' }]}>{valueLabel}</Text>
        </View>
      ) : null}
      <ChevronRight size={16} color={isDanger ? '#EF4444' : '#CBD5E1'} />
    </View>
  </TouchableOpacity>
);

// ── Custom Modern Popover Modal Wrapper ──────────────────────────────────────
interface ModernPopoverProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  loadingAction?: boolean;
}

const ModernPopover: React.FC<ModernPopoverProps> = ({
  visible, onClose, title, subtitle, icon, iconBg, children,
  primaryActionLabel, onPrimaryAction, loadingAction,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={pop.overlay}
    >
      <TouchableOpacity style={pop.backdropPress} activeOpacity={1} onPress={onClose} />
      <View style={pop.card} onStartShouldSetResponder={() => true}>
        {/* Drag handle */}
        <View style={pop.dragHandle} />

        {/* Header */}
        <View style={pop.headerRow}>
          <View style={pop.headerLeft}>
            <View style={[pop.iconCircle, { backgroundColor: iconBg }]}>
              {icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pop.titleText}>{title}</Text>
              {subtitle ? <Text style={pop.subText}>{subtitle}</Text> : null}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={pop.closeBtn} activeOpacity={0.7}>
            <X size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={pop.scrollContent}
          contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {/* Actions */}
        {onPrimaryAction ? (
          <View style={pop.actionsRow}>
            <TouchableOpacity style={pop.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={pop.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={pop.primaryBtn}
              onPress={onPrimaryAction}
              disabled={loadingAction}
              activeOpacity={0.85}
            >
              {loadingAction ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={pop.primaryBtnText}>{primaryActionLabel || 'Save Changes'}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={pop.singleCloseBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={pop.singleCloseBtnText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// ── Main ProfileScreen ────────────────────────────────────────────────────────
const ProfileScreen: React.FC = () => {
  const { user, targets, token, logout, updateProfile, updateTargets, refreshTargets } = useAuth();

  const [showPopover, setShowPopover] = useState(false);
  const [activeModal, setActiveModal] = useState<
    'userInfo' | 'healthOverview' | 'personalSettings' | 'preferences' | 'support' | 'notifications' | null
  >(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  // User Info state
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');

  // Health Overview state
  const [calInput, setCalInput] = useState(targets?.calories?.toString() || '2000');
  const [pInput, setPInput] = useState(targets?.proteinG?.toString() || '150');
  const [cInput, setCInput] = useState(targets?.carbsG?.toString() || '225');
  const [fInput, setFInput] = useState(targets?.fatG?.toString() || '65');
  const [waterInput, setWaterInput] = useState((targets?.waterMl ?? 2000).toString());
  const [macroWarning, setMacroWarning] = useState('');

  // Personal Settings state
  const [weightInput, setWeightInput] = useState((user?.profile?.weightKg || 70).toString());
  const [heightInput, setHeightInput] = useState((user?.profile?.heightCm || 170).toString());
  const [ageInput, setAgeInput] = useState((user?.profile?.age || '').toString());
  const [activityInput, setActivityInput] = useState<ActivityLevel>(
    (user?.profile?.activityLevel as ActivityLevel) || 'moderate'
  );
  const [goalInput, setGoalInput] = useState<Goal>((user?.profile?.goal as Goal) || 'maintain');
  const [genderInput, setGenderInput] = useState<Gender>((user?.profile?.gender as Gender) || 'other');
  const [bmrResult, setBmrResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentWeight = user?.profile?.weightKg ?? 70;
  const heightCm = user?.profile?.heightCm ?? 170;
  const heightM = heightCm / 100;
  const bmi = Math.round((currentWeight / (heightM * heightM)) * 10) / 10;
  const activityLevel = user?.profile?.activityLevel ?? 'moderate';
  const formattedActivity =
    activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1).replace('_', ' ');
  const isImperial = user?.profile?.unitSystem === 'imperial';

  // ── Avatar Picker ──────────────────────────────────────────────────────────
  const handlePickAvatar = () => {
    setShowPopover(false);
    Alert.alert('Change Profile Photo', 'Choose a photo source', [
      {
        text: '📷 Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.uri) await handleUploadAvatar(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Photo Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission required', 'Photo library access is needed.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.uri) await handleUploadAvatar(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUploadAvatar = async (uri: string) => {
    if (!token) return;
    setAvatarUploading(true);
    setLocalAvatarUri(uri);
    try {
      const avatarUrl = await API.uploadProfileImage(token, uri);
      if (avatarUrl) {
        await updateProfile({ avatarUrl } as any);
        Alert.alert('✅ Profile photo updated!');
      } else {
        Alert.alert('Upload Failed', 'Could not upload photo.');
        setLocalAvatarUri(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Upload failed.');
      setLocalAvatarUri(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save User Info ─────────────────────────────────────────────────────────
  const handleSaveUserInfo = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length < 2) { setNameError('Name must be at least 2 characters.'); return; }
    if (trimmed.length > 40) { setNameError('Name must be 40 characters or fewer.'); return; }
    setNameError('');
    setSaving(true);
    try {
      await updateProfile({ name: trimmed } as any);
      setActiveModal(null);
      Alert.alert('✅ Name updated!', `Your display name is now "${trimmed}".`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally { setSaving(false); }
  };

  // ── Macro Consistency ─────────────────────────────────────────────────────
  const checkMacroConsistency = (cal: number, p: number, c: number, f: number): string => {
    const macroKcal = p * 4 + c * 4 + f * 9;
    const diff = Math.abs(macroKcal - cal);
    const pct = (diff / cal) * 100;
    if (pct > 15) return `⚠️ Macro totals (${Math.round(macroKcal)} kcal) differ from calorie target (${cal} kcal) by ${Math.round(pct)}%. Consider adjusting for consistency.`;
    return '';
  };

  // ── Save Health Targets ────────────────────────────────────────────────────
  const handleSaveTargets = async () => {
    const calories = parseInt(calInput);
    const proteinG = parseInt(pInput) || 0;
    const carbsG = parseInt(cInput) || 0;
    const fatG = parseInt(fInput) || 0;
    const waterMl = parseInt(waterInput) || 2000;

    if (isNaN(calories) || calories < 500 || calories > 5000) { Alert.alert('Invalid Calories', 'Calories must be between 500 and 5000 kcal.'); return; }
    if (proteinG < 10 || proteinG > 400) { Alert.alert('Invalid Protein', 'Protein must be between 10g and 400g.'); return; }
    if (carbsG < 10 || carbsG > 600) { Alert.alert('Invalid Carbs', 'Carbs must be between 10g and 600g.'); return; }
    if (fatG < 5 || fatG > 200) { Alert.alert('Invalid Fat', 'Fat must be between 5g and 200g.'); return; }
    if (waterMl < 500 || waterMl > 6000) { Alert.alert('Invalid Water Target', 'Water target must be between 500 ml and 6000 ml.'); return; }

    const warn = checkMacroConsistency(calories, proteinG, carbsG, fatG);
    if (warn) {
      setMacroWarning(warn);
      Alert.alert('Macro Inconsistency', warn + '\n\nSave anyway?', [
        { text: 'Review', style: 'cancel' },
        { text: 'Save Anyway', onPress: () => doSaveTargets(calories, proteinG, carbsG, fatG, waterMl) },
      ]);
      return;
    }
    setMacroWarning('');
    await doSaveTargets(calories, proteinG, carbsG, fatG, waterMl);
  };

  const doSaveTargets = async (calories: number, proteinG: number, carbsG: number, fatG: number, waterMl: number) => {
    setSaving(true);
    try {
      await updateTargets({ calories, proteinG, carbsG, fatG, waterMl });
      await refreshTargets();
      setActiveModal(null);
      Alert.alert('✅ Targets Updated', 'Your daily nutrition targets have been saved.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update targets.');
    } finally { setSaving(false); }
  };

  // ── BMR ───────────────────────────────────────────────────────────────────
  const calculateBMR = (weightKg: number, heightCm: number, age: number, gender: Gender): number => {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(gender === 'female' ? base - 161 : base + 5);
  };

  const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };

  // ── Save Personal Settings ─────────────────────────────────────────────────
  const handleSavePersonal = async () => {
    const parsedW = parseFloat(weightInput);
    const parsedH = parseFloat(heightInput);
    const parsedAge = parseInt(ageInput);
    if (isNaN(parsedW) || parsedW < 20 || parsedW > 400) { Alert.alert('Invalid Weight', 'Weight must be between 20 and 400 kg.'); return; }
    if (isNaN(parsedH) || parsedH < 100 || parsedH > 250) { Alert.alert('Invalid Height', 'Height must be between 100 and 250 cm.'); return; }
    if (ageInput && (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120)) { Alert.alert('Invalid Age', 'Age must be between 13 and 120.'); return; }
    setSaving(true);
    try {
      await updateProfile({
        weightKg: parsedW, heightCm: parsedH, activityLevel: activityInput, goal: goalInput, gender: genderInput,
        ...(ageInput ? { age: parsedAge } : {}),
      });
      const age = ageInput ? parsedAge : (user?.profile?.age || 30);
      const bmr = calculateBMR(parsedW, parsedH, age, genderInput);
      const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityInput]);
      setBmrResult(`Estimated daily calorie need: ~${tdee} kcal (TDEE based on activity)`);
      setActiveModal(null);
      Alert.alert('✅ Metrics Saved', `Profile updated!\n\nEstimated daily calorie need: ~${tdee} kcal\n(Based on your activity level)`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update settings.');
    } finally { setSaving(false); }
  };

  const handleConfirmLogout = () => {
    setShowPopover(false);
    Alert.alert('Log Out', 'Are you sure you want to log out of Calitracs?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; icon: string }[] = [
    { value: 'sedentary', label: 'Sedentary', icon: '🛋️' },
    { value: 'light', label: 'Light', icon: '🚶' },
    { value: 'moderate', label: 'Moderate', icon: '🏃' },
    { value: 'active', label: 'Active', icon: '🏋️' },
    { value: 'very_active', label: 'Very Active', icon: '⚡' },
  ];

  const GOAL_OPTIONS: { value: Goal; label: string; icon: string }[] = [
    { value: 'lose_fat', label: 'Lose Fat', icon: '🔥' },
    { value: 'muscle_up', label: 'Build Muscle', icon: '💪' },
    { value: 'maintain', label: 'Maintain', icon: '⚖️' },
    { value: 'more_energy', label: 'More Energy', icon: '⚡' },
    { value: 'eat_healthier', label: 'Eat Healthier', icon: '🥗' },
    { value: 'control_sugar', label: 'Control Sugar', icon: '🩺' },
  ];

  const GENDER_OPTIONS: { value: Gender; label: string }[] = [
    { value: 'male', label: '♂ Male' },
    { value: 'female', label: '♀ Female' },
    { value: 'other', label: '⚧ Other' },
  ];

  const macroKcalPreview = useMemo(() => {
    const p = parseInt(pInput) || 0;
    const c = parseInt(cInput) || 0;
    const f = parseInt(fInput) || 0;
    return p * 4 + c * 4 + f * 9;
  }, [pInput, cInput, fInput]);

  const openModal = (m: typeof activeModal) => {
    if (m === 'healthOverview') {
      setCalInput(targets?.calories?.toString() || '2000');
      setPInput(targets?.proteinG?.toString() || '150');
      setCInput(targets?.carbsG?.toString() || '225');
      setFInput(targets?.fatG?.toString() || '65');
      setWaterInput((targets?.waterMl ?? 2000).toString());
      setMacroWarning('');
    }
    if (m === 'personalSettings') {
      setWeightInput((user?.profile?.weightKg || 70).toString());
      setHeightInput((user?.profile?.heightCm || 170).toString());
      setAgeInput((user?.profile?.age || '').toString());
      setActivityInput((user?.profile?.activityLevel as ActivityLevel) || 'moderate');
      setGoalInput((user?.profile?.goal as Goal) || 'maintain');
      setGenderInput((user?.profile?.gender as Gender) || 'other');
      setBmrResult(null);
    }
    if (m === 'userInfo') { setNameInput(user?.name || ''); setNameError(''); }
    setActiveModal(m);
  };

  const firstName = user?.name?.split(' ')[0] || 'User';

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6FA" />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO CARD ─────────────────────────────────────────────────── */}
        <View style={s.heroCard}>
          {/* Warm tint banner at top of hero */}
          <View style={s.heroBanner} />

          {/* Three-dot menu */}
          <TouchableOpacity style={s.heroMenuBtn} onPress={() => setShowPopover(true)} activeOpacity={0.75}>
            <MoreHorizontal size={20} color="#64748B" />
          </TouchableOpacity>

          {/* Avatar */}
          <TouchableOpacity style={s.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.85}>
            {avatarUploading ? (
              <View style={s.avatar}><ActivityIndicator color="#FF6B00" /></View>
            ) : (localAvatarUri || user?.profile?.avatarUrl) ? (
              <Image
                source={{ uri: localAvatarUri || getResizedCloudinaryUrl(user?.profile?.avatarUrl, 180) || undefined }}
                style={s.avatar}
              />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={s.cameraBadge}>
              <Camera size={11} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Name + Email + Streak */}
          <Text style={s.heroName}>{user?.name || 'User'}</Text>
          <Text style={s.heroEmail}>{user?.email || ''}</Text>

          <View style={s.heroBadgeRow}>
            <View style={s.proBadge}>
              <Sparkles size={11} color="#FF6B00" />
              <Text style={s.proBadgeText}>PRO</Text>
            </View>
            {(user?.profile?.streakDays ?? 0) > 0 && (
              <View style={s.streakBadge}>
                <Flame size={12} color="#FF6B00" />
                <Text style={s.streakBadgeText}>{user!.profile!.streakDays} day streak</Text>
              </View>
            )}
          </View>

          {/* ── Stat Pills row ─────────────────────────────────────────── */}
          <View style={s.statRow}>
            <View style={s.statPill}>
              <View style={[s.statIcon, { backgroundColor: '#FFF5EF' }]}>
                <Scale size={14} color="#FF6B00" />
              </View>
              <Text style={s.statVal}>{currentWeight}</Text>
              <Text style={s.statUnit}>kg</Text>
              <Text style={s.statLabel}>Weight</Text>
            </View>

            <View style={s.statDivider} />

            <View style={s.statPill}>
              <View style={[s.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ruler size={14} color="#3B82F6" />
              </View>
              <Text style={s.statVal}>{heightCm}</Text>
              <Text style={s.statUnit}>cm</Text>
              <Text style={s.statLabel}>Height</Text>
            </View>

            <View style={s.statDivider} />

            <View style={s.statPill}>
              <View style={[s.statIcon, { backgroundColor: '#F0FDF4' }]}>
                <Trophy size={14} color="#22C55E" />
              </View>
              <Text style={s.statVal}>{bmi.toFixed(1)}</Text>
              <Text style={s.statUnit}> </Text>
              <Text style={s.statLabel}>BMI</Text>
            </View>
          </View>
        </View>

        {/* ── CALORIE TARGET GRADIENT CARD ──────────────────────────────── */}
        <TouchableOpacity style={s.calCard} onPress={() => openModal('healthOverview')} activeOpacity={0.9}>
          {/* Decorative circle blobs */}
          <View style={s.calBlob1} />
          <View style={s.calBlob2} />

          <View style={s.calHeader}>
            <View>
              <Text style={s.calLabel}>Daily Calorie Target</Text>
              <View style={s.calValRow}>
                <Text style={s.calVal}>{(targets?.calories || 2000).toLocaleString()}</Text>
                <Text style={s.calUnit}> kcal / day</Text>
              </View>
            </View>
            <View style={s.calEditBtn}>
              <Edit3 size={13} color="#FF6B00" />
              <Text style={s.calEditText}>Edit</Text>
            </View>
          </View>

          {/* Macro chips */}
          <View style={s.calChipRow}>
            {[
              { label: 'Protein', val: `${targets?.proteinG || 150}g` },
              { label: 'Carbs', val: `${targets?.carbsG || 225}g` },
              { label: 'Fat', val: `${targets?.fatG || 65}g` },
              { label: 'Water', val: `${((targets?.waterMl ?? 2000) / 1000).toFixed(1)}L` },
            ].map((m) => (
              <View key={m.label} style={s.calChip}>
                <Text style={s.calChipLabel}>{m.label}</Text>
                <Text style={s.calChipVal}>{m.val}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* ── ACCOUNT & PROFILE ─────────────────────────────────────────── */}
        <Text style={s.groupLabel}>ACCOUNT & PROFILE</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<LucideUser size={18} color="#FF6B00" />}
            iconBg="#FFF5EF"
            title="User Information"
            subtitle="Name & account details"
            valueLabel={firstName}
            valueBg="#FFF5EF"
            valueColor="#FF6B00"
            onPress={() => openModal('userInfo')}
          />
          <SettingsRow
            icon={<Activity size={18} color="#22C55E" />}
            iconBg="#F0FDF4"
            title="Health & Target Goals"
            subtitle="Calories, macros & hydration"
            valueLabel={`${targets?.calories || 2000} kcal`}
            valueBg="#F0FDF4"
            valueColor="#16A34A"
            onPress={() => openModal('healthOverview')}
          />
          <SettingsRow
            icon={<Users size={18} color="#3B82F6" />}
            iconBg="#EFF6FF"
            title="Body Metrics"
            subtitle="Weight, height, activity & goal"
            valueLabel={formattedActivity}
            valueBg="#EFF6FF"
            valueColor="#2563EB"
            onPress={() => openModal('personalSettings')}
            isLast
          />
        </View>

        {/* ── PREFERENCES ───────────────────────────────────────────────── */}
        <Text style={s.groupLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Bell size={18} color="#F59E0B" />}
            iconBg="#FEF3C7"
            title="Notifications & Reminders"
            subtitle="Meal times, water & check-ins"
            onPress={() => openModal('notifications')}
          />
          <SettingsRow
            icon={<Sliders size={18} color="#8B5CF6" />}
            iconBg="#F3E8FF"
            title="App Preferences"
            subtitle={`Units · ${isImperial ? 'lbs / in' : 'kg / cm'}`}
            valueLabel={isImperial ? 'Imperial' : 'Metric'}
            valueBg="#F3E8FF"
            valueColor="#7C3AED"
            onPress={() => openModal('preferences')}
          />
          <SettingsRow
            icon={<Headphones size={18} color="#64748B" />}
            iconBg="#F1F5F9"
            title="Help & Support"
            subtitle="Contact us · FAQs · Feedback"
            onPress={() => openModal('support')}
            isLast
          />
        </View>

        {/* ── LOGOUT ────────────────────────────────────────────────────── */}
        <View style={[s.card, { marginBottom: 0 }]}>
          <SettingsRow
            icon={<LogOut size={18} color="#EF4444" />}
            iconBg="#FEF2F2"
            title="Log Out"
            subtitle="Sign out of your Calitracs account"
            onPress={handleConfirmLogout}
            isLast
            isDanger
          />
        </View>

        {/* ── App version ─────────────────────────────────────────────── */}
        <Text style={s.versionText}>Calitracs v2.5.0 · Made with ❤️</Text>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── AVATAR POPOVER ─────────────────────────────────────────────── */}
      <Modal visible={showPopover} transparent animationType="fade" onRequestClose={() => setShowPopover(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowPopover(false)}>
          <View style={s.popCard} onStartShouldSetResponder={() => true}>
            <View style={s.popHeader}>
              <Text style={s.popTitle}>Profile Actions</Text>
              <TouchableOpacity onPress={() => setShowPopover(false)} style={s.popClose}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.popRow} onPress={() => { setShowPopover(false); openModal('userInfo'); }} activeOpacity={0.7}>
              <View style={[s.rowIconWrap, { backgroundColor: '#FFF5EF' }]}><Edit3 size={17} color="#FF6B00" /></View>
              <Text style={s.popRowText}>Edit User Information</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.popRow} onPress={handlePickAvatar} activeOpacity={0.7}>
              <View style={[s.rowIconWrap, { backgroundColor: '#EFF6FF' }]}><Camera size={17} color="#3B82F6" /></View>
              <Text style={s.popRowText}>Change Profile Photo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── NOTIFICATIONS FULL PAGE MODAL ─────────────────────────────── */}
      <Modal visible={activeModal === 'notifications'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveModal(null)}>
        <NotificationSettingsScreen onBack={() => setActiveModal(null)} />
      </Modal>

      {/* ── APP PREFERENCES FULL PAGE MODAL ───────────────────────────── */}
      <Modal visible={activeModal === 'preferences'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveModal(null)}>
        <AppPreferencesScreen onBack={() => setActiveModal(null)} />
      </Modal>

      {/* ── REDESIGNED MODERN LIGHT POPOVERS ───────────────────────────── */}

      {/* Modern Popover 1: User Info */}
      <ModernPopover
        visible={activeModal === 'userInfo'}
        onClose={() => setActiveModal(null)}
        title="User Information"
        subtitle="Update your display name"
        icon={<LucideUser size={20} color="#FF6B00" />}
        iconBg="#FFF5EF"
        primaryActionLabel="Save Name"
        onPrimaryAction={handleSaveUserInfo}
        loadingAction={saving}
      >
        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Display Name</Text>
          <TextInput
            style={[s.dialogInput, nameError ? { borderColor: '#EF4444' } : {}]}
            value={nameInput}
            onChangeText={(t) => { setNameInput(t); setNameError(''); }}
            maxLength={40}
            returnKeyType="done"
            placeholder="Enter your name"
            placeholderTextColor="#94A3B8"
          />
          {nameError ? <Text style={s.fieldError}>{nameError}</Text> : null}
          <Text style={s.fieldHint}>{nameInput.trim().length}/40 characters</Text>
        </View>

        <View style={s.readonlyField}>
          <Text style={s.dialogLabel}>Email Address</Text>
          <Text style={s.readonlyValue}>{user?.email || 'No email set'}</Text>
          <View style={s.infoRow}>
            <Info size={13} color="#94A3B8" />
            <Text style={s.infoNote}>Email address is tied to your account and cannot be modified.</Text>
          </View>
        </View>
      </ModernPopover>

      {/* Modern Popover 2: Health & Target Goals */}
      <ModernPopover
        visible={activeModal === 'healthOverview'}
        onClose={() => setActiveModal(null)}
        title="Health & Target Goals"
        subtitle="Set daily calories, macros & water target"
        icon={<Activity size={20} color="#22C55E" />}
        iconBg="#F0FDF4"
        primaryActionLabel="Save Targets"
        onPrimaryAction={handleSaveTargets}
        loadingAction={saving}
      >
        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Daily Calories (kcal) · 500–5000</Text>
          <TextInput style={s.dialogInput} value={calInput} onChangeText={setCalInput} keyboardType="numeric" placeholder="2000" />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[s.dialogField, { flex: 1 }]}>
            <Text style={s.dialogLabel}>Protein (g)</Text>
            <TextInput style={s.dialogInput} value={pInput} onChangeText={setPInput} keyboardType="numeric" placeholder="150" />
          </View>
          <View style={[s.dialogField, { flex: 1 }]}>
            <Text style={s.dialogLabel}>Carbs (g)</Text>
            <TextInput style={s.dialogInput} value={cInput} onChangeText={setCInput} keyboardType="numeric" placeholder="225" />
          </View>
          <View style={[s.dialogField, { flex: 1 }]}>
            <Text style={s.dialogLabel}>Fat (g)</Text>
            <TextInput style={s.dialogInput} value={fInput} onChangeText={setFInput} keyboardType="numeric" placeholder="65" />
          </View>
        </View>

        <View style={s.dialogField}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Droplet size={13} color="#0284C7" />
            <Text style={s.dialogLabel}>Daily Water Target (ml) · 500–6000</Text>
          </View>
          <TextInput style={s.dialogInput} value={waterInput} onChangeText={setWaterInput} keyboardType="numeric" placeholder="2000" />
        </View>

        <View style={s.macroPreviewRow}>
          <Text style={s.macroPreviewLabel}>Macro calories sum:</Text>
          <Text style={[s.macroPreviewVal, {
            color: Math.abs(macroKcalPreview - (parseInt(calInput) || 0)) > (parseInt(calInput) || 0) * 0.15 ? '#F59E0B' : '#22C55E',
          }]}>{macroKcalPreview} kcal</Text>
        </View>
        {macroWarning ? <View style={s.warnBox}><Text style={s.warnText}>{macroWarning}</Text></View> : null}
      </ModernPopover>

      {/* Modern Popover 3: Personal Settings / Body Metrics */}
      <ModernPopover
        visible={activeModal === 'personalSettings'}
        onClose={() => setActiveModal(null)}
        title="Body Metrics"
        subtitle="Weight, height, activity level & primary goal"
        icon={<Users size={20} color="#3B82F6" />}
        iconBg="#EFF6FF"
        primaryActionLabel="Save Metrics"
        onPrimaryAction={handleSavePersonal}
        loadingAction={saving}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[s.dialogField, { flex: 1 }]}>
            <Text style={s.dialogLabel}>Weight (kg)</Text>
            <TextInput style={s.dialogInput} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" />
          </View>
          <View style={[s.dialogField, { flex: 1 }]}>
            <Text style={s.dialogLabel}>Height (cm)</Text>
            <TextInput style={s.dialogInput} value={heightInput} onChangeText={setHeightInput} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Age (years)</Text>
          <TextInput style={s.dialogInput} value={ageInput} onChangeText={setAgeInput} keyboardType="number-pad" placeholder="e.g. 28" />
        </View>

        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Gender</Text>
          <View style={s.chipRow}>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity key={g.value} style={[s.chip, genderInput === g.value && s.chipActive]} onPress={() => setGenderInput(g.value)} activeOpacity={0.75}>
                <Text style={[s.chipText, genderInput === g.value && s.chipTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Activity Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chipRow}>
              {ACTIVITY_OPTIONS.map((a) => (
                <TouchableOpacity key={a.value} style={[s.chip, activityInput === a.value && s.chipActive]} onPress={() => setActivityInput(a.value)} activeOpacity={0.75}>
                  <Text style={s.chipEmoji}>{a.icon}</Text>
                  <Text style={[s.chipText, activityInput === a.value && s.chipTextActive]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={s.dialogField}>
          <Text style={s.dialogLabel}>Primary Goal</Text>
          <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
            {GOAL_OPTIONS.map((g) => (
              <TouchableOpacity key={g.value} style={[s.chip, goalInput === g.value && s.chipGoalActive]} onPress={() => setGoalInput(g.value)} activeOpacity={0.75}>
                <Text style={s.chipEmoji}>{g.icon}</Text>
                <Text style={[s.chipText, goalInput === g.value && s.chipTextGoalActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {bmrResult ? (
          <View style={s.bmrBanner}>
            <Zap size={14} color="#22C55E" />
            <Text style={s.bmrText}>{bmrResult}</Text>
          </View>
        ) : null}
      </ModernPopover>

      {/* Modern Popover 4: Help & Support */}
      <ModernPopover
        visible={activeModal === 'support'}
        onClose={() => setActiveModal(null)}
        title="Help & Support"
        subtitle="Contact us & app information"
        icon={<Headphones size={20} color="#64748B" />}
        iconBg="#F1F5F9"
      >
        <View style={{ gap: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 14, color: '#334155', fontFamily: FONTS.body.regular }}>
            Have a question, feedback, or found an issue? Reach out to our dedicated support team:
          </Text>
          <View style={{ backgroundColor: '#FFF5EF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FFD8BF', gap: 4 }}>
            <Text style={{ fontSize: 11, color: '#64748B', fontFamily: FONTS.body.medium }}>Official Email Support</Text>
            <Text style={{ fontSize: 15, color: '#FF6B00', fontFamily: FONTS.heading.bold }}>support@calitracs.app</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, fontFamily: FONTS.body.regular }}>
            Calitracs Mobile v2.5.0 · Build 250{'\n'}© 2026 Calitracs Inc. All rights reserved.
          </Text>
        </View>
      </ModernPopover>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FOR MODERN POPOVER MODAL
// ─────────────────────────────────────────────────────────────────────────────
const pop = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  card: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 17,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
  },
  subText: {
    fontSize: 12,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scrollContent: {
    flexGrow: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#64748B',
  },
  primaryBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#FFFFFF',
  },
  singleCloseBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  singleCloseBtnText: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FOR PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  // ── Hero Card ────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    alignItems: 'center',
    paddingBottom: 20,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  heroBanner: {
    width: '100%',
    height: 72,
    backgroundColor: '#FFF5EF',
  },
  heroMenuBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  avatarWrap: {
    marginTop: -44,
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: 36,
    fontFamily: FONTS.heading.bold,
    color: '#FF6B00',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroName: {
    fontSize: 22,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
    marginTop: 10,
  },
  heroEmail: {
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
    marginTop: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  proBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.heading.bold,
    color: '#FF6B00',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  streakBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.heading.bold,
    color: '#FF6B00',
  },

  // ── Stat Row ────────────────────────────────────────────────────────────
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    marginHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statPill: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E2E8F0' },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 18, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  statUnit: { fontSize: 10, color: '#94A3B8', fontFamily: FONTS.body.regular, marginTop: -4 },
  statLabel: { fontSize: 11, color: '#64748B', fontFamily: FONTS.body.medium },

  // ── Calorie Card ────────────────────────────────────────────────────────
  calCard: {
    backgroundColor: '#FF6B00',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  calBlob1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -30,
  },
  calBlob2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: 10,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  calLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: FONTS.body.medium, marginBottom: 2 },
  calValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  calVal: { fontSize: 34, fontFamily: FONTS.heading.bold, color: '#FFFFFF' },
  calUnit: { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontFamily: FONTS.body.medium },
  calEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  calEditText: { fontSize: 12, fontFamily: FONTS.heading.bold, color: '#FF6B00' },
  calChipRow: { flexDirection: 'row', gap: 8 },
  calChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  calChipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: FONTS.body.medium },
  calChipVal: { fontSize: 14, fontFamily: FONTS.heading.bold, color: '#FFFFFF', marginTop: 2 },

  // ── Settings Sections ──────────────────────────────────────────────────
  groupLabel: {
    fontSize: 11,
    fontFamily: FONTS.heading.bold,
    color: '#94A3B8',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    marginBottom: -4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  // ── Settings Row ──────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6FA',
    minHeight: 68,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
  },
  rowSub: { fontSize: 12, fontFamily: FONTS.body.regular, color: '#94A3B8' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  valuePillText: { fontSize: 12, fontFamily: FONTS.heading.bold },

  // ── Version ────────────────────────────────────────────────────────────
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#CBD5E1',
    fontFamily: FONTS.body.regular,
    marginTop: 4,
  },

  // ── Avatar Popover Modal ───────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  popCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  popHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 4 },
  popTitle: { fontSize: 16, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  popClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  popRowText: { fontSize: 15, fontFamily: FONTS.heading.bold, color: '#0F172A' },

  // ── Fields & Chips inside popover ─────────────────────────────────────
  dialogField: { gap: 5 },
  dialogLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.medium },
  dialogInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: FONTS.body.regular,
    color: '#0F172A',
  },
  fieldError: { fontSize: 12, color: '#EF4444', fontFamily: FONTS.body.regular },
  fieldHint: { fontSize: 11, color: '#94A3B8', fontFamily: FONTS.body.regular, alignSelf: 'flex-end' },
  readonlyField: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  readonlyValue: { fontSize: 14, color: '#64748B', fontFamily: FONTS.body.regular },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoNote: { fontSize: 11, color: '#94A3B8', fontFamily: FONTS.body.regular, flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#FFF5EF', borderColor: '#FF6B00' },
  chipGoalActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontFamily: FONTS.heading.bold, color: '#64748B' },
  chipTextActive: { color: '#FF6B00' },
  chipTextGoalActive: { color: '#3B82F6' },
  bmrBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  bmrText: { fontSize: 12, color: '#166534', fontFamily: FONTS.body.medium, flex: 1 },
  macroPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  macroPreviewLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.medium },
  macroPreviewVal: { fontSize: 13, fontFamily: FONTS.heading.bold },
  warnBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  warnText: { fontSize: 12, color: '#92400E', fontFamily: FONTS.body.regular },
});

export default ProfileScreen;
