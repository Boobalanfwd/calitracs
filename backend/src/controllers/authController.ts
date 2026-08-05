import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { DailyTarget, calculateSuggestedTargets } from '../models/DailyTarget';
import { signToken } from '../middlewares/auth';

const SALT_ROUNDS = 12;

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

    const token = signToken({ userId: user._id.toString(), email: user.email, isGuest: false });

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

    const token = signToken({ userId: user._id.toString(), email: user.email, isGuest: false });

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

    const token = signToken({ userId: user._id.toString(), email: guestEmail, isGuest: true });

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

    if (name) user.name = name.trim();
    if (typeof onboardingComplete === 'boolean') user.onboardingComplete = onboardingComplete;

    // Merge profile fields whether passed as nested { profile: {...} } or root fields
    const profileData = profile || (Object.keys(rootProfileFields).length > 0 ? rootProfileFields : null);

    if (profileData) {
      const current = JSON.parse(JSON.stringify(user.profile || {}));
      user.profile = {
        ...current,
        ...profileData,
        ...(profileData.goals !== undefined ? { goals: profileData.goals } : {}),
      };
    }

    await user.save();

    // Calculate accurate personalised targets based on user metrics (1 to 8 onboarding steps)
    const p = user.profile;
    const effectiveAge = p.age || 25;
    const effectiveWeight = p.weightKg || 70;
    const effectiveHeight = p.heightCm || 170;
    const effectiveActivity = p.activityLevel || 'moderate';
    const effectiveGender = p.gender || 'male';
    const effectiveGoal = (p.goals && p.goals.length > 0 ? p.goals[0] : p.goal) || 'maintain';

    const suggestedTargets = calculateSuggestedTargets(
      effectiveAge,
      effectiveWeight,
      effectiveHeight,
      effectiveGender as any,
      effectiveActivity as any,
      effectiveGoal as any
    );

    // Persist calculated targets directly to MongoDB daily_targets collection
    await DailyTarget.findOneAndUpdate(
      { userId: user._id },
      {
        calories: suggestedTargets.calories,
        proteinG: suggestedTargets.proteinG,
        carbsG: suggestedTargets.carbsG,
        fatG: suggestedTargets.fatG,
      },
      { upsert: true, new: true }
    );

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
      },
      { new: true, select: '-passwordHash' }
    );

    if (!user) {
      res.status(404).json({ success: false, error: 'Session not found.' });
      return;
    }

    const token = signToken({ userId: user._id.toString(), email: user.email, isGuest: false });
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
