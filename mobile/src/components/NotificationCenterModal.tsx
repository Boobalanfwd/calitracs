import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import {
  Bell, CheckCheck, Trash2, X, Flame, Beef, Droplet, Wheat, Check, Sparkles,
} from 'lucide-react-native';
import { notificationService, AppNotificationItem } from '../services/notificationService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type FilterCategory = 'all' | 'nutrition' | 'water' | 'unread';

export const NotificationCenterModal: React.FC<Props> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterCategory>('all');

  useEffect(() => {
    setNotifications(notificationService.getNotifications());
    const unsubscribe = notificationService.subscribe(() => {
      setNotifications(notificationService.getNotifications());
    });
    return unsubscribe;
  }, []);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'nutrition') {
      return notifications.filter((n) =>
        ['calorie_exceeded', 'low_protein', 'high_carbs', 'high_fat'].includes(n.type)
      );
    }
    if (activeTab === 'water') {
      return notifications.filter((n) => ['water_reminder', 'water_goal', 'water_gap'].includes(n.type));
    }
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleMarkRead = () => {
    notificationService.markAllAsRead();
  };

  const handleClearAll = () => {
    notificationService.clearAll();
  };

  const handleDismissItem = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
  };

  const getCardTheme = (type: string) => {
    switch (type) {
      case 'calorie_exceeded':
        return {
          borderColor: '#EF4444',
          bgColor: '#FEF2F2',
          badgeBg: '#EF4444',
          icon: <Flame size={18} color="#FFFFFF" />,
          category: 'Calorie Alert',
          badgeTagBg: '#FEE2E2',
          badgeTagColor: '#DC2626',
        };
      case 'low_protein':
        return {
          borderColor: '#8B5CF6',
          bgColor: '#F3E8FF',
          badgeBg: '#8B5CF6',
          icon: <Beef size={18} color="#FFFFFF" />,
          category: 'Protein Focus',
          badgeTagBg: '#E9D5FF',
          badgeTagColor: '#7C3AED',
        };
      case 'water_reminder':
        return {
          borderColor: '#3B82F6',
          bgColor: '#EFF6FF',
          badgeBg: '#3B82F6',
          icon: <Droplet size={18} color="#FFFFFF" />,
          category: 'Hydration Goal',
          badgeTagBg: '#DBEAFE',
          badgeTagColor: '#2563EB',
        };
      case 'high_carbs':
      case 'high_fat':
        return {
          borderColor: '#EAB308',
          bgColor: '#FEFCE8',
          badgeBg: '#EAB308',
          icon: <Wheat size={18} color="#FFFFFF" />,
          category: 'Macro Notice',
          badgeTagBg: '#FEF08A',
          badgeTagColor: '#CA8A04',
        };
      default:
        return {
          borderColor: '#22C55E',
          bgColor: '#F0FDF4',
          badgeBg: '#22C55E',
          icon: <Check size={18} color="#FFFFFF" />,
          category: 'System',
          badgeTagBg: '#DCFCE7',
          badgeTagColor: '#16A34A',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Dismiss Area */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalContainer}>
          {/* Top Sheet Grab Handle */}
          <View style={styles.handle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.headerIconBg}>
                <Bell size={22} color="#FF6B00" />
                {unreadCount > 0 && <View style={styles.headerDot} />}
              </View>

              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Notifications</Text>
                  {unreadCount > 0 && (
                    <View style={styles.badgeCount}>
                      <Text style={styles.badgeCountText}>{unreadCount} New</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalSub}>AI Nutrition Insights & Reminders</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Prominent Action Bar (Mark Read & Clear All Always Visible) */}
          <View style={styles.actionHeaderBar}>
            <Text style={styles.actionHeaderTitle}>
              {notifications.length} {notifications.length === 1 ? 'Alert' : 'Alerts'}
            </Text>

            {notifications.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.markReadBtn}
                  onPress={handleMarkRead}
                  activeOpacity={0.75}
                >
                  <CheckCheck size={14} color="#FF6B00" />
                  <Text style={styles.markReadText}>Mark Read</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={handleClearAll}
                  activeOpacity={0.75}
                >
                  <Trash2 size={14} color="#EF4444" />
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Filter Category Chips */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'all' && styles.tabChipActive]}
              onPress={() => setActiveTab('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All ({notifications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'nutrition' && styles.tabChipActive]}
              onPress={() => setActiveTab('nutrition')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'nutrition' && styles.tabTextActive]}>
                🥗 Nutrition
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'water' && styles.tabChipActive]}
              onPress={() => setActiveTab('water')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'water' && styles.tabTextActive]}>
                💧 Hydration
              </Text>
            </TouchableOpacity>

            {unreadCount > 0 && (
              <TouchableOpacity
                style={[styles.tabChip, activeTab === 'unread' && styles.tabChipActive]}
                onPress={() => setActiveTab('unread')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
                  ⚡ Unread ({unreadCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notifications List ScrollView */}
          <ScrollView
            style={styles.scrollList}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <Bell size={38} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
                <Text style={styles.emptySub}>
                  No notifications in this category. Real-time calorie alerts and water reminders will appear here automatically.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12, paddingTop: 4 }}>
                {filteredNotifications.map((item) => {
                  const cardTheme = getCardTheme(item.type);
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.card,
                        {
                          backgroundColor: cardTheme.bgColor,
                          borderColor: cardTheme.borderColor,
                        },
                      ]}
                    >
                      {/* Left Badge Circle with Icon */}
                      <View style={[styles.iconBadgeCircle, { backgroundColor: cardTheme.badgeBg }]}>
                        {cardTheme.icon}
                      </View>

                      {/* Content Column */}
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={[styles.categoryPill, { backgroundColor: cardTheme.badgeTagBg }]}>
                            <Text style={[styles.categoryPillText, { color: cardTheme.badgeTagColor }]}>
                              {cardTheme.category}
                            </Text>
                          </View>
                          <Text style={styles.timeText}>{item.timestamp}</Text>
                        </View>

                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardBody} numberOfLines={2}>
                          {item.body}
                        </Text>
                      </View>

                      {/* Right Delete Button */}
                      <TouchableOpacity
                        onPress={() => handleDismissItem(item.id)}
                        style={styles.cardDismissBtn}
                        activeOpacity={0.7}
                      >
                        <X size={16} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  headerDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  badgeCount: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 4,
  },
  actionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FFD8BF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B00',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabChipActive: {
    backgroundColor: '#FFF5EF',
    borderColor: '#FF6B00',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  scrollList: {
    maxHeight: 480,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 10,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBadgeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 17,
  },
  cardDismissBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
