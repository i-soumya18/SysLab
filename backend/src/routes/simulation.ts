import { Router } from 'express';
import { simulationWorkloadRoutes } from './simulationWorkloadRoutes';
import { simulationService } from '../services/simulationService';
import {
  checkResourceQuota,
  estimateWorkload,
  submitAsWorkload,
  applyOptimizations,
  trackMetrics
} from '../middleware/simulationWorkloadMiddleware';

const router = Router();

// Mount simulation workload routes (SRS NFR-5)
router.use('/', simulationWorkloadRoutes);

// Core simulation control routes with workload management
router.post('/start',
  checkResourceQuota,
  estimateWorkload,
  applyOptimizations,
  async (req, res) => {
    try {
      const { workspaceId, workspace, userCount, duration, loadPattern } = req.body;

      if (!workspaceId || !workspace) {
        return res.status(400).json({
          error: 'Missing required fields: workspaceId and workspace configuration'
        });
      }

      // Start the simulation
      const result = await simulationService.startSimulation(workspaceId, workspace, {
        userCount: userCount || 100,
        duration: duration || 60,
        loadPattern
      });

      return res.json({
        success: true,
        simulationId: result.simulationId,
        status: result.status,
        message: result.message,
        workloadContext: req.workloadContext,
        optimizations: {
          caching: req.body.enableCaching || false,
          batching: req.body.enableBatching || false,
          resourceOptimization: req.body.enableResourceOptimization || false
        }
      });
    } catch (error) {
      console.error('Simulation start error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to start simulation'
      });
    }
  }
);

router.post('/stop', trackMetrics, async (req, res) => {
  try {
    const { simulationId } = req.body;

    if (!simulationId) {
      return res.status(400).json({
        error: 'Missing required field: simulationId'
      });
    }

    const result = await simulationService.stopSimulation(simulationId);

    return res.json({
      success: true,
      simulationId: result.simulationId,
      status: result.status,
      duration: result.duration,
      message: `Simulation stopped after ${(result.duration / 1000).toFixed(1)} seconds`
    });
  } catch (error) {
    console.error('Simulation stop error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to stop simulation'
    });
  }
});

router.get('/status/:simulationId', async (req, res) => {
  try {
    const { simulationId } = req.params;

    const status = simulationService.getSimulationStatus(simulationId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Simulation status error:', error);
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Failed to get simulation status'
    });
  }
});

router.get('/metrics/:simulationId', async (req, res) => {
  try {
    const { simulationId } = req.params;

    const metrics = simulationService.getSimulationMetrics(simulationId);

    res.json({
      success: true,
      simulationId,
      ...metrics
    });
  } catch (error) {
    console.error('Simulation metrics error:', error);
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Failed to get simulation metrics'
    });
  }
});

router.get('/active', async (req, res) => {
  try {
    const activeSimulations = simulationService.getActiveSimulations();

    res.json({
      success: true,
      count: activeSimulations.length,
      simulations: activeSimulations
    });
  } catch (error) {
    console.error('Active simulations error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get active simulations'
    });
  }
});

export default router;