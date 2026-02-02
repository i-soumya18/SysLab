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
        performance_metrics JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by VARCHAR(255) NOT NULL,
        UNIQUE(workspace_id, version_number)
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

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
      CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
      CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
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
    `);

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}