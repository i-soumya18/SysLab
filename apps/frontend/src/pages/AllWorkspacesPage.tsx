import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useSEO } from '../hooks/useSEO';
import { workspacesSEO } from '../config/seoPages';
import { WorkspaceApiService, type WorkspaceSummary } from '../services/workspaceApi';

const ITEMS_PER_PAGE = 12;

export function AllWorkspacesPage() {
  useSEO(workspacesSEO);
  
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalWorkspaces, setTotalWorkspaces] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isDeletingWorkspaceId, setIsDeletingWorkspaceId] = useState<string | null>(null);
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Fetch workspaces with pagination
  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const offset = (currentPage - 1) * ITEMS_PER_PAGE;
        const result = await WorkspaceApiService.listWorkspaces({
          userId: user.uid,
          search: searchQuery || undefined,
          limit: ITEMS_PER_PAGE,
          offset,
          sortBy,
          sortOrder
        });

        setWorkspaces(result.data);
        setTotalWorkspaces(result.pagination.total);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('Unable to connect to server. Please make sure the backend is running.');
        } else if (err instanceof Error) {
          setError(err.message || 'Failed to load workspaces. Please try again.');
        } else {
          setError('Failed to load workspaces. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, [user, currentPage, searchQuery, sortBy, sortOrder]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const handleDeleteWorkspace = async (workspaceId: string, workspaceName: string): Promise<void> => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the workspace "${workspaceName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsDeletingWorkspaceId(workspaceId);
      await WorkspaceApiService.deleteWorkspace(workspaceId, user.uid);
      
      // Remove from current list
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      setTotalWorkspaces(prev => Math.max(0, prev - 1));
      
      // If current page becomes empty and not page 1, go to previous page
      if (workspaces.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to delete workspace. Please try again.');
      } else {
        setError('Failed to delete workspace. Please try again.');
      }
    } finally {
      setIsDeletingWorkspaceId(null);
    }
  };

  const handleRenameWorkspace = async (workspaceId: string, currentName: string): Promise<void> => {
    if (!user) return;

    setRenamingWorkspaceId(workspaceId);
    setNewWorkspaceName(currentName);
  };

  const handleConfirmRename = async (workspaceId: string): Promise<void> => {
    if (!user || !newWorkspaceName.trim()) return;

    if (newWorkspaceName.trim() === workspaces.find(w => w.id === workspaceId)?.name) {
      setRenamingWorkspaceId(null);
      setNewWorkspaceName('');
      return;
    }

    try {
      const updatedWorkspace = await WorkspaceApiService.renameWorkspace(
        workspaceId,
        newWorkspaceName.trim(),
        user.uid
      );

      // Update the workspace in the list
      setWorkspaces(prev =>
        prev.map(w => (w.id === workspaceId ? { ...w, name: updatedWorkspace.name } : w))
      );

      setRenamingWorkspaceId(null);
      setNewWorkspaceName('');
      setError(null);
    } catch (err) {
      console.error('Error renaming workspace:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to rename workspace. Please try again.');
      } else {
        setError('Failed to rename workspace. Please try again.');
      }
    }
  };

  const handleCancelRename = (): void => {
    setRenamingWorkspaceId(null);
    setNewWorkspaceName('');
  };

  const handleCreateWorkspace = async () => {
    if (!user) return;

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Untitled Workspace',
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

  const totalPages = Math.ceil(totalWorkspaces / ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Workspaces</h1>
            <p className="mt-2 text-sm text-gray-600">
              {totalWorkspaces} {totalWorkspaces === 1 ? 'workspace' : 'workspaces'} total
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

      {/* Search and Sort Controls */}
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
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="sort-by" className="text-sm font-medium text-gray-700">
              Sort by:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'createdAt' | 'updatedAt')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="updatedAt">Last Updated</option>
              <option value="createdAt">Date Created</option>
              <option value="name">Name</option>
            </select>
          </div>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortOrder === 'asc' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          <button
            onClick={handleCreateWorkspace}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-md"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Workspace
          </button>
        </div>
      </div>

      {/* Workspaces Grid */}
      {isLoading ? (
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
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {searchQuery ? 'No workspaces found' : 'No workspaces yet'}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Get started by creating your first system design workspace'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateWorkspace}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
            >
              Create Workspace
            </button>
          )}
        </div>
      ) : (
        <>
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
                        {workspace.componentCount || 0} components
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {workspace.connectionCount || 0} connections
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-500">
                    Updated {new Date(workspace.updatedAt).toLocaleDateString()}
                  </div>
                </button>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameWorkspace(workspace.id, workspace.name);
                    }}
                    disabled={isDeletingWorkspaceId === workspace.id}
                    className="inline-flex items-center rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(workspace.id, workspace.name);
                    }}
                    disabled={isDeletingWorkspaceId === workspace.id}
                    className="inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingWorkspaceId === workspace.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalWorkspaces)} of {totalWorkspaces} workspaces
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rename Modal */}
      {renamingWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900">Rename Workspace</h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter a new name for your workspace
            </p>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Workspace name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmRename(renamingWorkspaceId);
                } else if (e.key === 'Escape') {
                  handleCancelRename();
                }
              }}
            />
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelRename}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmRename(renamingWorkspaceId)}
                disabled={!newWorkspaceName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
