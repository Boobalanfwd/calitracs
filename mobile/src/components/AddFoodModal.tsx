import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import {
  Camera, ScanBarcode, Tag, Image as ImageIcon, Edit3, ChevronRight,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface AddFoodModalProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  targetMeal?: string;
}

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  visible,
  onClose,
  navigation,
  targetMeal,
}) => {
  const handlePickGallery = async () => {
    onClose();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const rootNav = navigation.getParent() || navigation;
        rootNav.navigate('Preview' as any, {
          imageUri: result.assets[0].uri,
          base64: result.assets[0].base64 || undefined,
          targetMeal,
        });
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
    }
  };

  const navigateToScreen = (screen: string, params?: any) => {
    onClose();
    const rootNav = navigation.getParent() || navigation;
    rootNav.navigate(screen as any, { ...params, targetMeal });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Add Food to Log</Text>
          <Text style={styles.modalSub}>Select your preferred logging method</Text>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentGroup}>
              {/* SECTION 1: AI & SMART SCANNING */}
              <Text style={styles.sectionHeaderLabel}>AI & SMART SCANNING</Text>

              <View style={styles.optionsList}>
                {/* 1. Camera */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => navigateToScreen('CameraScanner', { mode: 'food' })}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: '#FFF0F1' }]}>
                    <Camera size={22} color="#F97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Camera</Text>
                    <Text style={styles.optionDesc}>Point camera at your meal for instant AI analysis</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* 2. Barcode */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => navigateToScreen('CameraScanner', { mode: 'barcode' })}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: '#F0FDF4' }]}>
                    <ScanBarcode size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Barcode</Text>
                    <Text style={styles.optionDesc}>Scan packaged food barcode for instant info</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* 3. Food Label */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => navigateToScreen('CameraScanner', { mode: 'label' })}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: '#FEF3C7' }]}>
                    <Tag size={22} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Food Label</Text>
                    <Text style={styles.optionDesc}>Scan nutrition facts label on packaged food</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* 4. Gallery */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handlePickGallery}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <ImageIcon size={22} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Gallery</Text>
                    <Text style={styles.optionDesc}>Upload an existing meal photo from library</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* SECTION 2: MANUAL LOGGING */}
              <Text style={[styles.sectionHeaderLabel, { marginTop: 16 }]}>MANUAL LOGGING</Text>

              <View style={styles.optionsList}>
                {/* 5. Manually Enter */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => navigateToScreen('ManualEntry')}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: '#F3E8FF' }]}>
                    <Edit3 size={22} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Manually Enter</Text>
                    <Text style={styles.optionDesc}>Type meal name, portion size & macros manually</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalContentGroup: {
    gap: 12,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
