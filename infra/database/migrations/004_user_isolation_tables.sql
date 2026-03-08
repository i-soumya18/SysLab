-- User Isolation Tables Migration
-- Implements SRS NFR-3: User isolation with resource quotas and limits

-- User Resource Quotas Table
CREATE TABLE IF NOT EXISTS user_resource_quotas (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_simulations INTEGER NOT NULL DEFAULT 3,
    max_components INTEGER NOT NULL DEFAULT 20,
    max_connections INTEGER NOT NULL DEFAULT 30,
    max_workspaces INTEGER NOT NULL DEFAULT 5,
    max_simulation_duration INTEGER NOT NULL DEFAULT 300, -- seconds
    max_memory_usage INTEGER NOT NULL DEFAULT 50, -- MB
    max_cpu_time INTEGER NOT NULL DEFAULT 30, -- seconds
    max_storage_size INTEGER NOT NULL DEFAULT 10, -- MB
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 2,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    quota_reset_interval INTEGER NOT NULL DEFAULT 3600, -- seconds
    last_reset TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User Resource Usage Table
CREATE TABLE IF NOT EXISTS user_resource_usage (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_simulations INTEGER NOT NULL DEFAULT 0,
    current_components INTEGER NOT NULL DEFAULT 0,
    current_connections INTEGER NOT NULL DEFAULT 0,
    current_workspaces INTEGER NOT NULL DEFAULT 0,
    current_memory_usage DECIMAL(10,2) NOT NULL DEFAULT 0.0, -- MB
    current_cpu_time DECIMAL(10,2) NOT NULL DEFAULT 0.0, -- seconds
    current_storage_size DECIMAL(10,2) NOT NULL DEFAULT 0.0, -- MB
    current_sessions INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Resource Violations Log Table
CREATE TABLE IF NOT EXISTS resource_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    current_value DECIMAL(10,2) NOT NULL,
    limit_value DECIMAL(10,2) NOT NULL,
    violation_type VARCHAR(50) NOT NULL, -- 'quota_exceeded', 'rate_limit', 'concurrent_limit'
    action_taken VARCHAR(50) NOT NULL, -- 'block', 'throttle', 'warn'
    request_path VARCHAR(255),
    request_method VARCHAR(10),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User Sessions Table (for concurrent session tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    simulation_id UUID,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tenant Data Isolation Views
-- These views ensure users can only see their own data

-- User's own workspaces view
CREATE OR REPLACE VIEW user_workspaces AS
SELECT w.*
FROM workspaces w
WHERE w.user_id = current_setting('app.current_user_id', true)::UUID;

-- User's own components view
CREATE OR REPLACE VIEW user_components AS
SELECT c.*
FROM components c
JOIN workspaces w ON c.workspace_id = w.id
WHERE w.user_id = current_setting('app.current_user_id', true)::UUID;

-- User's own connections view
CREATE OR REPLACE VIEW user_connections AS
SELECT conn.*
FROM connections conn
JOIN workspaces w ON conn.workspace_id = w.id
WHERE w.user_id = current_setting('app.current_user_id', true)::UUID;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_resource_quotas_user_id ON user_resource_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_quotas_subscription_tier ON user_resource_quotas(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_resource_quotas_last_reset ON user_resource_quotas(last_reset);

CREATE INDEX IF NOT EXISTS idx_user_resource_usage_user_id ON user_resource_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_usage_last_updated ON user_resource_usage(last_updated);

CREATE INDEX IF NOT EXISTS idx_resource_violations_user_id ON resource_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_violations_created_at ON resource_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_resource_violations_resource_type ON resource_violations(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_violations_violation_type ON resource_violations(violation_type);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Row Level Security (RLS) for tenant isolation
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspaces
CREATE POLICY workspace_isolation ON workspaces
    FOR ALL
    TO authenticated_users
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- RLS Policies for components
CREATE POLICY component_isolation ON components
    FOR ALL
    TO authenticated_users
    USING (
        workspace_id IN (
            SELECT id FROM workspaces 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- RLS Policies for connections
CREATE POLICY connection_isolation ON connections
    FOR ALL
    TO authenticated_users
    USING (
        workspace_id IN (
            SELECT id FROM workspaces 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- RLS Policies for user resource quotas
CREATE POLICY quota_isolation ON user_resource_quotas
    FOR ALL
    TO authenticated_users
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- RLS Policies for user resource usage
CREATE POLICY usage_isolation ON user_resource_usage
    FOR ALL
    TO authenticated_users
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- RLS Policies for resource violations
CREATE POLICY violation_isolation ON resource_violations
    FOR ALL
    TO authenticated_users
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- RLS Policies for user sessions
CREATE POLICY session_isolation ON user_sessions
    FOR ALL
    TO authenticated_users
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Functions for resource management

-- Function to check resource quota
CREATE OR REPLACE FUNCTION check_resource_quota(
    p_user_id UUID,
    p_resource_type VARCHAR(50),
    p_requested_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    quota_record RECORD;
    usage_record RECORD;
    current_value INTEGER;
    max_value INTEGER;
BEGIN
    -- Get quota limits
    SELECT * INTO quota_record
    FROM user_resource_quotas
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get current usage
    SELECT * INTO usage_record
    FROM user_resource_usage
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check specific resource type
    CASE p_resource_type
        WHEN 'simulations' THEN
            current_value := usage_record.current_simulations;
            max_value := quota_record.max_simulations;
        WHEN 'components' THEN
            current_value := usage_record.current_components;
            max_value := quota_record.max_components;
        WHEN 'connections' THEN
            current_value := usage_record.current_connections;
            max_value := quota_record.max_connections;
        WHEN 'workspaces' THEN
            current_value := usage_record.current_workspaces;
            max_value := quota_record.max_workspaces;
        WHEN 'sessions' THEN
            current_value := usage_record.current_sessions;
            max_value := quota_record.max_concurrent_sessions;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- Check if request would exceed quota
    RETURN (current_value + p_requested_amount) <= max_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update resource usage
CREATE OR REPLACE FUNCTION update_resource_usage(
    p_user_id UUID,
    p_resource_type VARCHAR(50),
    p_delta INTEGER
) RETURNS VOID AS $$
BEGIN
    -- Update usage based on resource type
    CASE p_resource_type
        WHEN 'simulations' THEN
            UPDATE user_resource_usage
            SET current_simulations = GREATEST(0, current_simulations + p_delta),
                last_updated = NOW()
            WHERE user_id = p_user_id;
        WHEN 'components' THEN
            UPDATE user_resource_usage
            SET current_components = GREATEST(0, current_components + p_delta),
                last_updated = NOW()
            WHERE user_id = p_user_id;
        WHEN 'connections' THEN
            UPDATE user_resource_usage
            SET current_connections = GREATEST(0, current_connections + p_delta),
                last_updated = NOW()
            WHERE user_id = p_user_id;
        WHEN 'workspaces' THEN
            UPDATE user_resource_usage
            SET current_workspaces = GREATEST(0, current_workspaces + p_delta),
                last_updated = NOW()
            WHERE user_id = p_user_id;
        WHEN 'sessions' THEN
            UPDATE user_resource_usage
            SET current_sessions = GREATEST(0, current_sessions + p_delta),
                last_updated = NOW()
            WHERE user_id = p_user_id;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log resource violation
CREATE OR REPLACE FUNCTION log_resource_violation(
    p_user_id UUID,
    p_resource_type VARCHAR(50),
    p_current_value DECIMAL(10,2),
    p_limit_value DECIMAL(10,2),
    p_violation_type VARCHAR(50),
    p_action_taken VARCHAR(50),
    p_request_path VARCHAR(255) DEFAULT NULL,
    p_request_method VARCHAR(10) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    violation_id UUID;
BEGIN
    INSERT INTO resource_violations (
        user_id, resource_type, current_value, limit_value,
        violation_type, action_taken, request_path, request_method,
        user_agent, ip_address
    ) VALUES (
        p_user_id, p_resource_type, p_current_value, p_limit_value,
        p_violation_type, p_action_taken, p_request_path, p_request_method,
        p_user_agent, p_ip_address
    ) RETURNING id INTO violation_id;
    
    RETURN violation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset user quotas
CREATE OR REPLACE FUNCTION reset_user_quotas() RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
    quota_record RECORD;
BEGIN
    -- Find quotas that need reset
    FOR quota_record IN
        SELECT user_id, quota_reset_interval, last_reset
        FROM user_resource_quotas
        WHERE last_reset + INTERVAL '1 second' * quota_reset_interval < NOW()
    LOOP
        -- Reset usage for this user
        UPDATE user_resource_usage
        SET current_simulations = 0,
            current_cpu_time = 0,
            last_updated = NOW()
        WHERE user_id = quota_record.user_id;
        
        -- Update last reset time
        UPDATE user_resource_quotas
        SET last_reset = NOW()
        WHERE user_id = quota_record.user_id;
        
        reset_count := reset_count + 1;
    END LOOP;
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Delete expired sessions
    DELETE FROM user_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Update session counts in usage table
    UPDATE user_resource_usage
    SET current_sessions = (
        SELECT COUNT(*)
        FROM user_sessions
        WHERE user_sessions.user_id = user_resource_usage.user_id
    ),
    last_updated = NOW();
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for automatic resource tracking

-- Trigger to update workspace count when workspace is created/deleted
CREATE OR REPLACE FUNCTION update_workspace_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_resource_usage(NEW.user_id, 'workspaces', 1);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_resource_usage(OLD.user_id, 'workspaces', -1);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_count_trigger
    AFTER INSERT OR DELETE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_workspace_count();

-- Trigger to update component count when component is created/deleted
CREATE OR REPLACE FUNCTION update_component_count() RETURNS TRIGGER AS $$
DECLARE
    workspace_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT user_id INTO workspace_user_id
        FROM workspaces
        WHERE id = NEW.workspace_id;
        
        PERFORM update_resource_usage(workspace_user_id, 'components', 1);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT user_id INTO workspace_user_id
        FROM workspaces
        WHERE id = OLD.workspace_id;
        
        PERFORM update_resource_usage(workspace_user_id, 'components', -1);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER component_count_trigger
    AFTER INSERT OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION update_component_count();

-- Trigger to update connection count when connection is created/deleted
CREATE OR REPLACE FUNCTION update_connection_count() RETURNS TRIGGER AS $$
DECLARE
    workspace_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT user_id INTO workspace_user_id
        FROM workspaces
        WHERE id = NEW.workspace_id;
        
        PERFORM update_resource_usage(workspace_user_id, 'connections', 1);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT user_id INTO workspace_user_id
        FROM workspaces
        WHERE id = OLD.workspace_id;
        
        PERFORM update_resource_usage(workspace_user_id, 'connections', -1);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connection_count_trigger
    AFTER INSERT OR DELETE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_connection_count();

-- Create authenticated_users role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_users') THEN
        CREATE ROLE authenticated_users;
    END IF;
END
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_users;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated_users;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated_users;

-- Comments for documentation
COMMENT ON TABLE user_resource_quotas IS 'Resource quotas and limits for each user based on subscription tier';
COMMENT ON TABLE user_resource_usage IS 'Current resource usage tracking for each user';
COMMENT ON TABLE resource_violations IS 'Log of resource quota violations and actions taken';
COMMENT ON TABLE user_sessions IS 'Active user sessions for concurrent session tracking';

COMMENT ON FUNCTION check_resource_quota IS 'Check if user can allocate additional resources without exceeding quota';
COMMENT ON FUNCTION update_resource_usage IS 'Update current resource usage for a user';
COMMENT ON FUNCTION log_resource_violation IS 'Log a resource quota violation with details';
COMMENT ON FUNCTION reset_user_quotas IS 'Reset quotas for users whose reset interval has expired';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Remove expired sessions and update session counts';