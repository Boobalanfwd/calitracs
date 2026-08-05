import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const { height } = Dimensions.get('window');

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Calitracs needs camera access to take food photos. Please enable it in Settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Permission Required',
        'Calitracs needs photo library access to select images. Please enable it in Settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleCamera = async () => {
    setLoading(true);
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.5,
        base64: true,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        navigation.navigate('Preview', {
          imageUri: result.assets[0].uri,
          base64: result.assets[0].base64 || undefined,
        });
      }
    } catch (err) {
      console.error('Camera launch error:', err);
      Alert.alert('Camera Error', 'Unable to open camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGallery = async () => {
    setLoading(true);
    try {
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.5,
        base64: true,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        navigation.navigate('Preview', {
          imageUri: result.assets[0].uri,
          base64: result.assets[0].base64 || undefined,
        });
      }
    } catch (err) {
      console.error('Gallery launch error:', err);
      Alert.alert('Gallery Error', 'Unable to open photo library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Background gradient orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Top section — branding */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 8 }}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Calitracs</Text>
        <Text style={styles.subtitle}>Snap your food.{'\n'}Let AI identify it.</Text>
      </View>

      {/* Center illustration */}
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationRing}>
          <View style={styles.illustrationInner}>
            <Text style={styles.illustrationEmoji}>📷</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>🥘 Indian Food</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>🍣 Global Cuisine</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>🤖 Gemini AI</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>⚡ Instant</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Primary — Camera */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleCamera}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={styles.primaryButtonIcon}>📷</Text>
          <Text style={styles.primaryButtonText}>Take Food Photo</Text>
        </TouchableOpacity>

        {/* Secondary — Gallery */}
        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={handleGallery}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>🖼️  Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Footer note */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by Google Gemini 2.5 Flash</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  orb1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  orb2: {
    position: 'absolute',
    bottom: height * 0.2,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(76, 175, 80, 0.06)',
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  illustrationRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 107, 53, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.15)',
    marginBottom: 8,
  },
  illustrationInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 52,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  primaryButtonIcon: {
    fontSize: 22,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
  },
});

export default HomeScreen;
