import { AnalysisResult, User, DailyTarget, FoodLog, CalendarDay, MealType, NutritionSource } from '../types';
import { ENDPOINTS, API_BASE_URL } from '../config';

// Helper to convert local image URI to Base64 in React Native
const imageUriToBase64 = async (uri: string): Promise<string> => {
  if (uri.startsWith('data:')) {
    return uri;
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
};

export const API = {
  // ── Food Analysis ───────────────────────────────────────────────────────────
  analyzeFoodImage: async (imageUri: string, base64Raw?: string): Promise<AnalysisResult> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout for AI + nutrition lookup

    try {
      let base64Data: string;
      if (base64Raw) {
        base64Data = base64Raw.startsWith('data:')
          ? base64Raw
          : `data:image/jpeg;base64,${base64Raw}`;
      } else {
        base64Data = await imageUriToBase64(imageUri);
      }

      const uriParts = imageUri.split('/');
      const rawFilename = uriParts[uriParts.length - 1] ?? 'photo';
      const filename = decodeURIComponent(rawFilename);
      const dotIndex = filename.lastIndexOf('.');
      const extension = dotIndex !== -1 ? filename.slice(dotIndex + 1).toLowerCase() : 'jpg';

      const mimeTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
      };
      const mimeType = mimeTypeMap[extension] || 'image/jpeg';

      const response = await fetch(ENDPOINTS.analyzeFood, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          fileName: `food_photo_${Date.now()}.${extension}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data: AnalysisResult = await response.json();

      if (!response.ok) {
        return {
          success: false,
          is_food: false,
          foods: [],
          error: data.error || `Server error (${response.status}). Please try again.`,
        };
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error as Error;

      if (err.name === 'AbortError') {
        return {
          success: false,
          is_food: false,
          foods: [],
          error: 'Request timed out. Please check your connection and try again.',
        };
      }

      if (err.message.includes('Network request failed') || err.message.includes('fetch')) {
        return {
          success: false,
          is_food: false,
          foods: [],
          error: 'Cannot connect to server. Make sure the backend is running.',
        };
      }

      return {
        success: false,
        is_food: false,
        foods: [],
        error: err.message || 'Something went wrong. Please try again.',
      };
    }
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  register: async (name: string, email: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed');
    return data;
  },

  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');
    return data;
  },

  guestLogin: async (): Promise<{ token: string; user: User }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Guest login failed');
    return data;
  },

  getMe: async (token: string): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch user profile');
    return data.user;
  },

  updateProfile: async (token: string, profileData: any): Promise<{ user: User; suggestedTargets?: DailyTarget }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update profile');
    return data;
  },

  convertGuest: async (token: string, name: string, email: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/convert-guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to convert guest session');
    return data;
  },

  // ── Targets ─────────────────────────────────────────────────────────────────
  getTargets: async (token: string): Promise<DailyTarget> => {
    const res = await fetch(`${API_BASE_URL}/api/targets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch targets');
    return data.targets;
  },

  updateTargets: async (token: string, targets: DailyTarget): Promise<DailyTarget> => {
    const res = await fetch(`${API_BASE_URL}/api/targets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(targets),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update targets');
    return data.targets;
  },

  // ── Food Logs ───────────────────────────────────────────────────────────────
  getLog: async (token: string, date: string): Promise<{ date: string; log: FoodLog; targets: DailyTarget }> => {
    const res = await fetch(`${API_BASE_URL}/api/logs/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch log');
    return data;
  },

  addLogEntry: async (
    token: string,
    entry: {
      name: string;
      meal: MealType;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      portionG?: number;
      portionDescription?: string;
      portionUnit?: string;
      portionQuantity?: number;
      weightGramsOrMl?: number;
      isLiquid?: boolean;
      source: 'ai' | 'manual';
      nutritionSource: NutritionSource;
      confidence?: number;
      imageUrl?: string;
      date?: string;
    }
  ): Promise<{ success: boolean; log: FoodLog; entryId: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/logs/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add food entry');
    return data;
  },

  deleteLogEntry: async (token: string, entryId: string, date?: string): Promise<{ success: boolean; log: FoodLog }> => {
    const url = date
      ? `${API_BASE_URL}/api/logs/entry/${entryId}?date=${date}`
      : `${API_BASE_URL}/api/logs/entry/${entryId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete entry');
    return data;
  },

  updateWaterIntake: async (
    token: string,
    params: { amountMl: number; date?: string; mode?: 'add' | 'set' }
  ): Promise<{ success: boolean; log: FoodLog }> => {
    const res = await fetch(`${API_BASE_URL}/api/logs/water`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update water intake');
    return data;
  },

  deleteWaterEntry: async (token: string, waterId: string, date?: string): Promise<{ success: boolean; log: FoodLog }> => {
    const url = date
      ? `${API_BASE_URL}/api/logs/water/${waterId}?date=${date}`
      : `${API_BASE_URL}/api/logs/water/${waterId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete water entry');
    return data;
  },

  getCalendarMonth: async (token: string, year: number, month: number): Promise<{ days: CalendarDay[]; targetCalories: number }> => {
    const res = await fetch(`${API_BASE_URL}/api/logs/calendar/${year}/${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch calendar data');
    return data;
  },

  // ── Quick Text Lookup (Auto-calculate macros for names + grams/pieces) ─────
  quickTextLookup: async (items: Array<{ name: string; quantity?: string; unit?: string }> | string) => {
    const res = await fetch(`${API_BASE_URL}/api/food/quick-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to auto-calculate nutrition');
    return data;
  },

  // ── Barcode Lookup ────────────────────────────────────────────────────────
  barcodeLookup: async (barcode: string) => {
    const res = await fetch(`${API_BASE_URL}/api/food/barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Barcode item not found');
    return data.product;
  },

  // ── Nutrition Label OCR ───────────────────────────────────────────────────
  analyzeNutritionLabel: async (imageUri: string, base64Raw?: string) => {
    let base64Data: string;
    if (base64Raw) {
      base64Data = base64Raw.startsWith('data:') ? base64Raw : `data:image/jpeg;base64,${base64Raw}`;
    } else {
      base64Data = await imageUriToBase64(imageUri);
    }
    const res = await fetch(`${API_BASE_URL}/api/food/analyze-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to read nutrition label');
    return data.item;
  },

  // ── Step 1: Detect Food Item Names ONLY (High-Precision 3-Step Pipeline) ─────
  detectFoodNames: async (imageUri: string, base64Raw?: string) => {
    let base64Data: string;
    if (base64Raw) {
      base64Data = base64Raw.startsWith('data:') ? base64Raw : `data:image/jpeg;base64,${base64Raw}`;
    } else {
      base64Data = await imageUriToBase64(imageUri);
    }
    const res = await fetch(`${API_BASE_URL}/api/food/detect-names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to detect food items');
    return data;
  },

  // ── Cloudinary Food Image Upload ───────────────────────────────────────────
  uploadFoodImage: async (imageUri: string, base64Raw?: string): Promise<string | null> => {
    try {
      let base64Data: string;
      if (base64Raw) {
        base64Data = base64Raw.startsWith('data:') ? base64Raw : `data:image/jpeg;base64,${base64Raw}`;
      } else {
        base64Data = await imageUriToBase64(imageUri);
      }
      const res = await fetch(`${API_BASE_URL}/api/food/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data }),
      });
      const data = await res.json();
      return data.imageUrl || null;
    } catch (e) {
      console.warn('[API uploadFoodImage Error]:', e);
      return null;
    }
  },

  // ── Cloudinary Profile Image Upload ──────────────────────────────────────
  uploadProfileImage: async (token: string, imageUri: string): Promise<string | null> => {
    try {
      const base64Data = await imageUriToBase64(imageUri);
      const res = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
      return data.avatarUrl || null;
    } catch (e: any) {
      console.warn('[API uploadProfileImage Error]:', e.message || e);
      return null;
    }
  },

  // ── Portion Calculation Engine ────────────────────────────────────────────
  convertPortion: async (
    baseNutrition: { caloriesPer100gOrMl: number; proteinGPer100gOrMl: number; carbsGPer100gOrMl: number; fatGPer100gOrMl: number; isLiquid?: boolean },
    unit: string,
    quantity: number,
    customEquivGramsOrMl?: number
  ) => {
    const res = await fetch(`${API_BASE_URL}/api/food/convert-portion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseNutrition, unit, quantity, customEquivGramsOrMl }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to convert portion');
    return data.result;
  },
};



// Backwards compatibility export
export const analyzeFoodImage = API.analyzeFoodImage;
