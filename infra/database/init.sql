-- System Design Simulator Database Initialization
-- This file is executed when the PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create database if it doesn't exist (this is handled by POSTGRES_DB env var)
-- The tables will be created by the application's database setup function

-- Create a simple health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW();
END;
$$ LANGUAGE plpgsql;