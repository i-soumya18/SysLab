/**
 * Queue Component Model - Enhanced for System Graph Engine
 * 
 * Models message queuing with different patterns, durability guarantees,
 * and backpressure handling.
 */

import { BaseComponentModel } from './BaseComponentModel';
import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentType } from '../../types';

export interface QueueConfiguration extends ComponentConfig {
  queueType: 'FIFO' | 'priority' | 'pub-sub' | 'dead-letter';
  maxQueueSize: number;
  durabilityLevel: 'none' | 'disk' | 'replicated';
  retentionPeriod: number; // milliseconds
  batchSize: number; // for batch processing
  consumerCount: number;
  deadLetterThreshold: number; // max retries before dead letter
}

export interface QueueMessage {
  id: string;
  payload: any;
  timestamp: number;
  priority?: number;
  retryCount: number;
  expiresAt?: number;
}

export class QueueModel extends BaseComponentModel {
  private messageQueue: QueueMessage[] = [];
  private deadLetterQueue: QueueMessage[] = [];
  private processingMessages: Map<string, QueueMessage> = new Map();
  private consumers: number = 0;
  private totalMessagesProcessed: number = 0;

  constructor(id: string, configuration: QueueConfiguration) {
    super(id, 'message-queue' as ComponentType, configuration);
    this.consumers = configuration.consumerCount || 1;
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    
    const config = this.configuration as QueueConfiguration;
    
    // Check if this is a publish or consume operation
    const operation = request.payload?.operation || 'publish';
    
    if (operation === 'publish') {
      return this.handlePublish(request);
    } else if (operation === 'consume') {
      return this.handleConsume(request);
    } else {
      return this.createFailureResponse(request, 1, 'Unknown queue operation');
    }
  }

  /**
   * Handle message publishing to the queue
   */
  private async handlePublish(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as QueueConfiguration;
    
    // Check queue capacity
    if (this.messageQueue.length >= config.maxQueueSize) {
      return this.createFailureResponse(request, 1, 'Queue full - backpressure applied');
    }

    // Create queue message
    const message: QueueMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      payload: request.payload?.message,
      timestamp: Date.now(),
      priority: request.payload?.priority || 0,
      retryCount: 0,
      expiresAt: config.retentionPeriod > 0 ? Date.now() + config.retentionPeriod : undefined
    };

    // Add to queue based on type
    this.addMessageToQueue(message);
    
    // Simulate durability overhead
    let durabilityLatency = 0;
    switch (config.durabilityLevel) {
      case 'disk':
        durabilityLatency = 5; // 5ms for disk write
        break;
      case 'replicated':
        durabilityLatency = 15; // 15ms for replication
        break;
      default:
        durabilityLatency = 1; // 1ms for in-memory
    }

    const totalLatency = this.calculateLatency() + durabilityLatency;
    await this.simulateProcessingDelay(totalLatency);

    return this.createSuccessResponse(request, totalLatency, {
      messageId: message.id,
      queueSize: this.messageQueue.length,
      durabilityLevel: config.durabilityLevel
    });
  }

  /**
   * Handle message consumption from the queue
   */
  private async handleConsume(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as QueueConfiguration;
    
    // Check if there are messages to consume
    if (this.messageQueue.length === 0) {
      return this.createSuccessResponse(request, 1, {
        messages: [],
        queueSize: 0
      });
    }

    // Get messages based on batch size
    const batchSize = Math.min(config.batchSize, this.messageQueue.length);
    const messages: QueueMessage[] = [];

    for (let i = 0; i < batchSize; i++) {
      const message = this.getNextMessage();
      if (message) {
        messages.push(message);
        this.processingMessages.set(message.id, message);
      }
    }

    // Simulate processing latency
    const processingLatency = this.calculateLatency() * messages.length;
    await this.simulateProcessingDelay(processingLatency);

    // Simulate processing success/failure
    const processedMessages: QueueMessage[] = [];
    const failedMessages: QueueMessage[] = [];

    for (const message of messages) {
      if (this.shouldRequestFail()) {
        // Message processing failed
        message.retryCount++;
        
        if (message.retryCount >= config.deadLetterThreshold) {
          // Move to dead letter queue
          this.deadLetterQueue.push(message);
        } else {
          // Retry - put back in queue
          this.addMessageToQueue(message);
        }
        
        failedMessages.push(message);
      } else {
        // Message processed successfully
        processedMessages.push(message);
        this.totalMessagesProcessed++;
      }
      
      this.processingMessages.delete(message.id);
    }

    return this.createSuccessResponse(request, processingLatency, {
      processedMessages: processedMessages.length,
      failedMessages: failedMessages.length,
      queueSize: this.messageQueue.length,
      deadLetterSize: this.deadLetterQueue.length
    });
  }

  /**
   * Add message to queue based on queue type
   */
  private addMessageToQueue(message: QueueMessage): void {
    const config = this.configuration as QueueConfiguration;
    
    switch (config.queueType) {
      case 'FIFO':
        this.messageQueue.push(message);
        break;
      case 'priority':
        // Insert based on priority (higher priority first)
        const insertIndex = this.messageQueue.findIndex(m => (m.priority || 0) < (message.priority || 0));
        if (insertIndex === -1) {
          this.messageQueue.push(message);
        } else {
          this.messageQueue.splice(insertIndex, 0, message);
        }
        break;
      case 'pub-sub':
        // For pub-sub, we simulate multiple subscribers
        this.messageQueue.push(message);
        break;
      case 'dead-letter':
        // This is the dead letter queue itself
        this.messageQueue.push(message);
        break;
    }
  }

  /**
   * Get next message from queue based on queue type
   */
  private getNextMessage(): QueueMessage | null {
    const config = this.configuration as QueueConfiguration;
    
    // Clean up expired messages first
    this.cleanupExpiredMessages();
    
    if (this.messageQueue.length === 0) {
      return null;
    }

    switch (config.queueType) {
      case 'FIFO':
      case 'priority':
      case 'dead-letter':
        return this.messageQueue.shift() || null;
      case 'pub-sub':
        // For pub-sub, we don't remove the message (multiple consumers)
        // In a real implementation, this would be more complex
        return this.messageQueue.shift() || null;
      default:
        return this.messageQueue.shift() || null;
    }
  }

  /**
   * Clean up expired messages
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    this.messageQueue = this.messageQueue.filter(message => 
      !message.expiresAt || message.expiresAt > now
    );
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    deadLetterSize: number;
    processingCount: number;
    totalProcessed: number;
    averageAge: number;
  } {
    const now = Date.now();
    const averageAge = this.messageQueue.length > 0 
      ? this.messageQueue.reduce((sum, msg) => sum + (now - msg.timestamp), 0) / this.messageQueue.length
      : 0;

    return {
      queueSize: this.messageQueue.length,
      deadLetterSize: this.deadLetterQueue.length,
      processingCount: this.processingMessages.size,
      totalProcessed: this.totalMessagesProcessed,
      averageAge
    };
  }

  /**
   * Get current queue depth for metrics
   */
  getCurrentQueueDepth(): number {
    return this.messageQueue.length;
  }

  /**
   * Check if queue is experiencing backpressure
   */
  isBackpressureActive(): boolean {
    const config = this.configuration as QueueConfiguration;
    return this.messageQueue.length >= config.maxQueueSize * 0.8; // 80% threshold
  }
}