import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FoodLog, FoodEntry, MealType, NutritionSource, PortionUnit } from '../types';
import { API } from '../services/api';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';

interface AddEntryParams {
  name: string;
  meal: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionUnit?: PortionUnit;
  portionQuantity?: number;
  weightGramsOrMl?: number;
  portionG?: number;
  portionDescription?: string;
  isLiquid?: boolean;
  source: 'ai' | 'manual';
  nutritionSource: NutritionSource;
  confidence?: number;
  imageUrl?: string;   // Cloudinary food photo URL
  date?: string;
}

interface LogContextValue {
  todayLog: FoodLog | null;
  selectedDateStr: string;
  isLoadingLog: boolean;
  loadTodayLog: (dateStr?: string) => Promise<void>;
  addEntry: (params: AddEntryParams) => Promise<void>;
  deleteEntry: (entryId: string, date?: string) => Promise<void>;
  updateWaterIntake: (amountMl: number, mode?: 'add' | 'set', date?: string) => Promise<void>;
  deleteWaterEntry: (waterId: string, date?: string) => Promise<void>;
  getEntriesByMeal: (meal: MealType) => FoodEntry[];
}

const LogContext = createContext<LogContextValue | null>(null);

export const useLog = (): LogContextValue => {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLog must be used within LogProvider');
  return ctx;
};

const emptyLog: FoodLog = {
  date: '',
  entries: [],
  waterIntakeMl: 0,
  waterLogs: [],
  totalCalories: 0,
  totalProteinG: 0,
  totalCarbsG: 0,
  totalFatG: 0,
};

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, targets } = useAuth();
  const [todayLog, setTodayLog] = useState<FoodLog | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoadingLog, setIsLoadingLog] = useState(false);

  useEffect(() => {
    if (!token) {
      setTodayLog(null);
    }
  }, [token]);

  const loadTodayLog = useCallback(async (dateParam?: string) => {
    const targetDate = dateParam || selectedDateStr || new Date().toISOString().split('T')[0];
    setSelectedDateStr(targetDate);
    if (!token) return;
    setIsLoadingLog(true);
    try {
      const data = await API.getLog(token, targetDate);
      setTodayLog(data.log);
    } catch (err) {
      console.warn('[LogContext] Failed to load log for date', targetDate, err);
      setTodayLog({ ...emptyLog, date: targetDate });
    } finally {
      setIsLoadingLog(false);
    }
  }, [token, selectedDateStr]);

  const addEntry = useCallback(async (params: AddEntryParams) => {
    if (!token) return;
    const targetDate = params.date || selectedDateStr;
    const data = await API.addLogEntry(token, { ...params, date: targetDate });
    setTodayLog(data.log);

    // Evaluate macro alerts & trigger Expo push notification if target exceeded/lacking
    if (data.log) {
      const targetCal = targets?.calories || 2200;
      const targetProtein = targets?.proteinG || 143;
      const targetCarbs = targets?.carbsG || 359;
      const targetFat = targets?.fatG || 370;

      notificationService.evaluateMacroAlerts({
        consumedCalories: data.log.totalCalories || 0,
        targetCalories: targetCal,
        proteinG: data.log.totalProteinG || 0,
        targetProteinG: targetProtein,
        carbsG: data.log.totalCarbsG || 0,
        targetCarbsG: targetCarbs,
        fatG: data.log.totalFatG || 0,
        targetFatG: targetFat,
      });
    }
  }, [token, selectedDateStr, targets]);

  const deleteEntry = useCallback(async (entryId: string, date?: string) => {
    if (!token) return;
    const targetDate = date || selectedDateStr;
    const data = await API.deleteLogEntry(token, entryId, targetDate);
    setTodayLog(data.log);
  }, [token, selectedDateStr]);

  const updateWaterIntake = useCallback(async (amountMl: number, mode: 'add' | 'set' = 'add', date?: string) => {
    if (!token) return;
    const targetDate = date || selectedDateStr;
    // Optimistic UI update
    setTodayLog((prev) => {
      if (!prev) return prev;
      const currentWater = prev.waterIntakeMl || 0;
      const newWater = mode === 'set' ? amountMl : currentWater + amountMl;
      return { ...prev, waterIntakeMl: newWater };
    });
    try {
      const data = await API.updateWaterIntake(token, { amountMl, mode, date: targetDate });
      setTodayLog(data.log);

      if (data.log) {
        notificationService.evaluateWaterAlert(data.log.waterIntakeMl || 0, 2500);
      }
    } catch (err) {
      console.warn('[LogContext] Failed to update water intake', err);
      loadTodayLog(targetDate); // Rollback on error
    }
  }, [token, selectedDateStr, loadTodayLog]);

  const deleteWaterEntry = useCallback(async (waterId: string, date?: string) => {
    if (!token) return;
    const targetDate = date || selectedDateStr;
    try {
      const data = await API.deleteWaterEntry(token, waterId, targetDate);
      setTodayLog(data.log);
    } catch (err) {
      console.warn('[LogContext] Failed to delete water entry', err);
    }
  }, [token, selectedDateStr]);

  const getEntriesByMeal = useCallback((meal: MealType): FoodEntry[] => {
    return (todayLog?.entries ?? []).filter((e) => e.meal === meal);
  }, [todayLog]);

  return (
    <LogContext.Provider value={{
      todayLog, selectedDateStr, isLoadingLog,
      loadTodayLog, addEntry, deleteEntry, updateWaterIntake, deleteWaterEntry, getEntriesByMeal,
    }}>
      {children}
    </LogContext.Provider>
  );
};

