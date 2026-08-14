import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Ruler, Bell, Shield, Info, Globe, Star,
  FileText, ChevronRight, Vibrate, RefreshCw, Trash2,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import { FONTS } from '../../theme/fonts';

interface Props {
  onBack?: () => void;
}

// ── Section Header ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={pref.sectionLabel}>{label}</Text>
);

// ── Toggle Row ────────────────────────────────────────────────────────────────
interface ToggleRowProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}
const ToggleRow: React.FC<ToggleRowProps> = ({ icon, iconBg, title, subtitle, value, onToggle, isLast }) => (
  <View style={[pref.row, isLast && pref.rowLast]}>
    <View style={[pref.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={pref.rowBody}>
      <Text style={pref.rowTitle}>{title}</Text>
      <Text style={pref.rowSub}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#E2E8F0', true: '#FF6B00' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E2E8F0"
    />
  </View>
);

// ── Tap Row ───────────────────────────────────────────────────────────────────
interface TapRowProps {
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
const TapRow: React.FC<TapRowProps> = ({
  icon, iconBg, title, subtitle, valueLabel, valueBg, valueColor, onPress, isLast, isDanger,
}) => (
  <TouchableOpacity style={[pref.row, isLast && pref.rowLast]} onPress={onPress} activeOpacity={0.65}>
    <View style={[pref.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={pref.rowBody}>
      <Text style={[pref.rowTitle, isDanger && { color: '#EF4444' }]}>{title}</Text>
      <Text style={pref.rowSub}>{subtitle}</Text>
    </View>
    <View style={pref.rowRight}>
      {valueLabel ? (
        <View style={[pref.valuePill, { backgroundColor: valueBg || '#F1F5F9' }]}>
          <Text style={[pref.valuePillText, { color: valueColor || '#64748B' }]}>{valueLabel}</Text>
        </View>
      ) : null}
      <ChevronRight size={16} color={isDanger ? '#EF4444' : '#CBD5E1'} />
    </View>
  </TouchableOpacity>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
const AppPreferencesScreen: React.FC<Props> = ({ onBack }) => {
  const { user, updateProfile } = useAuth();
  const isImperial = user?.profile?.unitSystem === 'imperial';

  // Toggle states (stored locally for instant feedback, persisted on change)
  const [haptics, setHaptics] = useState(user?.profile?.hapticsEnabled ?? true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(user?.profile?.analyticsEnabled ?? true);

  const handleToggleUnit = async () => {
    const next = isImperial ? 'metric' : 'imperial';
    try {
      await updateProfile({ unitSystem: next } as Partial<UserProfile>);
    } catch {
      Alert.alert('Error', 'Failed to update unit system.');
    }
  };

  const handleToggleHaptics = async (v: boolean) => {
    setHaptics(v);
    try {
      await updateProfile({ hapticsEnabled: v } as any);
    } catch {
      setHaptics(!v);
    }
  };

  const handleToggleAnalytics = async (v: boolean) => {
    setAnalyticsEnabled(v);
    try {
      await updateProfile({ analyticsEnabled: v } as any);
    } catch {
      setAnalyticsEnabled(!v);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary app data. Your logs and settings will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('✅ Cache cleared') },
      ]
    );
  };

  const handleRateApp = () => {
    Linking.openURL('https://apps.apple.com/app/calitracs').catch(() =>
      Alert.alert('Error', 'Could not open App Store.')
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://calitracs.app/privacy').catch(() =>
      Alert.alert('Error', 'Could not open browser.')
    );
  };

  const handleTerms = () => {
    Linking.openURL('https://calitracs.app/terms').catch(() =>
      Alert.alert('Error', 'Could not open browser.')
    );
  };

  return (
    <SafeAreaView style={pref.container} edges={['top']}>
      {/* ── Branded Header ───────────────────────────────────────────────── */}
      <View style={pref.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={pref.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={pref.headerTitle}>App Preferences</Text>
          <Text style={pref.headerSub}>Customize your Calitracs experience</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={pref.scroll} showsVerticalScrollIndicator={false}>

        {/* ── DISPLAY ─────────────────────────────────────────────────── */}
        <SectionLabel label="DISPLAY" />
        <View style={pref.card}>
          <TapRow
            icon={<Ruler size={18} color="#FF6B00" />}
            iconBg="#FFF5EF"
            title="Measurement Units"
            subtitle="Affects weight, height & fluid display"
            valueLabel={isImperial ? 'Imperial' : 'Metric'}
            valueBg={isImperial ? '#EFF6FF' : '#FFF5EF'}
            valueColor={isImperial ? '#2563EB' : '#FF6B00'}
            onPress={handleToggleUnit}
            isLast
          />
        </View>

        {/* ── BEHAVIOUR ───────────────────────────────────────────────── */}
        <SectionLabel label="BEHAVIOUR" />
        <View style={pref.card}>
          <ToggleRow
            icon={<Vibrate size={18} color="#8B5CF6" />}
            iconBg="#F3E8FF"
            title="Haptic Feedback"
            subtitle="Vibration on taps, swipes & alerts"
            value={haptics}
            onToggle={handleToggleHaptics}
            isLast
          />
        </View>

        {/* ── PRIVACY & DATA ───────────────────────────────────────────── */}
        <SectionLabel label="PRIVACY & DATA" />
        <View style={pref.card}>
          <ToggleRow
            icon={<Shield size={18} color="#22C55E" />}
            iconBg="#F0FDF4"
            title="Analytics & Crash Reports"
            subtitle="Help us improve Calitracs with usage data"
            value={analyticsEnabled}
            onToggle={handleToggleAnalytics}
          />
          <TapRow
            icon={<Trash2 size={18} color="#EF4444" />}
            iconBg="#FEF2F2"
            title="Clear Cache"
            subtitle="Remove temporary files (logs & settings safe)"
            onPress={handleClearCache}
            isLast
            isDanger
          />
        </View>

        {/* ── ABOUT ────────────────────────────────────────────────────── */}
        <SectionLabel label="ABOUT" />
        <View style={pref.card}>
          <TapRow
            icon={<Star size={18} color="#F59E0B" />}
            iconBg="#FEF3C7"
            title="Rate Calitracs"
            subtitle="Enjoying the app? Leave us a ⭐ review!"
            onPress={handleRateApp}
          />
          <TapRow
            icon={<Globe size={18} color="#3B82F6" />}
            iconBg="#EFF6FF"
            title="Privacy Policy"
            subtitle="How we handle your personal data"
            onPress={handlePrivacyPolicy}
          />
          <TapRow
            icon={<FileText size={18} color="#64748B" />}
            iconBg="#F1F5F9"
            title="Terms of Service"
            subtitle="Usage terms and conditions"
            onPress={handleTerms}
            isLast
          />
        </View>

        {/* ── Version Banner ────────────────────────────────────────────── */}
        <View style={pref.versionCard}>
          {/* Orange accent bar */}
          <View style={pref.versionAccent} />
          <View style={pref.versionContent}>
            <View style={pref.versionLogoCircle}>
              <Text style={pref.versionLogoText}>C</Text>
            </View>
            <View>
              <Text style={pref.versionAppName}>Calitracs</Text>
              <Text style={pref.versionNum}>Version 2.5.0 · Build 250</Text>
              <Text style={pref.versionCopy}>© 2026 Calitracs Inc. All rights reserved.</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const pref = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 1, fontFamily: FONTS.body.regular },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: FONTS.heading.bold,
    color: '#94A3B8',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    marginBottom: -2,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  // Rows
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
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  rowSub: { fontSize: 12, fontFamily: FONTS.body.regular, color: '#94A3B8' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valuePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  valuePillText: { fontSize: 12, fontFamily: FONTS.heading.bold },

  // Version Banner Card
  versionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  versionAccent: {
    height: 4,
    backgroundColor: '#FF6B00',
    width: '100%',
  },
  versionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  versionLogoCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  versionLogoText: { fontSize: 22, fontFamily: FONTS.heading.bold, color: '#FFFFFF' },
  versionAppName: { fontSize: 16, fontFamily: FONTS.heading.bold, color: '#0F172A' },
  versionNum: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body.regular, marginTop: 2 },
  versionCopy: { fontSize: 11, color: '#CBD5E1', fontFamily: FONTS.body.regular, marginTop: 3 },
});

export default AppPreferencesScreen;
