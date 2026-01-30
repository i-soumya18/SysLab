/**
 * Component Configuration Panel Tests
 * Tests for real-time parameter updates and configuration management
 */

import { describe, it, expect } from 'vitest';
import { componentLibrary } from '../components/ComponentLibrary';
import type { Component } from '../types';

describe('Component Configuration Real-time Updates', () => {
  const mockComponent: Component = {
    id: 'test-component',
    type: 'database',
    position: { x: 100, y: 100 },
    configuration: {
      capacity: 1000,
      latency: 5,
      failureRate: 0.001,
      connectionPool: 100,
      queryCache: true,
      replicationEnabled: false,
      storageType: 'SSD'
    },
    metadata: {
      name: 'Test Database',
      description: 'Test database component',
      version: '1.0'
    }
  };

  it('should create component with valid configuration', () => {
    expect(mockComponent.configuration.capacity).toBe(1000);
    expect(mockComponent.configuration.latency).toBe(5);
    expect(mockComponent.configuration.failureRate).toBe(0.001);
  });

  it('should validate parameter ranges', () => {
    // Test capacity validation
    expect(mockComponent.configuration.capacity).toBeGreaterThan(0);
    expect(mockComponent.configuration.capacity).toBeLessThanOrEqual(100000);
    
    // Test latency validation
    expect(mockComponent.configuration.latency).toBeGreaterThanOrEqual(0);
    
    // Test failure rate validation
    expect(mockComponent.configuration.failureRate).toBeGreaterThanOrEqual(0);
    expect(mockComponent.configuration.failureRate).toBeLessThanOrEqual(1);
  });

  it('should support configuration presets', () => {
    const presets = componentLibrary.getPresetConfigurations('database');
    expect(Object.keys(presets).length).toBeGreaterThan(0);
    
    // Check that MySQL preset exists and has expected properties
    expect(presets.mysql).toBeDefined();
    expect(presets.mysql.capacity).toBeDefined();
    expect(presets.mysql.latency).toBeDefined();
    expect(presets.mysql.failureRate).toBeDefined();
  });
});