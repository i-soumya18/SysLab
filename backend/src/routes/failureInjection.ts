/**
 * Failure Injection API Routes implementing SRS FR-6
 * 
 * Provides REST API endpoints for failure injection functionality
 * Implements all SRS FR-6 requirements through HTTP endpoints
 */

import { Router } from 'express';
import { FailureInjectionService } from '../services/failureInjectionService';

const router = Router();

/**
 * @route POST /api/failure-injection/component/:componentId
 * @desc Inject component failure per SRS FR-6.1
 * @access Private
 */
router.post('/component/:componentId', FailureInjectionService.injectComponentFailure);

/**
 * @route POST /api/failure-injection/network/:componentId
 * @desc Inject network latency per SRS FR-6.2
 * @access Private
 */
router.post('/network/:componentId', FailureInjectionService.injectNetworkLatency);

/**
 * @route POST /api/failure-injection/partition
 * @desc Simulate network partition per SRS FR-6.3
 * @access Private
 */
router.post('/partition', FailureInjectionService.simulateNetworkPartition);

/**
 * @route POST /api/failure-injection/regional/:region
 * @desc Simulate regional outage per SRS FR-6.4
 * @access Private
 */
router.post('/regional/:region', FailureInjectionService.simulateRegionalOutage);

/**
 * @route GET /api/failure-injection/status/:injectionId
 * @desc Get failure injection status
 * @access Private
 */
router.get('/status/:injectionId', FailureInjectionService.getInjectionStatus);

/**
 * @route POST /api/failure-injection/stop/:injectionId
 * @desc Stop failure injection
 * @access Private
 */
router.post('/stop/:injectionId', FailureInjectionService.stopInjection);

/**
 * @route GET /api/failure-injection/active
 * @desc Get active failure injections
 * @access Private
 */
router.get('/active', FailureInjectionService.getActiveInjections);

/**
 * @route GET /api/failure-injection/impact/:componentId
 * @desc Get failure impact analysis per SRS FR-6.5
 * @access Private
 */
router.get('/impact/:componentId', FailureInjectionService.getFailureImpactAnalysis);

export default router;