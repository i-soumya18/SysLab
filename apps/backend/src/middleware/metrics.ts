/**
 * Metrics Middleware
 * Records API metrics for monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/adminService';

const adminService = new AdminService();

/**
 * Middleware to record API metrics
 */
export function recordMetrics(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (body) {
    const responseTime = Date.now() - startTime;
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const userId = req.user?.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    // Record metric asynchronously (don't block response)
    adminService.recordApiMetric(
      endpoint,
      method,
      statusCode,
      responseTime,
      userId,
      ipAddress,
      userAgent
    ).catch(err => {
      console.error('Failed to record API metric:', err);
    });

    return originalSend.call(this, body);
  };

  next();
}
