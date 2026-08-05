import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Platform } from 'react-native';

/**
 * CENTRAL FONT CONFIGURATION
 * 
 * Headline font: Space Grotesk
 * Body / Description font: DM Sans
 */
export const FONTS = {
  heading: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semiBold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  body: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    bold: 'DMSans_700Bold',
  },
};

/**
 * Map of Google Font assets to load via useFonts in root App / AppNavigator
 */
export const FONT_ASSETS = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,

  // Fallback aliases for cross-platform resolution
  'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
  'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
  'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
  'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
  'DMSans-Regular': DMSans_400Regular,
  'DMSans-Medium': DMSans_500Medium,
  'DMSans-Bold': DMSans_700Bold,
};

/**
 * Ready-to-use typography style presets for components and screens
 * Note: On Native (iOS/Android), custom loaded font variants (e.g. SpaceGrotesk_700Bold)
 * ALREADY embed font weights. Omitting duplicate `fontWeight` properties ensures native OS
 * font managers load the exact Google Font instead of falling back to system defaults.
 */
export const FONT_STYLES = {
  // Headline Styles (Space Grotesk)
  h1: { fontFamily: FONTS.heading.bold, fontSize: 28 },
  h2: { fontFamily: FONTS.heading.bold, fontSize: 22 },
  h3: { fontFamily: FONTS.heading.semiBold, fontSize: 18 },
  headingBold: { fontFamily: FONTS.heading.bold },
  headingSemiBold: { fontFamily: FONTS.heading.semiBold },
  headingMedium: { fontFamily: FONTS.heading.medium },
  headingRegular: { fontFamily: FONTS.heading.regular },

  // Body Styles (DM Sans)
  bodyBold: { fontFamily: FONTS.body.bold },
  bodyMedium: { fontFamily: FONTS.body.medium },
  bodyRegular: { fontFamily: FONTS.body.regular },
  caption: { fontFamily: FONTS.body.regular, fontSize: 12 },
};
