import React, { useState, useEffect } from 'react';
import { Workspace, Scenario } from '../types';
import { guidanceApi, GuidanceHint, EvaluationResult } from '../services/guidanceApi';
import './GuidancePanel.css';

interface GuidancePanelProps {
  workspace: Workspace;
  scenario: Scenario | null;
  isVisible: boolean;
  onToggle: () => void;
  onEvaluate?: (result: EvaluationResult) => void;
}

export const GuidancePanel: React.FC<GuidancePanelProps> = ({
  workspace,
  scenario,
  isVisible,
  onToggle,
  onEvaluate
}) => {
  const [hints, setHints] = useState<GuidanceHint[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hints' | 'objectives' | 'evaluation'>('hints');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (isVisible && scenario && autoRefresh) {
      refreshHints();
    }
  }, [workspace, scenario, isVisible, autoRefresh]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVisible && scenario && autoRefresh) {
      interval = setInterval(refreshHints, 10000); // Refresh every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, scenario, autoRefresh]);

  const refreshHints = async () => {
    if (!scenario) return;

    try {
      setLoading(true);
      const hintsData = await guidanceApi.getHints(workspace, scenario.id);
      setHints(hintsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hints');
    } finally {
      setLoading(false);
    }
  };
  const evaluateWorkspace = async () => {
    if (!scenario) return;

    try {
      setLoading(true);
      const evaluationData = await guidanceApi.evaluateWorkspace(workspace, scenario.id);
      setEvaluation(evaluationData);
      setActiveTab('evaluation');
      onEvaluate?.(evaluationData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate workspace');
    } finally {
      setLoading(false);
    }
  };

  const getHintIcon = (type: GuidanceHint['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info':
      default: return 'ℹ️';
    }
  };

  const getHintClassName = (type: GuidanceHint['type']) => {
    return `hint-item hint-${type}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (!isVisible) {
    return (
      <div className="guidance-panel collapsed">
        <button onClick={onToggle} className="guidance-toggle">
          📋 Guidance
        </button>
      </div>
    );
  }
  return (
    <div className="guidance-panel expanded">
      <div className="guidance-header">
        <h3>Learning Guidance</h3>
        <div className="guidance-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={onToggle} className="close-button">×</button>
        </div>
      </div>

      {scenario && (
        <div className="scenario-info">
          <h4>{scenario.name}</h4>
          <p>{scenario.description}</p>
        </div>
      )}

      <div className="guidance-tabs">
        <button
          className={`tab-button ${activeTab === 'hints' ? 'active' : ''}`}
          onClick={() => setActiveTab('hints')}
        >
          Hints ({hints.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'objectives' ? 'active' : ''}`}
          onClick={() => setActiveTab('objectives')}
        >
          Objectives
        </button>
        <button
          className={`tab-button ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          Evaluation
        </button>
      </div>
      <div className="guidance-content">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Loading guidance...
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
            <button onClick={refreshHints} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {activeTab === 'hints' && !loading && (
          <div className="hints-tab">
            <div className="tab-header">
              <h4>Contextual Hints</h4>
              <button onClick={refreshHints} className="refresh-button">
                🔄 Refresh
              </button>
            </div>
            
            {hints.length === 0 ? (
              <div className="no-hints">
                <span className="success-icon">🎉</span>
                <p>Great job! No immediate issues detected.</p>
                <p>Continue building your architecture or evaluate your progress.</p>
              </div>
            ) : (
              <div className="hints-list">
                {hints.map((hint) => (
                  <div key={hint.id} className={getHintClassName(hint.type)}>
                    <div className="hint-header">
                      <span className="hint-icon">{getHintIcon(hint.type)}</span>
                      <span className="hint-title">{hint.title}</span>
                      <span className="hint-priority">P{hint.priority}</span>
                    </div>
                    <p className="hint-message">{hint.message}</p>
                    {hint.actionable && hint.suggestedAction && (
                      <div className="hint-action">
                        <strong>Suggested Action:</strong> {hint.suggestedAction}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'objectives' && scenario && (
          <div className="objectives-tab">
            <h4>Learning Objectives</h4>
            <div className="objectives-list">
              {scenario.objectives.map((objective, index) => (
                <div key={index} className="objective-item">
                  <span className="objective-number">{index + 1}</span>
                  <span className="objective-text">{objective}</span>
                </div>
              ))}
            </div>

            {scenario.hints && scenario.hints.length > 0 && (
              <div className="scenario-hints">
                <h5>General Hints</h5>
                <div className="scenario-hints-list">
                  {scenario.hints.map((hint, index) => (
                    <div key={index} className="scenario-hint">
                      <span className="hint-bullet">💡</span>
                      {hint}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'evaluation' && (
          <div className="evaluation-tab">
            <div className="tab-header">
              <h4>Solution Evaluation</h4>
              <button onClick={evaluateWorkspace} className="evaluate-button">
                🔍 Evaluate Now
              </button>
            </div>

            {evaluation ? (
              <div className="evaluation-results">
                <div className="score-section">
                  <div className="score-circle" style={{ borderColor: getScoreColor(evaluation.score) }}>
                    <span className="score-value" style={{ color: getScoreColor(evaluation.score) }}>
                      {evaluation.score}%
                    </span>
                  </div>
                  <div className="score-status">
                    <span className={`status-badge ${evaluation.passed ? 'passed' : 'failed'}`}>
                      {evaluation.passed ? '✅ Passed' : '❌ Needs Work'}
                    </span>
                    <p className="score-description">
                      {evaluation.passed 
                        ? 'Great job! Your solution meets the requirements.'
                        : 'Keep working on your solution to meet all criteria.'
                      }
                    </p>
                  </div>
                </div>
                <div className="criteria-section">
                  <h5>Evaluation Criteria</h5>
                  <div className="criteria-list">
                    {evaluation.completedCriteria.map((criterion, index) => (
                      <div key={index} className="criterion-item completed">
                        <span className="criterion-icon">✅</span>
                        <span className="criterion-text">{criterion}</span>
                      </div>
                    ))}
                    {evaluation.failedCriteria.map((criterion, index) => (
                      <div key={index} className="criterion-item failed">
                        <span className="criterion-icon">❌</span>
                        <span className="criterion-text">{criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {evaluation.recommendations.length > 0 && (
                  <div className="recommendations-section">
                    <h5>Recommendations</h5>
                    <div className="recommendations-list">
                      {evaluation.recommendations.map((recommendation, index) => (
                        <div key={index} className="recommendation-item">
                          <span className="recommendation-icon">💡</span>
                          {recommendation}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {evaluation.feedback.length > 0 && (
                  <div className="feedback-section">
                    <h5>Detailed Feedback</h5>
                    <div className="feedback-list">
                      {evaluation.feedback.map((feedback, index) => (
                        <div key={index} className="feedback-item">
                          {feedback}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-evaluation">
                <p>Click "Evaluate Now" to assess your solution against the scenario criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};