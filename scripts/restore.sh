#!/bin/bash

# System Design Simulator - Database Restore Script
# This script restores a database backup

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Please provide a backup file path"
    echo ""
    echo "Usage: ./scripts/restore.sh <backup-file>"
    echo "Example: ./scripts/restore.sh backups/sds-backup-20240212-120000.sql"
    echo ""
    echo "Available backups:"
    ls -1 backups/*.sql 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  Warning: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "♻️  Restoring database from $BACKUP_FILE..."

# Restore backup
docker exec -i sds-postgres psql -U postgres system_design_simulator < "$BACKUP_FILE"

echo "✅ Database restored successfully!"
echo ""
