/**
 * Concurrent User Monitoring Service
 * 
 * Implements SRS NFR-4: Monitor and track thousands of concurrent users
 * Provides real-time user metrics, session tracking, and capacity planning
 */

import { EventEmitter } from 'events';
import { getRedisClient } from '../config/redis';
import { getDatabase } from '../config/database';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';

export interface UserSession {
  sessionId: string;
  userId: string;
  userTier: string;
  region: string;
  ipAddress: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
  activeWorkspaces: string[];
  activeSimulations: string[];
  connectionType: 'http' | 'websocket';
  socketId?: string;
}

export interface ConcurrentUserMetrics {
  timestamp: Date;
  totalConcurrentUsers: number;
  activeConcurrentUsers: number; // Users with activity in last 5 minutes
  peakConcurrentUsers: number;
  usersByTier: {
    free: number;
    pro: number;
    enterprise: number;
  };
  usersByRegion: Record<string, number>;
  usersByConnectionType: {
    http: number;
    websocket: number;
  };
  averageSessionDuration: number;
  newSessionsPerMinute: number;
  sessionEndingsPerMinute: number;
  capacityUtilization: number; // Percentage of max capacity
}

export interface UserActivity {
  sessionId: string;
  userId: string;
  activityType: 'page_view' | 'api_call' | 'simulation_start' | 'simulation_stop' | 'workspace_edit' | 'collaboration_join';
  details: Record<string, any>;
  timestamp: Date;
}

export interface CapacityAlert {
  id: string;
  type: 'approaching_limit' | 'at_limit' | 'over_limit';
  currentUsers: number;
  maxCapacity: number;
  utilizationPercent: number;
  projectedPeakTime?: Date;
  projectedPeakUsers?: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface SessionAnalytics {
  totalSessions: number;
  averageSessionDuration: number;
  medianSessionDuration: number;
  bounceRate: number; // Sessions < 30 seconds
  retentionRate: number; // Users returning within 7 days
  conversionRate: number; // Free to paid conversions
  topRegions: Array<{ region: string; users: number; percentage: number }>;
  topUserAgents: Array<{ userAgent: string; users: number; percentage: number }>;
  peakHours: Array<{ hour: number; averageUsers: number }>;
}

export class ConcurrentUserMonitoringService extends EventEmitter {
  private db: Pool;
  private redis: RedisClientType;
  private activeSessions: Map<string, UserSession> = new Map();
  private userMetrics: ConcurrentUserMetrics;
  private maxCapacity: number = 10000; // Default max concurrent users
  private capacityThresholds = {
    warning: 0.8,  // 80%
    critical: 0.95 // 95%
  };
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private capacityMonitoringInterval: NodeJS.Timeout | null = null;
  private activityBuffer: UserActivity[] = [];
  private lastMetricsUpdate: Date = new Date();
  private initialized: boolean = false;

  constructor(maxCapacity: number = 10000) {
    super();
    this.db = getDatabase();
    this.redis = getRedisClient();
    this.maxCapacity = maxCapacity;
    this.initialized = false;

    this.userMetrics = {
      timestamp: new Date(),
      totalConcurrentUsers: 0,
      activeConcurrentUsers: 0,
      peakConcurrentUsers: 0,
      usersByTier: { free: 0, pro: 0, enterprise: 0 },
      usersByRegion: {},
      usersByConnectionType: { http: 0, websocket: 0 },
      averageSessionDuration: 0,
      newSessionsPerMinute: 0,
      sessionEndingsPerMinute: 0,
      capacityUtilization: 0
    };
  }

  /**
   * Initialize the service explicitly (must be called before use)
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.initializeService();
      this.initialized = true;
    }
  }

  /**
   * Initialize the monitoring service
   */
  private async initializeService(): Promise<void> {
    try {
      // Create database tables
      await this.createTables();
      
      // Load existing sessions from Redis
      await this.loadExistingSessions();
      
      // Start monitoring intervals
      this.startMetricsCollection();
      this.startSessionCleanup();
      this.startCapacityMonitoring();
      
      this.emit('service_initialized');
    } catch (error: any) {
      console.error('Failed to initialize concurrent user monitoring service:', error);
      // Don't throw - allow server to start even if this service fails
      // Log the error but continue
      if (error?.code !== '42703' && error?.code !== '23505') {
        console.error('Unexpected error during user monitoring initialization:', error);
      } else {
        console.warn('User monitoring service encountered known initialization issue, continuing...');
      }
    }
  }

  /**
   * Register a new user session
   */
  async registerSession(sessionData: Omit<UserSession, 'connectedAt' | 'lastActivity'>): Promise<void> {
    const session: UserSession = {
      ...sessionData,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    // Store in memory
    this.activeSessions.set(session.sessionId, session);
    
    // Store in Redis with TTL
    await this.redis.hSet(`session:${session.sessionId}`, {
      userId: session.userId,
      userTier: session.userTier,
      region: session.region,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      connectedAt: session.connectedAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      activeWorkspaces: JSON.stringify(session.activeWorkspaces),
      activeSimulations: JSON.stringify(session.activeSimulations),
      connectionType: session.connectionType,
      socketId: session.socketId || ''
    });
    
    // Set TTL for session (24 hours)
    await this.redis.expire(`session:${session.sessionId}`, 24 * 60 * 60);
    
    // Add to active sessions set
    await this.redis.sAdd('active_sessions', session.sessionId);
    
    // Update user count in Redis
    await this.updateConcurrentUserCount();
    
    // Record session start in database
    await this.recordSessionEvent(session.sessionId, 'session_start', {
      userId: session.userId,
      userTier: session.userTier,
      region: session.region,
      connectionType: session.connectionType
    });

    this.emit('session_registered', session);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, activity: Omit<UserActivity, 'sessionId' | 'timestamp'>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for activity update`);
      return;
    }

    // Update last activity
    session.lastActivity = new Date();
    
    // Update active workspaces/simulations if provided
    if (activity.activityType === 'workspace_edit' && activity.details.workspaceId) {
      if (!session.activeWorkspaces.includes(activity.details.workspaceId)) {
        session.activeWorkspaces.push(activity.details.workspaceId);
      }
    }
    
    if (activity.activityType === 'simulation_start' && activity.details.simulationId) {
      if (!session.activeSimulations.includes(activity.details.simulationId)) {
        session.activeSimulations.push(activity.details.simulationId);
      }
    }
    
    if (activity.activityType === 'simulation_stop' && activity.details.simulationId) {
      session.activeSimulations = session.activeSimulations.filter(id => id !== activity.details.simulationId);
    }

    // Update in Redis
    await this.redis.hSet(`session:${sessionId}`, {
      lastActivity: session.lastActivity.toISOString(),
      activeWorkspaces: JSON.stringify(session.activeWorkspaces),
      activeSimulations: JSON.stringify(session.activeSimulations)
    });

    // Buffer activity for batch processing
    const userActivity: UserActivity = {
      sessionId,
      userId: session.userId,
      activityType: activity.activityType,
      details: activity.details,
      timestamp: new Date()
    };
    
    this.activityBuffer.push(userActivity);
    
    // Process buffer if it gets too large
    if (this.activityBuffer.length >= 100) {
      await this.processActivityBuffer();
    }

    this.emit('session_activity', userActivity);
  }

  /**
   * End a user session
   */
  async endSession(sessionId: string, reason: 'logout' | 'timeout' | 'disconnect' = 'disconnect'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    const sessionDuration = Date.now() - session.connectedAt.getTime();
    
    // Remove from memory
    this.activeSessions.delete(sessionId);
    
    // Remove from Redis
    await this.redis.del(`session:${sessionId}`);
    await this.redis.sRem('active_sessions', sessionId);
    
    // Update user count
    await this.updateConcurrentUserCount();
    
    // Record session end in database
    await this.recordSessionEvent(sessionId, 'session_end', {
      userId: session.userId,
      reason,
      duration: sessionDuration,
      activeWorkspaces: session.activeWorkspaces.length,
      activeSimulations: session.activeSimulations.length
    });

    this.emit('session_ended', { session, reason, duration: sessionDuration });
  }

  /**
   * Get current concurrent user metrics
   */
  getCurrentMetrics(): ConcurrentUserMetrics {
    return { ...this.userMetrics };
  }

  /**
   * Get detailed session analytics
   */
  async getSessionAnalytics(timeRange: { start: Date; end: Date }): Promise<SessionAnalytics> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (details->>'duration')::numeric)) as avg_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (details->>'duration')::numeric) as median_duration,
        COUNT(*) FILTER (WHERE (details->>'duration')::numeric < 30000) as bounce_sessions,
        COUNT(DISTINCT details->>'userId') as unique_users
      FROM user_session_events 
      WHERE event_type = 'session_end' 
        AND timestamp BETWEEN $1 AND $2
    `, [timeRange.start, timeRange.end]);

    const sessionStats = result.rows[0];
    
    // Get regional distribution
    const regionResult = await this.db.query(`
      SELECT 
        details->>'region' as region,
        COUNT(*) as users,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM user_session_events 
      WHERE event_type = 'session_start' 
        AND timestamp BETWEEN $1 AND $2
        AND details->>'region' IS NOT NULL
      GROUP BY details->>'region'
      ORDER BY users DESC
      LIMIT 10
    `, [timeRange.start, timeRange.end]);

    // Get user agent distribution
    const userAgentResult = await this.db.query(`
      SELECT 
        SUBSTRING(user_agent FROM 1 FOR 50) as user_agent,
        COUNT(*) as users,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM user_connection_sessions 
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY SUBSTRING(user_agent FROM 1 FOR 50)
      ORDER BY users DESC
      LIMIT 10
    `, [timeRange.start, timeRange.end]);

    // Get peak hours
    const peakHoursResult = await this.db.query(`
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        AVG(concurrent_users) as average_users
      FROM user_metrics_snapshots 
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `, [timeRange.start, timeRange.end]);

    return {
      totalSessions: parseInt(sessionStats.total_sessions) || 0,
      averageSessionDuration: parseFloat(sessionStats.avg_duration) || 0,
      medianSessionDuration: parseFloat(sessionStats.median_duration) || 0,
      bounceRate: sessionStats.total_sessions > 0 ? 
        (parseInt(sessionStats.bounce_sessions) / parseInt(sessionStats.total_sessions)) * 100 : 0,
      retentionRate: 0, // Would need more complex query
      conversionRate: 0, // Would need subscription data
      topRegions: regionResult.rows.map(row => ({
        region: row.region,
        users: parseInt(row.users),
        percentage: parseFloat(row.percentage)
      })),
      topUserAgents: userAgentResult.rows.map(row => ({
        userAgent: row.user_agent,
        users: parseInt(row.users),
        percentage: parseFloat(row.percentage)
      })),
      peakHours: peakHoursResult.rows.map(row => ({
        hour: parseInt(row.hour),
        averageUsers: parseFloat(row.average_users)
      }))
    };
  }

  /**
   * Get capacity alerts
   */
  async getCapacityAlerts(limit: number = 50): Promise<CapacityAlert[]> {
    const result = await this.db.query(`
      SELECT * FROM capacity_alerts 
      ORDER BY timestamp DESC 
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      currentUsers: row.current_users,
      maxCapacity: row.max_capacity,
      utilizationPercent: parseFloat(row.utilization_percent),
      projectedPeakTime: row.projected_peak_time,
      projectedPeakUsers: row.projected_peak_users,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged
    }));
  }

  /**
   * Acknowledge capacity alert
   */
  async acknowledgeCapacityAlert(alertId: string): Promise<void> {
    await this.db.query(
      'UPDATE capacity_alerts SET acknowledged = true WHERE id = $1',
      [alertId]
    );

    this.emit('capacity_alert_acknowledged', { alertId });
  }

  /**
   * Get active sessions by criteria
   */
  getActiveSessions(criteria?: {
    userTier?: string;
    region?: string;
    connectionType?: 'http' | 'websocket';
    hasActiveSimulations?: boolean;
  }): UserSession[] {
    let sessions = Array.from(this.activeSessions.values());

    if (criteria) {
      if (criteria.userTier) {
        sessions = sessions.filter(s => s.userTier === criteria.userTier);
      }
      if (criteria.region) {
        sessions = sessions.filter(s => s.region === criteria.region);
      }
      if (criteria.connectionType) {
        sessions = sessions.filter(s => s.connectionType === criteria.connectionType);
      }
      if (criteria.hasActiveSimulations !== undefined) {
        sessions = sessions.filter(s => 
          criteria.hasActiveSimulations ? s.activeSimulations.length > 0 : s.activeSimulations.length === 0
        );
      }
    }

    return sessions;
  }

  /**
   * Set maximum capacity
   */
  setMaxCapacity(capacity: number): void {
    this.maxCapacity = capacity;
    this.emit('max_capacity_updated', { capacity });
  }

  /**
   * Get capacity utilization forecast
   */
  async getCapacityForecast(hours: number = 24): Promise<{
    currentUtilization: number;
    projectedPeak: { time: Date; users: number; utilization: number };
    recommendations: string[];
  }> {
    // Get historical data for trend analysis
    const historicalData = await this.db.query(`
      SELECT 
        timestamp,
        concurrent_users,
        EXTRACT(HOUR FROM timestamp) as hour,
        EXTRACT(DOW FROM timestamp) as day_of_week
      FROM user_metrics_snapshots 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
      ORDER BY timestamp
    `);

    const currentUtilization = (this.userMetrics.totalConcurrentUsers / this.maxCapacity) * 100;
    
    // Simple trend analysis (in production, use more sophisticated forecasting)
    const hourlyAverages = new Map<number, number>();
    
    for (const row of historicalData.rows) {
      const hour = parseInt(row.hour);
      const users = parseInt(row.concurrent_users);
      
      if (!hourlyAverages.has(hour)) {
        hourlyAverages.set(hour, users);
      } else {
        hourlyAverages.set(hour, (hourlyAverages.get(hour)! + users) / 2);
      }
    }

    // Find projected peak
    let maxUsers = 0;
    let peakHour = 0;
    
    for (const [hour, avgUsers] of hourlyAverages) {
      if (avgUsers > maxUsers) {
        maxUsers = avgUsers;
        peakHour = hour;
      }
    }

    const projectedPeakTime = new Date();
    projectedPeakTime.setHours(peakHour, 0, 0, 0);
    if (projectedPeakTime <= new Date()) {
      projectedPeakTime.setDate(projectedPeakTime.getDate() + 1);
    }

    const projectedUtilization = (maxUsers / this.maxCapacity) * 100;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (projectedUtilization > 90) {
      recommendations.push('Consider increasing server capacity before peak hours');
      recommendations.push('Enable auto-scaling for simulation nodes');
    }
    
    if (projectedUtilization > 80) {
      recommendations.push('Monitor system performance closely during peak hours');
      recommendations.push('Consider implementing queue management for new sessions');
    }
    
    if (currentUtilization > 70) {
      recommendations.push('Current utilization is high - monitor for performance degradation');
    }

    return {
      currentUtilization,
      projectedPeak: {
        time: projectedPeakTime,
        users: Math.round(maxUsers),
        utilization: projectedUtilization
      },
      recommendations
    };
  }

  // Private methods

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS user_connection_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_tier VARCHAR(50) NOT NULL,
        region VARCHAR(100) NOT NULL,
        ip_address INET NOT NULL,
        user_agent TEXT NOT NULL,
        connected_at TIMESTAMP WITH TIME ZONE NOT NULL,
        disconnected_at TIMESTAMP WITH TIME ZONE,
        connection_type VARCHAR(20) NOT NULL,
        socket_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS user_session_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS user_metrics_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        concurrent_users INTEGER NOT NULL,
        active_users INTEGER NOT NULL,
        peak_users INTEGER NOT NULL,
        users_by_tier JSONB NOT NULL DEFAULT '{}',
        users_by_region JSONB NOT NULL DEFAULT '{}',
        capacity_utilization DECIMAL(5,2) NOT NULL,
        metrics JSONB NOT NULL DEFAULT '{}'
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS capacity_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        current_users INTEGER NOT NULL,
        max_capacity INTEGER NOT NULL,
        utilization_percent DECIMAL(5,2) NOT NULL,
        projected_peak_time TIMESTAMP WITH TIME ZONE,
        projected_peak_users INTEGER,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        acknowledged BOOLEAN DEFAULT FALSE
      );
    `);

    // Create indexes
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_connection_sessions_user_id ON user_connection_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_connection_sessions_connected_at ON user_connection_sessions(connected_at);
      CREATE INDEX IF NOT EXISTS idx_user_connection_sessions_region ON user_connection_sessions(region);
      CREATE INDEX IF NOT EXISTS idx_user_session_events_session_id ON user_session_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_session_events_timestamp ON user_session_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activities_timestamp ON user_activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_metrics_snapshots_timestamp ON user_metrics_snapshots(timestamp);
      CREATE INDEX IF NOT EXISTS idx_capacity_alerts_timestamp ON capacity_alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_capacity_alerts_acknowledged ON capacity_alerts(acknowledged);
    `);
  }

  /**
   * Load existing sessions from Redis
   */
  private async loadExistingSessions(): Promise<void> {
    try {
      const sessionIds = await this.redis.sMembers('active_sessions');
      
      for (const sessionId of sessionIds) {
        const sessionData = await this.redis.hGetAll(`session:${sessionId}`);
        
        if (Object.keys(sessionData).length > 0) {
          const session: UserSession = {
            sessionId,
            userId: sessionData.userId,
            userTier: sessionData.userTier,
            region: sessionData.region,
            ipAddress: sessionData.ipAddress,
            userAgent: sessionData.userAgent,
            connectedAt: new Date(sessionData.connectedAt),
            lastActivity: new Date(sessionData.lastActivity),
            activeWorkspaces: JSON.parse(sessionData.activeWorkspaces || '[]'),
            activeSimulations: JSON.parse(sessionData.activeSimulations || '[]'),
            connectionType: sessionData.connectionType as 'http' | 'websocket',
            socketId: sessionData.socketId || undefined
          };
          
          this.activeSessions.set(sessionId, session);
        }
      }
      
      await this.updateConcurrentUserCount();
      
    } catch (error) {
      console.error('Failed to load existing sessions:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      await this.updateMetrics();
      await this.processActivityBuffer();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Start session cleanup
   */
  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(async () => {
      await this.cleanupInactiveSessions();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Start capacity monitoring
   */
  private startCapacityMonitoring(): void {
    this.capacityMonitoringInterval = setInterval(async () => {
      await this.checkCapacityThresholds();
    }, 60000); // Check every minute
  }

  /**
   * Update concurrent user count
   */
  private async updateConcurrentUserCount(): Promise<void> {
    const count = this.activeSessions.size;
    await this.redis.set('concurrent_users', count.toString());
    
    // Update peak if necessary
    if (count > this.userMetrics.peakConcurrentUsers) {
      this.userMetrics.peakConcurrentUsers = count;
      await this.redis.set('peak_concurrent_users', count.toString());
    }
  }

  /**
   * Update all metrics
   */
  private async updateMetrics(): Promise<void> {
    const now = new Date();
    const sessions = Array.from(this.activeSessions.values());
    
    // Calculate active users (activity in last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const activeSessions = sessions.filter(s => s.lastActivity >= fiveMinutesAgo);
    
    // Group by tier
    const usersByTier = { free: 0, pro: 0, enterprise: 0 };
    const usersByRegion: Record<string, number> = {};
    const usersByConnectionType = { http: 0, websocket: 0 };
    
    for (const session of sessions) {
      usersByTier[session.userTier as keyof typeof usersByTier]++;
      usersByRegion[session.region] = (usersByRegion[session.region] || 0) + 1;
      usersByConnectionType[session.connectionType]++;
    }
    
    // Calculate session metrics
    const sessionDurations = sessions.map(s => now.getTime() - s.connectedAt.getTime());
    const averageSessionDuration = sessionDurations.length > 0 ? 
      sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length : 0;
    
    // Calculate new sessions and endings per minute
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const newSessions = sessions.filter(s => s.connectedAt >= oneMinuteAgo).length;
    
    this.userMetrics = {
      timestamp: now,
      totalConcurrentUsers: sessions.length,
      activeConcurrentUsers: activeSessions.length,
      peakConcurrentUsers: this.userMetrics.peakConcurrentUsers,
      usersByTier,
      usersByRegion,
      usersByConnectionType,
      averageSessionDuration,
      newSessionsPerMinute: newSessions,
      sessionEndingsPerMinute: 0, // Would need to track from events
      capacityUtilization: (sessions.length / this.maxCapacity) * 100
    };
    
    // Store snapshot in database
    await this.db.query(`
      INSERT INTO user_metrics_snapshots (
        concurrent_users, active_users, peak_users, users_by_tier, 
        users_by_region, capacity_utilization, metrics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      this.userMetrics.totalConcurrentUsers,
      this.userMetrics.activeConcurrentUsers,
      this.userMetrics.peakConcurrentUsers,
      JSON.stringify(this.userMetrics.usersByTier),
      JSON.stringify(this.userMetrics.usersByRegion),
      this.userMetrics.capacityUtilization,
      JSON.stringify(this.userMetrics)
    ]);

    this.emit('metrics_updated', this.userMetrics);
  }

  /**
   * Process buffered activities
   */
  private async processActivityBuffer(): Promise<void> {
    if (this.activityBuffer.length === 0) return;
    
    const activities = [...this.activityBuffer];
    this.activityBuffer = [];
    
    // Batch insert activities
    const values = activities.map((activity, index) => {
      const baseIndex = index * 5;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
    }).join(', ');
    
    const params = activities.flatMap(activity => [
      activity.sessionId,
      activity.userId,
      activity.activityType,
      JSON.stringify(activity.details),
      activity.timestamp
    ]);
    
    await this.db.query(`
      INSERT INTO user_activities (session_id, user_id, activity_type, details, timestamp)
      VALUES ${values}
    `, params);
  }

  /**
   * Cleanup inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    
    const inactiveSessions = Array.from(this.activeSessions.entries())
      .filter(([_, session]) => 
        now.getTime() - session.lastActivity.getTime() > inactivityThreshold
      );
    
    for (const [sessionId, session] of inactiveSessions) {
      await this.endSession(sessionId, 'timeout');
    }
    
    if (inactiveSessions.length > 0) {
      this.emit('sessions_cleaned_up', { count: inactiveSessions.length });
    }
  }

  /**
   * Check capacity thresholds and generate alerts
   */
  private async checkCapacityThresholds(): Promise<void> {
    const utilization = this.userMetrics.capacityUtilization;
    
    if (utilization >= this.capacityThresholds.critical * 100) {
      await this.createCapacityAlert('at_limit', utilization);
    } else if (utilization >= this.capacityThresholds.warning * 100) {
      await this.createCapacityAlert('approaching_limit', utilization);
    }
  }

  /**
   * Create capacity alert
   */
  private async createCapacityAlert(type: CapacityAlert['type'], utilization: number): Promise<void> {
    // Check if similar alert exists in last 10 minutes
    const recentAlert = await this.db.query(`
      SELECT id FROM capacity_alerts 
      WHERE type = $1 AND timestamp >= NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `, [type]);
    
    if (recentAlert.rows.length > 0) {
      return; // Don't create duplicate alerts
    }
    
    const result = await this.db.query(`
      INSERT INTO capacity_alerts (
        type, current_users, max_capacity, utilization_percent
      ) VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [type, this.userMetrics.totalConcurrentUsers, this.maxCapacity, utilization]);
    
    const alert: CapacityAlert = {
      id: result.rows[0].id,
      type,
      currentUsers: this.userMetrics.totalConcurrentUsers,
      maxCapacity: this.maxCapacity,
      utilizationPercent: utilization,
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.emit('capacity_alert', alert);
  }

  /**
   * Record session event
   */
  private async recordSessionEvent(sessionId: string, eventType: string, details: any): Promise<void> {
    await this.db.query(`
      INSERT INTO user_session_events (session_id, event_type, details)
      VALUES ($1, $2, $3)
    `, [sessionId, eventType, JSON.stringify(details)]);
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    
    if (this.capacityMonitoringInterval) {
      clearInterval(this.capacityMonitoringInterval);
    }
  }
}