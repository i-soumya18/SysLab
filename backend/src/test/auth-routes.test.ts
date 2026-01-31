/**
 * Authentication Routes Integration Tests
 * Tests for SRS FR-1.2: Authentication API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupDatabase } from '../config/database';
import authRoutes from '../routes/auth';

let app: express.Application;

beforeAll(async () => {
  // Setup test database
  await setupDatabase();
  
  // Setup test app
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
});

describe('Authentication Routes', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/password-reset/request', () => {
    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset/request')
        .send({
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should return success for valid email (even if user does not exist)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset/request')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link');
    });
  });

  describe('POST /api/v1/auth/password-reset/confirm', () => {
    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset/confirm')
        .send({
          token: '',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset/confirm')
        .send({
          token: 'invalid-token',
          newPassword: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired reset token');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 401 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});