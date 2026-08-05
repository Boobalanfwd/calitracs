/**
 * ScreenEmpty — Animated themed empty / default state for all screens.
 *
 * Usage:
 *   <ScreenEmpty />
 *   <ScreenEmpty variant="food" onAction={() => navigation.navigate('CameraScanner')} />
 *   <ScreenEmpty variant="calendar" />
 *   <ScreenEmpty title="No logs yet" description="Start adding food!" onAction={fn} actionLabel="Add Food" />
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
import { UtensilsCrossed, CalendarX2, BarChart3, Inbox, Plus } from 'lucide-react-native';

type EmptyVariant = 'food' | 'calendar' | 'analytics' | 'default';

const VARIANT_CONFIG: Record<EmptyVariant, { icon: React.FC<any>; title: string; description: string; actionLabel?: string }> = {
  food: {
    icon: UtensilsCrossed,
    title: 'No Food Logged',
    description: 'Start tracking your meals to hit your daily nutrition goals.',
    actionLabel: 'Log Your First Meal',
  },
  calendar: {
    icon: CalendarX2,
    title: 'No Activity',
    description: 'No food logs were found for this day. Start adding meals!',
    actionLabel: 'Add a Meal',
  },
  analytics: {
    icon: BarChart3,
    title: 'No Data Yet',
    description: 'Log your meals consistently to unlock nutrition insights and trends.',
  },
  default: {
    icon: Inbox,
    title: 'Nothing Here',
    description: 'Looks like this section is empty. Add something to get started.',
    actionLabel: 'Get Started',
  },
};

interface Props {
  title?: string;
  description?: string;
  variant?: EmptyVariant;
  onAction?: () => void;
  actionLabel?: string;
}

const ScreenEmpty: React.FC<Props> = ({
  title,
  description,
  variant = 'default',
  onAction,
  actionLabel,
}) => {
  const { theme } = useTheme();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.icon;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 45, friction: 8, useNativeDriver: true }),
    ]).start();

    // Gentle float loop on icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleAction = () => {
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 0.93, useNativeDriver: true, speed: 30 }),
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start(() => onAction?.());
  };

  const label = actionLabel ?? config.actionLabel;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { backgroundColor: theme.background, opacity: fadeAnim },
      ]}
    >
      <Animated.View
        style={[
          styles.inner,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Floating icon */}
        <Animated.View
          style={[
            styles.iconBubble,
            {
              backgroundColor: theme.primaryLight,
              transform: [{ translateY: floatAnim }],
            },
          ]}
        >
          <IconComponent size={42} color={theme.primary} strokeWidth={1.6} />
        </Animated.View>

        {/* Text */}
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: FONTS.heading.bold }]}>
          {title ?? config.title}
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary, fontFamily: FONTS.body.regular }]}>
          {description ?? config.description}
        </Text>

        {/* Optional CTA */}
        {(onAction && label) ? (
          <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
              onPress={handleAction}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { fontFamily: FONTS.heading.semiBold }]}>
                {label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  inner: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 340,
  },
  iconBubble: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  actionBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default ScreenEmpty;
