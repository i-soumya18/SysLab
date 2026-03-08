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
    expect(availableComponents).toContain('client-web');
  });

  it('should filter components by type', () => {
    const databases = componentLibrary.getComponentsByType('database');
    const loadBalancers = componentLibrary.getComponentsByType('load-balancer');
    const clients = componentLibrary.getComponentsByType('client');

    expect(databases.length).toBeGreaterThan(0);
    expect(loadBalancers.length).toBeGreaterThan(0);
    expect(clients.length).toBeGreaterThan(0);
    
    databases.forEach(db => {
      expect(db).toMatch(/^database-/);
    });
    
    loadBalancers.forEach(lb => {
      expect(lb).toMatch(/^load-balancer-/);
    });

    clients.forEach(client => {
      expect(client).toMatch(/^client-/);
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

  describe('MVLE-1: Essential 4 Components', () => {
    it('should create all 4 MVLE components (Client, LB, Service, DB)', () => {
      // Test Client component
      const client = componentLibrary.createComponent(
        'client-web',
        'client',
        { x: 50, y: 100 }
      );
      expect(client).toBeDefined();
      expect(client?.type).toBe('client');
      expect(client?.metadata.name).toBe('Web Client');

      // Test Load Balancer component
      const loadBalancer = componentLibrary.createComponent(
        'load-balancer-nginx',
        'load-balancer',
        { x: 200, y: 100 }
      );
      expect(loadBalancer).toBeDefined();
      expect(loadBalancer?.type).toBe('load-balancer');
      expect(loadBalancer?.metadata.name).toBe('Nginx Load Balancer');

      // Test Service component (using web-server as service)
      const service = componentLibrary.createComponent(
        'web-server-nodejs',
        'web-server',
        { x: 350, y: 100 }
      );
      expect(service).toBeDefined();
      expect(service?.type).toBe('web-server');
      expect(service?.metadata.name).toBe('Node.js Server');

      // Test Database component
      const database = componentLibrary.createComponent(
        'database-mysql',
        'database',
        { x: 500, y: 100 }
      );
      expect(database).toBeDefined();
      expect(database?.type).toBe('database');
      expect(database?.metadata.name).toBe('MySQL Database');
    });

    it('should have proper configurations for MVLE components', () => {
      const client = componentLibrary.createComponent('client-web', 'client', { x: 0, y: 0 });
      const loadBalancer = componentLibrary.createComponent('load-balancer-nginx', 'load-balancer', { x: 0, y: 0 });
      const service = componentLibrary.createComponent('web-server-nodejs', 'web-server', { x: 0, y: 0 });
      const database = componentLibrary.createComponent('database-mysql', 'database', { x: 0, y: 0 });

      // Verify all components have required configuration properties
      expect(client?.configuration.capacity).toBeGreaterThan(0);
      expect(client?.configuration.latency).toBeGreaterThan(0);
      expect(client?.configuration.failureRate).toBeGreaterThanOrEqual(0);

      expect(loadBalancer?.configuration.capacity).toBeGreaterThan(0);
      expect(loadBalancer?.configuration.latency).toBeGreaterThan(0);
      expect(loadBalancer?.configuration.failureRate).toBeGreaterThanOrEqual(0);

      expect(service?.configuration.capacity).toBeGreaterThan(0);
      expect(service?.configuration.latency).toBeGreaterThan(0);
      expect(service?.configuration.failureRate).toBeGreaterThanOrEqual(0);

      expect(database?.configuration.capacity).toBeGreaterThan(0);
      expect(database?.configuration.latency).toBeGreaterThan(0);
      expect(database?.configuration.failureRate).toBeGreaterThanOrEqual(0);
    });

    it('should generate unique IDs for each component instance', () => {
      const client1 = componentLibrary.createComponent('client-web', 'client', { x: 0, y: 0 });
      const client2 = componentLibrary.createComponent('client-web', 'client', { x: 100, y: 0 });
      
      expect(client1?.id).toBeDefined();
      expect(client2?.id).toBeDefined();
      expect(client1?.id).not.toBe(client2?.id);
    });
  });
});