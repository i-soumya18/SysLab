/**
 * Authentication Service Tests
 * Tests for SRS FR-1.2: Secure login system, session management, and password reset
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { setupDatabase } from '../config/database';
import { AuthService } from '../services/authService';

// Test database setup
let testDb: Pool;
let authService: AuthService;

beforeAll(async () => {
  // Setup test database connection
  await setupDatabase();
  
  testDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'system_design_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  // Initialize auth service
  authService = new AuthService();
});

afterAll(async () => {
  await testDb.end();
});

beforeEach(async () => {
  // Clean up test data
  await testDb.query('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%test%@example.com\')');
  await testDb.query('DELETE FROM users WHERE email LIKE \'%test%@example.com\'');
});

describe('AuthService', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Create test user
      const email = 'test-login@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      const userResult = await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true) RETURNING id`,
        [email, passwordHash]
      );
      const userId = userResult.rows[0].id;

      // Test login
      const result = await authService.login({ email, password });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(email);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should fail login with invalid password', async () => {
      // Create test user
      const email = 'test-invalid-password@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true)`,
        [email, passwordHash]
      );

      // Test login with wrong password
      const result = await authService.login({ email, password: 'WrongPassword' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail login with unverified email', async () => {
      // Create test user with unverified email
      const email = 'test-unverified@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, false)`,
        [email, passwordHash]
      );

      // Test login
      const result = await authService.login({ email, password });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Please verify your email address before logging in');
    });

    it('should fail login with non-existent user', async () => {
      const result = await authService.login({ 
        email: 'nonexistent@example.com', 
        password: 'password' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('logout', () => {
    it('should successfully logout and cleanup session', async () => {
      // Create test user and login
      const email = 'test-logout@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true)`,
        [email, passwordHash]
      );

      const loginResult = await authService.login({ email, password });
      expect(loginResult.success).toBe(true);
      
      // Test logout
      const logoutResult = await authService.logout(loginResult.token!);
      expect(logoutResult.success).toBe(true);

      // Verify session is cleaned up
      const verification = await authService.verifyToken(loginResult.token!);
      expect(verification.valid).toBe(false);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      // Create test user and login
      const email = 'test-verify@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true)`,
        [email, passwordHash]
      );

      const loginResult = await authService.login({ email, password });
      
      // Test token verification
      const verification = await authService.verifyToken(loginResult.token!);
      
      expect(verification.valid).toBe(true);
      expect(verification.user).toBeDefined();
      expect(verification.user?.email).toBe(email);
    });

    it('should reject invalid token', async () => {
      const verification = await authService.verifyToken('invalid-token');
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });
  });

  describe('password reset', () => {
    it('should successfully request password reset', async () => {
      // Create test user
      const email = 'test-reset@example.com';
      const passwordHash = await bcrypt.hash('TestPassword123', 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true)`,
        [email, passwordHash]
      );

      // Test password reset request
      const result = await authService.requestPasswordReset({ email });
      expect(result.success).toBe(true);

      // Verify reset token was created
      const userResult = await testDb.query(
        'SELECT password_reset_token, password_reset_expires FROM users WHERE email = $1',
        [email]
      );
      
      expect(userResult.rows[0].password_reset_token).toBeDefined();
      expect(userResult.rows[0].password_reset_expires).toBeDefined();
    });

    it('should successfully confirm password reset', async () => {
      // Create test user with reset token
      const email = 'test-reset-confirm@example.com';
      const oldPasswordHash = await bcrypt.hash('OldPassword123', 12);
      const resetToken = 'test-reset-token';
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified, password_reset_token, password_reset_expires) 
         VALUES ($1, $2, true, $3, $4)`,
        [email, oldPasswordHash, resetToken, resetExpires]
      );

      // Test password reset confirmation
      const newPassword = 'NewPassword123';
      const result = await authService.confirmPasswordReset({ 
        token: resetToken, 
        newPassword 
      });
      
      expect(result.success).toBe(true);

      // Verify password was changed
      const userResult = await testDb.query(
        'SELECT password_hash, password_reset_token FROM users WHERE email = $1',
        [email]
      );
      
      const isNewPassword = await bcrypt.compare(newPassword, userResult.rows[0].password_hash);
      expect(isNewPassword).toBe(true);
      expect(userResult.rows[0].password_reset_token).toBeNull();
    });

    it('should reject expired reset token', async () => {
      // Create test user with expired reset token
      const email = 'test-expired-reset@example.com';
      const passwordHash = await bcrypt.hash('TestPassword123', 12);
      const resetToken = 'expired-reset-token';
      const resetExpires = new Date(Date.now() - 3600000); // 1 hour ago
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified, password_reset_token, password_reset_expires) 
         VALUES ($1, $2, true, $3, $4)`,
        [email, passwordHash, resetToken, resetExpires]
      );

      // Test password reset confirmation with expired token
      const result = await authService.confirmPasswordReset({ 
        token: resetToken, 
        newPassword: 'NewPassword123' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired reset token');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      // Create test user and login
      const email = 'test-refresh@example.com';
      const password = 'TestPassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      await testDb.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true)`,
        [email, passwordHash]
      );

      const loginResult = await authService.login({ email, password });
      
      // Test token refresh
      const refreshResult = await authService.refreshToken(loginResult.refreshToken!);
      
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token).toBeDefined();
      expect(refreshResult.token).not.toBe(loginResult.token);
    });

    it('should reject invalid refresh token', async () => {
      const refreshResult = await authService.refreshToken('invalid-refresh-token');
      
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBeDefined();
    });
  });
});