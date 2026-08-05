import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  navigation: any;
}

const CHOICES = [
  { emoji: '📷', title: 'Take a Photo', subtitle: 'Use camera to snap your food', screen: 'Home', color: '#FF6B35' },
  { emoji: '🖼️', title: 'Choose from Gallery', subtitle: 'Pick an existing photo', screen: 'Home', color: '#6366F1', gallery: true },
  { emoji: '✏️', title: 'Enter Manually', subtitle: 'Type food name and macros', screen: 'ManualEntry', color: '#22C55E' },
];

const AddFoodScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Text style={styles.title}>Add Food</Text>
        <Text style={styles.subtitle}>How would you like to log your meal?</Text>
      </View>
      <View style={styles.choices}>
        {CHOICES.map((c, i) => (
          <TouchableOpacity
            key={i}
            style={styles.card}
            onPress={() => navigation.navigate(c.screen, c.gallery ? { openGallery: true } : {})}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: `${c.color}18` }]}>
              <Text style={styles.icon}>{c.emoji}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardSub}>{c.subtitle}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 6 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 15, color: '#6B7280' },
  choices: { paddingHorizontal: 20, gap: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FAFAFA', borderRadius: 20, padding: 18,
    borderWidth: 1.5, borderColor: '#F3F4F6',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  cardSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  arrow: { fontSize: 22, color: '#D1D5DB', fontWeight: '300' },
});

export default AddFoodScreen;
