/**
 * Authentication Service
 * Implements SRS FR-1.2: Secure login system with JWT tokens and session management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  oauthProvider?: string;
  oauthId?: string;
  emailVerified: boolean;
  subscriptionTier: string;
  isAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  error?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface RegistrationData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class AuthService {
  private db: Pool;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private tokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.db = getDatabase();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
    this.tokenExpiry = process.env.JWT_EXPIRY || '1h';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Register a new user
   * Implements SRS FR-1.1: User registration with email verification
   */
  async register(registrationData: RegistrationData, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    try {
      const { email, password, firstName, lastName } = registrationData;

      // Check if user already exists
      const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
      const existingUserResult = await this.db.query(existingUserQuery, [email.toLowerCase()]);

      if (existingUserResult.rows.length > 0) {
        return {
          success: false,
          error: 'An account with this email already exists'
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const insertUserQuery = `
        INSERT INTO users (email, password_hash, first_name, last_name, email_verified,
                          subscription_tier, email_verification_token, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, email, first_name, last_name, email_verified, subscription_tier, created_at, updated_at
      `;

      const userResult = await this.db.query(insertUserQuery, [
        email.toLowerCase(),
        passwordHash,
        firstName || null,
        lastName || null,
        true, // For demo purposes, auto-verify email
        'free', // Default subscription tier
        emailVerificationToken
      ]);

      const userData = userResult.rows[0];

      // Generate tokens
      const token = this.generateAccessToken(userData.id, userData.email);
      const refreshToken = this.generateRefreshToken(userData.id);

      // Store session
      await this.createSession(userData.id, refreshToken, userAgent, ipAddress);

      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        emailVerified: userData.email_verified,
        subscriptionTier: userData.subscription_tier,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };

      // TODO: Send verification email in production
      console.log(`Email verification token for ${email}: ${emailVerificationToken}`);

      return {
        success: true,
        user,
        token,
        refreshToken
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'An error occurred during registration'
      };
    }
  }

  /**
   * Authenticate user with email and password
   * Implements SRS FR-1.2: Secure login system
   */
  async login(credentials: LoginCredentials, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    try {
      const { email, password } = credentials;

      // Find user by email
      const userQuery = `
        SELECT id, email, password_hash, first_name, last_name, oauth_provider, oauth_id,
               email_verified, subscription_tier, is_admin, created_at, updated_at, last_login
        FROM users 
        WHERE email = $1 AND password_hash IS NOT NULL
      `;
      
      const userResult = await this.db.query(userQuery, [email.toLowerCase()]);
      
      if (userResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      const userData = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userData.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if email is verified
      if (!userData.email_verified) {
        return {
          success: false,
          error: 'Please verify your email address before logging in'
        };
      }

      // Update last login
      await this.db.query(
        'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [userData.id]
      );

      // Generate tokens
      const token = this.generateAccessToken(userData.id, userData.email);
      const refreshToken = this.generateRefreshToken(userData.id);

      // Store session
      await this.createSession(userData.id, refreshToken, userAgent, ipAddress);

      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        oauthProvider: userData.oauth_provider,
        oauthId: userData.oauth_id,
        emailVerified: userData.email_verified,
        subscriptionTier: userData.subscription_tier,
        isAdmin: userData.is_admin || false,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
        lastLogin: new Date()
      };

      return {
        success: true,
        user,
        token,
        refreshToken
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'An error occurred during login'
      };
    }
  }

  /**
   * Logout user and cleanup session
   * Implements SRS FR-1.2: Logout functionality with session cleanup
   */
  async logout(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      // For logout, we need to invalidate the refresh token session
      // Since we only store refresh token hashes, we need to find sessions by user ID
      
      // First, decode the access token to get user ID
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Delete all sessions for this user (logout from all devices)
      await this.db.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [decoded.userId]
      );

      return { success: true };

    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'An error occurred during logout'
      };
    }
  }

  /**
   * Verify JWT token and return user information
   */
  async verifyToken(token: string): Promise<{ valid: boolean; user?: User; error?: string }> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // For access tokens, we don't need to check session table
      // Just verify the JWT signature and get user from database
      const userQuery = `
        SELECT id, email, first_name, last_name, oauth_provider, oauth_id,
               email_verified, subscription_tier, is_admin, created_at, updated_at, last_login
        FROM users 
        WHERE id = $1
      `;
      
      const userResult = await this.db.query(userQuery, [decoded.userId]);
      
      if (userResult.rows.length === 0) {
        return {
          valid: false,
          error: 'User not found'
        };
      }

      const userData = userResult.rows[0];
      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        oauthProvider: userData.oauth_provider,
        oauthId: userData.oauth_id,
        emailVerified: userData.email_verified,
        subscriptionTier: userData.subscription_tier,
        isAdmin: userData.is_admin || false,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
        lastLogin: userData.last_login
      };

      return {
        valid: true,
        user
      };

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token'
        };
      }
      
      console.error('Token verification error:', error);
      return {
        valid: false,
        error: 'Token verification failed'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      // Check if session exists
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const sessionQuery = `
        SELECT s.user_id, u.email
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = $1 AND s.expires_at > NOW()
      `;
      
      const sessionResult = await this.db.query(sessionQuery, [tokenHash]);
      
      if (sessionResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired refresh token'
        };
      }

      const { user_id, email } = sessionResult.rows[0];
      
      // Generate new access token with current timestamp to ensure uniqueness
      const newToken = this.generateAccessToken(user_id, email);
      
      return {
        success: true,
        token: newToken
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed'
      };
    }
  }

  /**
   * Initiate password reset process
   * Implements SRS FR-1.2: Password reset and account recovery flows
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const { email } = request;
      
      // Check if user exists
      const userQuery = 'SELECT id FROM users WHERE email = $1';
      const userResult = await this.db.query(userQuery, [email.toLowerCase()]);
      
      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not for security
        return { success: true };
      }

      const userId = userResult.rows[0].id;
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
      
      // Store reset token
      await this.db.query(
        `UPDATE users 
         SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
         WHERE id = $3`,
        [resetToken, resetExpires, userId]
      );

      // TODO: Send email with reset token
      // This would integrate with email service (nodemailer)
      console.log(`Password reset token for ${email}: ${resetToken}`);
      
      return { success: true };

    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        error: 'An error occurred while processing password reset request'
      };
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<{ success: boolean; error?: string }> {
    try {
      const { token, newPassword } = request;
      
      // Find user with valid reset token
      const userQuery = `
        SELECT id FROM users 
        WHERE password_reset_token = $1 AND password_reset_expires > NOW()
      `;
      const userResult = await this.db.query(userQuery, [token]);
      
      if (userResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      const userId = userResult.rows[0].id;
      
      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password and clear reset token
      await this.db.query(
        `UPDATE users 
         SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );

      // Invalidate all existing sessions for security
      await this.db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      
      return { success: true };

    } catch (error) {
      console.error('Password reset confirmation error:', error);
      return {
        success: false,
        error: 'An error occurred while resetting password'
      };
    }
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(userId: string, email: string): string {
    return jwt.sign(
      { 
        userId, 
        email,
        type: 'access',
        iat: Math.floor(Date.now() / 1000), // Include issued at time
        nonce: crypto.randomBytes(8).toString('hex') // Add random nonce for uniqueness
      },
      this.jwtSecret,
      { 
        expiresIn: '1h',
        issuer: 'system-design-simulator',
        audience: 'system-design-simulator-users'
      }
    );
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { 
        userId,
        type: 'refresh'
      },
      this.jwtRefreshSecret,
      { 
        expiresIn: '7d',
        issuer: 'system-design-simulator',
        audience: 'system-design-simulator-users'
      }
    );
  }

  /**
   * Create user session in database
   */
  private async createSession(userId: string, refreshToken: string, userAgent?: string, ipAddress?: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await this.db.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, expiresAt, userAgent, ipAddress]
    );
  }

  /**
   * Verify email address with token
   * Implements SRS FR-1.1: Email verification
   */
  async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user with verification token
      const userQuery = `
        SELECT id FROM users 
        WHERE email_verification_token = $1 AND email_verified = false
      `;
      const userResult = await this.db.query(userQuery, [token]);
      
      if (userResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      const userId = userResult.rows[0].id;
      
      // Mark email as verified and clear token
      await this.db.query(
        `UPDATE users 
         SET email_verified = true, email_verification_token = NULL, updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
      
      return { success: true };

    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        error: 'An error occurred during email verification'
      };
    }
  }

  /**
   * Resend email verification
   * Implements SRS FR-1.1: Email verification
   */
  async resendEmailVerification(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists and email is not verified
      const userQuery = 'SELECT id, email_verified FROM users WHERE email = $1';
      const userResult = await this.db.query(userQuery, [email.toLowerCase()]);
      
      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not for security
        return { success: true };
      }

      if (userResult.rows[0].email_verified) {
        return {
          success: false,
          error: 'Email is already verified'
        };
      }

      const userId = userResult.rows[0].id;
      
      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      
      // Update verification token
      await this.db.query(
        `UPDATE users 
         SET email_verification_token = $1, updated_at = NOW()
         WHERE id = $2`,
        [emailVerificationToken, userId]
      );

      // TODO: Send verification email
      console.log(`Email verification token for ${email}: ${emailVerificationToken}`);
      
      return { success: true };

    } catch (error) {
      console.error('Resend email verification error:', error);
      return {
        success: false,
        error: 'An error occurred while resending verification email'
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.db.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }
}

// Note: AuthService should be instantiated after database is initialized