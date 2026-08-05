/**
 * SkeletonTransition — Zero-glitch crossfade between skeleton and real content.
 *
 * PROBLEM this solves:
 *   When `if (loading) return <Skeleton>` flips to the real screen, React unmounts
 *   the skeleton and mounts the real tree at the same frame → hard visual pop.
 *
 * HOW it works:
 *   Both the real content (children) AND the skeleton are always mounted.
 *   The skeleton sits in an absoluteFill overlay.
 *   When `isLoading` becomes false → skeleton fades out (opacity 1→0) while
 *   the content below fades in (opacity 0→1) at the same time.
 *   This creates a professional Hollywood-style dissolve with zero layout shift.
 *
 * USAGE:
 *   <SkeletonTransition
 *     isLoading={isLoadingLog && !todayLog}
 *     skeleton={<ScreenLoader variant="dashboard" />}
 *   >
 *     {/* real screen content here * /}
 *   </SkeletonTransition>
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface Props {
  /** While true the skeleton covers the content. When it flips to false, crossfade begins. */
  isLoading: boolean;
  /** The skeleton element to show (e.g. <ScreenLoader variant="dashboard" />) */
  skeleton: React.ReactNode;
  children: React.ReactNode;
  /** Duration of the crossfade in ms. Default 420. */
  duration?: number;
}

const SkeletonTransition: React.FC<Props> = ({
  isLoading,
  skeleton,
  children,
  duration = 420,
}) => {
  // Controls the content fade-in
  const contentOpacity = useRef(new Animated.Value(isLoading ? 0 : 1)).current;
  // Controls the skeleton fade-out
  const skeletonOpacity = useRef(new Animated.Value(isLoading ? 1 : 0)).current;

  // Keep skeleton mounted until fade-out finishes so it doesn't pop away
  const [skeletonVisible, setSkeletonVisible] = useState(isLoading);

  // Track previous isLoading to detect the loading→done transition
  const wasLoading = useRef(isLoading);

  useEffect(() => {
    const justFinishedLoading = wasLoading.current === true && isLoading === false;
    wasLoading.current = isLoading;

    if (justFinishedLoading) {
      // Run crossfade: content fades in, skeleton fades out simultaneously
      setSkeletonVisible(true); // keep it mounted during animation
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Unmount skeleton overlay only after the animation fully completes
        setSkeletonVisible(false);
      });
    }

    if (isLoading) {
      // Reset for next loading cycle (e.g. navigating back in)
      contentOpacity.setValue(0);
      skeletonOpacity.setValue(1);
      setSkeletonVisible(true);
    }
  }, [isLoading]);

  return (
    <View style={styles.root}>
      {/* ── Real content — always mounted, fades in ── */}
      <Animated.View style={[styles.fill, { opacity: contentOpacity }]}>
        {children}
      </Animated.View>

      {/* ── Skeleton overlay — absoluteFill, fades out ── */}
      {skeletonVisible && (
        <Animated.View
          style={[styles.fill, styles.overlay, { opacity: skeletonOpacity }]}
          pointerEvents={isLoading ? 'auto' : 'none'}
        >
          {skeleton}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default SkeletonTransition;
