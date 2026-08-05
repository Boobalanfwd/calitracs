import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';

interface Props {
  visible: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<Props> = ({ visible, message = 'Analyzing your food...' }) => {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.sub}>Powered by Gemini 2.5 Flash</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 4,
  },
  sub: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default LoadingOverlay;
