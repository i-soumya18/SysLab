import React, { useState, useEffect } from 'react';
import type { Scenario } from '../types';
import { scenarioApi } from '../services/scenarioApi';
import './ScenarioLibrary.css';

interface ScenarioLibraryProps {
  onScenarioSelect: (scenario: Scenario) => void;
  onScenarioLoad: (scenarioId: string) => void;
  userId: string;
  completedScenarios?: string[]; // Add completed scenarios for prerequisite checking
}

export const ScenarioLibrary: React.FC<ScenarioLibraryProps> = ({
  onScenarioSelect,
  onScenarioLoad,
  userId,
  completedScenarios = []
}) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [recommendations, setRecommendations] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState<boolean>(false);

  useEffect(() => {
    loadScenarios();
    loadRecommendations();
  }, [userId, categoryFilter, difficultyFilter]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const url = new URL(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/scenarios`);
      
      if (categoryFilter) url.searchParams.append('category', categoryFilter);
      if (difficultyFilter) url.searchParams.append('difficulty', difficultyFilter);
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch scenarios');
      
      const result = await response.json();
      let scenarioData = result.data;
      
      // Filter by availability if requested
      if (showOnlyAvailable) {
        scenarioData = scenarioData.filter((scenario: Scenario) => 
          canAccessScenario(scenario, completedScenarios)
        );
      }
      
      setScenarios(scenarioData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const recommendationData = await scenarioApi.getRecommendedScenarios(userId);
      setRecommendations(recommendationData);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    onScenarioSelect(scenario);
  };

  const handleLoadScenario = async (scenarioId: string) => {
    try {
      onScenarioLoad(scenarioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    }
  };

  const getDifficultyLevel = (scenario: Scenario): string => {
    // Use the actual difficulty property from the scenario
    return scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1);
  };

  const getEstimatedTime = (scenario: Scenario): string => {
    // Use the actual estimated time from the scenario
    return `${scenario.estimatedTimeMinutes} min`;
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      case 'expert': return '#9C27B0';
      default: return '#757575';
    }
  };

  const canAccessScenario = (scenario: Scenario, completedScenarios: string[]): boolean => {
    const completed = new Set(completedScenarios);
    return scenario.prerequisites.every(prereq => completed.has(prereq));
  };

  if (loading) {
    return (
      <div className="scenario-library loading">
        <div className="loading-spinner">Loading scenarios...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scenario-library error">
        <div className="error-message">
          <h3>Error Loading Scenarios</h3>
          <p>{error}</p>
          <button onClick={loadScenarios} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scenario-library">
      <div className="scenario-header">
        <h2>Learning Scenarios</h2>
        <div className="scenario-filters">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="category-filter"
          >
            <option value="">All Categories</option>
            <option value="fundamentals">Fundamentals</option>
            <option value="caching">Caching</option>
            <option value="scaling">Scaling</option>
            <option value="microservices">Microservices</option>
            <option value="global-scale">Global Scale</option>
            <option value="high-performance">High Performance</option>
            <option value="resilience">Resilience</option>
          </select>
          
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="difficulty-filter"
          >
            <option value="">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
          
          <label className="availability-filter">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
            />
            Show only available scenarios
          </label>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h3>Recommended for You</h3>
          <div className="scenario-grid">
            {recommendations.map((scenario) => (
              <div
                key={scenario.id}
                className="scenario-card recommended"
                onClick={() => handleScenarioClick(scenario)}
              >
                <div className="scenario-badge">Recommended</div>
                <h4>{scenario.name}</h4>
                <p className="scenario-description">{scenario.description}</p>
                <div className="scenario-meta">
                  <span className="difficulty">{getDifficultyLevel(scenario)}</span>
                  <span className="time">{getEstimatedTime(scenario)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="all-scenarios-section">
        <h3>All Scenarios</h3>
        <div className="scenario-grid">
          {scenarios.map((scenario) => {
            const isAvailable = canAccessScenario(scenario, completedScenarios);
            const isCompleted = completedScenarios.includes(scenario.id);
            const difficultyLevel = getDifficultyLevel(scenario);
            
            return (
              <div
                key={scenario.id}
                className={`scenario-card ${selectedScenario?.id === scenario.id ? 'selected' : ''} ${
                  !isAvailable ? 'locked' : ''
                } ${isCompleted ? 'completed' : ''}`}
                onClick={() => isAvailable && handleScenarioClick(scenario)}
              >
                {!isAvailable && <div className="locked-overlay">🔒 Prerequisites required</div>}
                {isCompleted && <div className="completed-badge">✓ Completed</div>}
                
                <div className="scenario-header-card">
                  <h4>{scenario.name}</h4>
                  <div className="scenario-category">{scenario.category}</div>
                </div>
                
                <p className="scenario-description">{scenario.description}</p>
                
                <div className="scenario-meta">
                  <span 
                    className="difficulty" 
                    style={{ backgroundColor: getDifficultyColor(scenario.difficulty) }}
                  >
                    {difficultyLevel}
                  </span>
                  <span className="time">{getEstimatedTime(scenario)}</span>
                  <span className="objectives">{scenario.objectives.length} objectives</span>
                </div>
                
                {scenario.tags.length > 0 && (
                  <div className="scenario-tags">
                    {scenario.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                    {scenario.tags.length > 3 && (
                      <span className="tag more">+{scenario.tags.length - 3}</span>
                    )}
                  </div>
                )}
                
                {scenario.prerequisites.length > 0 && (
                  <div className="prerequisites">
                    <small>Prerequisites: {scenario.prerequisites.length} scenario(s)</small>
                  </div>
                )}
                
                <div className="scenario-objectives">
                  <h5>Learning Objectives:</h5>
                  <ul>
                    {scenario.objectives.slice(0, 3).map((objective, index) => (
                      <li key={index}>{objective}</li>
                    ))}
                    {scenario.objectives.length > 3 && (
                      <li>...and {scenario.objectives.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedScenario && (
        <div className="scenario-details">
          <div className="scenario-details-content">
            <div className="scenario-details-header">
              <h3>{selectedScenario.name}</h3>
              <div className="scenario-meta-details">
                <span 
                  className="difficulty-badge" 
                  style={{ backgroundColor: getDifficultyColor(selectedScenario.difficulty) }}
                >
                  {getDifficultyLevel(selectedScenario)}
                </span>
                <span className="time-badge">{getEstimatedTime(selectedScenario)}</span>
                <span className="category-badge">{selectedScenario.category}</span>
              </div>
            </div>
            
            <p className="scenario-description-full">{selectedScenario.description}</p>
            
            {selectedScenario.learningOutcomes.length > 0 && (
              <div className="learning-outcomes-section">
                <h4>What You'll Learn</h4>
                <ul>
                  {selectedScenario.learningOutcomes.map((outcome, index) => (
                    <li key={index}>{outcome}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="objectives-section">
              <h4>Learning Objectives</h4>
              <ul>
                {selectedScenario.objectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </div>
            
            {selectedScenario.prerequisites.length > 0 && (
              <div className="prerequisites-section">
                <h4>Prerequisites</h4>
                <p>Complete these scenarios first:</p>
                <ul>
                  {selectedScenario.prerequisites.map((prereqId, index) => {
                    const prereqScenario = scenarios.find(s => s.id === prereqId);
                    const isCompleted = completedScenarios.includes(prereqId);
                    return (
                      <li key={index} className={isCompleted ? 'completed' : 'incomplete'}>
                        {isCompleted ? '✓' : '○'} {prereqScenario?.name || prereqId}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            
            {selectedScenario.tags.length > 0 && (
              <div className="tags-section">
                <h4>Tags</h4>
                <div className="tags-list">
                  {selectedScenario.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="scenario-actions">
              <button
                onClick={() => handleLoadScenario(selectedScenario.id)}
                className="load-scenario-button primary"
                disabled={!canAccessScenario(selectedScenario, completedScenarios)}
              >
                {canAccessScenario(selectedScenario, completedScenarios) 
                  ? 'Start Scenario' 
                  : 'Prerequisites Required'
                }
              </button>
              <button
                onClick={() => setSelectedScenario(null)}
                className="close-details-button secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};