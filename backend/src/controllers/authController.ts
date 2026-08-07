import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { DailyTarget, calculateSuggestedTargets } from '../models/DailyTarget';
import { signToken, invalidateTokenVersionCache } from '../middlewares/auth';
import { isAllowedImageMime } from '../middlewares/upload';
import { isValidDateKey, clampNumber } from '../utils/validation';

const SALT_ROUNDS = 12;

const VALID_ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const VALID_GOALS = [
  'lose', 'maintain', 'gain',
  'lose_fat', 'gain_weight', 'more_energy', 'event_prep',
  'muscle_up', 'control_sugar', 'eat_healthier', 'just_track',
];
const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_UNITS = ['metric', 'imperial'];

// Profile fields that drive target calculation. Only when one of these changes
// do we recompute & persist DailyTargets (so minor edits don't wipe manual tweaks).
const METRIC_KEYS = ['age', 'weightKg', 'heightCm', 'activityLevel', 'gender', 'goal', 'goals'];

/** Clamp suggested targets into the DailyTarget schema bounds. */
function clampSuggestedTargets(suggested: ReturnType<typeof calculateSuggestedTargets>) {
  return {
    calories: clampNumber(Math.round(suggested.calories), 500, 10000),
    proteinG: clampNumber(Math.round(suggested.proteinG), 0, 500),
    carbsG: clampNumber(Math.round(suggested.carbsG), 0, 1000),
    fatG: clampNumber(Math.round(suggested.fatG), 0, 500),
    waterMl: clampNumber(Math.round(suggested.waterMl), 500, 10000),
  };
}

/** Returns an error message string for invalid profile fields, or null. */
function validateProfileFields(profileData: any): string | null {
  const numRange = (v: any, min: number, max: number) =>
    v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);

  if (!numRange(profileData.age, 10, 120)) return 'age must be a number between 10 and 120.';
  if (!numRange(profileData.weightKg, 20, 500)) return 'weightKg must be a number between 20 and 500.';
  if (!numRange(profileData.targetWeightKg, 20, 500)) return 'targetWeightKg must be a number between 20 and 500.';
  if (!numRange(profileData.heightCm, 50, 300)) return 'heightCm must be a number between 50 and 300.';
  if (profileData.activityLevel !== undefined && !VALID_ACTIVITY_LEVELS.includes(profileData.activityLevel)) {
    return `activityLevel must be one of: ${VALID_ACTIVITY_LEVELS.join(', ')}.`;
  }
  if (profileData.goal !== undefined && !VALID_GOALS.includes(profileData.goal)) {
    return `goal must be one of: ${VALID_GOALS.join(', ')}.`;
  }
  if (profileData.gender !== undefined && !VALID_GENDERS.includes(profileData.gender)) {
    return `gender must be one of: ${VALID_GENDERS.join(', ')}.`;
  }
  if (profileData.unitSystem !== undefined && !VALID_UNITS.includes(profileData.unitSystem)) {
    return `unitSystem must be one of: ${VALID_UNITS.join(', ')}.`;
  }
  if (profileData.goals !== undefined) {
    if (
      !Array.isArray(profileData.goals) ||
      profileData.goals.length > 10 ||
      !profileData.goals.every((g: any) => typeof g === 'string' && VALID_GOALS.includes(g))
    ) {
      return `goals must be an array of valid goal values (max 10).`;
    }
  }
  if (
    profileData.streakDays !== undefined &&
    (typeof profileData.streakDays !== 'number' || !Number.isInteger(profileData.streakDays) || profileData.streakDays < 0)
  ) {
    return 'streakDays must be a non-negative whole number.';
  }
  if (profileData.weightHistory !== undefined) {
    if (!Array.isArray(profileData.weightHistory)) return 'weightHistory must be an array.';
    for (const entry of profileData.weightHistory) {
      if (!entry || typeof entry !== 'object') return 'weightHistory entries must be objects.';
      if (typeof entry.weightKg !== 'number' || !Number.isFinite(entry.weightKg) || entry.weightKg < 1 || entry.weightKg > 500) {
        return 'weightHistory weightKg must be a number between 1 and 500.';
      }
      if (typeof entry.date !== 'string' || !isValidDateKey(entry.date)) {
        return 'weightHistory date must be a real YYYY-MM-DD date.';
      }
    }
  }
  return null;
}

// ── Register ─────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      return;
    }

    // Check for existing user
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      isGuest: false,
    });

    // Create default targets
    await DailyTarget.create({
      userId: user._id,
      calories: 2000,
      proteinG: 150,
      carbsG: 225,
      fatG: 65,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      isGuest: false,
      tokenVersion: user.tokenVersion || 0,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isGuest: false,
        onboardingComplete: user.onboardingComplete,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.isGuest) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      isGuest: false,
      tokenVersion: user.tokenVersion || 0,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isGuest: false,
        onboardingComplete: user.onboardingComplete,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

// ── Guest Login ───────────────────────────────────────────────────────────────
export const guestLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Create a temporary guest user with a unique email
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const guestEmail = `${guestId}@guest.foodlens.local`;

    const user = await User.create({
      name: 'Guest',
      email: guestEmail,
      passwordHash: await bcrypt.hash(guestId, 4), // fast hash for guest
      isGuest: true,
      onboardingComplete: true,
      profile: { unitSystem: 'metric' },
    });

    // Default targets for guest
    await DailyTarget.create({
      userId: user._id,
      calories: 2000,
      proteinG: 150,
      carbsG: 225,
      fatG: 65,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: guestEmail,
      isGuest: true,
      tokenVersion: user.tokenVersion || 0,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: 'Guest',
        email: null,
        isGuest: true,
        onboardingComplete: true,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error('[Auth] Guest login error:', err);
    res.status(500).json({ success: false, error: 'Failed to start guest session.' });
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile.' });
  }
};

// ── Update Profile ────────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, profile, onboardingComplete, ...rootProfileFields } = req.body;
    const userId = req.user!.userId;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Name cannot be empty.' });
        return;
      }
      if (name.trim().length > 80) {
        res.status(400).json({ success: false, error: 'Name must be 80 characters or fewer.' });
        return;
      }
      user.name = name.trim();
    }
    if (typeof onboardingComplete === 'boolean') user.onboardingComplete = onboardingComplete;

    // Merge profile fields whether passed as nested { profile: {...} } or root fields
    const profileData = profile || (Object.keys(rootProfileFields).length > 0 ? rootProfileFields : null);

    if (profileData) {
      if (typeof profileData !== 'object' || Array.isArray(profileData)) {
        res.status(400).json({ success: false, error: 'profile must be an object.' });
        return;
      }
      const validationError = validateProfileFields(profileData);
      if (validationError) {
        res.status(400).json({ success: false, error: validationError });
        return;
      }
      const current = JSON.parse(JSON.stringify(user.profile || {}));
      user.profile = {
        ...current,
        ...profileData,
        ...(profileData.goals !== undefined ? { goals: profileData.goals } : {}),
      };
    }

    await user.save();

    // Only recompute & persist targets when a metric that drives the
    // calculation actually changed — otherwise a minor edit (e.g. a name or
    // avatar change) would silently overwrite the user's manually tuned targets.
    const metricChanged = !!profileData && METRIC_KEYS.some((key) => profileData[key] !== undefined);

    // Calculate personalised targets based on user metrics (1 to 8 onboarding steps)
    const p = user.profile;
    const effectiveAge = p.age || 25;
    const effectiveWeight = p.weightKg || 70;
    const effectiveHeight = p.heightCm || 170;
    const effectiveActivity = p.activityLevel || 'moderate';
    const effectiveGender = p.gender || 'male';
    const effectiveGoal = (p.goals && p.goals.length > 0 ? p.goals[0] : p.goal) || 'maintain';

    const suggestedTargets = clampSuggestedTargets(
      calculateSuggestedTargets(
        effectiveAge,
        effectiveWeight,
        effectiveHeight,
        effectiveGender as any,
        effectiveActivity as any,
        effectiveGoal as any
      )
    );

    // Persist calculated targets directly to MongoDB daily_targets collection —
    // only when the metrics behind them changed.
    if (metricChanged) {
      await DailyTarget.findOneAndUpdate(
        { userId: user._id },
        suggestedTargets,
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      user: { ...user.toObject(), passwordHash: undefined },
      suggestedTargets,
    });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
};

// ── Convert Guest to Full Account ─────────────────────────────────────────────
export const convertGuest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user!.userId;

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: userId } });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.findByIdAndUpdate(
      userId,
      {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        isGuest: false,
        // Bump version so the leaked guest-account token is immediately revoked.
        $inc: { tokenVersion: 1 },
      },
      { new: true, select: '-passwordHash' }
    );

    // The auth middleware caches tokenVersion — drop the stale entry so the
    // old guest token is rejected immediately rather than after the cache TTL.
    invalidateTokenVersionCache(userId);

    if (!user) {
      res.status(404).json({ success: false, error: 'Session not found.' });
      return;
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      isGuest: false,
      tokenVersion: user.tokenVersion,
    });
    res.json({ success: true, token, user });
  } catch (err) {
    console.error('[Auth] Convert guest error:', err);
    res.status(500).json({ success: false, error: 'Failed to create account.' });
  }
};

// ── Upload Avatar ─────────────────────────────────────────────────────────────
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    let buffer: Buffer | undefined;
    let mimeType = 'image/jpeg';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body?.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      mimeType = req.body.mimeType || 'image/jpeg';
    }

    if (!buffer) {
      res.status(400).json({ success: false, error: 'No image provided.' });
      return;
    }

    if (!isAllowedImageMime(mimeType)) {
      res.status(415).json({ success: false, error: 'Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.' });
      return;
    }

    const { uploadProfileImage } = await import('../services/cloudinaryService');
    const avatarUrl = await uploadProfileImage(buffer, mimeType);

    if (!avatarUrl) {
      res.status(500).json({ success: false, error: 'Failed to upload avatar. Check Cloudinary credentials.' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 'profile.avatarUrl': avatarUrl },
      { new: true, select: '-passwordHash' }
    );

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({ success: true, avatarUrl, user });
  } catch (err) {
    console.error('[Auth] Upload avatar error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload avatar.' });
  }
};
