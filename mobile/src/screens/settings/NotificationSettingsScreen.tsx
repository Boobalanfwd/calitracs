import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import {
  ArrowLeft, Bell, Droplet, UtensilsCrossed, CheckCircle,
  Clock, Timer, ChevronUp, ChevronDown,
} from 'lucide-react-native';
import {
  LocalReminderPrefs,
  DEFAULT_PREFS,
  loadReminderPrefs,
  applyLocalNotificationSchedule,
} from '../../services/localNotificationScheduler';
import { FONTS } from '../../theme/fonts';

interface Props {
  onBack?: () => void;
}

// ── Inline Time Picker Modal ─────────────────────────────────────────────────
interface TimePickerModalProps {
  visible: boolean;
  label: string;
  hour: number;
  minute: number;
  onConfirm: (hour: number, minute: number) => void;
  onClose: () => void;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible, label, hour: initHour, minute: initMinute, onConfirm, onClose,
}) => {
  const [h, setH] = useState(initHour);
  const [m, setM] = useState(initMinute);

  useEffect(() => {
    if (visible) {
      setH(initHour);
      setM(initMinute);
    }
  }, [visible, initHour, initMinute]);

  const incH = () => setH((v) => (v + 1) % 24);
  const decH = () => setH((v) => (v - 1 + 24) % 24);
  const incM = () => setM((v) => (v + 15) % 60);
  const decM = () => setM((v) => (v - 15 + 60) % 60);

  const fmt12 = (hr: number, mn: number) => {
    const period = hr < 12 ? 'AM' : 'PM';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${h12}:${String(mn).padStart(2, '0')} ${period}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <View style={tp.card}>
          <Text style={tp.title}>Set time for {label}</Text>
          <View style={tp.pickerRow}>
            {/* Hour */}
            <View style={tp.column}>
              <TouchableOpacity onPress={incH} style={tp.arrowBtn} activeOpacity={0.7}>
                <ChevronUp size={22} color="#FF6B00" />
              </TouchableOpacity>
              <Text style={tp.valueText}>{String(h).padStart(2, '0')}</Text>
              <TouchableOpacity onPress={decH} style={tp.arrowBtn} activeOpacity={0.7}>
                <ChevronDown size={22} color="#FF6B00" />
              </TouchableOpacity>
            </View>
            <Text style={tp.colon}>:</Text>
            {/* Minute (15-min steps) */}
            <View style={tp.column}>
              <TouchableOpacity onPress={incM} style={tp.arrowBtn} activeOpacity={0.7}>
                <ChevronUp size={22} color="#FF6B00" />
              </TouchableOpacity>
              <Text style={tp.valueText}>{String(m).padStart(2, '0')}</Text>
              <TouchableOpacity onPress={decM} style={tp.arrowBtn} activeOpacity={0.7}>
                <ChevronDown size={22} color="#FF6B00" />
              </TouchableOpacity>
            </View>
            <View style={tp.previewCol}>
              <Text style={tp.previewLabel}>Preview</Text>
              <Text style={tp.previewTime}>{fmt12(h, m)}</Text>
            </View>
          </View>
          <View style={tp.actions}>
            <TouchableOpacity style={tp.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={tp.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tp.confirmBtn}
              onPress={() => { onConfirm(h, m); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={tp.confirmText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const NotificationSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [prefs, setPrefs] = useState<LocalReminderPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [permStatus, setPermStatus] = useState<string>('unknown');

  // Time picker state
  const [timePicker, setTimePicker] = useState<{
    visible: boolean;
    label: string;
    hourKey: keyof LocalReminderPrefs;
    minuteKey: keyof LocalReminderPrefs;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermStatus(status);
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

  const openTimePicker = (
    label: string,
    hourKey: keyof LocalReminderPrefs,
    minuteKey: keyof LocalReminderPrefs
  ) => {
    setTimePicker({ visible: true, label, hourKey, minuteKey });
  };

  const handleTimeConfirm = useCallback((hour: number, minute: number) => {
    if (!timePicker) return;
    setPrefs((prev) => ({
      ...prev,
      [timePicker.hourKey]: hour,
      [timePicker.minuteKey]: minute,
    }));
  }, [timePicker]);

  const SNOOZE_OPTIONS = [5, 10, 15, 30];

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      </SafeAreaView>
    );
  }

  // Meal row with tappable time
  const MealReminderRow = ({
    emoji, label, enabled, enabledKey, hourKey, minuteKey,
  }: {
    emoji: string;
    label: string;
    enabled: boolean;
    enabledKey: keyof LocalReminderPrefs;
    hourKey: keyof LocalReminderPrefs;
    minuteKey: keyof LocalReminderPrefs;
  }) => (
    <View style={styles.mealRow}>
      <View style={styles.mealLeft}>
        <Text style={styles.rowLabel}>{emoji} {label}</Text>
        {enabled && (
          <TouchableOpacity
            style={styles.timeChip}
            onPress={() => openTimePicker(label, hourKey, minuteKey)}
            activeOpacity={0.75}
          >
            <Clock size={11} color="#FF6B00" />
            <Text style={styles.timeChipText}>
              {formatTime(prefs[hourKey] as number, prefs[minuteKey] as number)}
            </Text>
            <Text style={styles.timeChipEdit}>Edit</Text>
          </TouchableOpacity>
        )}
        {!enabled && (
          <Text style={styles.timeDisabled}>Reminder off</Text>
        )}
      </View>
      <Switch
        value={enabled}
        onValueChange={(v) => updatePref(enabledKey, v as any)}
        trackColor={{ true: '#FF6B00', false: '#E2E8F0' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

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
          <Text style={styles.sectionSub}>Tap the time badge to change when you get reminded</Text>

          <MealReminderRow
            emoji="🍳" label="Breakfast" enabled={prefs.breakfastEnabled}
            enabledKey="breakfastEnabled" hourKey="breakfastHour" minuteKey="breakfastMinute"
          />
          <MealReminderRow
            emoji="🥗" label="Lunch" enabled={prefs.lunchEnabled}
            enabledKey="lunchEnabled" hourKey="lunchHour" minuteKey="lunchMinute"
          />
          <MealReminderRow
            emoji="🍽️" label="Dinner" enabled={prefs.dinnerEnabled}
            enabledKey="dinnerEnabled" hourKey="dinnerHour" minuteKey="dinnerMinute"
          />
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
              {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((hour) => {
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
          {prefs.waterEnabled && (
            <Text style={styles.selectedCount}>
              {prefs.waterHours.length} reminder{prefs.waterHours.length !== 1 ? 's' : ''} selected
            </Text>
          )}
        </View>

        {/* Daily Check-In */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CheckCircle size={18} color="#22C55E" />
            <Text style={styles.sectionTitle}>Daily Check-In</Text>
          </View>
          <Text style={styles.sectionSub}>End-of-day summary reminder</Text>

          <MealReminderRow
            emoji="📊" label="Evening Check-in" enabled={prefs.checkInEnabled}
            enabledKey="checkInEnabled" hourKey="checkInHour" minuteKey="checkInMinute"
          />
        </View>

        {/* Snooze Duration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Timer size={18} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Snooze Duration</Text>
          </View>
          <Text style={styles.sectionSub}>How long to snooze when you dismiss a reminder</Text>
          <View style={styles.snoozeRow}>
            {SNOOZE_OPTIONS.map((mins) => {
              const active = prefs.snoozeMinutes === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  style={[styles.snoozeChip, active && styles.snoozeChipActive]}
                  onPress={() => updatePref('snoozeMinutes', mins)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.snoozeChipText, active && styles.snoozeChipTextActive]}>
                    {mins} min
                  </Text>
                </TouchableOpacity>
              );
            })}
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

      {/* Time Picker Modal */}
      {timePicker && (
        <TimePickerModal
          visible={timePicker.visible}
          label={timePicker.label}
          hour={prefs[timePicker.hourKey] as number}
          minute={prefs[timePicker.minuteKey] as number}
          onConfirm={handleTimeConfirm}
          onClose={() => setTimePicker(null)}
        />
      )}
    </SafeAreaView>
  );
};

// ── Time Picker Modal Styles ──
const tp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  column: {
    alignItems: 'center',
    gap: 8,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 38,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
    minWidth: 56,
    textAlign: 'center',
  },
  colon: {
    fontSize: 34,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  previewCol: {
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  previewLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: FONTS.body.regular,
  },
  previewTime: {
    fontSize: 16,
    fontFamily: FONTS.heading.bold,
    color: '#FF6B00',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontFamily: FONTS.heading.bold,
    color: '#FFFFFF',
  },
});

// ── Main Screen Styles ──
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
  headerTitle: { fontSize: 18, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1, fontFamily: FONTS.body.regular },

  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permBannerText: { color: '#FFFFFF', fontFamily: FONTS.heading.bold, fontSize: 14 },

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
  sectionTitle: { fontSize: 15, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', lineHeight: 17, fontFamily: FONTS.body.regular },

  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mealLeft: { gap: 4 },
  rowLabel: { fontSize: 14, fontFamily: FONTS.heading.bold, color: '#1E293B' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD8BF',
    alignSelf: 'flex-start',
  },
  timeChipText: { fontSize: 12, fontFamily: FONTS.heading.bold, color: '#FF6B00' },
  timeChipEdit: { fontSize: 11, color: '#FF6B00', fontFamily: FONTS.body.regular },
  timeDisabled: { fontSize: 12, color: '#CBD5E1', fontFamily: FONTS.body.regular },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

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
  hourChipText: { fontSize: 12, fontFamily: FONTS.heading.bold, color: '#64748B' },
  hourChipTextActive: { color: '#3B82F6' },
  selectedCount: { fontSize: 11, color: '#94A3B8', fontFamily: FONTS.body.regular },

  snoozeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  snoozeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snoozeChipActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#8B5CF6',
  },
  snoozeChipText: { fontSize: 13, fontFamily: FONTS.heading.bold, color: '#64748B' },
  snoozeChipTextActive: { color: '#8B5CF6' },

  infoPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  infoPillText: { fontSize: 13, fontFamily: FONTS.heading.bold },

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
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.heading.bold },
});

export default NotificationSettingsScreen;
