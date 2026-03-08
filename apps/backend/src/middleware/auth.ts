/**
 * Authentication Middleware
 * Implements JWT token validation for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, User } from '../services/authService';

// Lazy-load auth service to avoid initialization issues
let authService: AuthService;
function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 * Implements SRS FR-1.2: Session management with JWT tokens
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    // Verify token using auth service
    const verification = await getAuthService().verifyToken(token);
    
    if (!verification.valid) {
      res.status(401).json({
        success: false,
        error: verification.error || 'Invalid token'
      });
      return;
    }

    // Attach user to request
    req.user = verification.user;
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const verification = await getAuthService().verifyToken(token);
      if (verification.valid) {
        req.user = verification.user;
      }
    }

    next();

  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
}

/**
 * Middleware to check subscription tier access
 */
export function requireSubscriptionTier(requiredTier: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const tierHierarchy = ['free', 'pro', 'enterprise'];
    const userTierIndex = tierHierarchy.indexOf(req.user.subscriptionTier);
    const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

    if (userTierIndex < requiredTierIndex) {
      res.status(403).json({
        success: false,
        error: `${requiredTier} subscription required`
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function authRateLimit(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }

    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts) {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000)
      });
      return;
    }

    clientAttempts.count++;
    next();
  };
}