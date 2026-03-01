import type { BottleneckInfo, ComponentMetrics, SystemMetrics, Workspace } from '../types';

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

export interface ArchitectureCriticRequest {
  workspace: Workspace;
  systemMetrics?: SystemMetrics;
  bottlenecks?: BottleneckInfo[];
  userGoal?: string;
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

export interface BottleneckRootCauseRequest {
  workspace: Workspace;
  systemMetrics?: SystemMetrics;
  componentMetrics?: Record<string, ComponentMetrics>;
  bottlenecks?: BottleneckInfo[];
  recentEvents?: Array<{ type: string; timestamp: string; details?: string }>;
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

export interface SocraticTutorRequest {
  workspace: Workspace;
  systemMetrics?: SystemMetrics;
  bottlenecks?: BottleneckInfo[];
  learningObjective?: string;
  learnerQuestion?: string;
  learnerActionSummary?: string;
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

export interface VersionDiffReviewerRequest {
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

interface LlmConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

const llmConfig: LlmConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
};

function normalizeSeverityScore(severity: Severity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function inferOverallRisk(findings: ArchitectureFinding[]): 'low' | 'medium' | 'high' {
  const max = findings.reduce((acc, item) => Math.max(acc, normalizeSeverityScore(item.severity)), 1);
  if (max >= 4) return 'high';
  if (max >= 3) return 'medium';
  return 'low';
}

function extractJson(content: string): any {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Model response did not contain valid JSON');
}

async function callLlm(systemInstruction: string, userPayload: unknown): Promise<any> {
  if (!llmConfig.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`
    },
    body: JSON.stringify({
      model: llmConfig.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const body: any = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('LLM response content missing');
  }

  return extractJson(content);
}

function buildArchitectureFallback(input: ArchitectureCriticRequest): ArchitectureCriticResponse {
  const findings: ArchitectureFinding[] = [];
  const components = input.workspace.components || [];
  const connections = input.workspace.connections || [];
  const bottlenecks = input.bottlenecks || [];

  const hasLoadBalancer = components.some(c => c.type === 'load-balancer');
  const dbCount = components.filter(c => c.type === 'database').length;
  const cacheCount = components.filter(c => c.type === 'cache').length;

  if (!hasLoadBalancer && components.length >= 3) {
    findings.push({
      id: 'single-entrypoint-risk',
      title: 'Potential single ingress bottleneck',
      severity: 'high',
      whyItMatters: 'Without traffic distribution, one service instance can saturate quickly and increase tail latency.',
      evidence: ['No load balancer component detected in topology'],
      recommendations: ['Add a load balancer before stateless services', 'Distribute requests using least-connections or weighted policy'],
      expectedImpact: 'Lower p95 latency under burst traffic and better fault isolation.'
    });
  }

  if (dbCount > 0 && cacheCount === 0 && (input.systemMetrics?.averageLatency || 0) > 120) {
    findings.push({
      id: 'cache-missing-under-db-load',
      title: 'Database appears to be serving hot reads directly',
      severity: 'medium',
      whyItMatters: 'Read-heavy paths hitting primary storage increase latency and can reduce throughput headroom.',
      evidence: ['Database present with no cache layer', `Observed average latency: ${input.systemMetrics?.averageLatency ?? 'n/a'} ms`],
      recommendations: ['Introduce cache for high-read endpoints', 'Warm cache before load tests and monitor hit ratio'],
      expectedImpact: 'Reduced mean and tail latency for repeated reads.'
    });
  }

  if (bottlenecks.some(b => b.severity === 'critical')) {
    findings.push({
      id: 'critical-bottlenecks-observed',
      title: 'Critical bottlenecks detected during simulation',
      severity: 'critical',
      whyItMatters: 'Critical hotspots indicate imminent degradation or cascading failure at higher load.',
      evidence: bottlenecks.filter(b => b.severity === 'critical').map(b => `${b.componentType}:${b.type} impact ${b.impact}%`),
      recommendations: ['Prioritize top critical bottleneck first', 'Re-run simulation after each fix to verify causality'],
      expectedImpact: 'Improved stability and lower error amplification.'
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'baseline-stable',
      title: 'No high-risk architecture issue found in current snapshot',
      severity: 'low',
      whyItMatters: 'Current structure appears balanced for the tested workload range.',
      evidence: [`Components: ${components.length}`, `Connections: ${connections.length}`],
      recommendations: ['Stress-test with spike and failure scenarios', 'Track p95/p99 and error rate while scaling'],
      expectedImpact: 'Higher confidence in behavior before production-like scenarios.'
    });
  }

  return {
    analysisMode: 'heuristic-fallback',
    summary: 'Fallback analysis generated because AI provider is unavailable in this environment.',
    overallRisk: inferOverallRisk(findings),
    confidence: 0.62,
    findings,
    tradeoffs: [
      {
        decision: 'Scale vertically before horizontally',
        upside: 'Faster short-term improvement with lower operational complexity',
        downside: 'Lower fault isolation and harder cost scaling at high load',
        whenToChoose: 'Early-stage systems with moderate traffic and limited ops capacity'
      },
      {
        decision: 'Aggressive caching for read paths',
        upside: 'Large latency and throughput gains for repeated reads',
        downside: 'Consistency complexity and cache invalidation bugs',
        whenToChoose: 'Read-heavy workloads with acceptable staleness windows'
      }
    ],
    responsibleUse: {
      limitations: [
        'This result used fallback logic, not a full LLM tradeoff analysis.',
        'Use simulation reruns to validate recommendations before adopting changes.'
      ],
      humanReviewChecklist: [
        'Confirm assumptions against your real workload and SLOs.',
        'Apply one change at a time and compare metrics deltas.',
        'Review consistency and failure-mode side effects before rollout.'
      ]
    }
  };
}

function buildRootCauseFallback(input: BottleneckRootCauseRequest): BottleneckRootCauseResponse {
  const bottlenecks = [...(input.bottlenecks || [])].sort((a, b) => {
    const severityDelta = normalizeSeverityScore(b.severity) - normalizeSeverityScore(a.severity);
    if (severityDelta !== 0) return severityDelta;
    return (b.impact || 0) - (a.impact || 0);
  });

  const primary = bottlenecks.slice(0, 2).map((b): RootCauseHypothesis => {
    const evidence = [
      `Bottleneck type: ${b.type}`,
      `Severity: ${b.severity}`,
      `Impact estimate: ${b.impact}%`
    ];

    let cause = 'Resource saturation under current request concurrency.';
    let fixes = ['Increase capacity for the affected component', 'Reduce per-request work via caching or batching'];
    let shift = 'Throughput up, latency and queue depth down under same load.';

    if (b.type === 'latency') {
      cause = 'Request service time is too high for arrival rate; queueing delay is accumulating.';
      fixes = ['Reduce downstream call latency', 'Add replica(s) and distribute traffic'];
      shift = 'Lower p95/p99 latency and fewer timeout-induced errors.';
    } else if (b.type === 'queue') {
      cause = 'Consumers are processing slower than producer rate, causing backlog growth.';
      fixes = ['Increase consumer concurrency', 'Apply backpressure and bounded retries'];
      shift = 'Queue depth stabilizes and end-to-end latency drops.';
    } else if (b.type === 'throughput') {
      cause = 'The component has become the throughput ceiling in the critical path.';
      fixes = ['Scale out bottleneck component', 'Split hot path into parallel workers'];
      shift = 'Higher system throughput before saturation.';
    }

    return {
      cause,
      confidence: Math.max(0.55, Math.min(0.9, 0.5 + normalizeSeverityScore(b.severity) * 0.1)),
      evidence,
      affectedComponents: [b.componentId],
      recommendedFixes: fixes,
      expectedMetricShift: shift
    };
  });

  const secondary: RootCauseHypothesis[] = [];
  if ((input.systemMetrics?.systemErrorRate || 0) > 0.05) {
    secondary.push({
      cause: 'Error feedback loop may be amplifying load via retries/timeouts.',
      confidence: 0.68,
      evidence: [`System error rate observed: ${((input.systemMetrics?.systemErrorRate || 0) * 100).toFixed(2)}%`],
      affectedComponents: bottlenecks.slice(0, 3).map(b => b.componentId),
      recommendedFixes: ['Use exponential backoff with jitter', 'Apply circuit breaker around unstable dependencies'],
      expectedMetricShift: 'Error rate and retry storm pressure decline, improving stability.'
    });
  }

  if (primary.length === 0) {
    primary.push({
      cause: 'No explicit bottleneck signal available in current snapshot.',
      confidence: 0.5,
      evidence: ['No bottlenecks were provided to analysis'],
      affectedComponents: [],
      recommendedFixes: ['Run simulation longer', 'Enable more telemetry signals for queue depth and p99 latency'],
      expectedMetricShift: 'Improved observability to support stronger diagnosis.'
    });
  }

  return {
    analysisMode: 'heuristic-fallback',
    summary: 'Fallback root-cause analysis generated because AI provider is unavailable in this environment.',
    primaryCauses: primary,
    secondaryCauses: secondary,
    nextExperiments: [
      'Scale only the top suspected bottleneck by 2x and compare p95 latency and throughput.',
      'Reduce retry aggressiveness and verify error-rate and queue-depth changes.',
      'Run the same load with one injected dependency failure to test resilience assumptions.'
    ],
    confidence: 0.64,
    responsibleUse: {
      limitations: [
        'Fallback mode does not perform deep semantic reasoning across all telemetry.',
        'Use this as a hypothesis generator, not a final diagnosis.'
      ],
      humanReviewChecklist: [
        'Validate each hypothesis with a controlled experiment.',
        'Compare before/after metrics for causality, not correlation.',
        'Check tradeoffs on cost, consistency, and failure behavior.'
      ]
    }
  };
}

function buildSocraticTutorFallback(input: SocraticTutorRequest): SocraticTutorResponse {
  const bottlenecks = input.bottlenecks || [];
  const top = bottlenecks[0];

  const questions: string[] = [];
  const hints: string[] = [];
  const checks: string[] = [];
  const experiments: string[] = [];

  if (top) {
    questions.push(`What signal suggests ${top.componentType} is the first bottleneck rather than a downstream effect?`);
    questions.push(`If you doubled ${top.componentType} capacity, which metric should improve first and why?`);
    hints.push(`Your strongest current signal is ${top.type} bottleneck with ${top.impact}% impact.`);
    hints.push('Try one controlled change and re-run the same load profile to validate causality.');
    checks.push('Are you assuming correlation equals causation from one run?');
    checks.push('Did retry behavior or queueing amplify the observed latency/error pattern?');
    experiments.push(`Increase capacity or reduce latency for ${top.componentId}, then compare p95 latency and throughput.`);
  } else {
    questions.push('Which component currently determines your end-to-end critical path?');
    questions.push('What metric would prove your design can handle a 2x traffic spike?');
    hints.push('Define one primary SLO first (latency, throughput, or error rate).');
    hints.push('Run baseline and one-parameter-change experiments for clean learning loops.');
    checks.push('Are you optimizing many variables at once?');
    experiments.push('Run a baseline constant-load test, then a spike test with identical topology.');
  }

  if (input.learnerQuestion) {
    questions.unshift(`Given your question "${input.learnerQuestion}", what assumption are you making that could be tested directly?`);
  }

  return {
    analysisMode: 'heuristic-fallback',
    coachSummary: 'Socratic tutor fallback mode is active. Prompts are tailored from current workspace and bottleneck signals.',
    socraticQuestions: questions,
    conceptualHints: hints,
    misconceptionChecks: checks,
    nextStepExperiments: experiments,
    confidence: 0.66,
    responsibleUse: {
      limitations: [
        'Fallback mode uses structural and metric heuristics instead of deep language-model reasoning.',
        'Use these prompts to guide experiments, not to replace empirical validation.'
      ],
      humanReviewChecklist: [
        'Pick one hypothesis before changing architecture.',
        'Measure before/after with same load profile.',
        'Document what changed and what did not.'
      ]
    }
  };
}

function buildVersionDiffFallback(input: VersionDiffReviewerRequest): VersionDiffReviewerResponse {
  const baselineComponents = input.baselineVersion.snapshot.components.length;
  const comparisonComponents = input.comparisonVersion.snapshot.components.length;
  const baselineConnections = input.baselineVersion.snapshot.connections.length;
  const comparisonConnections = input.comparisonVersion.snapshot.connections.length;

  const keyChanges = [
    `Component count: baseline ${baselineComponents} -> comparison ${comparisonComponents}`,
    `Connection count: baseline ${baselineConnections} -> comparison ${comparisonConnections}`
  ];

  const behaviorImplications = [
    'Higher topology complexity can improve resilience and scale but raises operational/debugging overhead.',
    'Additional dependencies may increase failure surface unless isolation and retry policies are tuned.'
  ];

  const riskFlags = [
    'Ensure new components in comparison version have capacity and failure settings aligned with target load.',
    'Validate that added connections do not create hidden choke points in the critical path.'
  ];

  const verificationChecklist = [
    'Compare p95/p99 latency between baseline and comparison under the same load pattern.',
    'Run at least one failure-injection scenario on both versions.',
    'Check throughput saturation point and error-rate inflection in both versions.'
  ];

  const comparisonLooksLarger = comparisonComponents + comparisonConnections > baselineComponents + baselineConnections;
  const suggestion: VersionDiffReviewerResponse['recommendation'] = comparisonLooksLarger
    ? {
      suggestedDirection: 'hybrid-follow-up',
      rationale: 'Comparison appears more complex; validate performance gains justify added complexity before full adoption.'
    }
    : {
      suggestedDirection: 'keep-baseline',
      rationale: 'No clear signal yet that comparison provides enough benefit; keep baseline and run targeted experiments.'
    };

  return {
    analysisMode: 'heuristic-fallback',
    summary: 'Version diff reviewer fallback mode is active. Recommendation is based on topology and available comparison signals.',
    keyChanges,
    behaviorImplications,
    riskFlags,
    verificationChecklist,
    recommendation: suggestion,
    confidence: 0.63,
    responsibleUse: {
      limitations: [
        'Fallback mode cannot deeply reason about semantic code/design intent from limited snapshot data.',
        'Treat recommendation as a triage guide and validate with simulation evidence.'
      ],
      humanReviewChecklist: [
        'Validate decision under representative load and failure conditions.',
        'Confirm maintainability cost of any added complexity.',
        'Prefer incremental rollout over full replacement.'
      ]
    }
  };
}

export class AIInsightService {
  async critiqueArchitecture(input: ArchitectureCriticRequest): Promise<ArchitectureCriticResponse> {
    const systemInstruction = [
      'You are an expert distributed systems architect.',
      'Perform architecture critique using context and metrics, not checklist-only logic.',
      'Return strict JSON only.',
      'Separate observed evidence from inference.',
      'Prioritize clarity, usability, and responsible recommendations.',
      'Output schema keys: summary, overallRisk, confidence, findings, tradeoffs, responsibleUse.',
      'findings[] keys: id,title,severity,whyItMatters,evidence,recommendations,expectedImpact.',
      'tradeoffs[] keys: decision,upside,downside,whenToChoose.',
      'responsibleUse keys: limitations,humanReviewChecklist.'
    ].join(' ');

    try {
      const modelResult = await callLlm(systemInstruction, input);
      const findings = Array.isArray(modelResult.findings) ? modelResult.findings : [];
      const normalized: ArchitectureCriticResponse = {
        analysisMode: 'ai',
        summary: typeof modelResult.summary === 'string' ? modelResult.summary : 'AI architecture review generated.',
        overallRisk: modelResult.overallRisk === 'high' || modelResult.overallRisk === 'medium' ? modelResult.overallRisk : 'low',
        confidence: typeof modelResult.confidence === 'number' ? Math.max(0, Math.min(1, modelResult.confidence)) : 0.75,
        findings: findings as ArchitectureFinding[],
        tradeoffs: Array.isArray(modelResult.tradeoffs) ? modelResult.tradeoffs as ArchitectureTradeoff[] : [],
        responsibleUse: {
          limitations: Array.isArray(modelResult?.responsibleUse?.limitations) ? modelResult.responsibleUse.limitations : ['AI output may contain uncertainty; validate with simulation.'],
          humanReviewChecklist: Array.isArray(modelResult?.responsibleUse?.humanReviewChecklist)
            ? modelResult.responsibleUse.humanReviewChecklist
            : ['Validate recommendations with controlled simulation experiments.']
        }
      };

      if (normalized.findings.length === 0) {
        return buildArchitectureFallback(input);
      }

      return normalized;
    } catch (error) {
      console.warn('AI architecture critique failed, using fallback:', error);
      return buildArchitectureFallback(input);
    }
  }

  async analyzeBottleneckRootCause(input: BottleneckRootCauseRequest): Promise<BottleneckRootCauseResponse> {
    const systemInstruction = [
      'You are an SRE and performance engineer for distributed systems.',
      'Generate root-cause hypotheses using multi-signal reasoning from metrics, bottlenecks, and topology.',
      'Return strict JSON only.',
      'Do not present guesses as facts; include confidence and evidence.',
      'Output schema keys: summary, primaryCauses, secondaryCauses, nextExperiments, confidence, responsibleUse.',
      'primaryCauses[] and secondaryCauses[] keys: cause,confidence,evidence,affectedComponents,recommendedFixes,expectedMetricShift.',
      'responsibleUse keys: limitations,humanReviewChecklist.'
    ].join(' ');

    try {
      const modelResult = await callLlm(systemInstruction, input);
      const normalized: BottleneckRootCauseResponse = {
        analysisMode: 'ai',
        summary: typeof modelResult.summary === 'string' ? modelResult.summary : 'AI root-cause analysis generated.',
        primaryCauses: Array.isArray(modelResult.primaryCauses) ? modelResult.primaryCauses as RootCauseHypothesis[] : [],
        secondaryCauses: Array.isArray(modelResult.secondaryCauses) ? modelResult.secondaryCauses as RootCauseHypothesis[] : [],
        nextExperiments: Array.isArray(modelResult.nextExperiments) ? modelResult.nextExperiments as string[] : [],
        confidence: typeof modelResult.confidence === 'number' ? Math.max(0, Math.min(1, modelResult.confidence)) : 0.74,
        responsibleUse: {
          limitations: Array.isArray(modelResult?.responsibleUse?.limitations) ? modelResult.responsibleUse.limitations : ['Validate with controlled experiments.'],
          humanReviewChecklist: Array.isArray(modelResult?.responsibleUse?.humanReviewChecklist)
            ? modelResult.responsibleUse.humanReviewChecklist
            : ['Treat hypotheses as candidates and validate causality.']
        }
      };

      if (normalized.primaryCauses.length === 0) {
        return buildRootCauseFallback(input);
      }

      return normalized;
    } catch (error) {
      console.warn('AI root-cause analysis failed, using fallback:', error);
      return buildRootCauseFallback(input);
    }
  }

  async generateSocraticTutorResponse(input: SocraticTutorRequest): Promise<SocraticTutorResponse> {
    const systemInstruction = [
      'You are a Socratic tutor for distributed systems design.',
      'Do not give final answers directly; ask guiding questions that improve reasoning.',
      'Use context from workspace structure, metrics, bottlenecks, and learner question.',
      'Return strict JSON only.',
      'Output schema keys: coachSummary, socraticQuestions, conceptualHints, misconceptionChecks, nextStepExperiments, confidence, responsibleUse.',
      'responsibleUse keys: limitations,humanReviewChecklist.'
    ].join(' ');

    try {
      const modelResult = await callLlm(systemInstruction, input);
      const normalized: SocraticTutorResponse = {
        analysisMode: 'ai',
        coachSummary: typeof modelResult.coachSummary === 'string' ? modelResult.coachSummary : 'AI Socratic guidance generated.',
        socraticQuestions: Array.isArray(modelResult.socraticQuestions) ? modelResult.socraticQuestions as string[] : [],
        conceptualHints: Array.isArray(modelResult.conceptualHints) ? modelResult.conceptualHints as string[] : [],
        misconceptionChecks: Array.isArray(modelResult.misconceptionChecks) ? modelResult.misconceptionChecks as string[] : [],
        nextStepExperiments: Array.isArray(modelResult.nextStepExperiments) ? modelResult.nextStepExperiments as string[] : [],
        confidence: typeof modelResult.confidence === 'number' ? Math.max(0, Math.min(1, modelResult.confidence)) : 0.75,
        responsibleUse: {
          limitations: Array.isArray(modelResult?.responsibleUse?.limitations) ? modelResult.responsibleUse.limitations : ['Validate tutor prompts through experiments.'],
          humanReviewChecklist: Array.isArray(modelResult?.responsibleUse?.humanReviewChecklist)
            ? modelResult.responsibleUse.humanReviewChecklist
            : ['Use one measurable experiment per hypothesis.']
        }
      };

      if (normalized.socraticQuestions.length === 0) {
        return buildSocraticTutorFallback(input);
      }

      return normalized;
    } catch (error) {
      console.warn('AI socratic tutor failed, using fallback:', error);
      return buildSocraticTutorFallback(input);
    }
  }

  async reviewVersionDiff(input: VersionDiffReviewerRequest): Promise<VersionDiffReviewerResponse> {
    const systemInstruction = [
      'You are a senior architecture reviewer for version comparisons.',
      'Analyze version diff and performance comparison context.',
      'Explain behavior implications and risks, not just structural differences.',
      'Return strict JSON only.',
      'Output schema keys: summary,keyChanges,behaviorImplications,riskFlags,verificationChecklist,recommendation,confidence,responsibleUse.',
      'recommendation keys: suggestedDirection,rationale. suggestedDirection must be one of keep-baseline/adopt-comparison/hybrid-follow-up.',
      'responsibleUse keys: limitations,humanReviewChecklist.'
    ].join(' ');

    try {
      const modelResult = await callLlm(systemInstruction, input);
      const suggestedDirection = modelResult?.recommendation?.suggestedDirection;
      const direction = suggestedDirection === 'adopt-comparison'
        || suggestedDirection === 'hybrid-follow-up'
        || suggestedDirection === 'keep-baseline'
        ? suggestedDirection
        : 'hybrid-follow-up';

      const normalized: VersionDiffReviewerResponse = {
        analysisMode: 'ai',
        summary: typeof modelResult.summary === 'string' ? modelResult.summary : 'AI version diff review generated.',
        keyChanges: Array.isArray(modelResult.keyChanges) ? modelResult.keyChanges as string[] : [],
        behaviorImplications: Array.isArray(modelResult.behaviorImplications) ? modelResult.behaviorImplications as string[] : [],
        riskFlags: Array.isArray(modelResult.riskFlags) ? modelResult.riskFlags as string[] : [],
        verificationChecklist: Array.isArray(modelResult.verificationChecklist) ? modelResult.verificationChecklist as string[] : [],
        recommendation: {
          suggestedDirection: direction,
          rationale: typeof modelResult?.recommendation?.rationale === 'string'
            ? modelResult.recommendation.rationale
            : 'Run targeted experiments before final selection.'
        },
        confidence: typeof modelResult.confidence === 'number' ? Math.max(0, Math.min(1, modelResult.confidence)) : 0.73,
        responsibleUse: {
          limitations: Array.isArray(modelResult?.responsibleUse?.limitations) ? modelResult.responsibleUse.limitations : ['Validate recommendation with simulation evidence.'],
          humanReviewChecklist: Array.isArray(modelResult?.responsibleUse?.humanReviewChecklist)
            ? modelResult.responsibleUse.humanReviewChecklist
            : ['Compare behavior under load and failure before deciding.']
        }
      };

      if (normalized.keyChanges.length === 0) {
        return buildVersionDiffFallback(input);
      }

      return normalized;
    } catch (error) {
      console.warn('AI version diff review failed, using fallback:', error);
      return buildVersionDiffFallback(input);
    }
  }
}

export const aiInsightService = new AIInsightService();
