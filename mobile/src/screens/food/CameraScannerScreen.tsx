import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Alert, ActivityIndicator, Image, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { API } from '../../services/api';

type ScanMode = 'food' | 'barcode' | 'label';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { mode?: ScanMode } };
}

const { width, height } = Dimensions.get('window');

const CameraScannerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const initialMode = route?.params?.mode || 'food';
  const [mode, setMode] = useState<ScanMode>(initialMode);

  React.useEffect(() => {
    if (route?.params?.mode) {
      setMode(route.params.mode);
    }
  }, [route?.params?.mode]);
  const [isScanning, setIsScanning] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const cameraRef = useRef<any>(null);

  if (!permission) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.background, padding: 24 }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📷</Text>
        <Text style={[styles.permTitle, { color: theme.textPrimary }]}>Camera Access Required</Text>
        <Text style={[styles.permSub, { color: theme.textSecondary }]}>
          Calitracs needs camera access to scan food items, barcodes, and nutrition labels.
        </Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isScanning) return;
    setIsScanning(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });

      if (!photo || !photo.uri) throw new Error('Failed to take photo.');

      if (mode === 'label') {
        const labelItem = await API.analyzeNutritionLabel(photo.uri, photo.base64);
        if (labelItem) {
          navigation.navigate('LogEntry', {
            food: {
              name: labelItem.name,
              calories: labelItem.calories,
              proteinG: labelItem.proteinG,
              carbsG: labelItem.carbsG,
              fatG: labelItem.fatG,
              portionG: labelItem.portionG || 100,
              portionDescription: labelItem.portionDescription || '1 serving',
              confidence: 0.95,
              nutritionSource: 'openfoodfacts',
            },
            imageUri: photo.uri,
          });
        } else {
          Alert.alert('Label Not Read', 'Could not read clear nutrition numbers. Please try again.');
        }
      } else {
        navigation.navigate('Preview', {
          imageUri: photo.uri,
          base64: photo.base64,
        });
      }
    } catch (err: any) {
      Alert.alert('Scan Error', err.message || 'Unable to scan food photo.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (mode !== 'barcode' || isScanning || scannedBarcode === result.data) return;
    setScannedBarcode(result.data);
    setIsScanning(true);

    try {
      const product = await API.barcodeLookup(result.data);
      if (product) {
        navigation.navigate('LogEntry', {
          food: {
            name: product.name,
            calories: product.calories,
            proteinG: product.proteinG,
            carbsG: product.carbsG,
            fatG: product.fatG,
            portionG: product.portionG || 100,
            portionDescription: product.portionDescription || '1 serving',
            confidence: 0.98,
            nutritionSource: 'openfoodfacts',
          },
          imageUri: product.imageUrl || undefined,
        });
      } else {
        Alert.alert('Product Not Found', `Barcode ${result.data} not found in database.`);
      }
    } catch (err: any) {
      Alert.alert('Barcode Error', err.message || 'Unable to fetch barcode product.');
    } finally {
      setIsScanning(false);
      setTimeout(() => setScannedBarcode(null), 3000);
    }
  };

  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        navigation.navigate('Preview', {
          imageUri: result.assets[0].uri,
          base64: result.assets[0].base64 || undefined,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Self-closing CameraView */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        enableTorch={flash === 'on'}
        onBarcodeScanned={mode === 'barcode' ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
      />

      {/* Absolute positioning overlay for controls & viewfinder */}
      <SafeAreaView style={[StyleSheet.absoluteFillObject, styles.cameraOverlay]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.goBack()}>
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modeHeaderTitle}>
            {mode === 'food' ? 'Food AI Scanner' : mode === 'barcode' ? 'Barcode Scanner' : 'Label OCR Reader'}
          </Text>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
          >
            <Text style={styles.iconText}>{flash === 'on' ? '⚡' : '💡'}</Text>
          </TouchableOpacity>
        </View>

        {/* Guide Overlay Box */}
        <View style={styles.guideContainer}>
          <View style={styles.frameBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {/* Tip Banner */}
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              {mode === 'food'
                ? '🎯 Keep the full meal inside frame in good lighting'
                : mode === 'barcode'
                ? '║▌║ Align barcode inside the box to scan'
                : '🏷️ Align Nutrition Label clearly inside frame'}
            </Text>
          </View>
        </View>

        {/* Bottom Bar Controls */}
        <View style={styles.bottomControls}>
          {/* Shutter row */}
          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={[styles.shutterOuter, isScanning && { opacity: 0.5 }]}
              onPress={handleCapture}
              disabled={isScanning || mode === 'barcode'}
            >
              {isScanning ? (
                <ActivityIndicator color="#FF4757" size="large" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  permTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  permSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  permBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  permBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  modeHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  guideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  frameBox: { width: width * 0.75, height: width * 0.75, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#FFFFFF', borderWidth: 3.5 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  tipCard: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  bottomControls: { paddingHorizontal: 20, paddingBottom: 24, gap: 20, alignItems: 'center' },
  modeTabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24, padding: 4, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modeTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  modeTabActive: { backgroundColor: '#FFFFFF' },
  modeTabText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  modeTabTextActive: { color: '#1A1423', fontWeight: '800' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  galleryBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 4 },
  shutterInner: { width: '100%', height: '100%', borderRadius: 35, backgroundColor: '#FFFFFF' },
});

export default CameraScannerScreen;
