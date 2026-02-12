#!/bin/bash

# System Design Simulator - Database Backup Script
# This script creates a manual backup of the database

set -e

echo "💾 Creating database backup..."

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
BACKUP_FILE="backups/sds-backup-$(date +%Y%m%d-%H%M%S).sql"

# Create backup
docker exec sds-postgres pg_dump -U postgres system_design_simulator > "$BACKUP_FILE"

echo "✅ Database backup created: $BACKUP_FILE"
echo ""
echo "📝 To restore this backup, run:"
echo "   docker exec -i sds-postgres psql -U postgres system_design_simulator < $BACKUP_FILE"
echo ""
