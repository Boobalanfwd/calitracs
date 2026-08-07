import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { FoodLog, FoodEntry, MealType, NutritionSource, PortionUnit } from '../types';
import { API } from '../services/api';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import { todayDateKey } from '../utils/dates';

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
  loadError: string | null;
  loadTodayLog: (dateStr?: string) => Promise<void>;
  addEntry: (params: AddEntryParams) => Promise<void>;
  deleteEntry: (entryId: string, date?: string) => Promise<void>;
  updateWaterIntake: (amountMl: number, mode?: 'add' | 'set', date?: string) => Promise<boolean>;
  deleteWaterEntry: (waterId: string, date?: string) => Promise<boolean>;
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
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayDateKey());
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestRequestedDateRef = React.useRef<string>('');
  // Guards against duplicate concurrent requests for the same date (e.g. the
  // provider's initial load racing a screen's focus/date-switch reload).
  const inFlightDateRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTodayLog(null);
    }
  }, [token]);

  const loadTodayLog = useCallback(async (dateParam?: string) => {
    const targetDate = dateParam || selectedDateStr || todayDateKey();
    latestRequestedDateRef.current = targetDate;
    setSelectedDateStr(targetDate);
    if (!token) return;
    if (inFlightDateRef.current === targetDate) return;
    inFlightDateRef.current = targetDate;
    setLoadError(null);
    setIsLoadingLog(true);
    try {
      const data = await API.getLog(token, targetDate);
      if (latestRequestedDateRef.current === targetDate) {
        setTodayLog(data.log);
      }

      // Check for long gap in water intake if viewing today's log
      const todayStr = todayDateKey();
      if (data.log && targetDate === todayStr) {
        notificationService.checkWaterGapReminder(data.log.waterIntakeMl || 0, targets?.waterMl || 2000);
      }
    } catch (err: any) {
      console.warn('[LogContext] Failed to load log for date', targetDate, err);
      if (latestRequestedDateRef.current === targetDate) {
        // Keep any already-loaded data on screen; surface the failure instead of
        // silently swapping it for an empty log (which reads as "nothing logged").
        setTodayLog((prev) => prev ?? { ...emptyLog, date: targetDate });
        setLoadError(err?.message || 'Could not load your food log. Please try again.');
      }
    } finally {
      if (inFlightDateRef.current === targetDate) {
        inFlightDateRef.current = null;
      }
      if (latestRequestedDateRef.current === targetDate) {
        setIsLoadingLog(false);
      }
    }
  }, [token, selectedDateStr, targets]);

  const addEntry = useCallback(async (params: AddEntryParams) => {
    if (!token) return;
    const targetDate = params.date || selectedDateStr;
    const data = await API.addLogEntry(token, { ...params, date: targetDate });

    // Only swap the on-screen log when the entry belongs to the date currently
    // being viewed; posting to another day must not hijack the UI or fire
    // "today" alerts against the wrong day's totals.
    const isCurrentView = targetDate === selectedDateStr;
    if (isCurrentView) {
      setTodayLog(data.log);
    }

    // Evaluate macro alerts & trigger Expo push notification if target exceeded/lacking
    if (isCurrentView && data.log) {
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

  const updateWaterIntake = useCallback(async (amountMl: number, mode: 'add' | 'set' = 'add', date?: string): Promise<boolean> => {
    if (!token) return false;
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
        notificationService.recordWaterLogged(data.log.waterIntakeMl || 0, targets?.waterMl || 2000);
      }
      return true;
    } catch (err) {
      console.warn('[LogContext] Failed to update water intake', err);
      loadTodayLog(targetDate); // Rollback on error
      return false;
    }
  }, [token, selectedDateStr, loadTodayLog, targets]);

  const deleteWaterEntry = useCallback(async (waterId: string, date?: string): Promise<boolean> => {
    if (!token) return false;
    const targetDate = date || selectedDateStr;
    try {
      const data = await API.deleteWaterEntry(token, waterId, targetDate);
      setTodayLog(data.log);
      return true;
    } catch (err) {
      console.warn('[LogContext] Failed to delete water entry', err);
      return false;
    }
  }, [token, selectedDateStr]);

  const getEntriesByMeal = useCallback((meal: MealType): FoodEntry[] => {
    return (todayLog?.entries ?? []).filter((e) => e.meal === meal);
  }, [todayLog]);

  const contextValue = useMemo<LogContextValue>(() => ({
    todayLog, selectedDateStr, isLoadingLog, loadError,
    loadTodayLog, addEntry, deleteEntry, updateWaterIntake, deleteWaterEntry, getEntriesByMeal,
  }), [todayLog, selectedDateStr, isLoadingLog, loadError, loadTodayLog, addEntry, deleteEntry, updateWaterIntake, deleteWaterEntry, getEntriesByMeal]);

  return (
    <LogContext.Provider value={contextValue}>
      {children}
    </LogContext.Provider>
  );
};

