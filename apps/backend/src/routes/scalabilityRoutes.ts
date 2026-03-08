/**
 * Scalability Routes
 * 
 * REST API routes for horizontal scaling, load balancing, and user monitoring
 * Implements SRS NFR-4: Support thousands of concurrent users
 */

import { Router } from 'express';
import { ScalabilityApiService } from '../services/scalabilityApiService';
import { HorizontalScalingService } from '../services/horizontalScalingService';
import { LoadBalancerService } from '../services/loadBalancerService';
import { ConcurrentUserMonitoringService } from '../services/concurrentUserMonitoringService';

// Initialize services
const horizontalScalingService = new HorizontalScalingService();
const loadBalancerService = new LoadBalancerService(horizontalScalingService);
const userMonitoringService = new ConcurrentUserMonitoringService();
const scalabilityApiService = new ScalabilityApiService(
  horizontalScalingService,
  loadBalancerService,
  userMonitoringService
);

const router = Router();

// Horizontal Scaling Routes
router.post('/nodes', (req, res) => scalabilityApiService.registerNode(req, res));
router.put('/nodes/:nodeId/metrics', (req, res) => scalabilityApiService.updateNodeMetrics(req, res));
router.delete('/nodes/:nodeId', (req, res) => scalabilityApiService.removeNode(req, res));
router.get('/nodes', (req, res) => scalabilityApiService.getNodes(req, res));
router.get('/capacity', (req, res) => scalabilityApiService.getSystemCapacity(req, res));

// Auto-scaling Policy Routes
router.put('/auto-scaling/:nodeType', (req, res) => scalabilityApiService.setAutoScalingPolicy(req, res));
router.get('/auto-scaling/:nodeType', (req, res) => scalabilityApiService.getAutoScalingPolicy(req, res));

// Scaling Events Routes
router.get('/events', (req, res) => scalabilityApiService.getScalingEvents(req, res));

// Load Balancer Routes
router.get('/load-balancer/stats', (req, res) => scalabilityApiService.getLoadBalancerStats(req, res));
router.post('/load-balancer/routing-rules', (req, res) => scalabilityApiService.addRoutingRule(req, res));
router.delete('/load-balancer/routing-rules/:ruleId', (req, res) => scalabilityApiService.removeRoutingRule(req, res));
router.get('/load-balancer/routing-rules', (req, res) => scalabilityApiService.getRoutingRules(req, res));
router.get('/load-balancer/circuit-breakers', (req, res) => scalabilityApiService.getCircuitBreakerStates(req, res));
router.post('/load-balancer/circuit-breakers/:nodeId/reset', (req, res) => scalabilityApiService.resetCircuitBreaker(req, res));
router.get('/load-balancer/health', (req, res) => scalabilityApiService.getHealthStatus(req, res));

// User Monitoring Routes
router.get('/users/metrics', (req, res) => scalabilityApiService.getCurrentUserMetrics(req, res));
router.get('/users/analytics', (req, res) => scalabilityApiService.getSessionAnalytics(req, res));
router.get('/users/sessions', (req, res) => scalabilityApiService.getActiveSessions(req, res));
router.put('/users/concurrent-count', (req, res) => scalabilityApiService.updateConcurrentUsers(req, res));

// Capacity Management Routes
router.get('/capacity/alerts', (req, res) => scalabilityApiService.getCapacityAlerts(req, res));
router.post('/capacity/alerts/:alertId/acknowledge', (req, res) => scalabilityApiService.acknowledgeCapacityAlert(req, res));
router.put('/capacity/max', (req, res) => scalabilityApiService.setMaxCapacity(req, res));
router.get('/capacity/forecast', (req, res) => scalabilityApiService.getCapacityForecast(req, res));

// Dashboard Routes
router.get('/dashboard', (req, res) => scalabilityApiService.getScalabilityDashboard(req, res));

export { router as scalabilityRoutes, horizontalScalingService, loadBalancerService, userMonitoringService };