/**
 * Simulation Workload Routes
 * 
 * REST API routes for simulation workload management
 * Implements SRS NFR-5: Scale simulation workloads
 */

import { Router } from 'express';
import { SimulationWorkloadApiService } from '../services/simulationWorkloadApiService';
import { SimulationWorkloadService } from '../services/simulationWorkloadService';
import { SimulationPerformanceOptimizer } from '../services/simulationPerformanceOptimizer';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Initialize services
const workloadService = new SimulationWorkloadService();
const performanceOptimizer = new SimulationPerformanceOptimizer();
const apiService = new SimulationWorkloadApiService(workloadService, performanceOptimizer);

// Workload Management Routes

/**
 * Submit a simulation workload
 * POST /api/v1/simulation/workload
 */
router.post('/workload', authenticateToken, async (req, res) => {
  await apiService.submitWorkload(req, res);
});

/**
 * Get workload status
 * GET /api/v1/simulation/workload/:workloadId
 */
router.get('/workload/:workloadId', authenticateToken, async (req, res) => {
  await apiService.getWorkload(req, res);
});

/**
 * Cancel a workload
 * DELETE /api/v1/simulation/workload/:workloadId
 */
router.delete('/workload/:workloadId', authenticateToken, async (req, res) => {
  await apiService.cancelWorkload(req, res);
});

/**
 * Get user's workloads
 * GET /api/v1/simulation/workloads
 */
router.get('/workloads', authenticateToken, async (req, res) => {
  await apiService.getUserWorkloads(req, res);
});

// Node Management Routes (Admin/System)

/**
 * Register a simulation node
 * POST /api/v1/simulation/nodes
 */
router.post('/nodes', async (req, res) => {
  await apiService.registerSimulationNode(req, res);
});

/**
 * Update node metrics
 * PUT /api/v1/simulation/nodes/:nodeId/metrics
 */
router.put('/nodes/:nodeId/metrics', async (req, res) => {
  await apiService.updateNodeMetrics(req, res);
});

/**
 * Get simulation nodes
 * GET /api/v1/simulation/nodes
 */
router.get('/nodes', async (req, res) => {
  await apiService.getSimulationNodes(req, res);
});

// Metrics and Analytics Routes

/**
 * Get workload metrics
 * GET /api/v1/simulation/metrics/workload
 */
router.get('/metrics/workload', async (req, res) => {
  await apiService.getWorkloadMetrics(req, res);
});

/**
 * Get queue status
 * GET /api/v1/simulation/metrics/queue
 */
router.get('/metrics/queue', async (req, res) => {
  await apiService.getQueueStatus(req, res);
});

/**
 * Get resource quota
 * GET /api/v1/simulation/quota
 */
router.get('/quota', authenticateToken, async (req, res) => {
  await apiService.getResourceQuota(req, res);
});

// Performance Optimization Routes

/**
 * Get performance metrics
 * GET /api/v1/simulation/performance/metrics
 */
router.get('/performance/metrics', async (req, res) => {
  await apiService.getPerformanceMetrics(req, res);
});

/**
 * Get performance profile for workspace
 * GET /api/v1/simulation/performance/profile/:workspaceId
 */
router.get('/performance/profile/:workspaceId', authenticateToken, async (req, res) => {
  await apiService.getPerformanceProfile(req, res);
});

/**
 * Update batching configuration
 * PUT /api/v1/simulation/performance/batching
 */
router.put('/performance/batching', async (req, res) => {
  await apiService.updateBatchingConfig(req, res);
});

/**
 * Clear cache
 * DELETE /api/v1/simulation/performance/cache
 */
router.delete('/performance/cache', async (req, res) => {
  await apiService.clearCache(req, res);
});

// Dashboard Routes

/**
 * Get simulation workload dashboard
 * GET /api/v1/simulation/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  await apiService.getWorkloadDashboard(req, res);
});

/**
 * Get workload statistics
 * GET /api/v1/simulation/statistics
 */
router.get('/statistics', async (req, res) => {
  await apiService.getWorkloadStatistics(req, res);
});

// Health check for simulation workload system
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'simulation-workload',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

export { router as simulationWorkloadRoutes };