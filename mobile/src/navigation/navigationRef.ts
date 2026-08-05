import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Module-level navigation ref to avoid require cycles between AppNavigator and hooks.
 */
export const navigationRef = createNavigationContainerRef<any>();
