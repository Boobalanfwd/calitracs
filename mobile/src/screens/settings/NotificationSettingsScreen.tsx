import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, Bell, Droplet, UtensilsCrossed, CheckCircle } from 'lucide-react-native';
import {
  LocalReminderPrefs,
  DEFAULT_PREFS,
  loadReminderPrefs,
  applyLocalNotificationSchedule,
} from '../../services/localNotificationScheduler';

interface Props {
  onBack?: () => void;
}

const NotificationSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [prefs, setPrefs] = useState<LocalReminderPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [permStatus, setPermStatus] = useState<string>('unknown');

  useEffect(() => {
    const init = async () => {
      // Check current permission status
      const { status } = await Notifications.getPermissionsAsync();
      setPermStatus(status);

      // Load saved prefs
      const saved = await loadReminderPrefs();
      setPrefs(saved);
      setLoaded(true);
    };
    init();
  }, []);

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermStatus(status);
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive meal and water reminders.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSave = async () => {
    if (permStatus !== 'granted') {
      await requestPermission();
      return;
    }
    setSaving(true);
    try {
      await applyLocalNotificationSchedule(prefs);
      Alert.alert('✅ Reminders Saved', 'Your notification schedule has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update schedule.');
    } finally {
      setSaving(false);
    }
  };

  const updatePref = <K extends keyof LocalReminderPrefs>(key: K, value: LocalReminderPrefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleWaterHour = (hour: number) => {
    setPrefs((prev) => {
      const hours = prev.waterHours.includes(hour)
        ? prev.waterHours.filter((h) => h !== hour)
        : [...prev.waterHours, hour].sort((a, b) => a - b);
      return { ...prev, waterHours: hours };
    });
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour < 12 ? 'AM' : 'PM';
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <Text style={styles.headerSub}>Manage local reminders & push alerts</Text>
        </View>
      </View>

      {/* Permission Banner */}
      {permStatus !== 'granted' && (
        <TouchableOpacity style={styles.permBanner} onPress={requestPermission} activeOpacity={0.85}>
          <Bell size={18} color="#FFFFFF" />
          <Text style={styles.permBannerText}>Tap to enable notification permissions</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Meal Reminders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <UtensilsCrossed size={18} color="#FF6B00" />
            <Text style={styles.sectionTitle}>Meal Reminders</Text>
          </View>
          <Text style={styles.sectionSub}>Daily repeating notifications at your set times</Text>

          {/* Breakfast */}
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>🍳 Breakfast</Text>
              <Text style={styles.rowTime}>{formatTime(prefs.breakfastHour, prefs.breakfastMinute)}</Text>
            </View>
            <Switch
              value={prefs.breakfastEnabled}
              onValueChange={(v) => updatePref('breakfastEnabled', v)}
              trackColor={{ true: '#FF6B00', false: '#E2E8F0' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Lunch */}
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>🥗 Lunch</Text>
              <Text style={styles.rowTime}>{formatTime(prefs.lunchHour, prefs.lunchMinute)}</Text>
            </View>
            <Switch
              value={prefs.lunchEnabled}
              onValueChange={(v) => updatePref('lunchEnabled', v)}
              trackColor={{ true: '#FF6B00', false: '#E2E8F0' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Dinner */}
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>🍽️ Dinner</Text>
              <Text style={styles.rowTime}>{formatTime(prefs.dinnerHour, prefs.dinnerMinute)}</Text>
            </View>
            <Switch
              value={prefs.dinnerEnabled}
              onValueChange={(v) => updatePref('dinnerEnabled', v)}
              trackColor={{ true: '#FF6B00', false: '#E2E8F0' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Water Reminders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Droplet size={18} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Water Reminders</Text>
          </View>
          <Text style={styles.sectionSub}>Select which hours to receive hydration nudges</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Enable water reminders</Text>
            <Switch
              value={prefs.waterEnabled}
              onValueChange={(v) => updatePref('waterEnabled', v)}
              trackColor={{ true: '#3B82F6', false: '#E2E8F0' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {prefs.waterEnabled && (
            <View style={styles.hourGrid}>
              {[7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((hour) => {
                const selected = prefs.waterHours.includes(hour);
                return (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.hourChip, selected && styles.hourChipActive]}
                    onPress={() => toggleWaterHour(hour)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.hourChipText, selected && styles.hourChipTextActive]}>
                      {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Daily Check-In */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CheckCircle size={18} color="#22C55E" />
            <Text style={styles.sectionTitle}>Daily Check-In</Text>
          </View>
          <Text style={styles.sectionSub}>End-of-day summary reminder</Text>

          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>📊 Evening check-in</Text>
              <Text style={styles.rowTime}>{formatTime(prefs.checkInHour, prefs.checkInMinute)}</Text>
            </View>
            <Switch
              value={prefs.checkInEnabled}
              onValueChange={(v) => updatePref('checkInEnabled', v)}
              trackColor={{ true: '#22C55E', false: '#E2E8F0' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Push Notification Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={18} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Server Push Alerts</Text>
          </View>
          <Text style={styles.sectionSub}>
            AI-driven alerts like calorie goal hits, streak breaks, weekly summaries, and re-engagement
            nudges are sent automatically from our server when triggered.
          </Text>
          <View style={[styles.infoPill, { backgroundColor: permStatus === 'granted' ? '#F0FDF4' : '#FEF2F2' }]}>
            <Text style={[styles.infoPillText, { color: permStatus === 'granted' ? '#16A34A' : '#DC2626' }]}>
              {permStatus === 'granted' ? '✅ Push notifications enabled' : '❌ Notifications disabled — tap banner above'}
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save Notification Schedule</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },

  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permBannerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  rowTime: { fontSize: 12, color: '#FF6B00', fontWeight: '600', marginTop: 2 },

  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  hourChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hourChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  hourChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  hourChipTextActive: { color: '#3B82F6' },

  infoPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  infoPillText: { fontSize: 13, fontWeight: '700' },

  saveBtn: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

export default NotificationSettingsScreen;
