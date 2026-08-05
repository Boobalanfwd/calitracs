import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { FoodItem } from '../types';

interface Props {
  food: FoodItem;
  variant?: 'primary' | 'secondary';
}

const FoodCard: React.FC<Props> = ({ food, variant = 'secondary' }) => {
  const confidencePct = Math.round(food.confidence * 100);

  return (
    <View style={[styles.card, variant === 'primary' && styles.primaryCard]}>
      <View style={styles.row}>
        <Text style={styles.name}>{food.name}</Text>
        <Text
          style={[
            styles.confidence,
            confidencePct >= 85
              ? styles.highConf
              : confidencePct >= 65
              ? styles.medConf
              : styles.lowConf,
          ]}
        >
          {confidencePct}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  primaryCard: {
    borderColor: 'rgba(255, 107, 53, 0.2)',
    backgroundColor: 'rgba(255, 107, 53, 0.04)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  confidence: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  highConf: { color: '#22C55E' },
  medConf: { color: '#F59E0B' },
  lowConf: { color: '#EF4444' },
});

export default FoodCard;
