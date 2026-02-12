import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { progressApi } from '../services/progressApi';
import type { ProgressStats } from '../services/progressApi';
import { WorkspaceApiService } from '../services/workspaceApi';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  components?: any[];
  connections?: any[];
}

interface WorkspaceListResponse {
  success: boolean;
  data: Workspace[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Use a relative default so the frontend can talk to the backend
// through the same origin (e.g. the Nginx gateway on :8080 in Docker).
// Use environment variable for API URL, fallback to relative path
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logoutUser } = useFirebaseAuthContext();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isDeletingWorkspaceId, setIsDeletingWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user workspaces
  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      try {
        setIsLoadingWorkspaces(true);
        const result = await WorkspaceApiService.listWorkspaces({
          userId: user.uid,
          limit: 6,
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        });
        setWorkspaces(result.data);
        setError(null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching workspaces:', err);
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('Unable to connect to server. Please make sure the backend is running.');
        } else if (err instanceof Error) {
          setError(err.message || 'Failed to load workspaces. Please try again.');
        } else {
          setError('Failed to load workspaces. Please try again.');
        }
      } finally {
        setIsLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  // Fetch progress stats
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        const stats = await progressApi.getProgressStats(user.uid);
        setProgressStats(stats);
      } catch (err) {
        console.error('Error fetching progress stats:', err);
        // Don't show error for stats - they're optional
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleCreateWorkspace = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `New Workspace ${new Date().toLocaleDateString()}`,
          description: 'A new system design workspace',
          userId: user.uid,
          components: [],
          connections: [],
          configuration: {}
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const result = await response.json();
      const newWorkspace = result.data;

      // Navigate to the new workspace
      navigate(`/workspace/${newWorkspace.id}`);
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError('Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string, workspaceName: string): Promise<void> => {
    if (!user) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the workspace "${workspaceName}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingWorkspaceId(workspaceId);
      await WorkspaceApiService.deleteWorkspace(workspaceId, user.uid);
      setWorkspaces(prev => prev.filter(workspace => workspace.id !== workspaceId));
      if (error) {
        setError(null);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error deleting workspace:', err);
      if (err instanceof Error) {
        setError(
          err.message ||
            'Failed to delete workspace. Please try again or refresh the page.'
        );
      } else {
        setError('Failed to delete workspace. Please try again or refresh the page.');
      }
    } finally {
      setIsDeletingWorkspaceId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const formatTimeSpent = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getInitials = (name: string | null): string => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.displayName || user?.email?.split('@')[0] || 'there'}!
          </h1>
          <p className="mt-2 text-gray-600">
            Build a system. Scale it. Watch it break. Fix it. Repeat.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Workspaces</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {isLoadingWorkspaces ? '...' : workspaces.length}
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scenarios Completed</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {isLoadingStats ? '...' : progressStats?.completedScenarios || 0}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Spent</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {isLoadingStats ? '...' : formatTimeSpent(progressStats?.timeSpent || 0)}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Level</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {isLoadingStats ? '...' : progressStats?.currentLevel || 1}
                </p>
              </div>
              <div className="rounded-full bg-orange-100 p-3">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={handleCreateWorkspace}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 shadow-md"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Workspace
          </button>

          <button
            onClick={() => navigate('/components')}
            className="flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-6 py-3 font-semibold text-blue-600 hover:bg-blue-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Browse Components
          </button>

          <button
            onClick={() => navigate('/getting-started')}
            className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Getting Started
          </button>
        </div>

        {/* Recent Workspaces */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Recent Workspaces</h2>
            {workspaces.length > 0 && (
              <button
                onClick={() => {
                  // TODO: Navigate to all workspaces page
                  alert('View all workspaces coming soon!');
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All →
              </button>
            )}
          </div>

          {isLoadingWorkspaces ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading workspaces...</div>
            </div>
          ) : workspaces.length === 0 ? (
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
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No workspaces yet</h3>
              <p className="mt-2 text-sm text-gray-600">
                Get started by creating your first system design workspace
              </p>
              <button
                onClick={handleCreateWorkspace}
                className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${workspace.id}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                          {workspace.name}
                        </h3>
                        {workspace.description && (
                          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {workspace.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          {workspace.components?.length || 0} components
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {workspace.connections?.length || 0} connections
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      Updated {new Date(workspace.updatedAt).toLocaleDateString()}
                    </div>
                  </button>

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                      disabled={isDeletingWorkspaceId === workspace.id}
                      className="inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeletingWorkspaceId === workspace.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scenario Library Preview */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Scenario Library</h2>
              <p className="mt-1 text-sm text-gray-600">
                Pre-built challenges to test your system design skills
              </p>
            </div>
            <button
              onClick={() => {
                // TODO: Navigate to scenario library
                alert('Full scenario library coming soon!');
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Browse All
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Beginner
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Simple Web App</h3>
              <p className="mt-1 text-xs text-gray-600">
                Design a basic web application that can handle 1,000 concurrent users
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                  Intermediate
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Social Media Feed</h3>
              <p className="mt-1 text-xs text-gray-600">
                Build a real-time feed system that scales to millions of users
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                  Advanced
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Global CDN Network</h3>
              <p className="mt-1 text-xs text-gray-600">
                Design a globally distributed content delivery system
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
