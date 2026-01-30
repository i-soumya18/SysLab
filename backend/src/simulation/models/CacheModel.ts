/**
 * Cache component simulation model
 * Simulates realistic cache behavior including hit/miss ratios, eviction policies, and memory constraints
 */

import { BaseComponentModel } from './BaseComponentModel';
import { SimulationRequest, SimulationResponse } from '../../types';

type EvictionPolicy = 'LRU' | 'LFU' | 'FIFO' | 'random';

interface CacheConfig {
  capacity: number;
  latency: number;
  failureRate: number;
  maxMemory: number; // bytes
  evictionPolicy: EvictionPolicy;
  ttl: number; // time to live in milliseconds
  hitRatio: number; // expected hit ratio (0-1)
}

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // bytes
}

export class CacheModel extends BaseComponentModel {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU
  private currentMemoryUsage: number = 0;

  constructor(id: string, configuration: CacheConfig) {
    super(id, 'cache', configuration);
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;
    this.queueDepth++;

    try {
      const cacheKey = this.generateCacheKey(request);
      const isRead = this.isReadOperation(request);
      
      let latency: number;
      let responsePayload: any;
      let cacheHit = false;

      if (isRead) {
        // Handle cache read
        const result = this.handleCacheRead(cacheKey);
        cacheHit = result.hit;
        latency = this.calculateCacheLatency(cacheHit);
        responsePayload = {
          operation: 'read',
          cacheHit,
          value: result.value,
          key: cacheKey
        };
      } else {
        // Handle cache write
        const success = this.handleCacheWrite(cacheKey, request.payload);
        latency = this.calculateCacheLatency(false); // Writes are always cache misses
        responsePayload = {
          operation: 'write',
          success,
          key: cacheKey,
          evicted: !success
        };
      }

      // Simulate processing delay
      await this.simulateProcessingDelay(latency);

      this.currentLoad--;
      this.queueDepth--;

      // Check for failure
      if (this.shouldRequestFail()) {
        return this.createFailureResponse(request, latency, 'Cache operation failed');
      }

      return this.createSuccessResponse(request, latency, responsePayload);

    } catch (error) {
      this.currentLoad--;
      this.queueDepth--;
      return this.createFailureResponse(request, 0, `Cache error: ${error}`);
    }
  }

  /**
   * Handle cache read operation
   */
  private handleCacheRead(key: string): { hit: boolean; value: any } {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return { hit: false, value: null };
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.getCacheConfig().ttl) {
      this.evictEntry(key);
      return { hit: false, value: null };
    }

    // Update access statistics
    entry.lastAccessed = now;
    entry.accessCount++;
    
    // Update LRU order
    this.updateAccessOrder(key);

    return { hit: true, value: entry.value };
  }

  /**
   * Handle cache write operation
   */
  private handleCacheWrite(key: string, value: any): boolean {
    const entrySize = this.estimateEntrySize(key, value);
    const config = this.getCacheConfig();

    // Check if we need to evict entries to make space
    while (this.currentMemoryUsage + entrySize > config.maxMemory && this.cache.size > 0) {
      const evictedKey = this.selectEvictionCandidate();
      if (!evictedKey) break;
      this.evictEntry(evictedKey);
    }

    // Check if we still have space
    if (this.currentMemoryUsage + entrySize > config.maxMemory) {
      return false; // Cannot store entry
    }

    // Store the entry
    const now = Date.now();
    const entry: CacheEntry = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size: entrySize
    };

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentMemoryUsage -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.currentMemoryUsage += entrySize;
    this.updateAccessOrder(key);

    return true;
  }

  /**
   * Select entry for eviction based on policy
   */
  private selectEvictionCandidate(): string | null {
    if (this.cache.size === 0) return null;

    const config = this.getCacheConfig();
    const entries = Array.from(this.cache.entries());

    switch (config.evictionPolicy) {
      case 'LRU':
        return this.selectLRUCandidate();
      
      case 'LFU':
        return this.selectLFUCandidate(entries);
      
      case 'FIFO':
        return this.selectFIFOCandidate(entries);
      
      case 'random':
        return this.selectRandomCandidate(entries);
      
      default:
        return entries[0][0]; // Fallback to first entry
    }
  }

  /**
   * Select LRU (Least Recently Used) candidate
   */
  private selectLRUCandidate(): string | null {
    // The first item in accessOrder is the least recently used
    return this.accessOrder[0] || null;
  }

  /**
   * Select LFU (Least Frequently Used) candidate
   */
  private selectLFUCandidate(entries: [string, CacheEntry][]): string {
    return entries.reduce((least, current) => 
      current[1].accessCount < least[1].accessCount ? current : least
    )[0];
  }

  /**
   * Select FIFO (First In, First Out) candidate
   */
  private selectFIFOCandidate(entries: [string, CacheEntry][]): string {
    return entries.reduce((oldest, current) => 
      current[1].timestamp < oldest[1].timestamp ? current : oldest
    )[0];
  }

  /**
   * Select random candidate
   */
  private selectRandomCandidate(entries: [string, CacheEntry][]): string {
    const randomIndex = Math.floor(Math.random() * entries.length);
    return entries[randomIndex][0];
  }

  /**
   * Evict entry from cache
   */
  private evictEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentMemoryUsage -= entry.size;
      
      // Remove from access order
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove key from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: SimulationRequest): string {
    return `${request.sourceComponentId}-${JSON.stringify(request.payload)}`;
  }

  /**
   * Determine if operation is a read
   */
  private isReadOperation(request: SimulationRequest): boolean {
    // Simple heuristic: if payload has 'operation' field, use it; otherwise assume read
    return request.payload?.operation !== 'write';
  }

  /**
   * Calculate cache-specific latency
   */
  private calculateCacheLatency(isHit: boolean): number {
    const baseLatency = this.calculateLatency();
    
    if (isHit) {
      return baseLatency * 0.1; // Cache hits are much faster
    } else {
      return baseLatency; // Cache misses take full latency
    }
  }

  /**
   * Estimate memory size of cache entry
   */
  private estimateEntrySize(key: string, value: any): number {
    // Rough estimation of memory usage
    const keySize = key.length * 2; // Assume UTF-16
    const valueSize = JSON.stringify(value).length * 2;
    const overhead = 64; // Object overhead
    
    return keySize + valueSize + overhead;
  }

  /**
   * Get cache-specific configuration
   */
  private getCacheConfig(): CacheConfig {
    return this.configuration as CacheConfig;
  }

  /**
   * Override metrics to include cache-specific metrics
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    const config = this.getCacheConfig();
    
    return {
      ...baseMetrics,
      cacheSize: this.cache.size,
      memoryUtilization: this.currentMemoryUsage / config.maxMemory,
      hitRatio: this.calculateActualHitRatio(),
      evictionPolicy: config.evictionPolicy,
      averageEntrySize: this.cache.size > 0 ? this.currentMemoryUsage / this.cache.size : 0
    };
  }

  /**
   * Calculate actual hit ratio from recent requests
   */
  private calculateActualHitRatio(): number {
    // This is a simplified calculation
    // In a real implementation, you'd track hits/misses over a sliding window
    const config = this.getCacheConfig();
    return config.hitRatio; // Return configured hit ratio for now
  }

  /**
   * Handle cache-specific failures
   */
  handleFailure(failureType: string): void {
    super.handleFailure(failureType);
    
    switch (failureType) {
      case 'memory_pressure':
        // Aggressive eviction
        const targetSize = Math.floor(this.cache.size * 0.5);
        while (this.cache.size > targetSize) {
          const evictKey = this.selectEvictionCandidate();
          if (!evictKey) break;
          this.evictEntry(evictKey);
        }
        break;
      case 'corruption':
        // Clear entire cache
        this.cache.clear();
        this.accessOrder = [];
        this.currentMemoryUsage = 0;
        break;
    }
  }
}