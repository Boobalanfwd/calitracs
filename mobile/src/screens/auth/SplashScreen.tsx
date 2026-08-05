import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StatusBar, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'> };

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { isLoading, isAuthenticated, user } = useAuth();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        (navigation as any).replace('Login');
      }, 1200);
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Calitracs</Text>
        <Text style={styles.tagline}>AI-Powered Calorie Tracking</Text>
      </Animated.View>
      <Text style={styles.version}>v2.0 · Powered by Gemini</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { alignItems: 'center', gap: 12 },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  appName: { fontSize: 36, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: '#FF6B00', fontWeight: '600' },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default SplashScreen;
