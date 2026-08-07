import { describe, it, expect } from 'vitest';
import { calculateSuggestedTargets } from './DailyTarget';

describe('calculateSuggestedTargets', () => {
  const male = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'maintain');
  const female = calculateSuggestedTargets(30, 70, 170, 'female', 'moderate', 'maintain');

  it('uses a lower BMR for females (Mifflin-St Jeor)', () => {
    expect(female.calories).toBeLessThan(male.calories);
  });

  it('adjusts calories by goal category', () => {
    const lose = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'lose');
    const gain = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'gain');
    const maintain = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'maintain');
    expect(lose.calories).toBeLessThan(maintain.calories);
    expect(gain.calories).toBeGreaterThan(maintain.calories);
  });

  it('maps extended goals to the right categories', () => {
    const loseFat = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'lose_fat');
    const muscle = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'muscle_up');
    const maintain = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', 'maintain');
    expect(loseFat.calories).toBeLessThan(maintain.calories);
    expect(muscle.calories).toBeGreaterThan(maintain.calories);
  });

  it('macros convert back to approximately the calorie total', () => {
    const goal = calculateSuggestedTargets(25, 65, 165, 'female', 'active', 'gain_weight');
    const fromMacros = Math.round(goal.proteinG * 4 + goal.carbsG * 4 + goal.fatG * 9);
    // Allow rounding slack across the three macros
    expect(Math.abs(fromMacros - goal.calories)).toBeLessThanOrEqual(3);
  });

  it('enforces minimum calorie floors', () => {
    const tinyFemale = calculateSuggestedTargets(80, 40, 150, 'female', 'sedentary', 'lose');
    const tinyMale = calculateSuggestedTargets(80, 45, 155, 'male', 'sedentary', 'lose');
    expect(tinyFemale.calories).toBeGreaterThanOrEqual(1200);
    expect(tinyMale.calories).toBeGreaterThanOrEqual(1500);
  });

  it('sets water from body weight with a 2000 ml floor', () => {
    const big = calculateSuggestedTargets(30, 90, 180, 'male', 'active', 'maintain');
    const small = calculateSuggestedTargets(30, 40, 160, 'female', 'sedentary', 'maintain');
    expect(big.waterMl).toBe(90 * 35);
    expect(small.waterMl).toBe(2000);
  });

  it('returns sane values for every extended goal', () => {
    const goals = ['lose', 'maintain', 'gain', 'lose_fat', 'gain_weight', 'more_energy', 'event_prep', 'muscle_up', 'control_sugar', 'eat_healthier', 'just_track'] as const;
    for (const goal of goals) {
      const t = calculateSuggestedTargets(30, 70, 170, 'male', 'moderate', goal);
      expect(t.calories).toBeGreaterThan(1000);
      expect(t.calories).toBeLessThan(10000);
      expect(t.proteinG).toBeGreaterThan(0);
      expect(t.fatG).toBeGreaterThan(0);
      expect(t.waterMl).toBeGreaterThanOrEqual(2000);
    }
  });
});
