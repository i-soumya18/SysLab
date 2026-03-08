import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { UserService, type UserPreferences, type UserProfileUpdate } from '../services/userService';

const router = Router();
const userService = new UserService();

const profileUpdateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

const preferencesSchema: z.ZodType<UserPreferences> = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  learningPace: z.enum(['slow', 'normal', 'fast']),
  difficultyPreference: z.enum(['beginner', 'intermediate', 'advanced']),
  notifications: z.object({
    email: z.boolean(),
    productUpdates: z.boolean(),
    learningReminders: z.boolean(),
  }),
});

router.get('/me', authenticateToken, async (request: Request, response: Response) => {
  try {
    if (!request.user) {
      response.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You need to be signed in to view your profile.',
        },
      });
      return;
    }

    const profile = await userService.getProfile(request.user.id);

    if (!profile) {
      response.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'No profile data was found for this account. Try signing out and back in.',
        },
      });
      return;
    }

    response.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching user profile:', error);
    response.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_ERROR',
        message: 'We could not load your profile. Please try again, and contact support if the issue persists.',
      },
    });
  }
});

router.put('/me', authenticateToken, async (request: Request, response: Response) => {
  try {
    if (!request.user) {
      response.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You need to be signed in to update your profile.',
        },
      });
      return;
    }

    const validation = profileUpdateSchema.safeParse(request.body);

    if (!validation.success) {
      response.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PROFILE_DATA',
          message: 'Some profile fields are invalid. Please fix the highlighted values and try again.',
          details: validation.error.issues,
        },
      });
      return;
    }

    const update: UserProfileUpdate = validation.data;
    const updatedProfile = await userService.updateProfile(request.user, update);

    response.json({
      success: true,
      data: updatedProfile,
      message: 'Your profile has been updated successfully.',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating user profile:', error);
    response.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_ERROR',
        message: 'We could not save your profile changes. Please try again in a moment.',
      },
    });
  }
});

router.get('/me/preferences', authenticateToken, async (request: Request, response: Response) => {
  try {
    if (!request.user) {
      response.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You need to be signed in to view your preferences.',
        },
      });
      return;
    }

    const preferences = await userService.getPreferences(request.user.id);

    response.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching user preferences:', error);
    response.status(500).json({
      success: false,
      error: {
        code: 'PREFERENCES_FETCH_ERROR',
        message: 'We could not load your preferences. Please refresh the page and try again.',
      },
    });
  }
});

router.put('/me/preferences', authenticateToken, async (request: Request, response: Response) => {
  try {
    if (!request.user) {
      response.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You need to be signed in to update your preferences.',
        },
      });
      return;
    }

    const validation = preferencesSchema.safeParse(request.body);

    if (!validation.success) {
      response.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PREFERENCES',
          message: 'Some preference values are invalid. Adjust them and try saving again.',
          details: validation.error.issues,
        },
      });
      return;
    }

    const nextPreferences = await userService.updatePreferences(request.user.id, validation.data);

    response.json({
      success: true,
      data: nextPreferences,
      message: 'Your preferences have been saved.',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating user preferences:', error);
    response.status(500).json({
      success: false,
      error: {
        code: 'PREFERENCES_UPDATE_ERROR',
        message: 'We could not save your preferences. Please try again, and contact support if it keeps failing.',
      },
    });
  }
});

export default router;
