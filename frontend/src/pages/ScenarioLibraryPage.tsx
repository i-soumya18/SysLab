import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useSEO } from '../hooks/useSEO';
import { scenariosSEO } from '../config/seoPages';
import { scenarioApi } from '../services/scenarioApi';
import { progressApi } from '../services/progressApi';
import type { Scenario } from '../types';

export function ScenarioLibraryPage() {
  useSEO(scenariosSEO);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useFirebaseAuthContext();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>(searchParams.get('difficulty') || '');
  const [completedScenarios, setCompletedScenarios] = useState<string[]>([]);
  const [isLoadingScenario, setIsLoadingScenario] = useState<string | null>(null);

  // Fetch scenarios and user progress
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch scenarios
        const scenariosData = await scenarioApi.getAllScenarios(
          categoryFilter || undefined,
          difficultyFilter || undefined
        );
        setScenarios(scenariosData);

        // Fetch user progress to show completed scenarios
        // Note: ProgressStats only has count, not the list. We'll try to get it from stats
        // For now, we'll use an empty array and scenarios will still be accessible
        // In a full implementation, you'd have a separate endpoint to get completed scenario IDs
        try {
          await progressApi.getProgressStats(user.uid);
          // ProgressStats doesn't include the list of completed scenario IDs
          // This would need a separate API endpoint in a full implementation
          // For now, we'll leave it empty and scenarios will still work
          setCompletedScenarios([]);
        } catch (err) {
          // Progress fetch is optional, don't fail if it errors
          console.warn('Failed to fetch user progress:', err);
          setCompletedScenarios([]);
        }
      } catch (err) {
        console.error('Error fetching scenarios:', err);
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('Unable to connect to server. Please make sure the backend is running.');
        } else if (err instanceof Error) {
          setError(err.message || 'Failed to load scenarios. Please try again.');
        } else {
          setError('Failed to load scenarios. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, categoryFilter, difficultyFilter]);

  // Filter scenarios based on search query (difficulty and category are already filtered by API)
  const filteredScenarios = scenarios.filter(scenario => {
    if (!searchQuery) return true;
    
    return (
      scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      scenario.learningOutcomes.some(outcome => outcome.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleStartScenario = async (scenarioId: string) => {
    if (!user) return;

    try {
      setIsLoadingScenario(scenarioId);
      
      // Load scenario and create workspace
      const { workspace } = await scenarioApi.loadScenario(scenarioId, user.uid);
      
      // Navigate to the workspace
      navigate(`/workspace/${workspace.id}`);
    } catch (err) {
      console.error('Error loading scenario:', err);
      setError(err instanceof Error ? err.message : 'Failed to start scenario. Please try again.');
      setIsLoadingScenario(null);
    }
  };

  const getDifficultyColor = (difficulty: string): { bg: string; text: string } => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'intermediate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
      case 'advanced':
        return { bg: 'bg-orange-100', text: 'text-orange-800' };
      case 'expert':
        return { bg: 'bg-purple-100', text: 'text-purple-800' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  const getCategoryDisplayName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'fundamentals': 'Fundamentals',
      'scaling': 'Scaling',
      'reliability': 'Reliability',
      'performance': 'Performance',
      'cost-optimization': 'Cost Optimization',
      'distributed-systems': 'Distributed Systems',
      'data-systems': 'Data Systems',
      'real-time': 'Real-Time Systems'
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const canAccessScenario = (scenario: Scenario): boolean => {
    if (scenario.prerequisites.length === 0) return true;
    return scenario.prerequisites.every(prereq => completedScenarios.includes(prereq));
  };

  // Get unique categories from scenarios
  const categories = Array.from(new Set(scenarios.map(s => s.category))).sort();
  const difficulties: Array<'beginner' | 'intermediate' | 'advanced' | 'expert'> = 
    ['beginner', 'intermediate', 'advanced', 'expert'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Scenario Library</h1>
            <p className="mt-2 text-sm text-gray-600">
              {filteredScenarios.length} {filteredScenarios.length === 1 ? 'scenario' : 'scenarios'} available
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {getCategoryDisplayName(category)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="difficulty-filter" className="text-sm font-medium text-gray-700">
              Difficulty:
            </label>
            <select
              id="difficulty-filter"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              {difficulties.map(difficulty => (
                <option key={difficulty} value={difficulty}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading scenarios...</div>
        </div>
      ) : filteredScenarios.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {searchQuery || categoryFilter || difficultyFilter ? 'No scenarios found' : 'No scenarios available'}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery || categoryFilter || difficultyFilter
              ? 'Try adjusting your filters'
              : 'Scenarios will appear here once they are added to the system'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredScenarios.map((scenario) => {
            const difficultyColors = getDifficultyColor(scenario.difficulty);
            const isCompleted = completedScenarios.includes(scenario.id);
            const isAccessible = canAccessScenario(scenario);
            const isLoading = isLoadingScenario === scenario.id;

            return (
              <div
                key={scenario.id}
                className={`group rounded-xl border-2 bg-white p-6 text-left shadow-sm transition-all hover:shadow-lg ${
                  isAccessible
                    ? 'border-gray-200 hover:border-blue-500'
                    : 'border-gray-100 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${difficultyColors.bg} ${difficultyColors.text}`}>
                        {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
                      </span>
                      {isCompleted && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          Completed
                        </span>
                      )}
                      {!isAccessible && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          Locked
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                      {scenario.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                      {scenario.description}
                    </p>
                  </div>
                </div>

                {/* Category and Time */}
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {getCategoryDisplayName(scenario.category)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {scenario.estimatedTimeMinutes} min
                  </span>
                </div>

                {/* Tags */}
                {scenario.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {scenario.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                    {scenario.tags.length > 3 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        +{scenario.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Learning Outcomes Preview */}
                {scenario.learningOutcomes.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">You'll learn:</p>
                    <ul className="space-y-1">
                      {scenario.learningOutcomes.slice(0, 2).map((outcome, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                          <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{outcome}</span>
                        </li>
                      ))}
                      {scenario.learningOutcomes.length > 2 && (
                        <li className="text-xs text-gray-500">
                          +{scenario.learningOutcomes.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Prerequisites Warning */}
                {!isAccessible && scenario.prerequisites.length > 0 && (
                  <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                    <p className="text-xs font-medium text-yellow-800 mb-1">Prerequisites required:</p>
                    <p className="text-xs text-yellow-700">
                      Complete {scenario.prerequisites.length} {scenario.prerequisites.length === 1 ? 'scenario' : 'scenarios'} first
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-6">
                  <button
                    onClick={() => handleStartScenario(scenario.id)}
                    disabled={!isAccessible || isLoading}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      isAccessible
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                      </span>
                    ) : isCompleted ? (
                      'Start Again'
                    ) : (
                      'Start Scenario'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
