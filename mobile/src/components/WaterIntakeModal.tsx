import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Surface } from 'react-native-paper';
import { X, Droplet, Plus, Trash2, CheckCircle2, Target } from 'lucide-react-native';
import { FONTS } from '../theme/fonts';
import { useLog } from '../contexts/LogContext';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PRESET_CONTAINERS = [
  { id: 'cup', label: 'Small Cup', amount: 150, emoji: '🍵' },
  { id: 'glass', label: 'Glass', amount: 250, emoji: '🥛' },
  { id: 'bottle', label: 'Bottle', amount: 500, emoji: '🧴' },
  { id: 'sports', label: 'Large Bottle', amount: 750, emoji: '🏋️' },
];

export const WaterIntakeModal: React.FC<Props> = ({ visible, onClose }) => {
  const { todayLog, updateWaterIntake, deleteWaterEntry } = useLog();
  const { targets, updateTargets } = useAuth();

  const [customAmount, setCustomAmount] = useState('');
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [targetGoalInput, setTargetGoalInput] = useState('');

  const currentIntake = todayLog?.waterIntakeMl || 0;
  const targetWater = targets?.waterMl || 2000;
  const progressPercent = Math.min(100, Math.round((currentIntake / targetWater) * 100));
  const remainingMl = Math.max(0, targetWater - currentIntake);

  const handleAddPreset = async (amountMl: number) => {
    await updateWaterIntake(amountMl, 'add');
  };

  const handleAddCustom = async () => {
    const amount = parseInt(customAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    await updateWaterIntake(amount, 'add');
    setCustomAmount('');
  };

  const handleDeleteEntry = async (waterId: string) => {
    await deleteWaterEntry(waterId);
  };

  const handleSaveGoal = async (newGoal: number) => {
    if (!newGoal || newGoal < 500 || newGoal > 10000) return;
    try {
      await updateTargets({
        calories: targets?.calories || 2000,
        proteinG: targets?.proteinG || 150,
        carbsG: targets?.carbsG || 225,
        fatG: targets?.fatG || 65,
        waterMl: newGoal,
      } as any);
      setShowGoalEdit(false);
      setTargetGoalInput('');
    } catch (e) {
      console.warn('Failed to update water target:', e);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Today';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalCard}
            >
              {/* Header Bar */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.iconBadge}>
                    <Droplet size={22} color="#0284C7" fill="#0284C7" />
                  </View>
                  <View>
                    <Text style={styles.title}>Water Tracker</Text>
                    <Text style={styles.subtitle}>Daily Hydration Goal</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                {/* Hero Intake Progress Card */}
                <Surface style={styles.progressHero}>
                  <View style={styles.heroRow}>
                    <View style={styles.heroTextContainer}>
                      <Text style={styles.intakeLargeText}>
                        {currentIntake.toLocaleString()}{' '}
                        <Text style={styles.unitText}>/ {targetWater.toLocaleString()} ml</Text>
                      </Text>
                      <Text style={styles.remainingText}>
                        {progressPercent >= 100
                          ? '🎉 Daily target reached!'
                          : `${remainingMl.toLocaleString()} ml remaining`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.editGoalBtn}
                      onPress={() => setShowGoalEdit(!showGoalEdit)}
                    >
                      <Target size={16} color="#0284C7" />
                      <Text style={styles.editGoalText}>Goal</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dynamic Progress Bar */}
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                  </View>

                  <View style={styles.progressMetaRow}>
                    <Text style={styles.metaPercentText}>{progressPercent}% Complete</Text>
                    {progressPercent >= 100 && (
                      <View style={styles.completedBadge}>
                        <CheckCircle2 size={14} color="#16A34A" />
                        <Text style={styles.completedText}>Hydrated</Text>
                      </View>
                    )}
                  </View>
                </Surface>

                {/* Target Goal Inline Editor */}
                {showGoalEdit && (
                  <View style={styles.goalEditContainer}>
                    <Text style={styles.sectionLabel}>Set Daily Target Goal:</Text>
                    <View style={styles.goalChipRow}>
                      {[2000, 2500, 3000, 3500].map((goalVal) => (
                        <TouchableOpacity
                          key={goalVal}
                          style={[
                            styles.goalChip,
                            targetWater === goalVal && styles.goalChipActive,
                          ]}
                          onPress={() => handleSaveGoal(goalVal)}
                        >
                          <Text
                            style={[
                              styles.goalChipText,
                              targetWater === goalVal && styles.goalChipTextActive,
                            ]}
                          >
                            {goalVal / 1000}L
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.customGoalRow}>
                      <TextInput
                        style={styles.customGoalInput}
                        placeholder="Custom (ml)"
                        keyboardType="number-pad"
                        value={targetGoalInput}
                        onChangeText={setTargetGoalInput}
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity
                        style={styles.saveGoalBtn}
                        onPress={() => handleSaveGoal(parseInt(targetGoalInput, 10))}
                      >
                        <Text style={styles.saveGoalBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Quick Add Presets Grid */}
                <Text style={styles.sectionLabel}>Quick Add</Text>
                <View style={styles.presetsGrid}>
                  {PRESET_CONTAINERS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.presetCard}
                      onPress={() => handleAddPreset(item.amount)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetEmoji}>{item.emoji}</Text>
                      <Text style={styles.presetLabel}>{item.label}</Text>
                      <Text style={styles.presetAmount}>+{item.amount} ml</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Amount Logger */}
                <Text style={styles.sectionLabel}>Custom Amount</Text>
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Enter amount in ml (e.g. 350)"
                    keyboardType="number-pad"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={[styles.addCustomBtn, !customAmount && styles.addCustomBtnDisabled]}
                    onPress={handleAddCustom}
                    disabled={!customAmount}
                  >
                    <Plus size={18} color="#FFFFFF" />
                    <Text style={styles.addCustomBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Today's Water Logs History */}
                <Text style={styles.sectionLabel}>Today's Water Logs</Text>
                {todayLog?.waterLogs && todayLog.waterLogs.length > 0 ? (
                  <View style={styles.logsList}>
                    {todayLog.waterLogs.map((log) => (
                      <View key={log._id} style={styles.logItem}>
                        <View style={styles.logItemLeft}>
                          <View style={styles.logItemDot} />
                          <View>
                            <Text style={styles.logItemAmount}>+{log.amountMl} ml</Text>
                            <Text style={styles.logItemTime}>{formatTime(log.addedAt)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteLogBtn}
                          onPress={() => handleDeleteEntry(log._id)}
                        >
                          <Trash2 size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyLogsContainer}>
                    <Text style={styles.emptyLogsText}>No water logged for this date yet.</Text>
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  progressHero: {
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroTextContainer: {
    flex: 1,
  },
  intakeLargeText: {
    fontSize: 24,
    fontFamily: FONTS.heading.bold,
    color: '#0284C7',
  },
  unitText: {
    fontSize: 16,
    fontFamily: FONTS.body.medium,
    color: '#64748B',
  },
  remainingText: {
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#334155',
    marginTop: 4,
  },
  editGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
  },
  editGoalText: {
    fontSize: 12,
    fontFamily: FONTS.heading.bold,
    color: '#0284C7',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 6,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaPercentText: {
    fontSize: 12,
    fontFamily: FONTS.body.bold,
    color: '#0284C7',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontFamily: FONTS.heading.bold,
    color: '#16A34A',
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FONTS.heading.bold,
    color: '#334155',
    marginTop: 4,
  },
  goalEditContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  goalChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  goalChipText: {
    fontSize: 13,
    fontFamily: FONTS.heading.bold,
    color: '#475569',
  },
  goalChipTextActive: {
    color: '#FFFFFF',
  },
  customGoalRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  customGoalInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  saveGoalBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveGoalBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.heading.bold,
    fontSize: 13,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 13,
    fontFamily: FONTS.heading.bold,
    color: '#1E293B',
  },
  presetAmount: {
    fontSize: 12,
    fontFamily: FONTS.body.bold,
    color: '#0284C7',
    marginTop: 2,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  addCustomBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  addCustomBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.heading.bold,
    fontSize: 14,
  },
  logsList: {
    gap: 8,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  logItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  logItemAmount: {
    fontSize: 14,
    fontFamily: FONTS.heading.bold,
    color: '#0F172A',
  },
  logItemTime: {
    fontSize: 11,
    fontFamily: FONTS.body.regular,
    color: '#64748B',
  },
  deleteLogBtn: {
    padding: 6,
  },
  emptyLogsContainer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyLogsText: {
    fontSize: 13,
    fontFamily: FONTS.body.regular,
    color: '#94A3B8',
  },
});
