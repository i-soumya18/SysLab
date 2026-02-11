/**
 * Version History Component
 * Handles workspace versioning and history tracking per SRS FR-1.3
 */

import React, { useState, useEffect } from 'react';
import { VersionApiService, type WorkspaceVersion, type CreateVersionRequest, type PerformanceComparison } from '../services/versionApi';

interface VersionHistoryProps {
  workspaceId: string;
  userId: string;
  onClose: () => void;
  onRestoreVersion?: (restoredWorkspace: any) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  workspaceId,
  userId,
  onClose,
  onRestoreVersion
}) => {
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create version form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadVersions();
  }, [workspaceId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { versions: versionData } = await VersionApiService.getWorkspaceVersions(workspaceId, {
        limit: 50,
        includeMetrics: true
      });

      setVersions(versionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const request: CreateVersionRequest = {
        workspaceId,
        name: createForm.name,
        description: createForm.description || undefined,
        createdBy: userId
      };

      await VersionApiService.createVersion(request);
      await loadVersions(); // Refresh the list
      
      // Reset form and hide it
      setCreateForm({ name: '', description: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    try {
      const restoredWorkspace = await VersionApiService.restoreToVersion(workspaceId, versionId, userId);
      if (onRestoreVersion) {
        onRestoreVersion(restoredWorkspace);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version');
    }
  };

  const handleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        // Replace the first selected version
        return [prev[1], versionId];
      }
    });
  };

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) return;

    try {
      const comparisonResult = await VersionApiService.compareVersions(
        selectedVersions[0],
        selectedVersions[1]
      );
      setComparison(comparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare versions');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getVersionBadgeColor = (versionNumber: number) => {
    if (versionNumber === 1) return 'bg-blue-100 text-blue-800';
    if (versions.length > 0 && versionNumber === versions[0].versionNumber) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading version history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Version History</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Version
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Version Form */}
        {showCreateForm && (
          <div className="mx-6 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Version</h3>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version Name *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Added caching layer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe the changes made in this version..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Version
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Version Comparison Controls */}
        {selectedVersions.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-800">
                  {selectedVersions.length === 1 
                    ? 'Select one more version to compare'
                    : `Comparing ${selectedVersions.length} versions`
                  }
                </p>
              </div>
              <div className="flex space-x-2">
                {selectedVersions.length === 2 && (
                  <button
                    onClick={handleCompareVersions}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Compare Versions
                  </button>
                )}
                <button
                  onClick={() => setSelectedVersions([])}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex h-[60vh]">
          {/* Versions List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Versions ({versions.length})
              </h3>
              
              {versions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No versions created yet.</p>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedVersions.includes(version.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleVersionSelection(version.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVersionBadgeColor(version.versionNumber)}`}>
                              v{version.versionNumber}
                            </span>
                            <h4 className="font-medium text-gray-900">{version.name}</h4>
                          </div>
                          {version.description && (
                            <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                          )}
                          <div className="text-xs text-gray-500">
                            <p>Created: {formatDate(version.createdAt)}</p>
                            <p>By: {version.createdBy}</p>
                            <p>Components: {version.snapshot.components.length}</p>
                            <p>Connections: {version.snapshot.connections.length}</p>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreVersion(version.id);
                            }}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            Restore
                          </button>
                          {selectedVersions.includes(version.id) && (
                            <div className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded text-center">
                              Selected
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comparison Results */}
          <div className="w-1/2 overflow-y-auto">
            <div className="p-6">
              {comparison ? (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Version Comparison</h3>
                  
                  <div className="space-y-6">
                    {/* Comparison Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                      <p className="text-sm text-gray-700">{comparison.summary}</p>
                    </div>

                    {/* Overall Improvements */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Overall Performance Changes</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 p-3 rounded">
                          <div className="text-sm text-gray-600">Latency</div>
                          <div className={`text-lg font-semibold ${
                            comparison.overallImprovement.latencyChange < 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {comparison.overallImprovement.latencyChange > 0 ? '+' : ''}
                            {comparison.overallImprovement.latencyChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-3 rounded">
                          <div className="text-sm text-gray-600">Throughput</div>
                          <div className={`text-lg font-semibold ${
                            comparison.overallImprovement.throughputChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {comparison.overallImprovement.throughputChange > 0 ? '+' : ''}
                            {comparison.overallImprovement.throughputChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-3 rounded">
                          <div className="text-sm text-gray-600">Error Rate</div>
                          <div className={`text-lg font-semibold ${
                            comparison.overallImprovement.errorRateChange < 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {comparison.overallImprovement.errorRateChange > 0 ? '+' : ''}
                            {comparison.overallImprovement.errorRateChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-3 rounded">
                          <div className="text-sm text-gray-600">Resource Efficiency</div>
                          <div className={`text-lg font-semibold ${
                            comparison.overallImprovement.resourceEfficiencyChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {comparison.overallImprovement.resourceEfficiencyChange > 0 ? '+' : ''}
                            {comparison.overallImprovement.resourceEfficiencyChange.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottleneck Analysis */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Bottleneck Analysis</h4>
                      <div className="space-y-3">
                        {comparison.bottleneckAnalysis.resolved.length > 0 && (
                          <div className="bg-green-50 border border-green-200 p-3 rounded">
                            <div className="text-sm font-medium text-green-800 mb-1">
                              Resolved Bottlenecks ({comparison.bottleneckAnalysis.resolved.length})
                            </div>
                            <div className="text-sm text-green-700">
                              Successfully resolved previous performance issues.
                            </div>
                          </div>
                        )}
                        {comparison.bottleneckAnalysis.introduced.length > 0 && (
                          <div className="bg-red-50 border border-red-200 p-3 rounded">
                            <div className="text-sm font-medium text-red-800 mb-1">
                              New Bottlenecks ({comparison.bottleneckAnalysis.introduced.length})
                            </div>
                            <div className="text-sm text-red-700">
                              New performance issues have been introduced.
                            </div>
                          </div>
                        )}
                        {comparison.bottleneckAnalysis.persisting.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                            <div className="text-sm font-medium text-yellow-800 mb-1">
                              Persisting Bottlenecks ({comparison.bottleneckAnalysis.persisting.length})
                            </div>
                            <div className="text-sm text-yellow-700">
                              These performance issues remain unresolved.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {comparison.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                        <ul className="space-y-2">
                          {comparison.recommendations.map((recommendation, index) => (
                            <li key={index} className="flex items-start">
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                              <span className="text-sm text-gray-700">{recommendation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Comparison Selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Select two versions to compare their performance and changes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};