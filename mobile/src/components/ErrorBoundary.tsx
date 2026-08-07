import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  DevSettings,
} from 'react-native';
import { captureClientError } from '../utils/logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * Top-level crash boundary. Without this, any render error from bad API data or
 * a runtime regression blanks the whole app with no message. We render a simple
 * fallback (system fonts only — fonts themselves may be the thing that failed)
 * with a recovery action instead.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Crashed:', error.message || error, info?.componentStack);
    captureClientError(error, 'render', { screen: 'ErrorBoundary' });
  }

  private handleRecover = () => {
    if (__DEV__) {
      DevSettings.reload();
      return;
    }
    // In production, reset the boundary so a transient render error recovers.
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconBadgeText}>!</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Your saved data is safe.
          </Text>
          {this.state.message ? (
            <Text style={styles.errorMessage} numberOfLines={3}>
              {this.state.message}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={this.handleRecover} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{__DEV__ ? 'Reload App' : 'Try Again'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

/**
 * Capture otherwise-silent global JS errors (uncaught exceptions) so they're at
 * least logged in production instead of disappearing.
 */
export const registerGlobalErrorHandlers = (): void => {
  const g = globalThis as any;
  if (g?.ErrorUtils?.setGlobalHandler) {
    g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error('[GlobalError]', isFatal ? 'FATAL:' : '', error?.message || error);
      captureClientError(error, 'global', { fatal: Boolean(isFatal) });
    });
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    maxWidth: 360,
    width: '100%',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconBadgeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#EF4444',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FF6B2C',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
