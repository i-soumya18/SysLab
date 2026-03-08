/**
 * Object Storage Component Model - Enhanced for System Graph Engine
 * 
 * Models scalable object storage with consistency models, throughput limits,
 * and multi-part upload behavior.
 */

import { BaseComponentModel } from './BaseComponentModel';
import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentType } from '../../types';

export interface ObjectStorageConfiguration extends ComponentConfig {
  consistencyModel: 'strong' | 'eventual' | 'read-after-write';
  replicationFactor: number;
  maxObjectSize: number; // bytes
  multiPartThreshold: number; // bytes - when to use multi-part upload
  throughputLimit: number; // bytes per second
  storageClass: 'standard' | 'infrequent' | 'archive';
  geographicReplication: boolean;
}

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  metadata: { [key: string]: string };
  uploadTime: number;
  lastModified: number;
  etag: string;
  storageClass: string;
}

export interface MultiPartUpload {
  uploadId: string;
  key: string;
  parts: UploadPart[];
  initiated: number;
  totalSize: number;
}

export interface UploadPart {
  partNumber: number;
  size: number;
  etag: string;
  uploaded: boolean;
}

export class ObjectStorageModel extends BaseComponentModel {
  private storedObjects: Map<string, StorageObject> = new Map();
  private activeUploads: Map<string, MultiPartUpload> = new Map();
  private totalStorageUsed: number = 0;
  private currentThroughput: number = 0;
  private lastThroughputReset: number = Date.now();

  constructor(id: string, configuration: ObjectStorageConfiguration) {
    super(id, 'database' as ComponentType, configuration); // Use database as closest legacy type
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;

    try {
      const operation = request.payload?.operation || 'get';
      
      switch (operation) {
        case 'put':
          return this.handlePutObject(request);
        case 'get':
          return this.handleGetObject(request);
        case 'delete':
          return this.handleDeleteObject(request);
        case 'list':
          return this.handleListObjects(request);
        case 'multipart-init':
          return this.handleMultiPartInit(request);
        case 'multipart-upload':
          return this.handleMultiPartUpload(request);
        case 'multipart-complete':
          return this.handleMultiPartComplete(request);
        default:
          return this.createFailureResponse(request, 1, 'Unknown storage operation');
      }
    } finally {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    }
  }

  /**
   * Handle object upload (PUT)
   */
  private async handlePutObject(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as ObjectStorageConfiguration;
    const key = request.payload?.key;
    const size = request.payload?.size || 1024; // Default 1KB
    const contentType = request.payload?.contentType || 'application/octet-stream';
    const metadata = request.payload?.metadata || {};

    if (!key) {
      return this.createFailureResponse(request, 1, 'Object key required');
    }

    // Check if object is too large for single upload
    if (size > config.multiPartThreshold) {
      return this.createFailureResponse(request, 1, 'Object too large - use multipart upload');
    }

    // Check throughput limits
    if (!this.checkThroughputLimit(size)) {
      return this.createFailureResponse(request, 1, 'Throughput limit exceeded');
    }

    // Calculate upload latency based on size and consistency model
    const uploadLatency = this.calculateUploadLatency(size);
    const consistencyLatency = this.calculateConsistencyLatency();
    const replicationLatency = this.calculateReplicationLatency();
    
    const totalLatency = uploadLatency + consistencyLatency + replicationLatency;

    // Simulate upload failure
    if (this.shouldRequestFail()) {
      return this.createFailureResponse(request, totalLatency, 'Upload failed');
    }

    await this.simulateProcessingDelay(totalLatency);

    // Store the object
    const etag = this.generateETag(key, size);
    const storageObject: StorageObject = {
      key,
      size,
      contentType,
      metadata,
      uploadTime: Date.now(),
      lastModified: Date.now(),
      etag,
      storageClass: config.storageClass
    };

    this.storedObjects.set(key, storageObject);
    this.totalStorageUsed += size;
    this.updateThroughput(size);

    return this.createSuccessResponse(request, totalLatency, {
      key,
      etag,
      size,
      storageClass: config.storageClass
    });
  }

  /**
   * Handle object download (GET)
   */
  private async handleGetObject(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as ObjectStorageConfiguration;
    const key = request.payload?.key;

    if (!key) {
      return this.createFailureResponse(request, 1, 'Object key required');
    }

    const storageObject = this.storedObjects.get(key);
    if (!storageObject) {
      return this.createFailureResponse(request, 10, 'Object not found');
    }

    // Check throughput limits
    if (!this.checkThroughputLimit(storageObject.size)) {
      return this.createFailureResponse(request, 1, 'Throughput limit exceeded');
    }

    // Calculate download latency
    const downloadLatency = this.calculateDownloadLatency(storageObject.size);
    const consistencyLatency = this.calculateConsistencyLatency();
    
    const totalLatency = downloadLatency + consistencyLatency;

    // Simulate download failure
    if (this.shouldRequestFail()) {
      return this.createFailureResponse(request, totalLatency, 'Download failed');
    }

    await this.simulateProcessingDelay(totalLatency);

    this.updateThroughput(storageObject.size);

    return this.createSuccessResponse(request, totalLatency, {
      key: storageObject.key,
      size: storageObject.size,
      contentType: storageObject.contentType,
      metadata: storageObject.metadata,
      etag: storageObject.etag,
      lastModified: storageObject.lastModified
    });
  }

  /**
   * Handle object deletion
   */
  private async handleDeleteObject(request: SimulationRequest): Promise<SimulationResponse> {
    const key = request.payload?.key;

    if (!key) {
      return this.createFailureResponse(request, 1, 'Object key required');
    }

    const storageObject = this.storedObjects.get(key);
    if (!storageObject) {
      return this.createFailureResponse(request, 5, 'Object not found');
    }

    // Calculate deletion latency
    const deletionLatency = this.calculateLatency() + this.calculateReplicationLatency();

    await this.simulateProcessingDelay(deletionLatency);

    // Remove the object
    this.storedObjects.delete(key);
    this.totalStorageUsed -= storageObject.size;

    return this.createSuccessResponse(request, deletionLatency, {
      key,
      deleted: true
    });
  }

  /**
   * Handle object listing
   */
  private async handleListObjects(request: SimulationRequest): Promise<SimulationResponse> {
    const prefix = request.payload?.prefix || '';
    const maxKeys = request.payload?.maxKeys || 1000;
    const marker = request.payload?.marker || '';

    // Filter objects by prefix
    const filteredObjects = Array.from(this.storedObjects.values())
      .filter(obj => obj.key.startsWith(prefix))
      .filter(obj => !marker || obj.key > marker)
      .slice(0, maxKeys);

    const listingLatency = Math.max(10, filteredObjects.length * 0.1); // Minimum 10ms

    await this.simulateProcessingDelay(listingLatency);

    return this.createSuccessResponse(request, listingLatency, {
      objects: filteredObjects.map(obj => ({
        key: obj.key,
        size: obj.size,
        lastModified: obj.lastModified,
        etag: obj.etag,
        storageClass: obj.storageClass
      })),
      truncated: false,
      maxKeys,
      prefix
    });
  }

  /**
   * Handle multipart upload initialization
   */
  private async handleMultiPartInit(request: SimulationRequest): Promise<SimulationResponse> {
    const key = request.payload?.key;
    const totalSize = request.payload?.totalSize || 0;

    if (!key) {
      return this.createFailureResponse(request, 1, 'Object key required');
    }

    const uploadId = `upload_${Date.now()}_${Math.random()}`;
    const multiPartUpload: MultiPartUpload = {
      uploadId,
      key,
      parts: [],
      initiated: Date.now(),
      totalSize
    };

    this.activeUploads.set(uploadId, multiPartUpload);

    const initLatency = 5; // 5ms to initialize
    await this.simulateProcessingDelay(initLatency);

    return this.createSuccessResponse(request, initLatency, {
      uploadId,
      key
    });
  }

  /**
   * Handle multipart upload part
   */
  private async handleMultiPartUpload(request: SimulationRequest): Promise<SimulationResponse> {
    const uploadId = request.payload?.uploadId;
    const partNumber = request.payload?.partNumber;
    const size = request.payload?.size || 1024;

    if (!uploadId || !partNumber) {
      return this.createFailureResponse(request, 1, 'Upload ID and part number required');
    }

    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      return this.createFailureResponse(request, 1, 'Upload not found');
    }

    // Check throughput limits
    if (!this.checkThroughputLimit(size)) {
      return this.createFailureResponse(request, 1, 'Throughput limit exceeded');
    }

    const uploadLatency = this.calculateUploadLatency(size);
    await this.simulateProcessingDelay(uploadLatency);

    // Add part to upload
    const etag = this.generateETag(`${upload.key}_part_${partNumber}`, size);
    const part: UploadPart = {
      partNumber,
      size,
      etag,
      uploaded: true
    };

    upload.parts.push(part);
    this.updateThroughput(size);

    return this.createSuccessResponse(request, uploadLatency, {
      uploadId,
      partNumber,
      etag
    });
  }

  /**
   * Handle multipart upload completion
   */
  private async handleMultiPartComplete(request: SimulationRequest): Promise<SimulationResponse> {
    const uploadId = request.payload?.uploadId;
    const parts = request.payload?.parts || [];

    if (!uploadId) {
      return this.createFailureResponse(request, 1, 'Upload ID required');
    }

    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      return this.createFailureResponse(request, 1, 'Upload not found');
    }

    // Validate all parts are uploaded
    const totalSize = upload.parts.reduce((sum, part) => sum + part.size, 0);
    
    const completionLatency = this.calculateLatency() + this.calculateReplicationLatency();
    await this.simulateProcessingDelay(completionLatency);

    // Create the final object
    const etag = this.generateETag(upload.key, totalSize);
    const storageObject: StorageObject = {
      key: upload.key,
      size: totalSize,
      contentType: 'application/octet-stream',
      metadata: {},
      uploadTime: Date.now(),
      lastModified: Date.now(),
      etag,
      storageClass: (this.configuration as ObjectStorageConfiguration).storageClass
    };

    this.storedObjects.set(upload.key, storageObject);
    this.totalStorageUsed += totalSize;
    this.activeUploads.delete(uploadId);

    return this.createSuccessResponse(request, completionLatency, {
      key: upload.key,
      etag,
      size: totalSize
    });
  }

  /**
   * Calculate upload latency based on size
   */
  private calculateUploadLatency(size: number): number {
    const config = this.configuration as ObjectStorageConfiguration;
    const baseLatency = this.calculateLatency();
    const sizeLatency = (size / 1024) * 0.1; // 0.1ms per KB
    const throughputLatency = size / (config.throughputLimit / 1000); // Convert to ms
    
    return baseLatency + sizeLatency + throughputLatency;
  }

  /**
   * Calculate download latency based on size
   */
  private calculateDownloadLatency(size: number): number {
    // Downloads are typically faster than uploads
    return this.calculateUploadLatency(size) * 0.7;
  }

  /**
   * Calculate consistency latency based on model
   */
  private calculateConsistencyLatency(): number {
    const config = this.configuration as ObjectStorageConfiguration;
    
    switch (config.consistencyModel) {
      case 'strong':
        return 20; // 20ms for strong consistency
      case 'read-after-write':
        return 10; // 10ms for read-after-write
      case 'eventual':
        return 2; // 2ms for eventual consistency
      default:
        return 10;
    }
  }

  /**
   * Calculate replication latency
   */
  private calculateReplicationLatency(): number {
    const config = this.configuration as ObjectStorageConfiguration;
    const baseReplicationLatency = config.replicationFactor * 5; // 5ms per replica
    const geoLatency = config.geographicReplication ? 50 : 0; // 50ms for geo replication
    
    return baseReplicationLatency + geoLatency;
  }

  /**
   * Check throughput limits
   */
  private checkThroughputLimit(size: number): boolean {
    const config = this.configuration as ObjectStorageConfiguration;
    const now = Date.now();
    
    // Reset throughput counter every second
    if (now - this.lastThroughputReset > 1000) {
      this.currentThroughput = 0;
      this.lastThroughputReset = now;
    }
    
    return (this.currentThroughput + size) <= config.throughputLimit;
  }

  /**
   * Update throughput tracking
   */
  private updateThroughput(size: number): void {
    this.currentThroughput += size;
  }

  /**
   * Generate ETag for object
   */
  private generateETag(key: string, size: number): string {
    return `"${key.length.toString(16)}-${size.toString(16)}-${Date.now().toString(16)}"`;
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalObjects: number;
    totalStorageUsed: number;
    activeUploads: number;
    currentThroughput: number;
    averageObjectSize: number;
  } {
    const totalObjects = this.storedObjects.size;
    const averageObjectSize = totalObjects > 0 ? this.totalStorageUsed / totalObjects : 0;

    return {
      totalObjects,
      totalStorageUsed: this.totalStorageUsed,
      activeUploads: this.activeUploads.size,
      currentThroughput: this.currentThroughput,
      averageObjectSize
    };
  }
}