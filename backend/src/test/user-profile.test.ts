/**
 * User Profile and Preferences Tests
 * Tests for SRS FR-1: User profile management and preferences
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { setupDatabase } from '../config/database';
import { UserService } from '../services/userService';

let testDb: Pool;
let userService: UserService;
let testUserId: string;

beforeAll(async () => {
  await setupDatabase();
  
  testDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'system_design_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  userService = new UserService();
});

afterAll(async () => {
  if (testDb) {
    await testDb.end();
  }
});

beforeEach(async () => {
  // Clean up test data
  await testDb.query('DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%profile-test%@example.com\')');
  await testDb.query('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%profile-test%@example.com\')');
  await testDb.query('DELETE FROM users WHERE email LIKE \'%profile-test%@example.com\'');

  // Create a test user
  const email = 'profile-test@example.com';
  const password = 'TestPassword123';
  const passwordHash = await bcrypt.hash(password, 12);
  
  const userResult = await testDb.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, email_verified, subscription_tier) 
     VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
    [email, passwordHash, 'Test', 'User', 'free']
  );
  testUserId = userResult.rows[0].id;
});

describe('UserService', () => {
  describe('getUserProfile', () => {
    it('should successfully get user profile', async () => {
      const result = await userService.getUserProfile(testUserId);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.email).toBe('profile-test@example.com');
      expect(result.profile?.firstName).toBe('Test');
      expect(result.profile?.lastName).toBe('User');
      expect(result.profile?.subscriptionTier).toBe('free');
    });

    it('should fail for non-existent user', async () => {
      const result = await userService.getUserProfile('00000000-0000-0000-0000-000000000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should successfully update user profile', async () => {
      const result = await userService.updateUserProfile(testUserId, {
        firstName: 'Updated',
        lastName: 'Name'
      });

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.firstName).toBe('Updated');
      expect(result.profile?.lastName).toBe('Name');
    });

    it('should update only provided fields', async () => {
      const result = await userService.updateUserProfile(testUserId, {
        firstName: 'OnlyFirst'
      });

      expect(result.success).toBe(true);
      expect(result.profile?.firstName).toBe('OnlyFirst');
      expect(result.profile?.lastName).toBe('User'); // Should remain unchanged
    });

    it('should fail with no updates provided', async () => {
      const result = await userService.updateUserProfile(testUserId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No updates provided');
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences for new user', async () => {
      const result = await userService.getUserPreferences(testUserId);

      expect(result.success).toBe(true);
      expect(result.preferences).toBeDefined();
      expect(result.preferences?.theme).toBe('system');
      expect(result.preferences?.learningPace).toBe('medium');
      expect(result.preferences?.difficulty).toBe('beginner');
    });

    it('should return saved preferences', async () => {
      // First, save some preferences
      await userService.updateUserPreferences(testUserId, {
        theme: 'dark',
        learningPace: 'fast',
        difficulty: 'advanced'
      });

      // Then retrieve them
      const result = await userService.getUserPreferences(testUserId);

      expect(result.success).toBe(true);
      expect(result.preferences?.theme).toBe('dark');
      expect(result.preferences?.learningPace).toBe('fast');
      expect(result.preferences?.difficulty).toBe('advanced');
    });
  });

  describe('updateUserPreferences', () => {
    it('should successfully create new preferences', async () => {
      const result = await userService.updateUserPreferences(testUserId, {
        theme: 'dark',
        notifications: {
          email: false,
          inApp: true
        },
        learningPace: 'fast',
        difficulty: 'intermediate',
        language: 'es'
      });

      expect(result.success).toBe(true);
      expect(result.preferences).toBeDefined();
      expect(result.preferences?.theme).toBe('dark');
      expect(result.preferences?.learningPace).toBe('fast');
      expect(result.preferences?.difficulty).toBe('intermediate');
    });

    it('should successfully update existing preferences', async () => {
      // Create initial preferences
      await userService.updateUserPreferences(testUserId, {
        theme: 'light',
        learningPace: 'slow'
      });

      // Update preferences
      const result = await userService.updateUserPreferences(testUserId, {
        theme: 'dark',
        difficulty: 'advanced'
      });

      expect(result.success).toBe(true);
      expect(result.preferences?.theme).toBe('dark');
      expect(result.preferences?.difficulty).toBe('advanced');
    });
  });

  describe('deleteUserAccount', () => {
    it('should successfully delete user account', async () => {
      const result = await userService.deleteUserAccount(testUserId);

      expect(result.success).toBe(true);

      // Verify user is deleted
      const userCheck = await testDb.query('SELECT id FROM users WHERE id = $1', [testUserId]);
      expect(userCheck.rows.length).toBe(0);
    });
  });
});
