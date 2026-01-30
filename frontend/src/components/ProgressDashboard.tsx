import React, { useState, useEffect } from 'react';
import { Scenario } from '../types';
import './ProgressDashboard.css';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: Date;
}

interface ProgressStats {
  totalScenarios: number;
  completedScenarios: number;
  averageScore: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  timeSpent: number;
  achievements: Achievement[];
  currentLevel: number;
  nextLevelProgress: number;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
}

interface ProgressDashboardProps {
  userId: string;
  onScenarioSelect?: (scenarioId: string) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  userId,
  onScenarioSelect
}) => {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [recommendations, setRecommendations] = useState<Scenario[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'recommendations'>('overview');

  useEffect(() => {
    loadProgressData();
  }, [userId]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      
      // Load progress stats
      const statsResponse = await fetch(`/api/v1/progress/${userId}/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load recommendations
      const recommendationsResponse = await fetch(`/api/v1/progress/${userId}/recommendations`);
      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        setRecommendations(recommendationsData.data);
      }

      // Load current learning path
      const pathResponse = await fetch(`/api/v1/progress/${userId}/learning-path`);
      if (pathResponse.ok) {
        const pathData = await pathResponse.json();
        setLearningPath(pathData.data);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#666';
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return '#4CAF50';
    if (percentage >= 60) return '#FF9800';
    return '#F44336';
  };

  if (loading) {
    return (
      <div className="progress-dashboard loading">
        <div className="loading-spinner">Loading progress...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-dashboard error">
        <div className="error-message">
          <h3>Error Loading Progress</h3>
          <p>{error}</p>
          <button onClick={loadProgressData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="progress-dashboard">
        <div className="no-data">No progress data available</div>
      </div>
    );
  }
  return (
    <div className="progress-dashboard">
      <div className="dashboard-header">
        <h2>Learning Progress</h2>
        <div className="level-indicator">
          <span className="level-badge">Level {stats.currentLevel}</span>
          <div className="level-progress">
            <div 
              className="level-progress-bar" 
              style={{ width: `${stats.nextLevelProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements ({stats.achievements.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          Recommendations
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.completedScenarios}/{stats.totalScenarios}</div>
                  <div className="stat-label">Scenarios Completed</div>
                  <div className="stat-progress">
                    <div 
                      className="stat-progress-bar" 
                      style={{ 
                        width: `${(stats.completedScenarios / stats.totalScenarios) * 100}%`,
                        backgroundColor: getProgressColor((stats.completedScenarios / stats.totalScenarios) * 100)
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.averageScore}%</div>
                  <div className="stat-label">Average Score</div>
                  <div className="stat-progress">
                    <div 
                      className="stat-progress-bar" 
                      style={{ 
                        width: `${stats.averageScore}%`,
                        backgroundColor: getProgressColor(stats.averageScore)
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🏆</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalPoints}</div>
                  <div className="stat-label">Total Points</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🔥</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.currentStreak}</div>
                  <div className="stat-label">Current Streak</div>
                  <div className="stat-sublabel">Best: {stats.longestStreak}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-value">{formatTime(stats.timeSpent)}</div>
                  <div className="stat-label">Time Spent Learning</div>
                </div>
              </div>
            </div>

            {learningPath && (
              <div className="learning-path-section">
                <h3>Current Learning Path</h3>
                <div className="learning-path-card">
                  <div className="path-header">
                    <h4>{learningPath.name}</h4>
                    <span 
                      className="difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(learningPath.difficulty) }}
                    >
                      {learningPath.difficulty}
                    </span>
                  </div>
                  <p className="path-description">{learningPath.description}</p>
                  <div className="path-meta">
                    <span className="path-time">⏱️ {formatTime(learningPath.estimatedTime)}</span>
                    <span className="path-scenarios">📚 {learningPath.scenarios.length} scenarios</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'achievements' && (
          <div className="achievements-tab">
            <div className="achievements-grid">
              {stats.achievements.map((achievement) => (
                <div key={achievement.id} className="achievement-card unlocked">
                  <div className="achievement-icon">{achievement.icon}</div>
                  <div className="achievement-content">
                    <h4 className="achievement-name">{achievement.name}</h4>
                    <p className="achievement-description">{achievement.description}</p>
                    <div className="achievement-points">+{achievement.points} points</div>
                    {achievement.unlockedAt && (
                      <div className="achievement-date">
                        Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Show locked achievements as placeholders */}
              {stats.achievements.length < 8 && (
                <div className="achievement-card locked">
                  <div className="achievement-icon">🔒</div>
                  <div className="achievement-content">
                    <h4 className="achievement-name">More to Unlock</h4>
                    <p className="achievement-description">Keep learning to unlock more achievements!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="recommendations-tab">
            <h3>Recommended Next Steps</h3>
            
            {recommendations.length > 0 ? (
              <div className="recommendations-list">
                {recommendations.map((scenario) => (
                  <div key={scenario.id} className="recommendation-card">
                    <div className="recommendation-header">
                      <h4>{scenario.name}</h4>
                      <button 
                        className="start-scenario-button"
                        onClick={() => onScenarioSelect?.(scenario.id)}
                      >
                        Start
                      </button>
                    </div>
                    <p className="recommendation-description">{scenario.description}</p>
                    <div className="recommendation-objectives">
                      <h5>You'll learn:</h5>
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
            ) : (
              <div className="no-recommendations">
                <div className="completion-message">
                  <span className="completion-icon">🎉</span>
                  <h4>Congratulations!</h4>
                  <p>You've completed all available scenarios. Check back for new content!</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};