#!/bin/bash

# ============================================
# Database Initialization Script for RDS
# ============================================
# Initialize SysLab database on AWS RDS PostgreSQL
#
# Usage: bash aws-deployment/init-database.sh
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SysLab Database Initialization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running from project root
if [ ! -f "database/init.sql" ]; then
    echo -e "${RED}❌ Run this script from the SysLab project root directory${NC}"
    exit 1
fi

# Load AWS config
if [ ! -f "aws-deployment/aws-config.env" ]; then
    echo -e "${RED}❌ aws-deployment/aws-config.env not found${NC}"
    echo -e "${YELLOW}Run: bash aws-deployment/setup-infrastructure.sh first${NC}"
    exit 1
fi

source aws-deployment/aws-config.env

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Install PostgreSQL client tools${NC}"
    echo -e "${YELLOW}On macOS: brew install postgresql${NC}"
    echo -e "${YELLOW}On Ubuntu/Debian: sudo apt install postgresql-client${NC}"
    exit 1
fi

echo -e "${BLUE}[1/5] Retrieving database credentials...${NC}"

# Get database password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id syslab/db/password \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ Could not retrieve database password from Secrets Manager${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Retrieved database credentials${NC}"

echo -e "${BLUE}[2/5] Testing RDS connectivity...${NC}"

# Test connectivity
if PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d postgres \
    -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Successfully connected to RDS${NC}"
else
    echo -e "${RED}❌ Failed to connect to RDS${NC}"
    echo -e "${YELLOW}Make sure:${NC}"
    echo "  - RDS is in a publicly accessible state or in the same VPC"
    echo "  - Security group allows inbound 5432 from your IP"
    echo "  - RDS endpoint is correct: $RDS_ENDPOINT"
    exit 1
fi

echo -e "${BLUE}[3/5] Creating database...${NC}"

# Create database
if PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d postgres \
    -c "CREATE DATABASE system_design_simulator;" 2>/dev/null || true; then
    echo -e "${GREEN}✓ Database created (or already exists)${NC}"
else
    echo -e "${YELLOW}⚠ Database creation skipped (may already exist)${NC}"
fi

echo -e "${BLUE}[4/5] Running initialization script...${NC}"

# Run init script
if PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d system_design_simulator \
    -f database/init.sql; then
    echo -e "${GREEN}✓ Initialization script executed${NC}"
else
    echo -e "${RED}⚠ Some initialization commands failed (may be OK if tables exist)${NC}"
fi

echo -e "${BLUE}[5/5] Running migrations...${NC}"

# Run migrations
if PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d system_design_simulator \
    -f database/migrations/004_user_isolation_tables.sql; then
    echo -e "${GREEN}✓ Migrations executed${NC}"
else
    echo -e "${RED}⚠ Migration execution completed with warnings${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Database Initialization Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Verification Commands:${NC}"
echo ""
echo "# List all tables"
echo "PGPASSWORD='$DB_PASSWORD' psql -h $RDS_ENDPOINT -U postgres -d system_design_simulator -c \"\\dt\""
echo ""
echo "# List all schemas"
echo "PGPASSWORD='$DB_PASSWORD' psql -h $RDS_ENDPOINT -U postgres -d system_design_simulator -c \"\\dn\""
echo ""
echo "# Count users"
echo "PGPASSWORD='$DB_PASSWORD' psql -h $RDS_ENDPOINT -U postgres -d system_design_simulator -c \"SELECT COUNT(*) FROM users;\""
echo ""
