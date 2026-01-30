import React, { useState, useEffect } from 'react';
import { Scenario } from '../types';
import { scenarioApi } from '../services/scenarioApi';
import './ScenarioLibrary.css';

interface ScenarioLibraryProps {
  onScenarioSelect: (scenario: Scenario) => void;
  onScenarioLoad: (scenarioId: string) => void;
  userId: string;
}

export const ScenarioLibrary: React.FC<ScenarioLibraryProps> = ({
  onScenarioSelect,
  onScenarioLoad,
  userId
}) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [recommendations, setRecommendations] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    loadScenarios();
    loadRecommendations();
  }, [userId, categoryFilter]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const scenarioData = await scenarioApi.getAllScenarios(categoryFilter || undefined);
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
    // Simple heuristic based on objectives count and complexity
    const objectiveCount = scenario.objectives.length;
    const hasComplexComponents = scenario.initialWorkspace.components?.some(
      comp => comp.type === 'message-queue' || comp.type === 'load-balancer'
    );

    if (objectiveCount <= 3 && !hasComplexComponents) return 'Beginner';
    if (objectiveCount <= 5) return 'Intermediate';
    return 'Advanced';
  };

  const getEstimatedTime = (scenario: Scenario): string => {
    const objectiveCount = scenario.objectives.length;
    const baseTime = 15; // minutes per objective
    return `${objectiveCount * baseTime} min`;
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
            <option value="basic">Basic</option>
            <option value="load">Load Balancing</option>
            <option value="cache">Caching</option>
            <option value="microservices">Microservices</option>
          </select>
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
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`scenario-card ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
              onClick={() => handleScenarioClick(scenario)}
            >
              <h4>{scenario.name}</h4>
              <p className="scenario-description">{scenario.description}</p>
              <div className="scenario-meta">
                <span className="difficulty">{getDifficultyLevel(scenario)}</span>
                <span className="time">{getEstimatedTime(scenario)}</span>
                <span className="objectives">{scenario.objectives.length} objectives</span>
              </div>
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
          ))}
        </div>
      </div>

      {selectedScenario && (
        <div className="scenario-details">
          <div className="scenario-details-content">
            <h3>{selectedScenario.name}</h3>
            <p>{selectedScenario.description}</p>
            
            <div className="objectives-section">
              <h4>Learning Objectives</h4>
              <ul>
                {selectedScenario.objectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </div>

            <div className="scenario-actions">
              <button
                onClick={() => handleLoadScenario(selectedScenario.id)}
                className="load-scenario-button primary"
              >
                Start Scenario
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