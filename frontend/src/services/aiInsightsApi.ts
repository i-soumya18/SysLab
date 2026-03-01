import type { BottleneckInfo, ComponentMetrics, SystemMetrics, Workspace } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

type Severity = 'low' | 'medium' | 'high' | 'critical';

type AnalysisMode = 'ai' | 'heuristic-fallback';

export interface ArchitectureFinding {
  id: string;
  title: string;
  severity: Severity;
  whyItMatters: string;
  evidence: string[];
  recommendations: string[];
  expectedImpact: string;
}

export interface ArchitectureTradeoff {
  decision: string;
  upside: string;
  downside: string;
  whenToChoose: string;
}

export interface ArchitectureCriticResponse {
  analysisMode: AnalysisMode;
  summary: string;
  overallRisk: 'low' | 'medium' | 'high';
  confidence: number;
  findings: ArchitectureFinding[];
  tradeoffs: ArchitectureTradeoff[];
  responsibleUse: {
    limitations: string[];
    humanReviewChecklist: string[];
  };
}

export interface RootCauseHypothesis {
  cause: string;
  confidence: number;
  evidence: string[];
  affectedComponents: string[];
  recommendedFixes: string[];
  expectedMetricShift: string;
}

export interface BottleneckRootCauseResponse {
  analysisMode: AnalysisMode;
  summary: string;
  primaryCauses: RootCauseHypothesis[];
  secondaryCauses: RootCauseHypothesis[];
  nextExperiments: string[];
  confidence: number;
  responsibleUse: {
    limitations: string[];
    humanReviewChecklist: string[];
  };
}

export interface SocraticTutorResponse {
  analysisMode: AnalysisMode;
  coachSummary: string;
  socraticQuestions: string[];
  conceptualHints: string[];
  misconceptionChecks: string[];
  nextStepExperiments: string[];
  confidence: number;
  responsibleUse: {
    limitations: string[];
    humanReviewChecklist: string[];
  };
}

export interface VersionDiffReviewerResponse {
  analysisMode: AnalysisMode;
  summary: string;
  keyChanges: string[];
  behaviorImplications: string[];
  riskFlags: string[];
  verificationChecklist: string[];
  recommendation: {
    suggestedDirection: 'keep-baseline' | 'adopt-comparison' | 'hybrid-follow-up';
    rationale: string;
  };
  confidence: number;
  responsibleUse: {
    limitations: string[];
    humanReviewChecklist: string[];
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody: ApiErrorResponse | null = await response.json().catch(() => null);
    throw new Error(errorBody?.error?.message ?? 'Failed to run AI insights analysis');
  }

  const payload = await response.json() as ApiResponse<T>;
  return payload.data;
}

export class AIInsightsApiService {
  async critiqueArchitecture(input: {
    workspace: Workspace;
    systemMetrics?: SystemMetrics;
    bottlenecks?: BottleneckInfo[];
    userGoal?: string;
  }): Promise<ArchitectureCriticResponse> {
    return requestJson<ArchitectureCriticResponse>('/ai/architecture-critic', input);
  }

  async analyzeBottleneckRootCause(input: {
    workspace: Workspace;
    systemMetrics?: SystemMetrics;
    componentMetrics?: Map<string, ComponentMetrics>;
    bottlenecks?: BottleneckInfo[];
    recentEvents?: Array<{ type: string; timestamp: string; details?: string }>;
  }): Promise<BottleneckRootCauseResponse> {
    const serializableComponentMetrics = input.componentMetrics
      ? Object.fromEntries(input.componentMetrics.entries())
      : undefined;

    return requestJson<BottleneckRootCauseResponse>('/ai/bottleneck-root-cause', {
      workspace: input.workspace,
      systemMetrics: input.systemMetrics,
      componentMetrics: serializableComponentMetrics,
      bottlenecks: input.bottlenecks,
      recentEvents: input.recentEvents
    });
  }

  async generateSocraticTutor(input: {
    workspace: Workspace;
    systemMetrics?: SystemMetrics;
    bottlenecks?: BottleneckInfo[];
    learningObjective?: string;
    learnerQuestion?: string;
    learnerActionSummary?: string;
  }): Promise<SocraticTutorResponse> {
    return requestJson<SocraticTutorResponse>('/ai/socratic-tutor', input);
  }

  async reviewVersionDiff(input: {
    baselineVersion: {
      id: string;
      name: string;
      versionNumber: number;
      snapshot: {
        components: any[];
        connections: any[];
        configuration: any;
      };
      performanceMetrics?: any;
    };
    comparisonVersion: {
      id: string;
      name: string;
      versionNumber: number;
      snapshot: {
        components: any[];
        connections: any[];
        configuration: any;
      };
      performanceMetrics?: any;
    };
    performanceComparison?: any;
    userIntent?: string;
  }): Promise<VersionDiffReviewerResponse> {
    return requestJson<VersionDiffReviewerResponse>('/ai/version-diff-reviewer', input);
  }
}

export const aiInsightsApi = new AIInsightsApiService();
