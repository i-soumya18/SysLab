/**
 * Consistency Management API Routes
 * Implements SRS FR-3.4: Database consistency levels and cache consistency/replication settings
 */

import { Router } from 'express';
import { ConsistencyService } from '../services/consistencyService';

const router = Router();

// Get database consistency configuration
router.get('/database/:componentKey', ConsistencyService.getDatabaseConsistencyConfig);

// Get cache consistency configuration
router.get('/cache/:componentKey', ConsistencyService.getCacheConsistencyConfig);

// Update database consistency configuration
router.put('/database/:componentKey', ConsistencyService.updateDatabaseConsistencyConfig);

// Update cache consistency configuration
router.put('/cache/:componentKey', ConsistencyService.updateCacheConsistencyConfig);

// Analyze CAP theorem trade-offs
router.get('/cap-analysis/:componentKey', ConsistencyService.analyzeCAPTradeoffs);

// Update consistency metrics
router.put('/metrics/:componentId', ConsistencyService.updateConsistencyMetrics);

// Get consistency metrics
router.get('/metrics/:componentId', ConsistencyService.getConsistencyMetrics);

// Get consistency events
router.get('/events/:componentId', ConsistencyService.getConsistencyEvents);

// Resolve consistency event
router.put('/events/:componentId/:eventId/resolve', ConsistencyService.resolveConsistencyEvent);

// Get replication factor and consistency guarantees
router.get('/replication/:componentKey', ConsistencyService.getReplicationFactor);

export default router;