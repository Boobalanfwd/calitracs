import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Portal, Dialog, Button } from 'react-native-paper';
import {
  MoreHorizontal,
  User as LucideUser,
  Camera,
  Scale,
  Ruler,
  Trophy,
  Activity,
  Users,
  Bell,
  Sliders,
  Headphones,
  LogOut,
  ChevronRight,
  Sparkles,
  Flame,
  Shield,
  X,
  Edit3,
  Target,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import { FONTS } from '../../theme/fonts';
import { API } from '../../services/api';
import { getResizedCloudinaryUrl } from '../../utils/imageUtils';

const ProfileScreen: React.FC = () => {
  const { user, targets, token, logout, updateProfile, updateTargets } = useAuth();

  // Active Modals & Popovers
  const [showPopover, setShowPopover] = useState(false);
  const [activeModal, setActiveModal] = useState<
    'userInfo' | 'healthOverview' | 'personalSettings' | 'preferences' | 'support' | null
  >(null);

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  // User Info state
  const [nameInput, setNameInput] = useState(user?.name || 'Spark Pixel');
  const [emailInput, setEmailInput] = useState(user?.email || 'spark@appmail.com');

  // Health Overview state
  const [calInput, setCalInput] = useState(targets?.calories.toString() || '2000');
  const [pInput, setPInput] = useState(targets?.proteinG.toString() || '150');
  const [cInput, setCInput] = useState(targets?.carbsG.toString() || '225');
  const [fInput, setFInput] = useState(targets?.fatG.toString() || '65');

  // Personal Settings state
  const [weightInput, setWeightInput] = useState((user?.profile?.weightKg || 70).toString());
  const [heightInput, setHeightInput] = useState((user?.profile?.heightCm || 170).toString());
  const [activityInput, setActivityInput] = useState<string>(user?.profile?.activityLevel || 'moderate');

  const [saving, setSaving] = useState(false);

  const currentWeight = user?.profile?.weightKg ?? 70;
  const heightCm = user?.profile?.heightCm ?? 170;
  const activityLevel = user?.profile?.activityLevel ?? 'Moderate';
  const formattedActivity =
    activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1);

  // Avatar Picker
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

  // Save User Info
  const handleSaveUserInfo = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: nameInput.trim() } as any);
      setActiveModal(null);
      Alert.alert('Success', 'User profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Save Health Targets
  const handleSaveTargets = async () => {
    const calories = parseInt(calInput);
    const proteinG = parseInt(pInput);
    const carbsG = parseInt(cInput);
    const fatG = parseInt(fInput);

    if (isNaN(calories) || calories < 500) {
      Alert.alert('Error', 'Calories must be at least 500 kcal.');
      return;
    }

    setSaving(true);
    try {
      await updateTargets({ calories, proteinG: proteinG || 0, carbsG: carbsG || 0, fatG: fatG || 0 });
      setActiveModal(null);
      Alert.alert('Success', 'Daily nutrition targets updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update targets.');
    } finally {
      setSaving(false);
    }
  };

  // Save Personal Settings
  const handleSavePersonal = async () => {
    const parsedW = parseFloat(weightInput);
    const parsedH = parseFloat(heightInput);

    if (isNaN(parsedW) || parsedW < 20) {
      Alert.alert('Error', 'Please enter a valid weight.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        weightKg: parsedW,
        heightCm: !isNaN(parsedH) ? parsedH : heightCm,
        activityLevel: activityInput as any,
      });
      setActiveModal(null);
      Alert.alert('Success', 'Personal health settings saved!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Units
  const handleToggleUnit = async () => {
    const currentUnit = user?.profile?.unitSystem || 'metric';
    const nextUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    try {
      await updateProfile({ unitSystem: nextUnit } as Partial<UserProfile>);
      Alert.alert('Unit System Updated', `Switched to ${nextUnit === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/in)'}.`);
    } catch {
      Alert.alert('Error', 'Failed to update unit system.');
    }
  };

  const handleConfirmLogout = () => {
    setShowPopover(false);
    Alert.alert('Log Out', 'Are you sure you want to log out of Calitracs?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Top Profile Card */}
        <View style={styles.topCard}>
          {/* Top Header Background Banner Accent */}
          <View style={styles.cardHeaderBanner} />

          {/* Options Popover Button */}
          <TouchableOpacity
            style={styles.optionsBtn}
            onPress={() => setShowPopover(true)}
            activeOpacity={0.8}
          >
            <MoreHorizontal size={18} color="#0F172A" />
          </TouchableOpacity>

          {/* Avatar Container */}
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} activeOpacity={0.85}>
            {avatarUploading ? (
              <View style={styles.avatarCircle}>
                <ActivityIndicator size="small" color="#FF6B00" />
              </View>
            ) : (localAvatarUri || user?.profile?.avatarUrl) ? (
              <Image
                source={{ uri: localAvatarUri || getResizedCloudinaryUrl(user?.profile?.avatarUrl, 160) || undefined }}
                style={[styles.avatarCircle, { overflow: 'hidden' }]}
              />
            ) : (
              <View style={styles.avatarCircle}>
                <LucideUser size={40} color="#FF6B00" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* User Name & Email */}
          <View style={styles.userTitleBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>{user?.name || 'Spark Pixel'}</Text>
              <View style={styles.proBadge}>
                <Sparkles size={11} color="#FF6B00" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.userEmail}>{user?.email || 'spark@appmail.com'}</Text>
          </View>

          {/* 3 Metrics Cards Row */}
          <View style={styles.metricsRow}>
            {/* Metric 1: Weight */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBg, { backgroundColor: '#FFF5EF' }]}>
                <Scale size={16} color="#FF6B00" />
              </View>
              <Text style={styles.metricLabel}>Weight</Text>
              <View style={styles.metricValRow}>
                <Text style={styles.metricVal}>{currentWeight}</Text>
                <Text style={styles.metricUnit}>kg</Text>
              </View>
            </View>

            {/* Metric 2: Height */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBg, { backgroundColor: '#EFF6FF' }]}>
                <Ruler size={16} color="#3B82F6" />
              </View>
              <Text style={styles.metricLabel}>Height</Text>
              <View style={styles.metricValRow}>
                <Text style={styles.metricVal}>{heightCm}</Text>
                <Text style={styles.metricUnit}>cm</Text>
              </View>
            </View>

            {/* Metric 3: Activity Level */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Trophy size={16} color="#8B5CF6" />
              </View>
              <Text style={styles.metricLabel}>Activity</Text>
              <Text style={styles.metricValText} numberOfLines={1}>
                {formattedActivity}
              </Text>
            </View>
          </View>
        </View>

        {/* Nutrition Goal Preview Card */}
        <TouchableOpacity
          style={styles.targetPreviewCard}
          onPress={() => setActiveModal('healthOverview')}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.targetIconBg}>
                <Flame size={20} color="#FF6B00" />
              </View>
              <View>
                <Text style={styles.targetCardTitle}>Daily Calorie Target</Text>
                <Text style={styles.targetCardSub}>{targets?.calories || 2000} kcal / day</Text>
              </View>
            </View>

            <View style={styles.editPillBtn}>
              <Text style={styles.editPillText}>Edit Target</Text>
              <ChevronRight size={14} color="#FF6B00" />
            </View>
          </View>

          {/* Macro breakdown pills */}
          <View style={styles.macroPillRow}>
            <View style={styles.macroPill}>
              <Text style={styles.macroPillLabel}>Protein</Text>
              <Text style={styles.macroPillVal}>{targets?.proteinG || 150}g</Text>
            </View>

            <View style={styles.macroPill}>
              <Text style={styles.macroPillLabel}>Carbs</Text>
              <Text style={styles.macroPillVal}>{targets?.carbsG || 225}g</Text>
            </View>

            <View style={styles.macroPill}>
              <Text style={styles.macroPillLabel}>Fat</Text>
              <Text style={styles.macroPillVal}>{targets?.fatG || 65}g</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Settings Categories List */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsGroupHeader}>ACCOUNT & PROFILE</Text>

          <View style={styles.menuList}>
            {/* 1. Edit User Info */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => setActiveModal('userInfo')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#FFF5EF' }]}>
                <LucideUser size={18} color="#FF6B00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>User Information</Text>
                <Text style={styles.menuSub}>Update your name & email address</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* 2. Health & Target Overview */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => setActiveModal('healthOverview')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Activity size={18} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Health & Target Goals</Text>
                <Text style={styles.menuSub}>Set daily calories, protein, carbs & fat</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* 3. Personal Body Metrics */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => setActiveModal('personalSettings')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Users size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Personal Body Metrics</Text>
                <Text style={styles.menuSub}>Update weight, height & activity level</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.settingsGroupHeader, { marginTop: 14 }]}>PREFERENCES & SUPPORT</Text>

          <View style={styles.menuList}>
            {/* 4. Notifications */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => Alert.alert('Notifications', 'AI Nutrition and Water reminders are enabled.')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Bell size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Notifications & Tracking</Text>
                <Text style={styles.menuSub}>Configure hydration & meal push alerts</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* 5. App Preferences */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => setActiveModal('preferences')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Sliders size={18} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>App Preferences</Text>
                <Text style={styles.menuSub}>Units ({user?.profile?.unitSystem === 'imperial' ? 'lbs / in' : 'kg / cm'})</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* 6. Support & Feedback */}
            <TouchableOpacity style={styles.menuItemRow} onPress={() => setActiveModal('support')} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Headphones size={18} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Support & Feedback</Text>
                <Text style={styles.menuSub}>Contact support@calitracs.app</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* 7. Log Out */}
            <TouchableOpacity style={[styles.menuItemRow, { borderBottomWidth: 0 }]} onPress={handleConfirmLogout} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <LogOut size={18} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuTitle, { color: '#EF4444' }]}>Log Out</Text>
                <Text style={styles.menuSub}>Sign out of your Calitracs account</Text>
              </View>
              <ChevronRight size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Popover Action Sheet Modal */}
      <Modal
        visible={showPopover}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPopover(false)}
      >
        <TouchableOpacity
          style={styles.popoverOverlay}
          activeOpacity={1}
          onPress={() => setShowPopover(false)}
        >
          <View style={styles.popoverCard} onStartShouldSetResponder={() => true}>
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>Profile Actions</Text>
              <TouchableOpacity onPress={() => setShowPopover(false)} style={styles.popoverCloseBtn}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.popoverOption}
              onPress={() => { setShowPopover(false); setActiveModal('userInfo'); }}
            >
              <Edit3 size={16} color="#FF6B00" />
              <Text style={styles.popoverOptionText}>Edit User Information</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.popoverOption}
              onPress={handlePickAvatar}
            >
              <Camera size={16} color="#3B82F6" />
              <Text style={styles.popoverOptionText}>Change Profile Photo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modals Portal */}
      <Portal>
        {/* Modal 1: User Info */}
        <Dialog visible={activeModal === 'userInfo'} onDismiss={() => setActiveModal(null)}>
          <Dialog.Title style={{ fontFamily: FONTS.heading.bold }}>Edit User Information</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Full Name</Text>
              <TextInput style={styles.dialogInput} value={nameInput} onChangeText={setNameInput} />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Email Address</Text>
              <TextInput style={styles.dialogInput} value={emailInput} onChangeText={setEmailInput} keyboardType="email-address" />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveModal(null)}>Cancel</Button>
            <Button mode="contained" buttonColor="#FF6B00" onPress={handleSaveUserInfo} loading={saving}>Save Changes</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal 2: Health Overview */}
        <Dialog visible={activeModal === 'healthOverview'} onDismiss={() => setActiveModal(null)}>
          <Dialog.Title style={{ fontFamily: FONTS.heading.bold }}>Health & Target Goals</Dialog.Title>
          <Dialog.Content style={{ gap: 10 }}>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Daily Calories (kcal)</Text>
              <TextInput style={styles.dialogInput} value={calInput} onChangeText={setCalInput} keyboardType="numeric" />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Protein Target (g)</Text>
              <TextInput style={styles.dialogInput} value={pInput} onChangeText={setPInput} keyboardType="numeric" />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Carbs Target (g)</Text>
              <TextInput style={styles.dialogInput} value={cInput} onChangeText={setCInput} keyboardType="numeric" />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Fat Target (g)</Text>
              <TextInput style={styles.dialogInput} value={fInput} onChangeText={setFInput} keyboardType="numeric" />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveModal(null)}>Cancel</Button>
            <Button mode="contained" buttonColor="#FF6B00" onPress={handleSaveTargets} loading={saving}>Save Targets</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal 3: Personal Settings */}
        <Dialog visible={activeModal === 'personalSettings'} onDismiss={() => setActiveModal(null)}>
          <Dialog.Title style={{ fontFamily: FONTS.heading.bold }}>Personal Body Metrics</Dialog.Title>
          <Dialog.Content style={{ gap: 10 }}>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Weight (kg)</Text>
              <TextInput style={styles.dialogInput} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Height (cm)</Text>
              <TextInput style={styles.dialogInput} value={heightInput} onChangeText={setHeightInput} keyboardType="decimal-pad" />
            </View>
            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Activity Level</Text>
              <TextInput style={styles.dialogInput} value={activityInput} onChangeText={setActivityInput} placeholder="sedentary / moderate / active" />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveModal(null)}>Cancel</Button>
            <Button mode="contained" buttonColor="#FF6B00" onPress={handleSavePersonal} loading={saving}>Save Metrics</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal 4: App Preferences */}
        <Dialog visible={activeModal === 'preferences'} onDismiss={() => setActiveModal(null)}>
          <Dialog.Title style={{ fontFamily: FONTS.heading.bold }}>App Preferences</Dialog.Title>
          <Dialog.Content style={{ gap: 14 }}>
            <TouchableOpacity style={styles.prefOptionRow} onPress={handleToggleUnit}>
              <Text style={styles.prefOptionLabel}>Measurement Unit</Text>
              <Text style={styles.prefOptionVal}>{user?.profile?.unitSystem === 'imperial' ? 'Imperial (lbs/in)' : 'Metric (kg/cm)'} ➔</Text>
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveModal(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal 5: Support */}
        <Dialog visible={activeModal === 'support'} onDismiss={() => setActiveModal(null)}>
          <Dialog.Title style={{ fontFamily: FONTS.heading.bold }}>Support & Feedback</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, color: '#334155', fontFamily: FONTS.body.regular }}>Need help or have suggestions?</Text>
            <Text style={{ fontSize: 13, color: '#FF6B00', fontWeight: '700', fontFamily: FONTS.heading.bold }}>Email: support@calitracs.app</Text>
            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, fontFamily: FONTS.body.regular }}>App Version: Calitracs v2.4.0 (2026)</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveModal(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 16 },

  // Top Card
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#FFF5EF',
  },
  optionsBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  avatarContainer: {
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userTitleBlock: {
    alignItems: 'center',
    gap: 2,
  },
  userName: {
    fontSize: 22,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6B00',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: FONTS.body.regular,
  },

  // 3-Column Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  metricVal: {
    fontSize: 16,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  metricValText: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: FONTS.heading.bold,
  },
  metricUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  // Target Preview Card
  targetPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD8BF',
    gap: 14,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  targetIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  targetCardSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B00',
  },
  macroPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  macroPillLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  macroPillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },

  // Settings Categories Card
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsGroupHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  menuList: {
    gap: 4,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },

  // Popover Action Sheet Modal Styles
  popoverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  popoverCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  popoverTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  popoverCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  popoverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  popoverOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  popoverDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },

  // Dialog Styles
  dialogField: { gap: 4 },
  dialogLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.medium },
  dialogInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: FONTS.body.regular,
  },
  prefOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  prefOptionLabel: { fontSize: 14, color: '#334155', fontFamily: FONTS.body.medium },
  prefOptionVal: { fontSize: 14, color: '#FF6B00', fontFamily: FONTS.heading.bold },
});

export default ProfileScreen;
