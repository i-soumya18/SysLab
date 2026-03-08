/**
 * Authentication Routes
 * Implements SRS FR-1.2: Secure login system, session management, and password reset
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { authenticateToken, authRateLimit } from '../middleware/auth';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

const router = Router();

// Lazy-load auth service to avoid initialization issues
let authService: AuthService;
function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

// Validation schemas
const registrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

/**
 * POST /api/auth/register
 * Register a new user
 * Implements SRS FR-1.1: User registration with email verification
 */
router.post(
  '/register',
  authRateLimit(3, 60 * 60 * 1000),
  createAuditMiddleware({ action: 'AUTH_REGISTER' }),
  async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = registrationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      });
      return;
    }

    const { email, password, firstName, lastName } = validation.data;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    // Register user
    const result = await getAuthService().register(
      { email, password, firstName, lastName },
      userAgent,
      ipAddress
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      });
      return;
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
      message: 'Registration successful'
    });

  } catch (error) {
    console.error('Registration route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 * Implements SRS FR-1.2: Secure login system
 */
router.post(
  '/login',
  authRateLimit(5, 15 * 60 * 1000),
  createAuditMiddleware({ action: 'AUTH_LOGIN' }),
  async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      });
      return;
    }

    const { email, password } = validation.data;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    // Authenticate user
    const result = await getAuthService().login(
      { email, password },
      userAgent,
      ipAddress
    );

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: result.error
      });
      return;
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and cleanup session
 * Implements SRS FR-1.2: Logout functionality with session cleanup
 */
router.post(
  '/logout',
  authenticateToken,
  createAuditMiddleware({ action: 'AUTH_LOGOUT' }),
  async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await getAuthService().logout(token);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * Implements SRS FR-1.2: Session management with JWT tokens
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Get refresh token from cookie or request body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
      return;
    }

    // Refresh access token
    const result = await getAuthService().refreshToken(refreshToken);

    if (!result.success) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');
      res.status(401).json({
        success: false,
        error: result.error
      });
      return;
    }

    res.json({
      success: true,
      token: result.token
    });

  } catch (error) {
    console.error('Token refresh route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      user: req.user
    });

  } catch (error) {
    console.error('Get user route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/password-reset/request
 * Request password reset
 * Implements SRS FR-1.2: Password reset and account recovery flows
 */
router.post('/password-reset/request', authRateLimit(3, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = passwordResetRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      });
      return;
    }

    const { email } = validation.data;

    // Request password reset
    const result = await getAuthService().requestPasswordReset({ email });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Password reset request route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/password-reset/confirm
 * Confirm password reset with token
 * Implements SRS FR-1.2: Password reset and account recovery flows
 */
router.post('/password-reset/confirm', authRateLimit(5, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = passwordResetConfirmSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      });
      return;
    }

    const { token, newPassword } = validation.data;

    // Confirm password reset
    const result = await getAuthService().confirmPasswordReset({ token, newPassword });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.'
    });

  } catch (error) {
    console.error('Password reset confirm route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 * Implements SRS FR-1.1: Email verification
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
      return;
    }

    const result = await getAuthService().verifyEmail(token);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 * Implements SRS FR-1.1: Email verification
 */
router.post('/resend-verification', authRateLimit(3, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    const result = await getAuthService().resendEmailVerification(email);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'If an account with that email exists and is not verified, a verification email has been sent.'
    });

  } catch (error) {
    console.error('Resend verification route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices (invalidate all sessions)
 */
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Invalidate all sessions for the user
    const db = getAuthService()['db']; // Access private db property
    await db.query('DELETE FROM user_sessions WHERE user_id = $1', [req.user.id]);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });

  } catch (error) {
    console.error('Logout all route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;