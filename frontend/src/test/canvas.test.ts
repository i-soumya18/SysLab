/**
 * Canvas Component Tests
 * Tests for drag-and-drop functionality and component management
 */

import { describe, it, expect } from 'vitest';
import { componentLibrary } from '../components/ComponentLibrary';

describe('Canvas Drag-and-Drop Functionality', () => {
  it('should create component from library', () => {
    const component = componentLibrary.createComponent(
      'database-mysql',
      'database',
      { x: 100, y: 100 }
    );

    expect(component).toBeDefined();
    expect(component?.type).toBe('database');
    expect(component?.position).toEqual({ x: 100, y: 100 });
    expect(component?.metadata.name).toBe('MySQL Database');
  });

  it('should handle multiple component types', () => {
    const database = componentLibrary.createComponent(
      'database-postgresql',
      'database',
      { x: 0, y: 0 }
    );

    const loadBalancer = componentLibrary.createComponent(
      'load-balancer-nginx',
      'load-balancer',
      { x: 200, y: 0 }
    );

    expect(database?.type).toBe('database');
    expect(loadBalancer?.type).toBe('load-balancer');
    expect(database?.id).not.toBe(loadBalancer?.id);
    
    // Verify metadata is correct
    expect(database?.metadata.name).toBe('PostgreSQL Database');
    expect(loadBalancer?.metadata.name).toBe('Nginx Load Balancer');
  });

  it('should provide available components', () => {
    const availableComponents = componentLibrary.getAvailableComponents();
    
    expect(availableComponents.length).toBeGreaterThan(0);
    expect(availableComponents).toContain('database-mysql');
    expect(availableComponents).toContain('load-balancer-nginx');
    expect(availableComponents).toContain('web-server-apache');
  });

  it('should filter components by type', () => {
    const databases = componentLibrary.getComponentsByType('database');
    const loadBalancers = componentLibrary.getComponentsByType('load-balancer');

    expect(databases.length).toBeGreaterThan(0);
    expect(loadBalancers.length).toBeGreaterThan(0);
    
    databases.forEach(db => {
      expect(db).toMatch(/^database-/);
    });
    
    loadBalancers.forEach(lb => {
      expect(lb).toMatch(/^load-balancer-/);
    });
  });

  it('should return null for invalid component key', () => {
    const component = componentLibrary.createComponent(
      'invalid-component',
      'database',
      { x: 0, y: 0 }
    );

    expect(component).toBeNull();
  });
});