/**
 * Search Index Component Model - Enhanced for System Graph Engine
 * 
 * Models full-text search with indexing latency, relevance scoring,
 * and query complexity scaling.
 */

import { BaseComponentModel } from './BaseComponentModel';
import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentType } from '../../types';

export interface SearchIndexConfiguration extends ComponentConfig {
  indexType: 'full-text' | 'faceted' | 'geospatial' | 'time-based';
  indexSize: number; // number of documents
  shardCount: number;
  replicationFactor: number;
  queryComplexityThreshold: number; // max query complexity before degradation
  indexingLatency: number; // base latency for indexing operations
}

export interface SearchQuery {
  query: string;
  filters?: { [key: string]: any };
  sort?: string[];
  limit?: number;
  offset?: number;
  complexity: number; // calculated query complexity score
}

export interface SearchResult {
  documents: SearchDocument[];
  totalHits: number;
  searchTime: number;
  relevanceScores: number[];
}

export interface SearchDocument {
  id: string;
  score: number;
  fields: { [key: string]: any };
}

export class SearchIndexModel extends BaseComponentModel {
  private indexedDocuments: number = 0;
  private activeQueries: Map<string, SearchQuery> = new Map();
  private queryCache: Map<string, SearchResult> = new Map();
  private indexingQueue: any[] = [];

  constructor(id: string, configuration: SearchIndexConfiguration) {
    super(id, 'database' as ComponentType, configuration); // Use database as closest legacy type
    this.indexedDocuments = configuration.indexSize || 1000000;
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;

    try {
      const operation = request.payload?.operation || 'search';
      
      if (operation === 'search') {
        return this.handleSearch(request);
      } else if (operation === 'index') {
        return this.handleIndexing(request);
      } else if (operation === 'delete') {
        return this.handleDeletion(request);
      } else {
        return this.createFailureResponse(request, 1, 'Unknown search operation');
      }
    } finally {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    }
  }

  /**
   * Handle search query
   */
  private async handleSearch(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as SearchIndexConfiguration;
    const query = this.parseSearchQuery(request.payload?.query);
    
    // Check query cache first
    const cacheKey = this.generateCacheKey(query);
    const cachedResult = this.queryCache.get(cacheKey);
    
    if (cachedResult && Math.random() < 0.3) { // 30% cache hit rate
      const cacheLatency = 2; // 2ms for cache hit
      await this.simulateProcessingDelay(cacheLatency);
      
      return this.createSuccessResponse(request, cacheLatency, {
        ...cachedResult,
        cached: true
      });
    }

    // Calculate query complexity and latency
    const complexityMultiplier = this.calculateComplexityMultiplier(query);
    const shardLatency = this.calculateShardLatency(query);
    const relevanceLatency = this.calculateRelevanceLatency(query);
    
    const totalLatency = (this.calculateLatency() + shardLatency + relevanceLatency) * complexityMultiplier;
    
    // Check if query is too complex
    if (query.complexity > config.queryComplexityThreshold) {
      return this.createFailureResponse(request, totalLatency, 'Query too complex - timeout');
    }

    // Simulate search failure
    if (this.shouldRequestFail()) {
      return this.createFailureResponse(request, totalLatency, 'Search index error');
    }

    await this.simulateProcessingDelay(totalLatency);

    // Generate mock search results
    const result = this.generateSearchResults(query, totalLatency);
    
    // Cache the result
    this.queryCache.set(cacheKey, result);
    
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.queryCache.delete(firstKey);
      }
    }

    return this.createSuccessResponse(request, totalLatency, result);
  }

  /**
   * Handle document indexing
   */
  private async handleIndexing(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as SearchIndexConfiguration;
    const documents = request.payload?.documents || [request.payload?.document];
    
    if (!documents || documents.length === 0) {
      return this.createFailureResponse(request, 1, 'No documents to index');
    }

    // Calculate indexing latency based on document size and complexity
    const baseIndexingLatency = config.indexingLatency || 50;
    const documentComplexity = this.calculateDocumentComplexity(documents);
    const replicationLatency = config.replicationFactor * 10; // 10ms per replica
    
    const totalLatency = (baseIndexingLatency + replicationLatency) * documentComplexity;

    // Check if indexing should fail
    if (this.shouldRequestFail()) {
      return this.createFailureResponse(request, totalLatency, 'Indexing failed');
    }

    await this.simulateProcessingDelay(totalLatency);

    // Update indexed document count
    this.indexedDocuments += documents.length;
    
    // Clear relevant cache entries (simplified)
    this.queryCache.clear();

    return this.createSuccessResponse(request, totalLatency, {
      indexedDocuments: documents.length,
      totalDocuments: this.indexedDocuments,
      replicationFactor: config.replicationFactor
    });
  }

  /**
   * Handle document deletion
   */
  private async handleDeletion(request: SimulationRequest): Promise<SimulationResponse> {
    const config = this.configuration as SearchIndexConfiguration;
    const documentIds = request.payload?.documentIds || [request.payload?.documentId];
    
    if (!documentIds || documentIds.length === 0) {
      return this.createFailureResponse(request, 1, 'No document IDs provided');
    }

    // Deletion is typically faster than indexing
    const deletionLatency = (config.indexingLatency || 50) * 0.3; // 30% of indexing latency
    const replicationLatency = config.replicationFactor * 5; // 5ms per replica for deletion
    
    const totalLatency = deletionLatency + replicationLatency;

    await this.simulateProcessingDelay(totalLatency);

    // Update indexed document count
    this.indexedDocuments = Math.max(0, this.indexedDocuments - documentIds.length);
    
    // Clear cache
    this.queryCache.clear();

    return this.createSuccessResponse(request, totalLatency, {
      deletedDocuments: documentIds.length,
      totalDocuments: this.indexedDocuments
    });
  }

  /**
   * Parse search query and calculate complexity
   */
  private parseSearchQuery(queryData: any): SearchQuery {
    const query: SearchQuery = {
      query: queryData?.query || '',
      filters: queryData?.filters || {},
      sort: queryData?.sort || [],
      limit: queryData?.limit || 10,
      offset: queryData?.offset || 0,
      complexity: 1
    };

    // Calculate query complexity
    let complexity = 1;
    
    // Text query complexity
    const queryTerms = query.query.split(' ').length;
    complexity += queryTerms * 0.1;
    
    // Filter complexity
    const filterCount = Object.keys(query.filters || {}).length;
    complexity += filterCount * 0.2;
    
    // Sort complexity
    complexity += (query.sort?.length || 0) * 0.3;
    
    // Result size complexity
    complexity += (query.limit || 10) * 0.001;
    
    query.complexity = complexity;
    return query;
  }

  /**
   * Calculate complexity multiplier for latency
   */
  private calculateComplexityMultiplier(query: SearchQuery): number {
    return Math.max(1, Math.log(query.complexity + 1));
  }

  /**
   * Calculate shard latency based on query distribution
   */
  private calculateShardLatency(query: SearchQuery): number {
    const config = this.configuration as SearchIndexConfiguration;
    const shardCount = config.shardCount || 1;
    
    // More shards = more parallel processing but also coordination overhead
    return Math.log(shardCount + 1) * 5;
  }

  /**
   * Calculate relevance scoring latency
   */
  private calculateRelevanceLatency(query: SearchQuery): number {
    // More complex queries require more relevance calculation
    return query.complexity * 2;
  }

  /**
   * Calculate document complexity for indexing
   */
  private calculateDocumentComplexity(documents: any[]): number {
    let totalComplexity = 0;
    
    for (const doc of documents) {
      let docComplexity = 1;
      
      // Field count complexity
      const fieldCount = Object.keys(doc).length;
      docComplexity += fieldCount * 0.1;
      
      // Text content complexity (approximate)
      for (const value of Object.values(doc)) {
        if (typeof value === 'string') {
          docComplexity += value.length * 0.0001;
        }
      }
      
      totalComplexity += docComplexity;
    }
    
    return totalComplexity / documents.length; // Average complexity
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      query: query.query,
      filters: query.filters,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset
    });
  }

  /**
   * Generate mock search results
   */
  private generateSearchResults(query: SearchQuery, searchTime: number): SearchResult {
    const limit = query.limit || 10;
    const totalHits = Math.floor(Math.random() * this.indexedDocuments * 0.1); // 10% of index matches
    
    const documents: SearchDocument[] = [];
    const relevanceScores: number[] = [];
    
    for (let i = 0; i < Math.min(limit, totalHits); i++) {
      const score = Math.random() * 0.8 + 0.2; // Score between 0.2 and 1.0
      documents.push({
        id: `doc_${i + (query.offset || 0)}`,
        score,
        fields: {
          title: `Document ${i + 1}`,
          content: `Content matching query: ${query.query}`
        }
      });
      relevanceScores.push(score);
    }

    return {
      documents,
      totalHits,
      searchTime,
      relevanceScores
    };
  }

  /**
   * Get search index statistics
   */
  getIndexStats(): {
    indexedDocuments: number;
    activeQueries: number;
    cacheSize: number;
    cacheHitRate: number;
    averageQueryComplexity: number;
  } {
    const activeQueryComplexities = Array.from(this.activeQueries.values()).map(q => q.complexity);
    const averageComplexity = activeQueryComplexities.length > 0 
      ? activeQueryComplexities.reduce((sum, c) => sum + c, 0) / activeQueryComplexities.length 
      : 0;

    return {
      indexedDocuments: this.indexedDocuments,
      activeQueries: this.activeQueries.size,
      cacheSize: this.queryCache.size,
      cacheHitRate: 0.3, // Simplified - would track actual hits/misses in real implementation
      averageQueryComplexity: averageComplexity
    };
  }
}