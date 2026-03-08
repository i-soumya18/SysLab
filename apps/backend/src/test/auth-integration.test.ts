/**
 * Authentication Integration Test
 * End-to-end test for the complete authentication flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { setupDatabase } from '../config/database';
import { AuthService } from '../services/authService';

let testDb: Pool;
let authService: AuthService;

beforeAll(async () => {
  await setupDatabase();
  
  testDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'system_design_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  authService = new AuthService();
});

afterAll(async () => {
  await testDb.end();
});

beforeEach(async () => {
  // Clean up test data
  await testDb.query('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%integration-test%@example.com\')');
  await testDb.query('DELETE FROM users WHERE email LIKE \'%integration-test%@example.com\'');
});

describe('Authentication Integration', () => {
  it('should complete full authentication flow', async () => {
    // 1. Create a test user
    const email = 'integration-test@example.com';
    const password = 'TestPassword123';
    const passwordHash = await bcrypt.hash(password, 12);
    
    const userResult = await testDb.query(
      `INSERT INTO users (email, password_hash, email_verified, first_name, last_name, subscription_tier) 
       VALUES ($1, $2, true, $3, $4, $5) RETURNING id`,
      [email, passwordHash, 'Test', 'User', 'free']
    );
    const userId = userResult.rows[0].id;

    // 2. Login
    const loginResult = await authService.login({ email, password });
    expect(loginResult.success).toBe(true);
    expect(loginResult.user).toBeDefined();
    expect(loginResult.token).toBeDefined();
    expect(loginResult.refreshToken).toBeDefined();

    const { user, token, refreshToken } = loginResult;

    // 3. Verify token
    const verifyResult = await authService.verifyToken(token!);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.user?.id).toBe(userId);
    expect(verifyResult.user?.email).toBe(email);

    // 4. Refresh token
    const refreshResult = await authService.refreshToken(refreshToken!);
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.token).toBeDefined();
    expect(refreshResult.token).not.toBe(token);

    // 5. Verify new token works
    const verifyNewResult = await authService.verifyToken(refreshResult.token!);
    expect(verifyNewResult.valid).toBe(true);
    expect(verifyNewResult.user?.id).toBe(userId);

    // 6. Logout
    const logoutResult = await authService.logout(refreshResult.token!);
    expect(logoutResult.success).toBe(true);

    // 7. Verify access token is still valid (JWT tokens are stateless)
    // but refresh token should be invalidated
    const verifyAfterLogout = await authService.verifyToken(refreshResult.token!);
    expect(verifyAfterLogout.valid).toBe(true); // Access token remains valid

    // 8. But refresh token should be invalidated
    const refreshAfterLogout = await authService.refreshToken(refreshToken!);
    expect(refreshAfterLogout.success).toBe(false);

    console.log('✅ Complete authentication flow test passed');
  });

  it('should handle password reset flow', async () => {
    // 1. Create a test user
    const email = 'password-reset-integration-test@example.com';
    const originalPassword = 'OriginalPassword123';
    const passwordHash = await bcrypt.hash(originalPassword, 12);
    
    await testDb.query(
      `INSERT INTO users (email, password_hash, email_verified) 
       VALUES ($1, $2, true)`,
      [email, passwordHash]
    );

    // 2. Request password reset
    const resetRequestResult = await authService.requestPasswordReset({ email });
    expect(resetRequestResult.success).toBe(true);

    // 3. Get reset token from database
    const tokenResult = await testDb.query(
      'SELECT password_reset_token FROM users WHERE email = $1',
      [email]
    );
    const resetToken = tokenResult.rows[0].password_reset_token;
    expect(resetToken).toBeDefined();

    // 4. Confirm password reset
    const newPassword = 'NewPassword123';
    const resetConfirmResult = await authService.confirmPasswordReset({
      token: resetToken,
      newPassword
    });
    expect(resetConfirmResult.success).toBe(true);

    // 5. Verify old password doesn't work
    const oldPasswordLogin = await authService.login({ email, password: originalPassword });
    expect(oldPasswordLogin.success).toBe(false);

    // 6. Verify new password works
    const newPasswordLogin = await authService.login({ email, password: newPassword });
    expect(newPasswordLogin.success).toBe(true);

    console.log('✅ Password reset flow test passed');
  });

  it('should handle session cleanup', async () => {
    // 1. Create a test user and login
    const email = 'session-cleanup-integration-test@example.com';
    const password = 'TestPassword123';
    const passwordHash = await bcrypt.hash(password, 12);
    
    await testDb.query(
      `INSERT INTO users (email, password_hash, email_verified) 
       VALUES ($1, $2, true)`,
      [email, passwordHash]
    );

    const loginResult = await authService.login({ email, password });
    expect(loginResult.success).toBe(true);

    // 2. Manually expire the session (this affects refresh token, not access token)
    await testDb.query(
      'UPDATE user_sessions SET expires_at = NOW() - INTERVAL \'1 hour\' WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [email]
    );

    // 3. Access token should still work (it's stateless)
    const verifyResult = await authService.verifyToken(loginResult.token!);
    expect(verifyResult.valid).toBe(true);

    // 4. But refresh token should fail
    const refreshResult = await authService.refreshToken(loginResult.refreshToken!);
    expect(refreshResult.success).toBe(false);

    // 5. Run cleanup
    await authService.cleanupExpiredSessions();

    // 6. Verify session was cleaned up
    const sessionCount = await testDb.query(
      'SELECT COUNT(*) FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [email]
    );
    expect(parseInt(sessionCount.rows[0].count)).toBe(0);

    console.log('✅ Session cleanup test passed');
  });
});