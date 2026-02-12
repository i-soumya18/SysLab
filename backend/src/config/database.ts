import { Pool } from 'pg';

let pool: Pool;

export async function setupDatabase(): Promise<void> {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'system_design_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  pool = new Pool(config);

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    // Initialize database schema
    await initializeSchema();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return pool;
}

async function initializeSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP WITH TIME ZONE,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);

    // Create user sessions table for JWT token management
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        ip_address INET
      );
    `);

    // Create user preferences table for user preferences management (SRS FR-1)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        preferences JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create user subscriptions table for subscription management (SRS FR-1.4)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier VARCHAR(50) NOT NULL DEFAULT 'free',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        billing_cycle VARCHAR(20),
        current_period_start TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        trial_end TIMESTAMP WITH TIME ZONE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create billing events table for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB NOT NULL DEFAULT '{}',
        stripe_event_id VARCHAR(255),
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id VARCHAR(255) NOT NULL,
        configuration JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        position JSONB NOT NULL,
        configuration JSONB NOT NULL DEFAULT '{}',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        target_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        source_port VARCHAR(100) NOT NULL,
        target_port VARCHAR(100) NOT NULL,
        configuration JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        objectives JSONB NOT NULL DEFAULT '[]',
        initial_setup JSONB NOT NULL DEFAULT '{}',
        evaluation_criteria JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
        completed_at TIMESTAMP WITH TIME ZONE,
        score INTEGER,
        feedback JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, scenario_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        snapshot JSONB NOT NULL,
        changes_summary JSONB NOT NULL DEFAULT '{}',
        performance_metrics JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by VARCHAR(255) NOT NULL,
        parent_version_id UUID REFERENCES workspace_versions(id),
        branch_name VARCHAR(100) DEFAULT 'main',
        tags JSONB DEFAULT '[]',
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(255),
        UNIQUE(workspace_id, version_number, branch_name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        variants JSONB NOT NULL,
        traffic_split JSONB NOT NULL,
        duration INTEGER NOT NULL,
        metrics JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        results JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        version_id UUID REFERENCES workspace_versions(id) ON DELETE CASCADE,
        report_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        content JSONB NOT NULL,
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by VARCHAR(255),
        shared BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(255) UNIQUE
      );
    `);

    // Create workspace sharing table for design sharing functionality
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        shared_by VARCHAR(255) NOT NULL,
        share_token VARCHAR(255) UNIQUE NOT NULL,
        permission_level VARCHAR(20) NOT NULL DEFAULT 'view',
        expires_at TIMESTAMP WITH TIME ZONE,
        is_public BOOLEAN DEFAULT FALSE,
        access_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create workspace collaborators table for multi-user editing
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_collaborators (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        invited_by VARCHAR(255) NOT NULL,
        permission_level VARCHAR(20) NOT NULL DEFAULT 'view',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        accepted_at TIMESTAMP WITH TIME ZONE,
        last_accessed TIMESTAMP WITH TIME ZONE,
        UNIQUE(workspace_id, user_id)
      );
    `);

    // Create collaboration sessions table for real-time collaboration
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaboration_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ended_at TIMESTAMP WITH TIME ZONE,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create collaboration participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaboration_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        socket_id VARCHAR(255) NOT NULL,
        color VARCHAR(7) NOT NULL,
        cursor_x INTEGER DEFAULT 0,
        cursor_y INTEGER DEFAULT 0,
        selection JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(session_id, user_id)
      );
    `);

    // Create collaboration operations table for operational transformation
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaboration_operations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        operation_data JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        applied BOOLEAN DEFAULT false,
        transformed_from UUID REFERENCES collaboration_operations(id)
      );
    `);

    // Create audit logs table for security and compliance reporting
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        tenant_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_path TEXT NOT NULL,
        http_method VARCHAR(10) NOT NULL,
        status_code INTEGER NOT NULL,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        duration_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create system_settings table for admin controls
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL DEFAULT '{}',
        description TEXT,
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create api_metrics table for monitoring API endpoints
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        user_id UUID REFERENCES users(id),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
      CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
      CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
      CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON billing_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id ON billing_events(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_event_id ON billing_events(stripe_event_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
      CREATE INDEX IF NOT EXISTS idx_components_workspace_id ON components(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_connections_workspace_id ON connections(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_versions_workspace_id ON workspace_versions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_versions_version_number ON workspace_versions(workspace_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_workspace_id ON ab_tests(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
      CREATE INDEX IF NOT EXISTS idx_performance_reports_workspace_id ON performance_reports(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_performance_reports_version_id ON performance_reports(version_id);
      CREATE INDEX IF NOT EXISTS idx_performance_reports_share_token ON performance_reports(share_token);
      CREATE INDEX IF NOT EXISTS idx_workspace_shares_workspace_id ON workspace_shares(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_shares_share_token ON workspace_shares(share_token);
      CREATE INDEX IF NOT EXISTS idx_workspace_shares_shared_by ON workspace_shares(shared_by);
      CREATE INDEX IF NOT EXISTS idx_workspace_collaborators_workspace_id ON workspace_collaborators(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_collaborators_user_id ON workspace_collaborators(user_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_collaborators_status ON workspace_collaborators(status);
      CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_workspace_id ON collaboration_sessions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_started_at ON collaboration_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_collaboration_participants_session_id ON collaboration_participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_participants_user_id ON collaboration_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_participants_socket_id ON collaboration_participants(socket_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_participants_is_active ON collaboration_participants(is_active);
      CREATE INDEX IF NOT EXISTS idx_collaboration_operations_session_id ON collaboration_operations(session_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_operations_user_id ON collaboration_operations(user_id);
      CREATE INDEX IF NOT EXISTS idx_collaboration_operations_timestamp ON collaboration_operations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_collaboration_operations_applied ON collaboration_operations(applied);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
      CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint);
      CREATE INDEX IF NOT EXISTS idx_api_metrics_created_at ON api_metrics(created_at);
      CREATE INDEX IF NOT EXISTS idx_api_metrics_status_code ON api_metrics(status_code);
    `);

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}