import React, { useState, useEffect } from 'react';
import type { ConstraintEvent, ConstraintSequence } from '../types';
import { progressiveConstraintsApi } from '../services/progressiveConstraintsApi';
import './ProgressiveConstraintsPanel.css';

interface ProgressiveConstraintsPanelProps {
  scenarioId: string;
  sessionId: string;
  userId: string;
  currentTime: number; // Current simulation time in seconds
  isActive: boolean;
  onConstraintActivated?: (constraint: ConstraintEvent) => void;
  onPerformanceUpdate?: (metrics: {
    correctDecisionsMade: number;
    totalDecisionOpportunities: number;
    timeToResolveIssues: number;
  }) => void;
}

export const ProgressiveConstraintsPanel: React.FC<ProgressiveConstraintsPanelProps> = ({
  scenarioId,
  sessionId,
  userId,
  currentTime,
  isActive,
  onConstraintActivated,
  onPerformanceUpdate
}) => {
  const [constraintSequence, setConstraintSequence] = useState<ConstraintSequence | null>(null);
  const [activeConstraints, setActiveConstraints] = useState<ConstraintEvent[]>([]);
  const [nextConstraint, setNextConstraint] = useState<ConstraintEvent | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [constraintHistory, setConstraintHistory] = useState<ConstraintEvent[]>([]);
  const [userDecisions, setUserDecisions] = useState<{
    correct: number;
    total: number;
    startTime: number;
  }>({ correct: 0, total: 0, startTime: Date.now() });

  // Load constraint sequence when scenario changes
  useEffect(() => {
    if (scenarioId && isActive) {
      loadConstraintSequence();
      startConstraintSequence();
    }
  }, [scenarioId, isActive]);

  // Update active constraints based on current time
  useEffect(() => {
    if (isActive && sessionId) {
      updateActiveConstraints();
      updateNextConstraint();
    }
  }, [currentTime, isActive, sessionId]);

  const loadConstraintSequence = async () => {
    try {
      setLoading(true);
      const sequence = await progressiveConstraintsApi.getConstraintSequence(scenarioId);
      setConstraintSequence(sequence);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load constraint sequence');
    } finally {
      setLoading(false);
    }
  };

  const startConstraintSequence = async () => {
    try {
      await progressiveConstraintsApi.startConstraintSequence(sessionId, scenarioId, userId);
    } catch (err) {
      console.error('Failed to start constraint sequence:', err);
    }
  };

  const updateActiveConstraints = async () => {
    try {
      const constraints = await progressiveConstraintsApi.getActiveConstraints(sessionId, currentTime);
      
      // Check for newly activated constraints
      const newlyActive = constraints.filter(constraint => 
        !activeConstraints.some(active => active.id === constraint.id)
      );
      
      // Notify about newly activated constraints
      newlyActive.forEach(constraint => {
        if (onConstraintActivated) {
          onConstraintActivated(constraint);
        }
        // Add to history if not already there
        if (!constraintHistory.some(h => h.id === constraint.id)) {
          setConstraintHistory(prev => [...prev, constraint]);
        }
      });
      
      setActiveConstraints(constraints);
    } catch (err) {
      console.error('Failed to update active constraints:', err);
    }
  };

  const updateNextConstraint = async () => {
    try {
      const { constraint, timeUntilNext: timeUntil } = await progressiveConstraintsApi.getNextConstraint(
        sessionId, 
        currentTime
      );
      setNextConstraint(constraint);
      setTimeUntilNext(timeUntil);
    } catch (err) {
      console.error('Failed to update next constraint:', err);
    }
  };

  const recordDecision = async (isCorrect: boolean) => {
    const newDecisions = {
      correct: userDecisions.correct + (isCorrect ? 1 : 0),
      total: userDecisions.total + 1,
      startTime: userDecisions.startTime
    };
    
    setUserDecisions(newDecisions);
    
    // Update performance metrics
    if (onPerformanceUpdate) {
      onPerformanceUpdate({
        correctDecisionsMade: newDecisions.correct,
        totalDecisionOpportunities: newDecisions.total,
        timeToResolveIssues: (Date.now() - newDecisions.startTime) / 1000
      });
    }

    // Record performance with API
    try {
      await progressiveConstraintsApi.recordUserPerformance(userId, scenarioId, {
        correctDecisionsMade: newDecisions.correct,
        totalDecisionOpportunities: newDecisions.total,
        timeToResolveIssues: (Date.now() - newDecisions.startTime) / 1000
      });
    } catch (err) {
      console.error('Failed to record performance:', err);
    }
  };

  const getConstraintTypeIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      'load-increase': '📈',
      'failure-injection': '💥',
      'latency-spike': '🐌',
      'resource-limit': '⚠️',
      'network-partition': '🔌'
    };
    return icons[type] || '❓';
  };

  const getConstraintSeverityColor = (severity: number): string => {
    if (severity <= 0.3) return '#4CAF50'; // Green - Low
    if (severity <= 0.6) return '#FF9800'; // Orange - Medium
    if (severity <= 0.8) return '#F44336'; // Red - High
    return '#9C27B0'; // Purple - Critical
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) {
    return null;
  }

  if (loading) {
    return (
      <div className="progressive-constraints-panel loading">
        <div className="loading-spinner">Loading constraints...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progressive-constraints-panel error">
        <div className="error-message">
          <h4>Error Loading Constraints</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progressive-constraints-panel">
      <div className="panel-header">
        <h3>Progressive Constraints</h3>
        <div className="scenario-info">
          <span className="scenario-name">{constraintSequence?.scenarioId}</span>
          {constraintSequence?.adaptiveDifficulty && (
            <span className="adaptive-badge">Adaptive</span>
          )}
        </div>
      </div>

      {/* Active Constraints */}
      {activeConstraints.length > 0 && (
        <div className="active-constraints-section">
          <h4>🔥 Active Constraints</h4>
          <div className="constraints-list">
            {activeConstraints.map((constraint) => (
              <div 
                key={constraint.id} 
                className="constraint-card active"
                style={{ borderLeftColor: getConstraintSeverityColor(constraint.severity) }}
              >
                <div className="constraint-header">
                  <span className="constraint-icon">
                    {getConstraintTypeIcon(constraint.type)}
                  </span>
                  <span className="constraint-type">{constraint.type}</span>
                  <span 
                    className="severity-badge"
                    style={{ backgroundColor: getConstraintSeverityColor(constraint.severity) }}
                  >
                    {Math.round(constraint.severity * 100)}%
                  </span>
                </div>
                <p className="constraint-description">{constraint.description}</p>
                <div className="learning-objective">
                  <strong>Learning:</strong> {constraint.learningObjective}
                </div>
                <div className="constraint-timing">
                  Ends in: {formatTime(constraint.triggerTime + constraint.duration - currentTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Constraint */}
      {nextConstraint && timeUntilNext !== null && (
        <div className="next-constraint-section">
          <h4>⏰ Upcoming Constraint</h4>
          <div 
            className="constraint-card upcoming"
            style={{ borderLeftColor: getConstraintSeverityColor(nextConstraint.severity) }}
          >
            <div className="constraint-header">
              <span className="constraint-icon">
                {getConstraintTypeIcon(nextConstraint.type)}
              </span>
              <span className="constraint-type">{nextConstraint.type}</span>
              <span 
                className="severity-badge"
                style={{ backgroundColor: getConstraintSeverityColor(nextConstraint.severity) }}
              >
                {Math.round(nextConstraint.severity * 100)}%
              </span>
            </div>
            <p className="constraint-description">{nextConstraint.description}</p>
            <div className="learning-objective">
              <strong>Learning:</strong> {nextConstraint.learningObjective}
            </div>
            <div className="constraint-timing">
              Starts in: {formatTime(timeUntilNext)}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tracking */}
      <div className="performance-section">
        <h4>📊 Your Performance</h4>
        <div className="performance-stats">
          <div className="stat">
            <span className="stat-label">Decisions</span>
            <span className="stat-value">
              {userDecisions.correct}/{userDecisions.total}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">
              {userDecisions.total > 0 
                ? Math.round((userDecisions.correct / userDecisions.total) * 100)
                : 0}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Time</span>
            <span className="stat-value">
              {formatTime(Math.floor((Date.now() - userDecisions.startTime) / 1000))}
            </span>
          </div>
        </div>
        
        <div className="decision-buttons">
          <button 
            onClick={() => recordDecision(true)}
            className="decision-button correct"
          >
            ✓ Good Decision
          </button>
          <button 
            onClick={() => recordDecision(false)}
            className="decision-button incorrect"
          >
            ✗ Poor Decision
          </button>
        </div>
      </div>

      {/* Constraint History */}
      {constraintHistory.length > 0 && (
        <div className="constraint-history-section">
          <h4>📋 Constraint History</h4>
          <div className="history-list">
            {constraintHistory.map((constraint) => (
              <div key={constraint.id} className="history-item">
                <span className="history-icon">
                  {getConstraintTypeIcon(constraint.type)}
                </span>
                <span className="history-description">{constraint.description}</span>
                <span className="history-time">
                  {formatTime(constraint.triggerTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sequence Overview */}
      {constraintSequence && (
        <div className="sequence-overview">
          <h4>🎯 Sequence Overview</h4>
          <div className="sequence-stats">
            <div className="sequence-stat">
              <span>Total Events:</span>
              <span>{constraintSequence.events.length}</span>
            </div>
            <div className="sequence-stat">
              <span>Avg Difficulty:</span>
              <span>
                {Math.round(
                  (constraintSequence.events.reduce((sum, e) => sum + e.severity, 0) / 
                   constraintSequence.events.length) * 100
                )}%
              </span>
            </div>
            <div className="sequence-stat">
              <span>Adaptive:</span>
              <span>{constraintSequence.adaptiveDifficulty ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};