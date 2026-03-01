import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Hint, ExplanationContent, HintContext } from '../types';
import { hintsApi } from '../services/hintsApi';
import './HintsPanel.css';

interface HintsPanelProps {
  context: HintContext;
  currentDifficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  isActive: boolean;
  onHintInteraction?: (hintId: string, action: 'shown' | 'requested' | 'skipped') => void;
  onExplanationRequested?: (concept: string) => void;
}

export const HintsPanel: React.FC<HintsPanelProps> = ({
  context,
  currentDifficulty,
  isActive,
  onHintInteraction,
  onExplanationRequested
}) => {
  const [contextualHints, setContextualHints] = useState<Hint[]>([]);
  const [progressiveHints, setProgressiveHints] = useState<Hint[]>([]);
  const [remedialHints, setRemedialHints] = useState<Hint[]>([]);
  const [selectedExplanation, setSelectedExplanation] = useState<ExplanationContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
  const [requestedHints, setRequestedHints] = useState<Set<string>>(new Set());

  // Track last context to prevent unnecessary updates
  const lastContextRef = useRef<string>('');
  
  // Update hints when context changes
  useEffect(() => {
    if (!isActive) return;
    
    // Create a stable key from context to detect actual changes
    const contextKey = JSON.stringify({
      userId: context.userId,
      scenarioId: context.scenarioId,
      currentDifficulty
    });
    
    // Only update if context actually changed
    if (lastContextRef.current === contextKey) {
      return;
    }
    
    lastContextRef.current = contextKey;
    updateHints();
  }, [context.userId, context.scenarioId, currentDifficulty, isActive]);

  const updateHints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch different types of hints in parallel
      // Map expert->advanced for progressive hints API which only supports 3 levels
      const progressiveDifficulty = currentDifficulty === 'expert' ? 'advanced' : currentDifficulty;
      const [contextual, progressive, remedial] = await Promise.all([
        hintsApi.getContextualHints(context),
        hintsApi.getProgressiveHints(context, progressiveDifficulty),
        hintsApi.getRemedialHints(context)
      ]);

      setContextualHints(contextual);
      setProgressiveHints(progressive);
      setRemedialHints(remedial);

      // Record contextual hints as shown (async, don't block)
      contextual.forEach(hint => {
        // Use setTimeout to avoid blocking the state update
        setTimeout(() => {
          recordHintShown(hint.id).catch(err => {
            console.error('Failed to record hint shown:', err);
          });
        }, 0);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hints');
    } finally {
      setLoading(false);
    }
  }, [context, currentDifficulty, onHintInteraction]);

  const recordHintShown = useCallback(async (hintId: string) => {
    try {
      await hintsApi.recordHintShown(context.userId, context.scenarioId, hintId);
      if (onHintInteraction) {
        onHintInteraction(hintId, 'shown');
      }
    } catch (err) {
      console.error('Failed to record hint shown:', err);
    }
  }, [context.userId, context.scenarioId, onHintInteraction]);

  const recordHintRequested = async (hintId: string) => {
    try {
      await hintsApi.recordHintRequested(context.userId, context.scenarioId, hintId);
      setRequestedHints(prev => new Set([...prev, hintId]));
      if (onHintInteraction) {
        onHintInteraction(hintId, 'requested');
      }
    } catch (err) {
      console.error('Failed to record hint requested:', err);
    }
  };

  const recordHintSkipped = async (hintId: string) => {
    try {
      await hintsApi.recordHintSkipped(context.userId, context.scenarioId, hintId);
      if (onHintInteraction) {
        onHintInteraction(hintId, 'skipped');
      }
    } catch (err) {
      console.error('Failed to record hint skipped:', err);
    }
  };

  const handleExplanationRequest = async (concept: string) => {
    try {
      const difficultyMapping: Record<string, 'basic' | 'intermediate' | 'advanced' | 'expert'> = {
        'beginner': 'basic',
        'intermediate': 'intermediate',
        'advanced': 'advanced',
        'expert': 'expert'
      };

      const explanation = await hintsApi.getExplanation(concept, difficultyMapping[currentDifficulty] || 'intermediate');
      setSelectedExplanation(explanation);
      
      // Record explanation viewed
      await hintsApi.recordExplanationViewed(context.userId, context.scenarioId, concept);
      
      if (onExplanationRequested) {
        onExplanationRequested(concept);
      }
    } catch (err) {
      console.error('Failed to load explanation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load explanation');
    }
  };

  const toggleHintExpansion = (hintId: string) => {
    setExpandedHints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hintId)) {
        newSet.delete(hintId);
      } else {
        newSet.add(hintId);
      }
      return newSet;
    });
  };

  const getHintTypeIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      'contextual': '💡',
      'progressive': '📈',
      'remedial': '🔧',
      'advanced': '🎓'
    };
    return icons[type] || '💡';
  };

  const getHintTypeColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'contextual': '#2196F3',
      'progressive': '#4CAF50',
      'remedial': '#FF9800',
      'advanced': '#9C27B0'
    };
    return colors[type] || '#2196F3';
  };

  const getDifficultyColor = (difficulty: string): string => {
    const colors: { [key: string]: string } = {
      'beginner': '#4CAF50',
      'intermediate': '#FF9800',
      'advanced': '#F44336'
    };
    return colors[difficulty] || '#757575';
  };

  const renderHint = (hint: Hint) => {
    const isExpanded = expandedHints.has(hint.id);
    const isRequested = requestedHints.has(hint.id);

    return (
      <div 
        key={hint.id} 
        className={`hint-card ${hint.type} ${isRequested ? 'requested' : ''}`}
        style={{ borderLeftColor: getHintTypeColor(hint.type) }}
      >
        <div className="hint-header">
          <div className="hint-type-info">
            <span className="hint-icon">{getHintTypeIcon(hint.type)}</span>
            <span className="hint-type">{hint.type}</span>
            <span 
              className="difficulty-badge"
              style={{ backgroundColor: getDifficultyColor(hint.difficulty) }}
            >
              {hint.difficulty}
            </span>
            <span className="priority-badge">P{hint.priority}</span>
          </div>
          <div className="hint-actions">
            <button
              onClick={() => toggleHintExpansion(hint.id)}
              className="expand-button"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            <button
              onClick={() => recordHintRequested(hint.id)}
              className="request-button"
              title="Mark as helpful"
              disabled={isRequested}
            >
              {isRequested ? '✓' : '👍'}
            </button>
            <button
              onClick={() => recordHintSkipped(hint.id)}
              className="skip-button"
              title="Skip this hint"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="hint-content">
          <p className="hint-text">{hint.content}</p>
          
          {isExpanded && (
            <div className="hint-details">
              {hint.explanation && (
                <div className="hint-explanation">
                  <h5>Explanation:</h5>
                  <p>{hint.explanation}</p>
                </div>
              )}
              
              {hint.relatedConcepts.length > 0 && (
                <div className="related-concepts">
                  <h5>Related Concepts:</h5>
                  <div className="concept-tags">
                    {hint.relatedConcepts.map((concept, index) => (
                      <button
                        key={index}
                        className="concept-tag"
                        onClick={() => handleExplanationRequest(concept)}
                      >
                        {concept}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {hint.followUpHints && hint.followUpHints.length > 0 && (
                <div className="follow-up-hints">
                  <h5>Follow-up hints available</h5>
                  <p>Complete this step to unlock {hint.followUpHints.length} more hints</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isActive) {
    return null;
  }

  if (loading) {
    return (
      <div className="hints-panel loading">
        <div className="loading-spinner">Loading hints...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hints-panel error">
        <div className="error-message">
          <h4>Error Loading Hints</h4>
          <p>{error}</p>
          <button onClick={updateHints} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const allHints = [...contextualHints, ...progressiveHints, ...remedialHints];

  return (
    <div className="hints-panel">
      <div className="panel-header">
        <h3>💡 Learning Hints</h3>
        <div className="difficulty-indicator">
          <span>Current Level:</span>
          <span 
            className="difficulty-badge"
            style={{ backgroundColor: getDifficultyColor(currentDifficulty) }}
          >
            {currentDifficulty}
          </span>
        </div>
      </div>

      {allHints.length === 0 ? (
        <div className="no-hints">
          <p>🎉 Great job! No hints needed right now.</p>
          <p>Keep exploring and building your system!</p>
        </div>
      ) : (
        <div className="hints-sections">
          {/* Remedial Hints - Show first if user is struggling */}
          {remedialHints.length > 0 && (
            <div className="hints-section remedial">
              <h4>🔧 Need Help?</h4>
              <div className="hints-list">
                {remedialHints.map(renderHint)}
              </div>
            </div>
          )}

          {/* Contextual Hints - Show current relevant hints */}
          {contextualHints.length > 0 && (
            <div className="hints-section contextual">
              <h4>💡 Current Suggestions</h4>
              <div className="hints-list">
                {contextualHints.map(renderHint)}
              </div>
            </div>
          )}

          {/* Progressive Hints - Show next steps */}
          {progressiveHints.length > 0 && (
            <div className="hints-section progressive">
              <h4>📈 Next Steps</h4>
              <div className="hints-list">
                {progressiveHints.map(renderHint)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explanation Modal */}
      {selectedExplanation && (
        <div className="explanation-modal">
          <div className="explanation-content">
            <div className="explanation-header">
              <h3>{selectedExplanation.title}</h3>
              <button
                onClick={() => setSelectedExplanation(null)}
                className="close-button"
              >
                ✕
              </button>
            </div>
            
            <div className="explanation-body">
              <div className="explanation-summary">
                <h4>Summary</h4>
                <p>{selectedExplanation.content.summary}</p>
              </div>
              
              <div className="explanation-detailed">
                <h4>Detailed Explanation</h4>
                <p>{selectedExplanation.content.detailedExplanation}</p>
              </div>
              
              {selectedExplanation.content.examples.length > 0 && (
                <div className="explanation-examples">
                  <h4>Examples</h4>
                  <ul>
                    {selectedExplanation.content.examples.map((example, index) => (
                      <li key={index}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedExplanation.content.bestPractices.length > 0 && (
                <div className="explanation-best-practices">
                  <h4>Best Practices</h4>
                  <ul>
                    {selectedExplanation.content.bestPractices.map((practice, index) => (
                      <li key={index}>{practice}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedExplanation.content.commonMistakes.length > 0 && (
                <div className="explanation-mistakes">
                  <h4>Common Mistakes</h4>
                  <ul>
                    {selectedExplanation.content.commonMistakes.map((mistake, index) => (
                      <li key={index}>{mistake}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          onClick={updateHints}
          className="refresh-hints-button"
          title="Refresh hints"
        >
          🔄 Refresh
        </button>
        <button
          onClick={() => handleExplanationRequest('system-design-basics')}
          className="help-button"
          title="Get general help"
        >
          ❓ Help
        </button>
      </div>
    </div>
  );
};