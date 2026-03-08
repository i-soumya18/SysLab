/**
 * Scaling Management API Routes
 * Implements SRS FR-3.3: Vertical scaling, horizontal scaling, and auto-scaling policies
 */

import { Router } from 'express';
import { ScalingService } from '../services/scalingService';

const router = Router();

// Get vertical scaling configuration
router.get('/vertical/:componentKey', ScalingService.getVerticalScalingConfig);

// Get horizontal scaling configuration
router.get('/horizontal/:componentKey', ScalingService.getHorizontalScalingConfig);

// Get auto-scaling policy
router.get('/auto-scaling/:componentKey', ScalingService.getAutoScalingPolicy);

// Update vertical scaling configuration
router.put('/vertical/:componentKey', ScalingService.updateVerticalScalingConfig);

// Update horizontal scaling configuration
router.put('/horizontal/:componentKey', ScalingService.updateHorizontalScalingConfig);

// Update auto-scaling policy
router.put('/auto-scaling/:componentKey', ScalingService.updateAutoScalingPolicy);

// Evaluate scaling needs for a component
router.get('/evaluate/:componentId', ScalingService.evaluateScalingNeeds);

// Execute scaling action
router.post('/execute/:componentId', ScalingService.executeScalingAction);

// Get scaling events for a component
router.get('/events/:componentId', ScalingService.getScalingEvents);

// Get all scaling events
router.get('/events', ScalingService.getAllScalingEvents);

// Get scaling capabilities for a component
router.get('/capabilities/:componentKey', ScalingService.getScalingCapabilities);

export default router;