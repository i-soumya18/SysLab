/**
 * Seed Admin User
 * Grants admin access to a specific user by email or Firebase UID
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { getDatabase, setupDatabase } from '../config/database';

// Load environment variables from .env file
dotenv.config();

const ADMIN_EMAIL = 'sahoosoumya242004@gmail.com';
const ADMIN_FIREBASE_UID = 'KkTM9FRdbxTMiFDRE3sVMD86mWT2';

async function seedAdmin(): Promise<void> {
  // Initialize database connection first
  await setupDatabase();

  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Try to find user by email first
    let userResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL.toLowerCase()]
    );

    // If not found by email, try to find by oauth_id (Firebase UID)
    if (userResult.rows.length === 0) {
      userResult = await client.query(
        'SELECT id FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
        [ADMIN_FIREBASE_UID, 'google']
      );
    }

    if (userResult.rows.length === 0) {
      console.log(`⚠️  User not found with email ${ADMIN_EMAIL} or Firebase UID ${ADMIN_FIREBASE_UID}`);
      console.log('Creating new admin user...');
      
      // Create new user with admin privileges
      const insertResult = await client.query(
        `INSERT INTO users (email, is_admin, email_verified, subscription_tier, created_at, updated_at)
         VALUES ($1, true, true, 'enterprise', NOW(), NOW())
         RETURNING id`,
        [ADMIN_EMAIL.toLowerCase()]
      );
      
      const userId = insertResult.rows[0].id;
      console.log(`✅ Created admin user with ID: ${userId}`);
    } else {
      const userId = userResult.rows[0].id;
      
      // Update existing user to admin
      await client.query(
        'UPDATE users SET is_admin = true, subscription_tier = $1, updated_at = NOW() WHERE id = $2',
        ['enterprise', userId]
      );
      
      console.log(`✅ Granted admin access to user ID: ${userId}`);
    }

    await client.query('COMMIT');
    console.log('✅ Admin user seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding admin user:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('Admin seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Admin seeding failed:', error);
      process.exit(1);
    });
}

export { seedAdmin };
