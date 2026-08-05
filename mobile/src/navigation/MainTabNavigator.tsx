import React, { useState } from 'react';
import {
  Text, View, StyleSheet, TouchableOpacity, Platform, Modal, ScrollView,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { MainTabParamList, FoodStackParamList } from '../types';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import AddFoodScreen from '../screens/food/AddFoodScreen';
import HomeScreen from '../screens/HomeScreen';
import PreviewScreen from '../screens/PreviewScreen';
import ResultScreen from '../screens/ResultScreen';
import LogEntryScreen from '../screens/food/LogEntryScreen';
import ManualEntryScreen from '../screens/food/ManualEntryScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

import ProgressScreen from '../screens/analytics/ProgressScreen';
import CameraScannerScreen from '../screens/food/CameraScannerScreen';
import { AddFoodModal } from '../components/AddFoodModal';

import {
  Home as LucideHome,
  TrendingUp,
  Calendar as LucideCalendar,
  User as LucideUser,
  Scan,
  Camera,
  ScanBarcode,
  Tag,
  Image as ImageIcon,
  Edit3,
  ChevronRight,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();
const FoodStack = createNativeStackNavigator<FoodStackParamList>();

const FoodNavigator: React.FC = () => {
  return (
    <FoodStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <FoodStack.Screen name="AddFoodChoice" component={AddFoodScreen} />
      <FoodStack.Screen name="CameraScanner" component={CameraScannerScreen} />
      <FoodStack.Screen name="Home" component={HomeScreen} />
      <FoodStack.Screen name="Preview" component={PreviewScreen} />
      <FoodStack.Screen name="Result" component={ResultScreen} />
      <FoodStack.Screen name="LogEntry" component={LogEntryScreen} />
      <FoodStack.Screen name="ManualEntry" component={ManualEntryScreen} />
    </FoodStack.Navigator>
  );
};

// ── Custom Floating Bottom Tab Bar ────────────────────────────────────────────

const CustomFloatingTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 12 : 8);
  const [showScanModal, setShowScanModal] = useState(false);

  const TAB_ITEMS = [
    {
      routeName: 'Dashboard',
      label: 'Home',
      renderIcon: (a: boolean) => <LucideHome size={20} color={a ? '#FFFFFF' : '#94A3B8'} />,
    },
    {
      routeName: 'Progress',
      label: 'Progress',
      renderIcon: (a: boolean) => <TrendingUp size={20} color={a ? '#FFFFFF' : '#94A3B8'} />,
    },
    {
      routeName: 'Calendar',
      label: 'History',
      renderIcon: (a: boolean) => <LucideCalendar size={20} color={a ? '#FFFFFF' : '#94A3B8'} />,
    },
    {
      routeName: 'Profile',
      label: 'Profile',
      renderIcon: (a: boolean) => <LucideUser size={20} color={a ? '#FFFFFF' : '#94A3B8'} />,
    },
  ];

  const handlePickGallery = async () => {
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
        });
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
    }
  };

  const navigateToRoot = (screen: string, params?: any) => {
    setShowScanModal(false);
    const rootNav = navigation.getParent() || navigation;
    rootNav.navigate(screen as any, params);
  };

  return (
    <>
      <View style={[styles.floatingWrapper, { bottom: bottomInset }]}>
        {/* Left Dark Floating Pill Container */}
        <View style={styles.darkPillContainer}>
          {TAB_ITEMS.map((item) => {
            const index = state.routes.findIndex((r) => r.name === item.routeName);
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index]?.key || item.routeName,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(item.routeName as any);
              }
            };

            return (
              <TouchableOpacity
                key={item.routeName}
                style={[
                  styles.tabItem,
                  isFocused && styles.tabItemActive,
                ]}
                onPress={onPress}
                activeOpacity={0.8}
              >
                {item.renderIcon(isFocused)}
                {isFocused && (
                  <Text style={styles.activePillText}>{item.label}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Separate Floating Circular Orange Scan Button */}
        <TouchableOpacity
          style={styles.floatingScanBtn}
          onPress={() => setShowScanModal(true)}
          activeOpacity={0.85}
        >
          <Scan size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <AddFoodModal
        visible={showScanModal}
        onClose={() => setShowScanModal(false)}
        navigation={navigation}
      />
    </>
  );
};

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomFloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  darkPillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#161922',
    borderRadius: 32,
    height: 60,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#252936',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabItemActive: {
    backgroundColor: '#2D323E',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingScanBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF6B2C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalContentGroup: {
    paddingVertical: 4,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
  optionChevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 6,
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
  // Sub-modal grid for Camera input method selection
  subModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  subOptionCard: {
    width: '46%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  subOptionDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default MainTabNavigator;
