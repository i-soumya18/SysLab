/**
 * Admin Routes
 * Provides admin endpoints for user management, system control, and monitoring
 */

import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/admin';
import { AdminService } from '../services/adminService';

const router = Router();
const adminService = new AdminService();

/**
 * GET /api/v1/admin/users
 * Get all users with pagination
 */
router.get('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    const result = await adminService.getUsers(page, limit, search);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    const details = error instanceof Error ? error.stack : String(error);
    console.error('Error fetching users:', details);
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * GET /api/v1/admin/users/:id
 * Get user by ID
 */
router.get('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const user = await adminService.getUserById(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

/**
 * PUT /api/v1/admin/users/:id/subscription
 * Update user subscription tier
 */
router.put('/users/:id/subscription', adminAuth, async (req: Request, res: Response) => {
  try {
    const { tier } = req.body;

    if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) {
      res.status(400).json({
        success: false,
        error: 'Invalid tier. Must be free, pro, or enterprise'
      });
      return;
    }

    await adminService.updateUserSubscription(req.params.id, tier, req.user!.id);

    res.json({
      success: true,
      message: `User subscription updated to ${tier}`
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription'
    });
  }
});

/**
 * PUT /api/v1/admin/users/:id/admin
 * Toggle admin status
 */
router.put('/users/:id/admin', adminAuth, async (req: Request, res: Response) => {
  try {
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'isAdmin must be a boolean'
      });
      return;
    }

    await adminService.toggleAdminStatus(req.params.id, isAdmin, req.user!.id);

    res.json({
      success: true,
      message: `Admin status ${isAdmin ? 'granted' : 'revoked'}`
    });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin status'
    });
  }
});

/**
 * DELETE /api/v1/admin/users/:id
 * Delete user
 */
router.delete('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    await adminService.deleteUser(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'User deleted'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

/**
 * GET /api/v1/admin/health
 * Get system health status
 */
router.get('/health', adminAuth, async (req: Request, res: Response) => {
  try {
    const health = await adminService.getSystemHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health'
    });
  }
});

/**
 * GET /api/v1/admin/metrics
 * Get API metrics
 */
router.get('/metrics', adminAuth, async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query.range as '24h' | '7d' | '30d') || '24h';
    const metrics = await adminService.getApiMetrics(timeRange);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

/**
 * GET /api/v1/admin/settings
 * Get system settings
 */
router.get('/settings', adminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await adminService.getSystemSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
});

/**
 * PUT /api/v1/admin/settings
 * Update system settings
 */
router.put('/settings', adminAuth, async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    await adminService.updateSystemSettings(settings, req.user!.id);

    res.json({
      success: true,
      message: 'Settings updated'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

export default router;
