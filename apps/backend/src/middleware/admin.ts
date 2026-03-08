/**
 * Admin Middleware
 * Lightweight check for admin access based on trusted email header.
 *
 * NOTE: This is intended for local development and learning.
 * In production, replace this with proper JWT/Firebase verification.
 */

import { NextFunction, Request, Response } from 'express';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase() ?? 'sahoosoumya242004@gmail.com';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const headerEmailRaw = req.headers['x-admin-email'];
  const headerEmail = typeof headerEmailRaw === 'string' ? headerEmailRaw.toLowerCase() : Array.isArray(headerEmailRaw)
    ? headerEmailRaw[0]?.toLowerCase()
    : '';

  if (!headerEmail || headerEmail !== ADMIN_EMAIL) {
    res.status(403).json({
      success: false,
      error: 'Admin access required. Make sure you are logged in with the correct admin email.',
    });
    return;
  }

  // Attach a minimal user object so downstream code can rely on req.user
  req.user = {
    id: 'admin-email-user',
    email: headerEmail,
    emailVerified: true,
    subscriptionTier: 'enterprise',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  next();
}
