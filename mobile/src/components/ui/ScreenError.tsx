/**
 * ScreenError — Animated themed error state for all screens.
 *
 * Usage:
 *   <ScreenError onRetry={refetchFn} />
 *   <ScreenError message="Could not load data" onRetry={fn} />
 *   <ScreenError variant="network" onRetry={fn} />
 *   <ScreenError variant="server" onRetry={fn} />
 *   <ScreenError variant="notfound" />
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { FONTS } from '../../theme/fonts';
import { WifiOff, ServerCrash, SearchX, AlertCircle, RefreshCw } from 'lucide-react-native';

type ErrorVariant = 'network' | 'server' | 'notfound' | 'generic';

const VARIANT_CONFIG: Record<ErrorVariant, { icon: React.FC<any>; title: string; description: string; iconColor: string }> = {
  network: {
    icon: WifiOff,
    title: 'No Connection',
    description: 'Check your internet connection and try again.',
    iconColor: '#F59E0B',
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    description: 'Something went wrong on our end. We\'re on it!',
    iconColor: '#EF4444',
  },
  notfound: {
    icon: SearchX,
    title: 'Nothing Here',
    description: 'We couldn\'t find what you\'re looking for.',
    iconColor: '#8B5CF6',
  },
  generic: {
    icon: AlertCircle,
    title: 'Oops!',
    description: 'Something went wrong. Please try again.',
    iconColor: '#EF4444',
  },
};

interface Props {
  message?: string;
  title?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  retryLabel?: string;
}

const ScreenError: React.FC<Props> = ({
  message,
  title,
  variant = 'generic',
  onRetry,
  retryLabel = 'Try Again',
}) => {
  const { theme } = useTheme();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.icon;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Icon shake for error emphasis
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -7, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 7, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }, 450);
  }, []);

  const handleRetry = () => {
    // Button press animation
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 0.93, useNativeDriver: true, speed: 30 }),
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start(() => onRetry?.());
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        { backgroundColor: theme.background, opacity: fadeAnim },
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Icon */}
        <Animated.View
          style={[
            styles.iconBubble,
            {
              backgroundColor: `${config.iconColor}18`,
              transform: [{ translateX: shakeAnim }],
            },
          ]}
        >
          <IconComponent size={36} color={config.iconColor} strokeWidth={1.8} />
        </Animated.View>

        {/* Text */}
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: FONTS.heading.bold }]}>
          {title ?? config.title}
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary, fontFamily: FONTS.body.regular }]}>
          {message ?? config.description}
        </Text>

        {/* Retry button */}
        {onRetry && (
          <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: theme.primary }]}
              onPress={handleRetry}
              activeOpacity={0.85}
            >
              <RefreshCw size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={[styles.retryBtnText, { fontFamily: FONTS.heading.semiBold }]}>
                {retryLabel}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 28,
    paddingVertical: 44,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  iconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default ScreenError;
