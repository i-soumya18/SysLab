import { Router } from 'express';
import { z } from 'zod';
import { aiInsightService } from '../services/aiInsightService';
import type {
  ArchitectureCriticRequest,
  BottleneckRootCauseRequest,
  SocraticTutorRequest,
  VersionDiffReviewerRequest
} from '../services/aiInsightService';
import type { ErrorResponse } from '../types';

const router = Router();

const ArchitectureCriticSchema = z.object({
  workspace: z.any(),
  systemMetrics: z.any().optional(),
  bottlenecks: z.array(z.any()).optional(),
  userGoal: z.string().max(500).optional()
});

const RootCauseSchema = z.object({
  workspace: z.any(),
  systemMetrics: z.any().optional(),
  componentMetrics: z.record(z.any()).optional(),
  bottlenecks: z.array(z.any()).optional(),
  recentEvents: z.array(z.object({
    type: z.string(),
    timestamp: z.string(),
    details: z.string().optional()
  })).optional()
});

const SocraticTutorSchema = z.object({
  workspace: z.any(),
  systemMetrics: z.any().optional(),
  bottlenecks: z.array(z.any()).optional(),
  learningObjective: z.string().max(500).optional(),
  learnerQuestion: z.string().max(2000).optional(),
  learnerActionSummary: z.string().max(2000).optional()
});

const VersionDiffReviewerSchema = z.object({
  baselineVersion: z.object({
    id: z.string(),
    name: z.string(),
    versionNumber: z.number(),
    snapshot: z.object({
      components: z.array(z.any()),
      connections: z.array(z.any()),
      configuration: z.any()
    }),
    performanceMetrics: z.any().optional()
  }),
  comparisonVersion: z.object({
    id: z.string(),
    name: z.string(),
    versionNumber: z.number(),
    snapshot: z.object({
      components: z.array(z.any()),
      connections: z.array(z.any()),
      configuration: z.any()
    }),
    performanceMetrics: z.any().optional()
  }),
  performanceComparison: z.any().optional(),
  userIntent: z.string().max(500).optional()
});

router.post('/architecture-critic', async (req, res) => {
  try {
    const payload = ArchitectureCriticSchema.parse(req.body) as ArchitectureCriticRequest;
    const analysis = await aiInsightService.critiqueArchitecture(payload);

    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid architecture critique request payload',
          details: error.issues,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: 'AI_ARCHITECTURE_CRITIQUE_ERROR',
        message: 'Failed to generate architecture critique',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown'
      }
    };

    return res.status(500).json(errorResponse);
  }
});

router.post('/bottleneck-root-cause', async (req, res) => {
  try {
    const payload = RootCauseSchema.parse(req.body) as BottleneckRootCauseRequest;
    const analysis = await aiInsightService.analyzeBottleneckRootCause(payload);

    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bottleneck root-cause request payload',
          details: error.issues,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: 'AI_ROOT_CAUSE_ANALYSIS_ERROR',
        message: 'Failed to generate bottleneck root-cause analysis',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown'
      }
    };

    return res.status(500).json(errorResponse);
  }
});

router.post('/socratic-tutor', async (req, res) => {
  try {
    const payload = SocraticTutorSchema.parse(req.body) as SocraticTutorRequest;
    const analysis = await aiInsightService.generateSocraticTutorResponse(payload);

    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid socratic tutor request payload',
          details: error.issues,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: 'AI_SOCRATIC_TUTOR_ERROR',
        message: 'Failed to generate Socratic tutor response',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown'
      }
    };

    return res.status(500).json(errorResponse);
  }
});

router.post('/version-diff-reviewer', async (req, res) => {
  try {
    const payload = VersionDiffReviewerSchema.parse(req.body) as VersionDiffReviewerRequest;
    const analysis = await aiInsightService.reviewVersionDiff(payload);

    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid version diff reviewer request payload',
          details: error.issues,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: 'AI_VERSION_DIFF_REVIEW_ERROR',
        message: 'Failed to generate version diff review',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown'
      }
    };

    return res.status(500).json(errorResponse);
  }
});

export default router;
