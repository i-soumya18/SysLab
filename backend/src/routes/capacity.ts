/**
 * Capacity Management API Routes
 * Implements SRS FR-3.2: Component capacity limits, monitoring, and alerting
 */

import { Router } from 'express';
import { CapacityService } from '../services/capacityService';

const router = Router();

// Get capacity limits for a component
router.get('/limits/:componentKey', CapacityService.getCapacityLimits);

// Get current capacity metrics for a component
router.get('/metrics/:componentId', CapacityService.getCapacityMetrics);

// Update capacity metrics for a component
router.put('/metrics/:componentId', CapacityService.updateCapacityMetrics);

// Get active alerts for a component
router.get('/alerts/:componentId', CapacityService.getActiveAlerts);

// Get all active alerts across all components
router.get('/alerts', CapacityService.getAllActiveAlerts);

// Acknowledge an alert
router.put('/alerts/:componentId/:alertId/acknowledge', CapacityService.acknowledgeAlert);

// Clear acknowledged alerts for a component
router.delete('/alerts/:componentId/acknowledged', CapacityService.clearAcknowledgedAlerts);

// Check if component is at capacity
router.get('/status/:componentId', CapacityService.checkCapacityStatus);

// Update capacity thresholds
router.put('/thresholds', CapacityService.updateThresholds);

// Get current capacity thresholds
router.get('/thresholds', CapacityService.getThresholds);

export default router;