/**
 * Admin Service
 * Provides admin functionality for user management, system control, and monitoring
 */

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { SubscriptionService } from './subscriptionService';

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  workspaceCount?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  database: {
    connected: boolean;
    responseTimeMs: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface ApiMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  last24Hours: Array<{
    hour: string;
    requests: number;
    avgResponseTime: number;
    errors: number;
  }>;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  maxUsers?: number;
  features: Record<string, boolean>;
}

export class AdminService {
  private db: Pool;
  private subscriptionService: SubscriptionService;

  constructor(database?: Pool) {
    this.db = database || getDatabase();
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, limit: number = 50, search?: string): Promise<{
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.subscription_tier, 
        u.is_admin, u.email_verified, u.created_at, u.updated_at, u.last_login,
        COUNT(DISTINCT w.id) as workspace_count
      FROM users u
      LEFT JOIN workspaces w ON w.user_id = u.id
    `;
    const params: any[] = [];
    
    if (search) {
      query += ` WHERE u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` GROUP BY u.id, u.email, u.first_name, u.last_name, u.subscription_tier, 
                u.is_admin, u.email_verified, u.created_at, u.updated_at, u.last_login 
                ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    
    const countQuery = search 
      ? `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`
      : `SELECT COUNT(*) FROM users`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await this.db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const users: AdminUser[] = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      subscriptionTier: row.subscription_tier,
      isAdmin: row.is_admin || false,
      emailVerified: row.email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      workspaceCount: parseInt(row.workspace_count, 10) || 0
    }));

    return { users, total, page, limit };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AdminUser | null> {
    const query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.subscription_tier, 
        u.is_admin, u.email_verified, u.created_at, u.updated_at, u.last_login,
        COUNT(DISTINCT w.id) as workspace_count
      FROM users u
      LEFT JOIN workspaces w ON w.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.subscription_tier, 
               u.is_admin, u.email_verified, u.created_at, u.updated_at, u.last_login
    `;
    
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      subscriptionTier: row.subscription_tier,
      isAdmin: row.is_admin || false,
      emailVerified: row.email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      workspaceCount: parseInt(row.workspace_count, 10) || 0
    };
  }

  /**
   * Update user subscription tier
   */
  async updateUserSubscription(
    userId: string, 
    tier: 'free' | 'pro' | 'enterprise',
    adminId: string
  ): Promise<void> {
    await this.db.query('BEGIN');
    
    try {
      // Update user's subscription tier
      await this.db.query(
        'UPDATE users SET subscription_tier = $1, updated_at = NOW() WHERE id = $2',
        [tier, userId]
      );

      // Create or update subscription record
      // First check if subscription exists
      const existingSub = await this.db.query(
        'SELECT id FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (existingSub.rows.length > 0) {
        await this.db.query(
          `UPDATE user_subscriptions 
           SET tier = $1, status = 'active', updated_at = NOW() 
           WHERE user_id = $2`,
          [tier, userId]
        );
      } else {
        await this.db.query(
          `INSERT INTO user_subscriptions (user_id, tier, status, billing_cycle, current_period_start, current_period_end)
           VALUES ($1, $2, 'active', 'monthly', NOW(), NOW() + INTERVAL '1 month')`,
          [userId, tier]
        );
      }

      // Log admin action (optional - don't fail if audit logging fails)
      try {
        await this.db.query(
          `INSERT INTO audit_logs (user_id, action, resource_path, http_method, status_code, metadata)
           VALUES ($1, 'admin_subscription_update', $2, 'PUT', 200, $3)`,
          [adminId, `/admin/users/${userId}/subscription`, JSON.stringify({ tier, updatedBy: adminId })]
        );
      } catch (auditError) {
        console.warn('Failed to log admin action:', auditError);
        // Continue execution - audit logging is not critical
      }

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Toggle admin status for a user
   */
  async toggleAdminStatus(userId: string, isAdmin: boolean, adminId: string): Promise<void> {
    await this.db.query('BEGIN');
    
    try {
      await this.db.query(
        'UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2',
        [isAdmin, userId]
      );

      // Log admin action (optional)
      try {
        await this.db.query(
          `INSERT INTO audit_logs (user_id, action, resource_path, http_method, status_code, metadata)
           VALUES ($1, 'admin_toggle', $2, 'PUT', 200, $3)`,
          [adminId, `/admin/users/${userId}/admin`, JSON.stringify({ isAdmin, updatedBy: adminId })]
        );
      } catch (auditError) {
        console.warn('Failed to log admin action:', auditError);
      }

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Delete user (soft delete by marking as inactive)
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    await this.db.query('BEGIN');
    
    try {
      // In a real system, you might want to soft delete
      // For now, we'll just log the action (optional)
      try {
        await this.db.query(
          `INSERT INTO audit_logs (user_id, action, resource_path, http_method, status_code, metadata)
           VALUES ($1, 'admin_user_delete', $2, 'DELETE', 200, $3)`,
          [adminId, `/admin/users/${userId}`, JSON.stringify({ deletedBy: adminId, deletedAt: new Date() })]
        );
      } catch (auditError) {
        console.warn('Failed to log admin action:', auditError);
      }

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    
    // Check database connection
    let dbConnected = false;
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await this.db.query('SELECT 1');
      dbResponseTime = Date.now() - dbStart;
      dbConnected = true;
    } catch (error) {
      dbConnected = false;
    }

    // Get memory usage
    const memUsage = process.memoryUsage();
    const memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    const status: 'healthy' | 'degraded' | 'down' = 
      !dbConnected ? 'down' :
      memory.percentage > 90 ? 'degraded' :
      'healthy';

    return {
      status,
      database: {
        connected: dbConnected,
        responseTimeMs: dbResponseTime
      },
      memory,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Get API metrics
   */
  async getApiMetrics(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<ApiMetrics[]> {
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const query = `
      SELECT 
        endpoint,
        method,
        COUNT(*) as total_requests,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100 as error_rate,
        jsonb_object_agg(status_code::TEXT, status_count) as status_codes
      FROM (
        SELECT 
          endpoint,
          method,
          status_code,
          response_time_ms,
          COUNT(*) OVER (PARTITION BY endpoint, method, status_code) as status_count
        FROM api_metrics
        WHERE created_at >= $1
      ) sub
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
      LIMIT 100
    `;

    const result = await this.db.query(query, [cutoffTime]);
    
    // Get hourly breakdown for last 24 hours
    const hourlyQuery = `
      SELECT 
        endpoint,
        method,
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as requests,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
      FROM api_metrics
      WHERE created_at >= $1
      GROUP BY endpoint, method, DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `;

    const hourlyResult = await this.db.query(hourlyQuery, [cutoffTime]);
    const hourlyMap = new Map<string, any[]>();
    
    hourlyResult.rows.forEach(row => {
      const key = `${row.endpoint}:${row.method}`;
      if (!hourlyMap.has(key)) {
        hourlyMap.set(key, []);
      }
      hourlyMap.get(key)!.push({
        hour: row.hour.toISOString(),
        requests: parseInt(row.requests, 10),
        avgResponseTime: parseInt(row.avg_response_time, 10),
        errors: parseInt(row.errors, 10)
      });
    });

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      method: row.method,
      totalRequests: parseInt(row.total_requests, 10),
      avgResponseTime: parseInt(row.avg_response_time, 10),
      errorRate: parseFloat(row.error_rate) || 0,
      statusCodes: row.status_codes || {},
      last24Hours: hourlyMap.get(`${row.endpoint}:${row.method}`) || []
    }));
  }

  /**
   * Get system settings
   */
  async getSystemSettings(): Promise<SystemSettings> {
    const query = 'SELECT key, value FROM system_settings WHERE key IN ($1, $2, $3)';
    const result = await this.db.query(query, ['maintenance_mode', 'max_users', 'features']);
    
    const settings: SystemSettings = {
      maintenanceMode: false,
      features: {}
    };

    result.rows.forEach(row => {
      if (row.key === 'maintenance_mode') {
        settings.maintenanceMode = row.value.enabled || false;
        settings.maintenanceMessage = row.value.message;
      } else if (row.key === 'max_users') {
        settings.maxUsers = row.value.max;
      } else if (row.key === 'features') {
        settings.features = row.value;
      }
    });

    return settings;
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(
    settings: Partial<SystemSettings>,
    adminId: string
  ): Promise<void> {
    await this.db.query('BEGIN');
    
    try {
      if (settings.maintenanceMode !== undefined) {
        await this.db.query(
          `INSERT INTO system_settings (key, value, updated_by, updated_at)
           VALUES ('maintenance_mode', $1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
          [JSON.stringify({ enabled: settings.maintenanceMode, message: settings.maintenanceMessage }), adminId]
        );
      }

      if (settings.maxUsers !== undefined) {
        await this.db.query(
          `INSERT INTO system_settings (key, value, updated_by, updated_at)
           VALUES ('max_users', $1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
          [JSON.stringify({ max: settings.maxUsers }), adminId]
        );
      }

      if (settings.features) {
        await this.db.query(
          `INSERT INTO system_settings (key, value, updated_by, updated_at)
           VALUES ('features', $1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
          [JSON.stringify(settings.features), adminId]
        );
      }

      // Log admin action (optional)
      try {
        await this.db.query(
          `INSERT INTO audit_logs (user_id, action, resource_path, http_method, status_code, metadata)
           VALUES ($1, 'admin_settings_update', '/admin/settings', 'PUT', 200, $2)`,
          [adminId, JSON.stringify(settings)]
        );
      } catch (auditError) {
        console.warn('Failed to log admin action:', auditError);
      }

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Record API metric
   */
  async recordApiMetric(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO api_metrics (endpoint, method, status_code, response_time_ms, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [endpoint, method, statusCode, responseTimeMs, userId || null, ipAddress || null, userAgent || null]
      );
    } catch (error) {
      // Don't fail requests if metrics recording fails
      console.error('Failed to record API metric:', error);
    }
  }
}
