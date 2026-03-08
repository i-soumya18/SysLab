import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import type { User } from './authService';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  learningPace: 'slow' | 'normal' | 'fast';
  difficultyPreference: 'beginner' | 'intermediate' | 'advanced';
  notifications: {
    email: boolean;
    productUpdates: boolean;
    learningReminders: boolean;
  };
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
}

export class UserService {
  private database: Pool;

  constructor() {
    this.database = getDatabase();
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, first_name, last_name, subscription_tier, created_at, updated_at, last_login
      FROM users
      WHERE id = $1
    `;

    const result = await this.database.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      subscriptionTier: row.subscription_tier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login ?? undefined,
    };
  }

  async updateProfile(user: User, update: UserProfileUpdate): Promise<UserProfile> {
    const nextFirstName = update.firstName ?? user.firstName ?? null;
    const nextLastName = update.lastName ?? user.lastName ?? null;

    const query = `
      UPDATE users
      SET first_name = $1,
          last_name = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, first_name, last_name, subscription_tier, created_at, updated_at, last_login
    `;

    const result = await this.database.query(query, [nextFirstName, nextLastName, user.id]);
    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      subscriptionTier: row.subscription_tier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login ?? undefined,
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const query = `
      SELECT preferences
      FROM user_preferences
      WHERE user_id = $1
    `;

    const result = await this.database.query(query, [userId]);

    if (result.rows.length === 0) {
      return this.getDefaultPreferences();
    }

    const stored = result.rows[0].preferences as Partial<UserPreferences> | null;
    return {
      ...this.getDefaultPreferences(),
      ...stored,
      notifications: {
        ...this.getDefaultPreferences().notifications,
        ...(stored?.notifications ?? {}),
      },
    };
  }

  async updatePreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
    const merged = {
      ...this.getDefaultPreferences(),
      ...preferences,
      notifications: {
        ...this.getDefaultPreferences().notifications,
        ...preferences.notifications,
      },
    };

    const query = `
      INSERT INTO user_preferences (user_id, preferences)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()
      RETURNING preferences
    `;

    const result = await this.database.query(query, [userId, merged]);
    const stored = result.rows[0].preferences as UserPreferences;

    return stored;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      learningPace: 'normal',
      difficultyPreference: 'beginner',
      notifications: {
        email: true,
        productUpdates: true,
        learningReminders: true,
      },
    };
  }
}
